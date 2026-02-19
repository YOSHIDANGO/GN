// assets/js/scenes/FieldScene.js
import { makeEncounterCounter, addSteps, pickGuestId } from '../util/encounter.js';
import { loadSave, storeSave } from '../core/save.js';
import { EventQueue } from '../core/eventQueue.js';

export class FieldScene extends Phaser.Scene {
  constructor(){ super('Field'); }

  create(){
    // =========================
    // save init
    // =========================
    this.state = loadSave();
    if (!this.state){
      this.state = {
        player: { name:'レイ', hp:100, maxHp:100, atk:16, def:8, spd:10, crit:0.07, eva:0.05 },
        flags: { firstDayIntroShown:false, openingShown:false, bossUnlocked:false },
        progress: {
          nomination:0,
          nextEventAt:2,         // 互換用（いまは使わなくても残す）
          defeatedCabajo:{},

          // ★キャバ嬢解禁管理
          cabajoUnlocked:{},     // enemyId -> true
          cabajoStage:0,         // 0..8（解禁済み人数）
          pendingUnlockEnemyId:null
        },
        fieldPos: null,
        lastBattle: null
      };
      storeSave(this.state);
    }

    if (!this.state.flags){
      this.state.flags = { firstDayIntroShown:false, openingShown:false, bossUnlocked:false };
    }

    // ★エンディング用フラグの初期化（保険）
    if (!('endingPending' in this.state.flags)){
      this.state.flags.endingPending = false;
    }

    // ★進行データ（指名/撃破/次イベント）
    if (!this.state.progress){
      this.state.progress = {
        nomination:0,
        nextEventAt:2,
        defeatedCabajo:{},
        cabajoUnlocked:{},
        cabajoStage:0,
        pendingUnlockEnemyId:null
      };
      storeSave(this.state);
    }
    if (typeof this.state.progress.nomination !== 'number') this.state.progress.nomination = 0;
    if (typeof this.state.progress.nextEventAt !== 'number') this.state.progress.nextEventAt = 2;
    if (!this.state.progress.defeatedCabajo) this.state.progress.defeatedCabajo = {};

    // ★キャバ嬢解禁管理（追加）
    if (!this.state.progress.cabajoUnlocked) this.state.progress.cabajoUnlocked = {};
    if (typeof this.state.progress.cabajoStage !== 'number') this.state.progress.cabajoStage = 0; // 0..8
    if (!('pendingUnlockEnemyId' in this.state.progress)) this.state.progress.pendingUnlockEnemyId = null;

    if (!('fieldPos' in this.state)) this.state.fieldPos = null;
    if (!('lastBattle' in this.state)) this.state.lastBattle = null;

    // =========================
    // inside spots + cabajo order
    // =========================
    this._initInsideSpots();

    // 指名2/4/6.. の解禁順（enemyId）
    this.cabajoOrder = ['mio','yuna','saki','eri','rina','mako','aya','karen'];

    // ★cabajoStage から cabajoUnlocked を復元（ズレ防止）
    {
      const p = this.state.progress;
      const stage = Phaser.Math.Clamp(p.cabajoStage ?? 0, 0, this.cabajoOrder.length);
      for (let i=0; i<stage; i++){
        const id = this.cabajoOrder[i];
        p.cabajoUnlocked[id] = true;
      }
      storeSave(this.state);
    }

    // =========================
    // mode / restore position
    // =========================
    this.mode = 'outside'; // outside | inside

    // 背景（COVER）
    this.bgOutside = this.add.image(0, 0, 'bg_susukino_night_01').setOrigin(0.5,0.5);
    this.bgInside  = this.add.image(0, 0, 'bg_shop_inside').setOrigin(0.5,0.5).setVisible(false);

    // Player
    this.player = this.add.sprite(640, 620, 'rei_field', 0);
    this.player.setOrigin(0.5, 1);
    this.player.setScale(0.55);

    // ★バトル後に外の初期位置へ戻るのを防ぐ（最後の座標/モードを復元）
    if (this.state.fieldPos){
      const fp = this.state.fieldPos;
      if (fp && typeof fp.x === 'number' && typeof fp.y === 'number'){
        this.player.setPosition(fp.x, fp.y);
      }
      if (fp?.mode === 'inside' || fp?.mode === 'outside'){
        this.mode = fp.mode;
      }
    }

    // 表示モード反映
    this.bgOutside.setVisible(this.mode === 'outside');
    this.bgInside.setVisible(this.mode === 'inside');

    this.target = new Phaser.Math.Vector2(this.player.x, this.player.y);

    // zones（ワールド基準 1280x720 のまま）
    this.doorZoneOutside = new Phaser.Geom.Rectangle(60, 420, 180, 220);
    this.doorZoneInside  = new Phaser.Geom.Rectangle(60, 420, 180, 240);

    // =========================
    // ★outside walkable（通路＋赤階段のみ歩ける）
    // =========================
    this._initWalkableOutside();

    // =========================
    // ★入力消費フラグ（ドア/NPCタップ時に通常移動を止める）
    // =========================
    this._pointerConsumed = false;

    // タップ移動
    this.modalOpen = false;

    // ★resume理由（Dialogueから戻った時だけ resume処理を走らせる）
    this._resumeReason = '';

    // =========================
    // 演出 / FX
    // =========================
    this._sceneTransitioning = false;
    this._initFxLayers();

    // 入場フェード（復帰も含めて軽く）
    this.cameras.main.fadeIn(140, 0,0,0);

    // ★通常の移動は1フレーム遅らせて、ドア側が消費してたらキャンセル
    this.input.on('pointerdown', (p)=> {
      if (this.modalOpen) return;

      const wx = p.worldX;
      const wy = p.worldY;

      // ★足元リング
      this._spawnTapRing(wx, wy);

      this.time.delayedCall(0, ()=> {
        if (this.modalOpen) return;
        if (this._pointerConsumed){
          this._pointerConsumed = false;
          return;
        }

        // ★outside は「歩ける場所に吸着」
        if (this.mode === 'outside'){
          const pt = this._clampToWalkableOutside(wx, wy);
          this._setTarget(pt.x, pt.y);
        } else {
          this._setTarget(wx, wy);
        }
      });
    });

    // キー（PC保険）
    this.keys = this.input.keyboard.addKeys('E,F,ONE,TWO,THREE,ESC,SPACE');

    // 会話アイコン（演出用）
    this.talkIcon = this.add.text(0, 0, '▼', {
      fontSize:'20px',
      color:'#ffffff'
    }).setShadow(2,2,'#000',2).setVisible(false);

    this.talkIcon.setDepth(9999);

    this.counter = makeEncounterCounter();

    // Player anims（12フレーム前提ガード）
    const tex = this.textures.get('rei_field');
    const total = tex?.frameTotal || 0;
    if (total >= 12){
      if (!this.anims.exists('rei_down')){
        this.anims.create({ key:'rei_down', frames:this.anims.generateFrameNumbers('rei_field',{start:0,end:3}), frameRate:8, repeat:-1 });
      }
      if (!this.anims.exists('rei_left')){
        this.anims.create({ key:'rei_left', frames:this.anims.generateFrameNumbers('rei_field',{start:4,end:7}), frameRate:8, repeat:-1 });
      }
      if (!this.anims.exists('rei_up')){
        this.anims.create({ key:'rei_up', frames:this.anims.generateFrameNumbers('rei_field',{start:8,end:11}), frameRate:8, repeat:-1 });
      }
    }

    // =========================
    // post dialogue action (boy menu / rematch menu)
    // =========================
    this.postDialogueAction = null; // { type:'boy', npc } | { type:'rematch', enemyId }

    // toast
    this.toastText = null;

    // =========================
    // NPC defs
    // =========================
    this.npcs = [];
    this.npcDefs = {
      outside: [
        { id:'mob_m_1', key:'mob_m', script:'npc_mob_m_1', variant:0 },
        { id:'mob_m_2', key:'mob_m', script:'npc_mob_m_2', variant:1 },
        { id:'mob_m_3', key:'mob_m', script:'npc_mob_m_3', variant:2 },
        { id:'mob_m_4', key:'mob_m', script:'npc_mob_m_4', variant:3 },

        { id:'mob_f_1', key:'mob_f', script:'npc_mob_f_1', variant:0 },
        { id:'mob_f_2', key:'mob_f', script:'npc_mob_f_2', variant:1 },
        { id:'mob_f_3', key:'mob_f', script:'npc_mob_f_3', variant:2 },
        { id:'mob_f_4', key:'mob_f', script:'npc_mob_f_4', variant:3 },
      ],
      inside: [
        // ---- cabajo (right side) ----
        { id:'npc_cabajo_1', key:'cabajo_symbol1', script:'npc_cabajo_1', variant:0, spot:'rf1', enemyId:'mio'   },
        { id:'npc_cabajo_2', key:'cabajo_symbol1', script:'npc_cabajo_2', variant:1, spot:'rm2', enemyId:'yuna'  },
        { id:'npc_cabajo_3', key:'cabajo_symbol1', script:'npc_cabajo_3', variant:2, spot:'bar3', enemyId:'saki'  }, // ★上へ
        { id:'npc_cabajo_4', key:'cabajo_symbol1', script:'npc_cabajo_4', variant:3, spot:'rb2', enemyId:'eri'   },
        { id:'npc_cabajo_5', key:'cabajo_symbol2', script:'npc_cabajo_5', variant:0, spot:'bar2', enemyId:'rina'  }, // ★上へ
        { id:'npc_cabajo_6', key:'cabajo_symbol2', script:'npc_cabajo_6', variant:1, spot:'rm3', enemyId:'mako'  },
        { id:'npc_cabajo_7', key:'cabajo_symbol2', script:'npc_cabajo_7', variant:2, spot:'rb1', enemyId:'aya'   },
        { id:'npc_cabajo_8', key:'cabajo_symbol2', script:'npc_cabajo_8', variant:3, spot:'bar1', enemyId:'karen' }, // ★上へ

        // ---- boys (left side) ----
        { id:'boy_1', key:'npc_boy', script:'npc_boy_1', variant:0, spot:'boyL1' },
        { id:'boy_2', key:'npc_boy', script:'npc_boy_2', variant:1, spot:'boyL3' },
      ]
    };

    // NPC配置（outsideのみランダム）
    this._initNpcSpawnParams();
    this._fitBackgrounds();
    this._initWalkableOutside();
    this._spawnNPCs(this.mode);
    this._startNpcWander();

    // doors
    this._makeDoorHints();

    // ボーイメニュー
    this._makeBoyMenu();

    // 再戦メニュー
    this._makeRematchMenu();

    // 背景COVER & リサイズ追従
    this._onResize = () => this.time.delayedCall(0, () => {
      this._fitBackgrounds();
      this._initWalkableOutside(); // これ追加
      this._relayoutMenus();
      this._relayoutDoorHints();
      this._relayoutRematchMenu?.();
      this._relayoutToast?.();
    });
    this.scale.on('resize', this._onResize);

    // =========================
    // Event Queue
    // =========================
    this.ev = new EventQueue(this);

    // Dialogueが閉じて Field が resume されたら、次のイベントへ
    this.events.on('resume', () => {

        // ★ここ：reason判定より前に “強制掃除”
        for (const key of ['Club', 'ClubResult']){
            if (this.scene.isActive(key) || this.scene.isPaused(key) || this.scene.isVisible(key)){
            this.scene.stop(key);
            }
        }
        if (this.scene.isPaused('Field')) this.scene.resume('Field');
        this.scene.bringToTop('Field');

        const reason = this._resumeReason || '';
        this._resumeReason = '';

      // ★Dialogueから戻った時だけ、会話後処理を走らせる
      if (reason !== 'dialogue') return;

      if (this.ev && this.ev.running) {
        this.ev.resume();
      }

      // ★会話後に解禁反映（入店イベント→出現）
      if (this.mode === 'inside'){
        const p = this.state?.progress;
        const id = p?.pendingUnlockEnemyId;
        if (id){
          p.cabajoUnlocked[id] = true;
          p.pendingUnlockEnemyId = null;
          storeSave(this.state);

          this._spawnNPCs('inside'); // 出現更新
          this._startNpcWander();
        }
      }

      // ★会話後アクション
      if (this.postDialogueAction){
        const act = this.postDialogueAction;
        this.postDialogueAction = null;

        if (act.type === 'boy'){
          this._openBoyMenu(act.npc);
          return;
        }
        if (act.type === 'rematch'){
          this._openRematchMenu(act.enemyId);
          return;
        }
      }

      // ★エンディング判定（カレン後）
      if (this.state?.flags?.endingPending){
        this.state.flags.endingPending = false;
        storeSave(this.state);

        // エンディング開始
        this.scene.pause();
        this.scene.launch('Ending', { returnTo: 'Title' });
        this.scene.bringToTop('Ending');
        return;
      }
    });

    // shutdown cleanup
    this.events.once('shutdown', ()=>{
      if (this.npcWanderTimer) this.npcWanderTimer.remove(false);
      if (this._onResizeMenu) this.scale.off('resize', this._onResizeMenu);
      if (this._onResize) this.scale.off('resize', this._onResize);
      if (this._relayoutRematchMenu) this.scale.off('resize', this._relayoutRematchMenu);
      if (this.ev) this.ev.running = false;
      if (this.toastText) this.toastText.destroy();

      // FX
      if (this._neonPulseTimer) this._neonPulseTimer.remove(false);
      if (this._neonPulseTimer2) this._neonPulseTimer2.remove(false);
      if (this.snow) this.snow.destroy();
      if (this.neonOutside) this.neonOutside.destroy();
      if (this.neonInside) this.neonInside.destroy();
    });

    // =========================
    // Field entry events（ここだけ）
    // =========================
    this._runFieldEntryEvents();

    // 初期表示のFX状態
    this._applyFxVisibilityByMode();
  }

  // =========================
  // 演出 / FX
  // =========================
  _initFxLayers(){
    // ターゲット到達判定用
    this._targetActive = false;
    this._arrivedFxDone = false;

    // ---------- 遠景ネオンゆらぎ ----------
    const makeNeon = () => {
      const g = this.add.graphics().setDepth(1);
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 1280, 720);
      g.setAlpha(0.06);
      g.setBlendMode(Phaser.BlendModes.ADD);
      g.setScrollFactor(0); // 背景に貼る扱い
      g.setVisible(false);
      return g;
    };

    this.neonOutside = makeNeon();
    this.neonInside  = makeNeon();

    const flicker = (obj) => {
      this.tweens.add({
        targets: obj,
        alpha: { from: 0.03, to: 0.085 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 450)
      });

      const t = this.time.addEvent({
        delay: 1100,
        loop: true,
        callback: () => {
          if (!obj.visible) return;
          if (Math.random() < 0.18){
            this.tweens.add({
              targets: obj,
              alpha: { from: obj.alpha, to: Math.min(0.16, obj.alpha + 0.06) },
              duration: 90,
              yoyo: true
            });
          }
        }
      });
      return t;
    };

    this._neonPulseTimer = flicker(this.neonOutside);
    this._neonPulseTimer2 = flicker(this.neonInside);

    // ---------- 雪 ----------
    if (!this.textures.exists('fx_snow_dot')){
      const gg = this.make.graphics({ x:0, y:0, add:false });
      gg.fillStyle(0xffffff, 1);
      gg.fillCircle(2,2,2);
      gg.generateTexture('fx_snow_dot', 4,4);
      gg.destroy();
    }

    this.snow = this.add.particles(0, 0, 'fx_snow_dot', {
      x: { min: 0, max: 1280 },
      y: -10,
      quantity: 1,
      frequency: 40,
      lifespan: { min: 2200, max: 3600 },
      speedY: { min: 30, max: 70 },
      speedX: { min: -12, max: 12 },
      scale: { start: 0.45, end: 0.25 },
      alpha: { start: 0.25, end: 0 },
      rotate: { min: 0, max: 360 }
    }).setDepth(2);
    this.snow.setScrollFactor(0);
    this.snow.setVisible(false);

    this._applyFxVisibilityByMode();
  }

  _applyFxVisibilityByMode(){
    const outside = (this.mode === 'outside');
    if (this.neonOutside) this.neonOutside.setVisible(outside);
    if (this.neonInside)  this.neonInside.setVisible(!outside);

    // 雪は外だけ
    if (this.snow) this.snow.setVisible(outside);
  }

  _setTarget(x, y){
    this.target.set(x, y);
    this._targetActive = true;
    this._arrivedFxDone = false;
  }

  _spawnTapRing(x, y){
    const c = this.add.circle(x, y, 10, 0xffffff, 0.22).setDepth(9990);
    c.setStrokeStyle(2, 0xffffff, 0.42);

    this.tweens.add({
      targets: c,
      radius: 18,
      alpha: 0,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: ()=> c.destroy()
    });
  }

  _spawnArriveSparkle(x, y){
    const g = this.add.graphics().setDepth(9991);
    g.lineStyle(2, 0xffffff, 0.9);
    g.beginPath();
    g.moveTo(x-8, y); g.lineTo(x+8, y);
    g.moveTo(x, y-8); g.lineTo(x, y+8);
    g.strokePath();
    g.setAlpha(0);

    this.tweens.add({
      targets: g,
      alpha: { from: 0, to: 0.9 },
      duration: 70,
      yoyo: true,
      repeat: 1,
      onComplete: ()=> g.destroy()
    });
  }

  _startSceneWithFade(sceneKey, data){
    if (this._sceneTransitioning) return;
    this._sceneTransitioning = true;

    const dur = 150; // 120〜180
    const cam = this.cameras.main;

    cam.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, data);
    });

    cam.fadeOut(dur, 0,0,0);
  }

  // =========================
  // outside walkable (通路＋赤階段)
  // =========================
  _initWalkableOutside(){
    // bg_susukino_night_01 の元画像サイズ（this.bgOutside.width / height）に対する座標で切る
    // 画像: 1536x864 前提のつもりで置いてる（違っても this.bgOutside.width/height で動く）
    const W = this.bgOutside?.width  || 1536;
    const H = this.bgOutside?.height || 864;

    // 通路は「台形っぽい見た目」を段々の矩形で近似
    this.walkableOutsideTex = [
      // ---- main street (near) ----
      new Phaser.Geom.Rectangle(W*0.30, H*0.58, W*0.55, H*0.40),  // 下側ひろめ
      // ---- mid ----
      new Phaser.Geom.Rectangle(W*0.36, H*0.49, W*0.45, H*0.12),
      // ---- far ----
      new Phaser.Geom.Rectangle(W*0.42, H*0.40, W*0.34, H*0.10),
      new Phaser.Geom.Rectangle(W*0.47, H*0.34, W*0.22, H*0.07),

      // ---- shop steps / door front (赤階段まわり) ----
      new Phaser.Geom.Rectangle(W*0.02, H*0.56, W*0.28, H*0.40),
      new Phaser.Geom.Rectangle(W*0.02, H*0.46, W*0.33, H*0.18),
    ];
  }

  // ワールド座標 -> 背景画像のピクセル座標
  _worldToBgTex(x, y){
    const img = this.bgOutside;
    const sx = img.scaleX;
    const sy = img.scaleY;

    const left = img.x - (img.width  * sx)/2;
    const top  = img.y - (img.height * sy)/2;

    const tx = (x - left) / sx;
    const ty = (y - top)  / sy;

    return { tx, ty };
  }

  // 背景画像ピクセル座標 -> ワールド座標
  _bgTexToWorld(tx, ty){
    const img = this.bgOutside;
    const sx = img.scaleX;
    const sy = img.scaleY;

    const left = img.x - (img.width  * sx)/2;
    const top  = img.y - (img.height * sy)/2;

    const x = left + tx * sx;
    const y = top  + ty * sy;

    return { x, y };
  }

  _isWalkableOutside(x, y){
    // 足元判定（origin 0.5,1）
    const footX = x;
    const footY = y - 18;

    const { tx, ty } = this._worldToBgTex(footX, footY);

    // 画像外は歩けない
    if (tx < 0 || ty < 0 || tx > this.bgOutside.width || ty > this.bgOutside.height) return false;

    const zones = this.walkableOutsideTex || [];
    for (const r of zones){
      if (Phaser.Geom.Rectangle.Contains(r, tx, ty)) return true;
    }
    return false;
  }

  _clampToWalkableOutside(x, y){
    let tx = x;
    let ty = y;

    if (this._isWalkableOutside(tx, ty)) return { x:tx, y:ty };

    const step = 12;
    const maxR = 420;

    for (let r = step; r <= maxR; r += step){
      for (let a = 0; a < 360; a += 15){
        const rad = Phaser.Math.DegToRad(a);
        const nx = tx + Math.cos(rad) * r;
        const ny = ty + Math.sin(rad) * r;
        if (this._isWalkableOutside(nx, ny)){
          return { x:nx, y:ny };
        }
      }
    }

    return { x:this.player.x, y:this.player.y };
  }

  // =========================
  // inside spot system
  // =========================
  _initInsideSpots(){
    // ★左：入口＆ボーイ
    // ★右：キャバ嬢（前/中/奥 + バーカウンター側）に散らす
    this.insideSpots = [
      // ---- left (entrance / boys) ----
      { id:'exit',  x:150, y:610 },
      { id:'boyL1', x:240, y:620 },
      { id:'boyL2', x:320, y:600 },
      { id:'boyL3', x:400, y:620 },

      // ---- mid (aisle) ----
      { id:'mid1', x:520, y:610 },
      { id:'mid2', x:610, y:590 },

      // ---- bar side (upper)
      { id:'bar1', x:500, y:500 },
      { id:'bar2', x:660, y:470 },
      { id:'bar3', x:840, y:450 },

      // ---- right front ----
      { id:'rf1', x:740, y:620 },
      { id:'rf2', x:860, y:600 },
      { id:'rf3', x:980, y:620 },

      // ---- right middle
      { id:'rm1', x:740, y:575 },
      { id:'rm2', x:930, y:545 },
      { id:'rm3', x:1100,y:575 },

      // ---- right back
      { id:'rb1', x:760, y:500 },
      { id:'rb2', x:950, y:495 },
      { id:'rb3', x:1140,y:505 },
    ];

    this.spotsById = Object.fromEntries(this.insideSpots.map(s => [s.id, s]));
    this.spotOwner = {};
  }

  _pickWanderSpots(spotId){
    const map = {
      // boys stay left
      boyL1:['boyL1','boyL2'],
      boyL2:['boyL2','boyL1','boyL3'],
      boyL3:['boyL3','boyL2'],

      // bar side ★追加
      bar1:['bar1','bar2','mid2'],
      bar2:['bar2','bar1','bar3','mid2'],
      bar3:['bar3','bar2','rm2'],

      // cabajo roam right only
      rf1:['rf1','rm1','mid2'],
      rf2:['rf2','rm2','mid2'],
      rf3:['rf3','rm3','mid2'],

      rm1:['rm1','rf1','rb1'],
      rm2:['rm2','rf2','rb2','bar3'],
      rm3:['rm3','rf3','rb3'],

      rb1:['rb1','rm1','rb2'],
      rb2:['rb2','rm2','rb1','rb3'],
      rb3:['rb3','rm3','rb2'],

      mid1:['mid1','mid2'],
      mid2:['mid2','mid1'],
    };
    return map[spotId] || (spotId ? [spotId] : []);
  }

  // =========================
  // field entry events
  // =========================
  _runFieldEntryEvents(){
    // 優先順
    // 1) lastBattle（勝利後イベントがあれば最優先）
    // 2) firstDay intro（1回）
    // 3) boss unlock（指名到達で1回）
    // 4) cabajo unlock（入店時：指名2/4/6..）
    this.ev.push(()=> this._applyLastBattleResultQueued());
    this.ev.push(()=> this._maybeStartFirstDayIntroQueued());
    this.ev.push(()=> this._maybeBossUnlockQueued());
    this.ev.push(()=> this._maybeCabajoUnlockQueued());
    this.ev.run();
  }

  _launchDialogue(scriptKey, bgKey){
    // ★resume理由をセット
    this._resumeReason = 'dialogue';

    this.scene.pause();
    this.scene.launch('Dialogue', {
      scriptKey,
      returnTo: 'Field',
      bgKey: bgKey || ((this.mode === 'inside') ? 'bg_shop_inside' : 'bg_susukino_night_01')
    });
    this.scene.bringToTop('Dialogue');
  }

  _applyLastBattleResultQueued(){
    if (!this.state) this.state = loadSave();
    if (!this.state) return false;

    const lb = this.state.lastBattle;
    if (!lb || !lb.type || !lb.result) return false;

    const p = this.state.progress;
    const clear = () => {
      this.state.lastBattle = null;
      storeSave(this.state);
    };

    // lose は消して終わり
    if (lb.result !== 'win'){
      clear();
      return false;
    }

    // guest win：指名加算（デフォルト +1）
    if (lb.type === 'guest'){
      const add = (typeof lb.addNomination === 'number') ? lb.addNomination : 1;

      const cap = this._getNominationCap();
      const cur = p.nomination || 0;

      // ★上限で止める（2到達後はミオ撃破まで2固定、みたいな）
      p.nomination = Math.min(cur + add, cap);

      storeSave(this.state);
      clear();
      return false;
    }

    // cabajo win：撃破フラグ + 勝利後イベント（初回のみ）
    if (lb.type === 'cabajo'){
      if (lb.id){
        const alreadyDefeated = !!p.defeatedCabajo?.[lb.id];

        // 先に撃破扱いにはする
        p.defeatedCabajo[lb.id] = true;
        storeSave(this.state);
        clear();

        // ★初回だけストーリーを出す（再戦は出さない）
        if (!alreadyDefeated){
          const k = `story_after_boss_${lb.id}`;

          // ★カレンだけエンディング待ちフラグ
          if (lb.id === 'karen'){
            this.state.flags.endingPending = true;
            storeSave(this.state);
          }

          this._launchDialogue(k, 'bg_shop_inside');
          return true;
        }

        return false;
      }
      clear();
      return false;
    }

    clear();
    return false;
  }

  _getNominationCap(){
    const p = this.state?.progress || {};
    const defeated = p.defeatedCabajo || {};

    // 最初に「未撃破」のキャバ嬢がいる所で指名を止める
    for (let i = 0; i < this.cabajoOrder.length; i++){
      const id = this.cabajoOrder[i];
      if (!defeated[id]){
        return (i + 1) * 5;
      }
    }
    return Infinity; // 全員撃破なら上限なし
  }

  _maybeStartFirstDayIntroQueued(){
    if (!this.state) this.state = loadSave();
    if (!this.state) return false;

    if (!this.state.flags) this.state.flags = {};
    if (this.state.flags.firstDayIntroShown) return false;

    this.state.flags.firstDayIntroShown = true;
    storeSave(this.state);

    this._launchDialogue('story_firstday');
    return true;
  }

  _maybeBossUnlockQueued(){
    if (!this.state) this.state = loadSave();
    if (!this.state) return false;

    const p = this.state.progress;
    const flags = this.state.flags || (this.state.flags = {});
    const TH = 8;

    const nom = p?.nomination ?? 0;
    if (!flags.bossUnlocked && nom >= TH){
      flags.bossUnlocked = true;
      storeSave(this.state);

      this._launchDialogue('story_boss_unlock', 'bg_shop_inside');
      return true;
    }
    return false;
  }

  // ★入店時：指名2/4/6..でキャバ嬢解禁イベント
  _maybeCabajoUnlockQueued(){
    if (!this.state) this.state = loadSave();
    if (!this.state) return false;

    if (this.mode !== 'inside') return false;

    const p = this.state.progress || (this.state.progress = {});
    if (!p.cabajoUnlocked) p.cabajoUnlocked = {};
    if (typeof p.cabajoStage !== 'number') p.cabajoStage = 0;
    if (!('pendingUnlockEnemyId' in p)) p.pendingUnlockEnemyId = null;

    const nom = p.nomination ?? 0;

    const nextIndex = p.cabajoStage; // 0 -> 1人目
    if (nextIndex >= this.cabajoOrder.length) return false;

    const needNom = (nextIndex + 1) * 5;
    if (nom < needNom) return false;

    const enemyId = this.cabajoOrder[nextIndex];

    // すでに解禁済みならスキップ（保険）
    if (p.cabajoUnlocked[enemyId]){
      p.cabajoStage = nextIndex + 1;
      storeSave(this.state);
      return false;
    }

    // 二重発火防止：先に段階を進める
    p.cabajoStage = nextIndex + 1;

    // 会話後に出現させるため pending に積む
    p.pendingUnlockEnemyId = enemyId;

    storeSave(this.state);

    // 既存の段階イベントキーを流用（story_event_2 / 4 / 6 ...）
    this._launchDialogue(`story_event_${needNom}`, 'bg_shop_inside');
    return true;
  }

  // ===== NPCランダム配置用のパラメータ =====
  _initNpcSpawnParams(){
    this.npcSpawn = {
      minX: 140,
      maxX: 1140,
      minY: 560,
      maxY: 640,
      minDist: 74,
      avoidDoorR: 150
    };
  }

  _rand(min, max){
    return min + Math.random() * (max - min);
  }

  _pickSpawnPosition(placed){
    const s = this.npcSpawn;

    const dcx = this.doorZoneOutside.x + this.doorZoneOutside.width/2;
    const dcy = this.doorZoneOutside.y + this.doorZoneOutside.height/2;

    const zones = this.walkableOutsideTex || [];
    const pickInRectTex = (r) => {
      const tx = this._rand(r.left + 8, r.right - 8);
      const ty = this._rand(r.top  + 8, r.bottom - 8);
      return { tx, ty };
    };

    for (let t=0; t<180; t++){
      if (!zones.length) break;

      const r = Phaser.Utils.Array.GetRandom(zones);
      const ptex = pickInRectTex(r);
      const pw = this._bgTexToWorld(ptex.tx, ptex.ty);

      // 既存の湧き帯も維持（雰囲気維持）
      if (pw.x < s.minX || pw.x > s.maxX) continue;
      if (pw.y < s.minY || pw.y > s.maxY) continue;

      // 念のため walkable
      if (!this._isWalkableOutside(pw.x, pw.y)) continue;

      // ドア近すぎ回避（既存）
      const dd = Phaser.Math.Distance.Between(pw.x, pw.y, dcx, dcy);
      if (dd < s.avoidDoorR) continue;

      // 近すぎ回避（既存）
      let ok = true;
      for (const q of placed){
        const d = Phaser.Math.Distance.Between(pw.x, pw.y, q.x, q.y);
        if (d < s.minDist){ ok = false; break; }
      }
      if (!ok) continue;

      return { x: pw.x, y: pw.y };
    }

    // fallback（ここは従来寄り）
    for (let t=0; t<80; t++){
      const x = this._rand(s.minX, s.maxX);
      const y = this._rand(s.minY, s.maxY);
      if (!this._isWalkableOutside(x, y)) continue;

      const dd = Phaser.Math.Distance.Between(x, y, dcx, dcy);
      if (dd < s.avoidDoorR) continue;

      let ok = true;
      for (const p of placed){
        const d = Phaser.Math.Distance.Between(x, y, p.x, p.y);
        if (d < s.minDist){ ok = false; break; }
      }
      if (!ok) continue;

      return { x, y };
    }

    return { x:this.player.x, y:this.player.y };
  }

  _fitBackgrounds(){
    const w = this.scale.width;
    const h = this.scale.height;

    const fitOne = (img) => {
      if (!img) return;
      img.setPosition(w/2, h/2);
      const sx = w / img.width;
      const sy = h / img.height;
      img.setScale(Math.max(sx, sy));
    };

    fitOne(this.bgOutside);
    fitOne(this.bgInside);

    // ネオンも画面に追従（1280x720に固定描画だから位置だけ合わせる）
    if (this.neonOutside) this.neonOutside.setPosition(0,0);
    if (this.neonInside)  this.neonInside.setPosition(0,0);
  }

  // =========================
  // doors
  // =========================
  _makeDoorHints(){
    // outside door
    {
      const handleX = 260;
      const handleY = 470;

      this.outDoorHandle = { x: handleX, y: handleY };

      // タップ判定は広め（ドア全体＋周辺）
      const zoneW = 220;
      const zoneH = 280;
      const zoneX = handleX;
      const zoneY = handleY - 120;

      // Rectangle は判定/リレイアウト用に保持
      this.doorZoneOutside = new Phaser.Geom.Rectangle(
        zoneX - zoneW/2,
        zoneY - zoneH/2,
        zoneW,
        zoneH
      );

      // 既存があれば破棄（再生成の保険）
      if (this.doorTapZoneOutside){
        this.doorTapZoneOutside.destroy();
        this.doorTapZoneOutside = null;
      }

      // Zone をちゃんと生成してから on を付ける
      this.doorTapZoneOutside = this.add.zone(zoneX, zoneY, zoneW, zoneH)
        .setOrigin(0.5)
        .setDepth(9999)
        .setInteractive({ useHandCursor:true });

      this.doorTapZoneOutside.on('pointerdown', (pointer)=>{
        if (this.modalOpen) return;

        // ★通常移動クリックを潰す
        this._pointerConsumed = true;

        pointer.event && pointer.event.stopPropagation && pointer.event.stopPropagation();

        // 一回タップで「向かう→到着で入店」
        this.pendingDoorOutside = true;

        // ★ドア地点も walkable に吸着（外限定）
        if (this.mode === 'outside'){
          const pt = this._clampToWalkableOutside(handleX, handleY);
          this._setTarget(pt.x, pt.y);
        } else {
          this._setTarget(handleX, handleY);
        }
      });
    }

    // inside door（退店）
    {
      const cx = this.doorZoneInside.x + this.doorZoneInside.width/2;
      const cy = this.doorZoneInside.y + this.doorZoneInside.height/2;

      this.doorHintInside = this.add.text(cx, cy - 40, 'EXIT', {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { left:10, right:10, top:6, bottom:6 }
      }).setOrigin(0.5,0.5).setShadow(2,2,'#000',2).setDepth(1500);

      this.doorTapZoneInside = this.add.zone(cx, cy, this.doorZoneInside.width, this.doorZoneInside.height)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor:true });

      this.doorTapZoneInside.on('pointerdown', (pointer)=>{
        if (this.modalOpen) return;

        // ★通常移動クリックを潰す（保険）
        this._pointerConsumed = true;

        pointer.event?.stopPropagation?.();

        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, 620);
        if (d > 140){
          this._setTarget(cx, 620);
          return;
        }
        this.toggleInsideOutside();
      });
    }

    this._relayoutDoorHints();
  }

  _relayoutDoorHints(){
    // outside
    if (this.doorTapZoneOutside){
      const cx = this.doorZoneOutside.x + this.doorZoneOutside.width/2;
      const cy = this.doorZoneOutside.y + this.doorZoneOutside.height/2;

      this.doorTapZoneOutside.setPosition(cx, cy);
      this.doorTapZoneOutside.setSize(this.doorZoneOutside.width, this.doorZoneOutside.height);

      const show = (this.mode === 'outside');
      this.doorTapZoneOutside.setVisible(show);
    }

    // inside
    if (this.doorHintInside && this.doorTapZoneInside){
      const cx = this.doorZoneInside.x + this.doorZoneInside.width/2;
      const cy = this.doorZoneInside.y + this.doorZoneInside.height/2;

      this.doorHintInside.setPosition(cx, cy - 40);
      this.doorTapZoneInside.setPosition(cx, cy);
      this.doorTapZoneInside.setSize(this.doorZoneInside.width, this.doorZoneInside.height);

      const show = (this.mode === 'inside');
      this.doorHintInside.setVisible(show);
      this.doorTapZoneInside.setVisible(show);
    }
  }

  // =========================
  // boy menu
  // =========================
  _makeBoyMenu(){
    this.boyMenu = this.add.container(0,0).setDepth(5000).setScrollFactor(0).setVisible(false);

    const w = this.scale.width;
    const h = this.scale.height;

    // 背景（サイズはレイアウトで決める）
    this.boyMenuBg = this.add.rectangle(w/2, h/2, 760, 260, 0x000000, 0.72).setOrigin(0.5,0.5);
    this.boyMenuBg.setInteractive().on('pointerdown', (pointer)=>{
      pointer.event?.stopPropagation?.();
    });

    this.boyMenuTitle = this.add.text(0, 0, 'ボーイ', {
      fontSize:'20px', color:'#fff', fontStyle:'700'
    }).setShadow(2,2,'#000',2);

    this.boyMenuHint = this.add.text(0, 0,
      'タップで選択（PCは数字キーも可）',
      { fontSize:'16px', color:'#ddd' }
    ).setShadow(2,2,'#000',2);

    // ===== ボタン生成（rect+text）=====
    const mkBtn = (label, onTap) => {
      const bg = this.add.rectangle(0, 0, 10, 10, 0x121218, 0.88)
        .setOrigin(0.5, 0.5)
        .setStrokeStyle(3, 0xf2c66d, 0.28)
        .setInteractive({ useHandCursor:true });

      const tx = this.add.text(0, 0, label, {
        fontSize:'22px',
        color:'#ffffff',
        fontStyle:'700'
      }).setOrigin(0.5, 0.5).setShadow(2,2,'#000',2);

      const onDown = (pointer)=>{
        // ★通常移動クリックを潰す（保険）
        this._pointerConsumed = true;

        pointer.event?.stopPropagation?.();
        onTap();
      };

      bg.on('pointerdown', onDown);
      tx.setInteractive({ useHandCursor:true }).on('pointerdown', onDown);

      // hover（PC向け）
      bg.on('pointerover', ()=> bg.setAlpha(0.98));
      bg.on('pointerout',  ()=> bg.setAlpha(1));

      return { bg, tx };
    };

    this.boyBtnHeal = mkBtn('回復する', ()=>{
      this._doHeal();
      this._closeBoyMenu();
    });

    this.boyBtnSave = mkBtn('セーブする', ()=>{
      this._doSave();
      this._closeBoyMenu();
    });

    this.boyBtnPlay = mkBtn('お店で遊ぶ', ()=>{
      this._closeBoyMenu();
      this._startClubMode();
    });

    this.boyBtnClose = mkBtn('やめる', ()=>{
      this._closeBoyMenu();
    });

    this.boyMenu.add([
      this.boyMenuBg,
      this.boyMenuTitle,
      this.boyBtnHeal.bg, this.boyBtnHeal.tx,
      this.boyBtnSave.bg, this.boyBtnSave.tx,
      this.boyBtnPlay.bg, this.boyBtnPlay.tx,
      this.boyBtnClose.bg, this.boyBtnClose.tx,
      this.boyMenuHint
    ]);

    this._onResizeMenu = () => this._relayoutMenus();
    this.scale.on('resize', this._onResizeMenu);

    this._relayoutMenus();
  }

  _relayoutMenus(){
    if (!this.boyMenuBg) return;

    const w = this.scale.width;
    const h = this.scale.height;

    const cx = w/2;
    const cy = h/2;

    const panelW = Math.min(820, w - 40);
    const padX = Math.max(20, Math.floor(panelW * 0.05));
    const padY = 22;

    // ボタンサイズ（タップ優先で大きめ）
    const btnH = Math.max(64, Math.floor(h * 0.095));
    const gapX = Math.max(14, Math.floor(panelW * 0.03));
    const gapY = Math.max(14, Math.floor(btnH * 0.25));

    // 4ボタンなので2列固定（2x2）
    const btnW = Math.floor((panelW - padX*2 - gapX) / 2);

    // タイトル・ヒント
    const titleFs = Math.min(22, Math.max(18, Math.floor(h * 0.028)));
    const hintFs  = Math.min(18, Math.max(14, Math.floor(h * 0.022)));

    this.boyMenuTitle.setFontSize(titleFs);
    this.boyMenuHint.setFontSize(hintFs);

    const placeBtn = (btn, x, y) => {
      btn.bg.setPosition(x, y);
      btn.bg.setSize(btnW, btnH);
      btn.tx.setPosition(x, y);
    };

    // ボタン配置（2x2）
    const topY  = cy - Math.floor(btnH * 1.05);
    const leftX  = cx - (btnW/2 + gapX/2);
    const rightX = cx + (btnW/2 + gapX/2);
    const row2Y  = topY + btnH + gapY;

    placeBtn(this.boyBtnHeal,  leftX,  topY);
    placeBtn(this.boyBtnSave,  rightX, topY);
    placeBtn(this.boyBtnPlay,  leftX,  row2Y);
    placeBtn(this.boyBtnClose, rightX, row2Y);

    // 背景サイズ
    const contentH = (btnH*2 + gapY);
    const panelH =
      padY + Math.floor(titleFs * 1.6) + 14 +
      contentH +
      16 + Math.floor(hintFs * 1.6) + padY;

    this.boyMenuBg.setPosition(cx, cy);
    this.boyMenuBg.setSize(panelW, panelH);

    const topPanel = cy - panelH/2;

    this.boyMenuTitle.setPosition(cx - panelW/2 + padX, topPanel + padY);
    this.boyMenuHint.setPosition(
      cx - panelW/2 + padX,
      topPanel + panelH - padY - Math.floor(hintFs * 1.2)
    );
  }

  _openBoyMenu(boyNpc){
    this.modalOpen = true;
    this.boyMenu.setVisible(true);
    this.boyNpc = boyNpc || null;
    this.boyMenuTitle.setText('ボーイ');
  }

  _closeBoyMenu(){
    this.modalOpen = false;
    this.boyMenu.setVisible(false);
    this.boyNpc = null;
  }

  _doHeal(){
    this.state.player.hp = this.state.player.maxHp;
    storeSave(this.state);
    this._showToast('ボーイ「息、整ったな。まだ行ける」');
  }

  _doSave(){
    storeSave(this.state);
    this._showToast('ボーイ「ここまでの流れ、控えた」');
  }

  _startClubMode(){
    // 位置復元用に保存
    this._saveFieldPos();

    // ★resume理由をclubにする（resumeで会話扱いにしない）
    this._resumeReason = 'club';

    // ボーイメニュー状態を綺麗に閉じる
    this.modalOpen = false;
    this.boyMenu?.setVisible(false);

    // Fieldを止めてClubを上に起動
    this.scene.pause('Field');
    this.scene.launch('Club', {
      returnTo: 'Field',
      characterId: 'rei',
      debug: false
    });
  }

  // =========================
  // rematch menu
  // =========================
  _makeRematchMenu(){
    this.rematchMenu = this.add.container(0,0).setDepth(5000).setScrollFactor(0).setVisible(false);

    const w = this.scale.width;
    const h = this.scale.height;

    this.rematchBg = this.add.rectangle(w/2, h/2, 760, 220, 0x000000, 0.72).setOrigin(0.5,0.5);
    this.rematchBg.setInteractive().on('pointerdown', (pointer)=>{
      pointer.event?.stopPropagation?.();
    });

    this.rematchTitle = this.add.text(0, 0, '再戦', {
      fontSize:'20px', color:'#fff', fontStyle:'700'
    }).setShadow(2,2,'#000',2);

    this.rematchHint = this.add.text(0, 0,
      'タップで選択',
      { fontSize:'16px', color:'#ddd' }
    ).setShadow(2,2,'#000',2);

    const mkBtn = (label, onTap) => {
      const bg = this.add.rectangle(0, 0, 10, 10, 0x121218, 0.88)
        .setOrigin(0.5, 0.5)
        .setStrokeStyle(3, 0xf2c66d, 0.28)
        .setInteractive({ useHandCursor:true });

      const tx = this.add.text(0, 0, label, {
        fontSize:'22px',
        color:'#ffffff',
        fontStyle:'700'
      }).setOrigin(0.5, 0.5).setShadow(2,2,'#000',2);

      const onDown = (pointer)=>{
        // ★通常移動クリックを潰す（保険）
        this._pointerConsumed = true;

        pointer.event?.stopPropagation?.();
        onTap();
      };

      bg.on('pointerdown', onDown);
      tx.setInteractive({ useHandCursor:true }).on('pointerdown', onDown);

      return { bg, tx };
    };

    this.rematchBtnFight = mkBtn('もう一回やる', ()=>{
      const id = this.rematchEnemyId;
      this._closeRematchMenu();
      if (id) this._startSceneWithFade('Battle', { type:'cabajo', id });
    });

    this.rematchBtnClose = mkBtn('やめとく', ()=>{
      this._closeRematchMenu();
    });

    this.rematchMenu.add([
      this.rematchBg,
      this.rematchTitle,
      this.rematchBtnFight.bg, this.rematchBtnFight.tx,
      this.rematchBtnClose.bg, this.rematchBtnClose.tx,
      this.rematchHint
    ]);

    this._relayoutRematchMenu = () => {
      const w = this.scale.width;
      const h = this.scale.height;

      const cx = w/2;
      const cy = h/2;

      const panelW = Math.min(820, w - 40);
      const padX = Math.max(20, Math.floor(panelW * 0.05));
      const padY = 22;

      const btnH = Math.max(64, Math.floor(h * 0.095));
      const gapX = Math.max(14, Math.floor(panelW * 0.04));
      const btnW = Math.floor((panelW - padX*2 - gapX) / 2);

      const titleFs = Math.min(22, Math.max(18, Math.floor(h * 0.028)));
      const hintFs  = Math.min(18, Math.max(14, Math.floor(h * 0.022)));

      this.rematchTitle.setFontSize(titleFs);
      this.rematchHint.setFontSize(hintFs);

      const panelH = padY + Math.floor(titleFs * 1.6) + 14 + btnH + 18 + Math.floor(hintFs * 1.6) + padY;

      this.rematchBg.setPosition(cx, cy);
      this.rematchBg.setSize(panelW, panelH);

      const topPanel = cy - panelH/2;

      this.rematchTitle.setPosition(cx - panelW/2 + padX, topPanel + padY);

      const btnY = topPanel + padY + Math.floor(titleFs * 1.6) + 24;

      const leftX  = cx - (btnW/2 + gapX/2);
      const rightX = cx + (btnW/2 + gapX/2);

      const placeBtn = (btn, x, y) => {
        btn.bg.setPosition(x, y);
        btn.bg.setSize(btnW, btnH);
        btn.tx.setPosition(x, y);
      };

      placeBtn(this.rematchBtnFight, leftX, btnY);
      placeBtn(this.rematchBtnClose, rightX, btnY);

      this.rematchHint.setPosition(cx - panelW/2 + padX, topPanel + panelH - padY - Math.floor(hintFs * 1.2));
    };

    this.scale.on('resize', this._relayoutRematchMenu);
    this._relayoutRematchMenu();
  }

  _openRematchMenu(enemyId){
    this.modalOpen = true;
    this.rematchEnemyId = enemyId || null;
    this.rematchMenu.setVisible(true);
    this._relayoutRematchMenu?.();
  }

  _closeRematchMenu(){
    this.modalOpen = false;
    this.rematchEnemyId = null;
    this.rematchMenu.setVisible(false);
  }

  // =========================
  // toast (tiny popup)
  // =========================
  _showToast(msg){
    if (!msg) return;

    if (this.toastText){
      this.toastText.destroy();
      this.toastText = null;
    }

    const w = this.scale.width;
    const h = this.scale.height;

    this.toastText = this.add.text(w/2, h - 88, msg, {
      fontSize:'20px',
      color:'#fff',
      backgroundColor:'rgba(0,0,0,0.55)',
      padding:{ left:14, right:14, top:10, bottom:10 }
    }).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(9000);

    this.toastText.setAlpha(0);

    this.tweens.add({
      targets:this.toastText,
      alpha:1,
      duration:120
    });

    this.time.delayedCall(900, ()=>{
      if (!this.toastText) return;
      this.tweens.add({
        targets:this.toastText,
        alpha:0,
        duration:220,
        onComplete: ()=>{
          this.toastText?.destroy();
          this.toastText = null;
        }
      });
    });

    this._relayoutToast = () => {
      if (!this.toastText) return;
      const w = this.scale.width;
      const h = this.scale.height;
      this.toastText.setPosition(w/2, h - 88);
    };
  }

  // =========================
  // NPC spawn / tap behavior
  // =========================
  _spawnNPCs(mode){
    for (const n of this.npcs) n.destroy();
    this.npcs = [];

    const defs = this.npcDefs[mode] || [];
    const placed = [];

    const p = this.state?.progress || {};
    const unlocked = p.cabajoUnlocked || {};

    // insideスポット所有リセット
    if (mode === 'inside') this.spotOwner = {};

    for (const def of defs){
      // ★inside：キャバ嬢は解禁されるまで生成しない
      if (mode === 'inside' && def.enemyId){
        if (!unlocked[def.enemyId]) continue;
      }

      const pos = (mode === 'outside')
        ? this._pickSpawnPosition(placed)
        : this._pickInsideSpotPos(def, placed);

      if (mode === 'outside') placed.push({ x:pos.x, y:pos.y });

      const spr = this.add.sprite(pos.x, pos.y, def.key, 0);
      spr.setOrigin(0.5, 1);
      spr.setScale(this.player.scaleX);
      spr.setFrame(def.variant);
      spr.setDepth(5 + Math.floor(spr.y));

      spr.npcId = def.id;
      spr.scriptKey = def.script;
      spr.variant = def.variant;
      spr.enemyId = def.enemyId || null;
      spr.homeSpot = def.spot || null;
      spr.wanderSpots = (mode === 'inside' && spr.homeSpot) ? this._pickWanderSpots(spr.homeSpot) : null;

      spr.wander = { vx:0, vy:0, until:0, dir:'down' };

      if (mode === 'inside' && def.spot){
        this.spotOwner[def.spot] = def.id;
      }

      spr.setInteractive({ useHandCursor:true });
      spr.on('pointerdown', (pointer)=>{
        if (this.modalOpen) return;

        // ★通常移動クリックを潰す（保険）
        this._pointerConsumed = true;

        pointer.event?.stopPropagation?.();

        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, spr.x, spr.y);
        if (d > 120){
          // ★外は walkable に吸着
          if (this.mode === 'outside'){
            const pt = this._clampToWalkableOutside(spr.x, spr.y);
            this._setTarget(pt.x, pt.y);
          } else {
            this._setTarget(spr.x, spr.y);
          }
          return;
        }

        const isBoy = (spr.npcId === 'boy_1' || spr.npcId === 'boy_2');
        if (this.mode === 'inside' && isBoy){
          // ★会話 → 会話後にメニュー
          this.postDialogueAction = { type:'boy', npc:spr };
          this._launchDialogue(spr.scriptKey, 'bg_shop_inside');
          return;
        }

        // 店内：キャバ嬢
        if (this.mode === 'inside' && spr.enemyId){
          this._saveFieldPos();

          const defeated = !!this.state?.progress?.defeatedCabajo?.[spr.enemyId];
          if (defeated){
            // ★会話 → 会話後に再戦メニュー
            this.postDialogueAction = { type:'rematch', enemyId:spr.enemyId };

            // ★resume理由をセット
            this._resumeReason = 'dialogue';
            this.scene.pause();
            this.scene.launch('Dialogue', {
              scriptKey: `npc_cabajo_after_${spr.enemyId}`,
              returnTo: 'Field',
              bgKey: 'bg_shop_inside'
            });
            this.scene.bringToTop('Dialogue');
            return;
          }

          // unlocked & 未撃破なら戦闘（フェード）
          this._startSceneWithFade('Battle', { type:'cabajo', id: spr.enemyId });
          return;
        }

        // 通常：会話
        this._resumeReason = 'dialogue';
        this.scene.pause();
        this.scene.launch('Dialogue', {
          scriptKey: spr.scriptKey,
          returnTo: 'Field',
          bgKey: (this.mode === 'inside') ? 'bg_shop_inside' : 'bg_susukino_night_01'
        });
        this.scene.bringToTop('Dialogue');
      });

      this.npcs.push(spr);
      if (mode === 'inside') placed.push({ x: spr.x, y: spr.y });
    }

    this._relayoutDoorHints();
  }

  _pickInsideSpotPos(def, placed){
    const base = (def.spot && this.spotsById?.[def.spot])
      ? this.spotsById[def.spot]
      : { x: def.x ?? 640, y: def.y ?? 610 };

    // spotごとに揺れ幅を変える（同じ方向に寄るのを防ぐ）
    const spotId = def.spot || '';
    const isBoy = spotId.startsWith('boy');
    const isBar = spotId.startsWith('bar');
    const isBack = spotId.startsWith('rb');
    const isMid  = spotId.startsWith('rm');
    const isFront= spotId.startsWith('rf');

    let jitterX = 18;
    let jitterY = 8;

    if (isBoy)  { jitterX = 14; jitterY = 6; }
    if (isFront){ jitterX = 20; jitterY = 10; }
    if (isMid)  { jitterX = 24; jitterY = 10; }
    if (isBack) { jitterX = 28; jitterY = 12; }
    if (isBar)  { jitterX = 34; jitterY = 14; } // ★上側は広めに散らす

    const tryMake = () => {
      const x = base.x + Phaser.Math.Between(-jitterX, jitterX);
      const y = base.y + Phaser.Math.Between(-jitterY, jitterY);
      return { x, y };
    };

    // ★初期配置の最低距離を上げる（被りを強めに回避）
    const MIN_D = 86;

    // ★粘り回数も増やす
    for (let t=0; t<28; t++){
      const p = tryMake();

      let ok = true;
      for (const q of placed){
        const d = Phaser.Math.Distance.Between(p.x, p.y, q.x, q.y);
        if (d < MIN_D){ ok = false; break; }
      }
      if (ok) return p;
    }

    // ダメなら base に戻す（ただしplacedと近いならちょい逃がす）
    let x = base.x, y = base.y;
    for (let t=0; t<12; t++){
      const px = base.x + Phaser.Math.Between(-40, 40);
      const py = base.y + Phaser.Math.Between(-18, 18);

      let ok = true;
      for (const q of placed){
        const d = Phaser.Math.Distance.Between(px, py, q.x, q.y);
        if (d < MIN_D){ ok = false; break; }
      }
      if (ok){ x = px; y = py; break; }
    }

    return { x, y };
  }

  _startNpcWander(){
    if (this.npcWanderTimer) this.npcWanderTimer.remove(false);

    this.npcWanderTimer = this.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => {
        const now = this.time.now;

        for (const n of this.npcs){
          // 店内も少しだけ動かす（スポット間）
          if (this.mode === 'inside'){
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.x, n.y);
            if (d < 150){
              n.wander.vx = 0; n.wander.vy = 0; n.wander.until = now + 700;
              this._npcSetPose(n, 'down');
              continue;
            }

            const spots = n.wanderSpots;
            if (!spots || spots.length === 0){
              n.wander.vx = 0; n.wander.vy = 0; n.wander.until = now + 900;
              continue;
            }

            const nextSpotId = Phaser.Utils.Array.GetRandom(spots);
            const s = this.spotsById?.[nextSpotId];
            if (!s){
              n.wander.vx = 0; n.wander.vy = 0; n.wander.until = now + 900;
              continue;
            }

            // 簡易被り回避（距離だけ）
            let ok = true;
            for (const other of this.npcs){
              if (other === n) continue;
              const dd = Phaser.Math.Distance.Between(s.x, s.y, other.x, other.y);
              if (dd < 56){ ok = false; break; }
            }
            if (!ok){
              n.wander.vx = 0; n.wander.vy = 0; n.wander.until = now + 650;
              continue;
            }

            const dx = s.x - n.x;
            const dy = s.y - n.y;
            const dist = Math.hypot(dx, dy);
            const spd = Phaser.Math.Between(18, 26);

            if (dist > 2){
              n.wander.vx = (dx/dist) * spd;
              n.wander.vy = (dy/dist) * spd;
              n.wander.until = now + Phaser.Math.Between(800, 1400);

              if (Math.abs(dx) > Math.abs(dy)) this._npcSetPose(n, (dx>0)?'right':'left');
              else this._npcSetPose(n, (dy>0)?'down':'up');
            } else {
              n.wander.vx = 0; n.wander.vy = 0; n.wander.until = now + 900;
            }
            continue;
          }

          // outside wander
          const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.x, n.y);
          if (d < 140){
            n.wander.vx = 0; n.wander.vy = 0; n.wander.until = now + 600;
            this._npcSetPose(n, 'down');
            continue;
          }

          if (Math.random() < 0.7){
            n.wander.vx = 0; n.wander.vy = 0;
            n.wander.until = now + Phaser.Math.Between(600, 1400);
            if (Math.random() < 0.35){
              const dir = Phaser.Utils.Array.GetRandom(['down','up','side']);
              this._npcSetPose(n, dir);
            }
          } else {
            const dir = Phaser.Utils.Array.GetRandom(['down','up','left','right']);
            const spd = Phaser.Math.Between(14, 26);
            let vx = 0, vy = 0;

            if (dir === 'left')  vx = -spd;
            if (dir === 'right') vx =  spd;
            if (dir === 'up')    vy = -spd;
            if (dir === 'down')  vy =  spd;

            n.wander.vx = vx;
            n.wander.vy = vy;
            n.wander.until = now + Phaser.Math.Between(500, 1200);

            this._npcSetPose(n, dir);
          }
        }
      }
    });
  }

  _npcSetPose(npc, dir){
    const v = npc.variant;

    if (dir === 'up'){
      npc.setFrame(v + 8);
      npc.setFlipX(false);
      npc.wander.dir = 'up';
      return;
    }
    if (dir === 'down'){
      npc.setFrame(v + 0);
      npc.setFlipX(false);
      npc.wander.dir = 'down';
      return;
    }

    npc.setFrame(v + 4);
    npc.setFlipX(dir === 'right');
    npc.wander.dir = (dir === 'right') ? 'right' : 'left';
  }

  // =========================
  // field pos save
  // =========================
  _saveFieldPos(){
    this.state.fieldPos = {
      x: this.player.x,
      y: this.player.y,
      mode: this.mode
    };
    storeSave(this.state);
  }

  update(_, delta){
    // モーダル中
    if (this.modalOpen){
      if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)){
        if (this.boyMenu?.visible){
          this._doHeal();
          this._closeBoyMenu();
        }
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)){
        if (this.boyMenu?.visible){
          this._doSave();
          this._closeBoyMenu();
        }
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.THREE)){
        if (this.boyMenu?.visible){
          this._closeBoyMenu();
          this._startClubMode();
        }
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)){
        if (this.boyMenu?.visible) this._closeBoyMenu();
        if (this.rematchMenu?.visible) this._closeRematchMenu();
        return;
      }
      return;
    }

    const dt = delta / 1000;
    const speed = 240;

    // NPC wandering
    const now = this.time.now;
    for (const n of this.npcs){
      if (now < n.wander.until){
        n.x += n.wander.vx * dt;
        n.y += n.wander.vy * dt;

        n.x = Phaser.Math.Clamp(n.x, 80, 1200);
        n.y = Phaser.Math.Clamp(n.y, 320, 660);

        n.setDepth(5 + Math.floor(n.y));
      } else {
        if (n.wander.vx !== 0 || n.wander.vy !== 0){
          if (n.wander.dir === 'up') this._npcSetPose(n, 'up');
          else if (n.wander.dir === 'down') this._npcSetPose(n, 'down');
          else if (n.wander.dir === 'right') this._npcSetPose(n, 'right');
          else this._npcSetPose(n, 'left');
        }
        n.wander.vx = 0; n.wander.vy = 0;
      }
    }

    // Player move
    const dx = this.target.x - this.player.x;
    const dy = this.target.y - this.player.y;
    const dist = Math.hypot(dx, dy);

    let moved = 0;

    if (dist > 2){
      const vx = (dx/dist) * speed * dt;
      const vy = (dy/dist) * speed * dt;

      const ox = this.player.x;
      const oy = this.player.y;

      // ★外だけ「歩ける場所」制限（すり抜け防止でX→Yの順に試す）
      if (this.mode === 'outside'){
        const nx = ox + vx;
        const ny = oy + vy;

        if (this._isWalkableOutside(nx, oy)) this.player.x = nx;
        if (this._isWalkableOutside(this.player.x, ny)) this.player.y = ny;

        // もし両方ダメで動けないなら target を自分に戻す（無限押し当て防止）
        if (this.player.x === ox && this.player.y === oy){
          this.target.set(ox, oy);
          this._targetActive = false;
        }
      } else {
        this.player.x = ox + vx;
        this.player.y = oy + vy;
      }

      moved = Phaser.Math.Distance.Between(ox, oy, this.player.x, this.player.y);

      if (this.anims.exists('rei_left') && this.anims.exists('rei_up') && this.anims.exists('rei_down')){
        if (Math.abs(dx) > Math.abs(dy)){
          this.player.anims.play('rei_left', true);
          this.player.setFlipX(dx > 0);
        } else {
          this.player.setFlipX(false);
          if (dy > 0) this.player.anims.play('rei_down', true);
          else        this.player.anims.play('rei_up', true);
        }
      }

      // encounter outside only
      if (this.mode === 'outside'){
        if (addSteps(this.counter, moved)){
          const guestId = pickGuestId();
          this._saveFieldPos();
          this._startSceneWithFade('Battle', { type:'guest', id: guestId });
          return;
        }
      }
    } else {
      if (this.player.anims?.isPlaying) this.player.anims.stop();

      // ★目的地到達キラッ
      if (this._targetActive && !this._arrivedFxDone){
        // ちょい緩め
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y) <= 6){
          this._arrivedFxDone = true;
          this._targetActive = false;
          this._spawnArriveSparkle(this.player.x, this.player.y - 10);
        }
      }
    }

    // 主人公もyソート
    this.player.setDepth(5 + Math.floor(this.player.y));

    // Door（PC保険）
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)){
      const inDoorOutside = Phaser.Geom.Rectangle.Contains(this.doorZoneOutside, this.player.x, this.player.y);
      const inDoorInside  = Phaser.Geom.Rectangle.Contains(this.doorZoneInside,  this.player.x, this.player.y);

      if (this.mode === 'outside' && inDoorOutside) this.toggleInsideOutside();
      if (this.mode === 'inside'  && inDoorInside)  this.toggleInsideOutside();
    }

    // NPC talk icon（演出）
    this._updateTalkable();

    // ★外ドア：到着で入店
    if (this.mode === 'outside' && this.pendingDoorOutside && !this.modalOpen){
      const hx = this.outDoorHandle?.x ?? 365;
      const hy = this.outDoorHandle?.y ?? 630;

      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, hx, hy);
      if (d <= 40){
        this.pendingDoorOutside = false;
        this.toggleInsideOutside();
      }
    }
  }

  _updateTalkable(){
    let nearest = null;
    let best = 999999;

    for (const n of this.npcs){
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.x, n.y);
      if (d < best){ best = d; nearest = n; }
    }

    const canTalk = nearest && best < 110;

    if (canTalk){
      this.talkIcon.setVisible(true);
      const headY = nearest.y - (nearest.displayHeight || 90) - 6;
      this.talkIcon.setPosition(nearest.x - 4, headY);

      // PC保険（F）
      if (Phaser.Input.Keyboard.JustDown(this.keys.F)){
        const isBoy = (nearest.npcId === 'boy_1' || nearest.npcId === 'boy_2');
        if (this.mode === 'inside' && isBoy){
          // ★会話 → 会話後にメニュー
          this.postDialogueAction = { type:'boy', npc:nearest };
          this._launchDialogue(nearest.scriptKey, 'bg_shop_inside');
          return;
        }

        if (this.mode === 'inside' && nearest.enemyId){
          this._saveFieldPos();

          const defeated = !!this.state?.progress?.defeatedCabajo?.[nearest.enemyId];
          if (defeated){
            // ★会話 → 会話後に再戦メニュー
            this.postDialogueAction = { type:'rematch', enemyId:nearest.enemyId };

            // ★resume理由をセット
            this._resumeReason = 'dialogue';
            this.scene.pause();
            this.scene.launch('Dialogue', {
              scriptKey: `npc_cabajo_after_${nearest.enemyId}`,
              returnTo: 'Field',
              bgKey: 'bg_shop_inside'
            });
            this.scene.bringToTop('Dialogue');
            return;
          }

          this._startSceneWithFade('Battle', { type:'cabajo', id: nearest.enemyId });
          return;
        }

        this._resumeReason = 'dialogue';
        this.scene.pause();
        this.scene.launch('Dialogue', {
          scriptKey: nearest.scriptKey,
          returnTo: 'Field',
          bgKey: (this.mode === 'inside') ? 'bg_shop_inside' : 'bg_susukino_night_01'
        });
        this.scene.bringToTop('Dialogue');
        return;
      }
    } else {
      this.talkIcon.setVisible(false);
    }
  }

  // =========================
  // inside/outside + event gate
  // =========================
  toggleInsideOutside(){
    // ★切り替え時に保険で解除
    this.pendingDoorOutside = false;
    this._pointerConsumed = false;

    const wasOutside = (this.mode === 'outside');
    this.mode = wasOutside ? 'inside' : 'outside';

    this.bgOutside.setVisible(!wasOutside);
    this.bgInside.setVisible(wasOutside);

    // FXの表示も追従
    this._applyFxVisibilityByMode();

    // 保存
    this.state.fieldPos = { x:this.player.x, y:this.player.y, mode:this.mode };
    storeSave(this.state);

    this._spawnNPCs(this.mode);
    this._startNpcWander();

    if (this.modalOpen){
      if (this.boyMenu?.visible) this._closeBoyMenu();
      if (this.rematchMenu?.visible) this._closeRematchMenu();
    }

    this._relayoutDoorHints();

    // 入店イベント：opening → それ以外（bossUnlock/解禁）をキューで処理
    if (wasOutside && this.mode === 'inside'){
      if (!this.state?.flags?.openingShown){
        this.state.flags.openingShown = true;
        storeSave(this.state);

        this._launchDialogue('story_opening', 'bg_shop_inside');
        return;
      }

      // opening 済みなら、入店時イベント（bossUnlock/解禁）を流す
      this._runFieldEntryEvents();
    }
  }
}
