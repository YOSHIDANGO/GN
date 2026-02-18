// assets/js/scenes/BattleScene.js
import { BattleUI } from '../ui/BattleUI.js';
import { calcDamage } from '../util/damage.js';
import { loadSave, storeSave } from '../core/save.js';

const PHASE = {
  PLAYER_SELECT:     'PLAYER_SELECT',
  SERIF_PLAYER:      'SERIF_PLAYER',
  SERIF_ENEMY_REPLY: 'SERIF_ENEMY_REPLY',
  APPLY_DAMAGE:      'APPLY_DAMAGE',
  TURN_END:          'TURN_END'
};

// =========================
// Mood system
// =========================
const MOOD = {
  CALM:       'calm',
  IRRITATED:  'irritated',
  EMBARRASSED:'embarrassed',
  AGGRESSIVE: 'aggressive'
};

export class BattleScene extends Phaser.Scene {
  constructor(){ super('Battle'); }

  create(data){
    // =========================
    // save load + normalize
    // =========================
    this.state = loadSave() || {
      player:{ name:'レイ', hp:100, maxHp:100, atk:16, def:8, spd:10 },
      flags:{},
      progress:{},
      fieldPos:null,
      lastBattle:null
    };

    if (!this.state.player){
      this.state.player = { name:'レイ', hp:100, maxHp:100, atk:16, def:8, spd:10 };
    }
    if (!this.state.flags) this.state.flags = {};
    if (!this.state.progress) this.state.progress = {};
    // ★ここでは進行は触らない。FieldSceneが統括する

    // =========================
    // 背景（画面COVER）
    // =========================
    this.bg = this.add.image(0,0,'bg_battle_generic').setOrigin(0.5,0.5);

    const fitBg = () => {
      const w = this.scale.width;
      const h = this.scale.height;
      this.bg.setPosition(w/2, h/2);
      const sx = w / this.bg.width;
      const sy = h / this.bg.height;
      this.bg.setScale(Math.max(sx, sy));
    };

    // プレイヤー
    this.rei = { name:'レイ', ...this.state.player, expr:'rei_normal' };

    // =========================
    // 指名数ボーナス
    // =========================
    const shimei =
      Number(this.state.progress?.shimeiCount ?? this.state.progress?.nomination ?? 0) || 0;

    const bonus = 1 + (shimei * 0.2) / (1 + shimei * 0.3);

    this.rei.atk = Math.floor(this.rei.atk * bonus);

    // バトル種別
    this.type = data?.type || 'guest';
    this.id   = data?.id || 'salaryman';

    // DB
    const dbCabajo = this.cache.json.get('enemies_cabajo')?.cabajo || {};
    const dbGuests = this.cache.json.get('enemies_guests')?.guests || {};
    this.linesGuest  = this.cache.json.get('lines_guest') || null;
    this.linesCabajo = this.cache.json.get('lines_cabajo') || null;

    // =========================
    // 流れ（連打ペナ・切替ボナ）
    // =========================
    this.flow = {
      lastTag: null,
      streakCount: 0
    };

    // 敵定義
    if (this.type === 'cabajo'){
      const d = dbCabajo[this.id];
      this.enemy = {
        id:this.id, type:this.type, name:d?.name || this.id,
        hp:d?.maxHp ?? 120, maxHp:d?.maxHp ?? 120,
        atk:d?.atk ?? 18, def:d?.def ?? 8, spd:d?.spd ?? 10,
        expr:`${this.id}_normal`,
        lines:d?.lines || {},
        traits: d?.traits || {},
        counterMul: 0.85 // ★キャバ嬢反撃弱体（強すぎ対策）
      };

      // ★さらに「絶対負け」回避のため、プレイヤー基準で軽く丸める
      this._applyCabajoBalance();
    } else {
      const d = dbGuests[this.id];
      this.enemy = {
        id:this.id, type:this.type, name:d?.name || this.id,
        hp:d?.maxHp ?? d?.stats?.hp ?? 70,
        maxHp:d?.maxHp ?? d?.stats?.hp ?? 70,
        atk:d?.atk ?? d?.stats?.atk ?? 14,
        def:d?.def ?? d?.stats?.def ?? 6,
        spd:d?.spd ?? d?.stats?.spd ?? 8,
        expr:`guest_${this.id}`,
        lines:{},
        traits: {},
        counterMul: 1.0
      };
    }

    // =========================
    // enemy mood（cabajoだけ）
    // =========================
    this.enemyMood = null;
    if (this.type === 'cabajo'){
      this.enemyMood = this._initialEnemyMood();
    }

    // =========================
    // help system（倒した嬢が援護）
    // =========================
    this.help = {
      used: false,
      id: null,
      name: '',
      expr: '',
      chance: 0,
      sprite: null
    };
    this._initHelpCandidate(dbCabajo);

    // 立ち絵
    this.reiSprite   = this.add.image(0,0,this.rei.expr).setOrigin(0.5,1).setScale(0.4);
    this.enemySprite = this.add.image(0,0,this.enemy.expr).setOrigin(0.5,1).setScale(0.4);

    // =========================
    // UI
    // =========================
    this.ui = new BattleUI(this);
    this.ui.onCommand(id => this._onPlayerCommand(id));
    this.ui.onAdvance(() => this._onAdvance());

    // 最初は advance 無効（ボタン押すフェーズ）
    this.ui.setAdvanceEnabled(false);

    // フラッシュ（画面サイズに追従する矩形）
    this.flash = this.add.rectangle(0,0,10,10,0xff0000,0.4)
      .setOrigin(0,0)
      .setAlpha(0)
      .setDepth(900);

    // キー
    this.keys = this.input.keyboard.addKeys('ONE,TWO,THREE,FOUR,ESC,SPACE,ENTER');

    // 状態
    this.phase = PHASE.PLAYER_SELECT;
    this.waitingAdvance = false;
    this.pendingExit = null;

    this.turn = {
      cmdId:null, cmdLabel:null, cmdPower:1,
      cmdTag:null,
      serifPlayer:'', serifEnemyReply:'',
      dmgToEnemy:0, dmgToPlayer:0, resultText:'',
      outcome:'hit' // ★追加（hit/miss/crit）
    };

    // 初期メッセージ
    this._setMessage('コマンドを選んで');

    // リサイズ
    this._onResize = () => this.time.delayedCall(0, () => {
      fitBg();
      this._layoutActors(true);
      this._syncHud(true);
      this._fitFlash();
    });
    this.scale.on('resize', this._onResize);

    // 初回レイアウト
    fitBg();
    this._layoutActors(true);
    this._fitFlash();
    this._syncHud(true);
  }

  update(){
    this._layoutActors(false);
    this._syncHud(false);

    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)){
      // 逃げる扱い（結果未設定のまま戻す）
      this._returnToField(null);
      return;
    }

    if (this.phase === PHASE.PLAYER_SELECT && !this.waitingAdvance){
      const map = [['ONE','kogeki'],['TWO','aori'],['THREE','home'],['FOUR','kirikaeshi']];
      for (const [k,id] of map){
        if (Phaser.Input.Keyboard.JustDown(this.keys[k])){
          this._onPlayerCommand(id);
          return;
        }
      }
    }

    if (this.waitingAdvance){
      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) ||
          Phaser.Input.Keyboard.JustDown(this.keys.ENTER)){
        this._onAdvance();
      }
    }
  }

  // =========================
  // input
  // =========================
  _onPlayerCommand(cmdId){
    if (this.phase !== PHASE.PLAYER_SELECT || this.waitingAdvance) return;

    const def = this._getCommandDef(cmdId);
    this.turn.cmdId = cmdId;
    this.turn.cmdLabel = def.label;
    this.turn.cmdPower = def.power;
    this.turn.cmdTag = def.tag || null;
    this.turn.outcome = 'hit';

    // セリフ（プレイヤー）
    this.turn.serifPlayer = this._pickPlayerLine(cmdId);

    // 敵の返し（ここだけ許可、攻撃セリフは出さない）
    if (this.type === 'guest'){
      this.turn.serifEnemyReply = this._pickGuestEnemyAfter(cmdId);
    } else {
      this.turn.serifEnemyReply = this._pickCabajoEnemyReply(cmdId);
    }

    // ===== ここから係数（tag耐性 + 流れ + mood） =====
    const tag = this.turn.cmdTag;

    const tagResist = this._getEnemyTagResist(tag);           // 例: 0.85〜1.15 / なければ1
    const streakMultiplier = this._calcStreakMultiplier(tag); // 連打ペナ/切替ボナ
    const moodMultiplier = this._getMoodMultiplier(tag);      // moodで刺さり方を変える（cabajoだけ）

    // powerにまとめて乗せる（damage.js触らない方針）
    const effPower = (this.turn.cmdPower || 1.0) * tagResist * streakMultiplier * moodMultiplier;

    // dmg（ここでベース確定）
    this.turn.dmgToEnemy = this._damageValue(
      calcDamage(this.rei, this.enemy, effPower)
    );

    // ★反撃は cabajo の時だけ倍率で弱体 + moodで微調整
    const rawP = this._damageValue(calcDamage(this.enemy, this.rei, 1.0));
    const baseMul = (this.type === 'cabajo') ? (this.enemy.counterMul ?? 0.85) : 1.0;
    const moodCounter = this._getMoodCounterMul(); // calmなら弱め、aggressiveなら強め
    const mul = baseMul * moodCounter;
    this.turn.dmgToPlayer = Math.max(0, Math.floor(rawP * mul));

    this.phase = PHASE.SERIF_PLAYER;
    this.ui.setEnabled(false);

    // 表情を通常へ戻す（前ターンの残り対策）
    this._setReiExpr('normal');
    this._setEnemyExpr('normal');

    this._setMessage(this.turn.serifPlayer);
    this._waitAdvance();
  }

  _onAdvance(){
    if (!this.waitingAdvance) return;
    this.waitingAdvance = false;

    switch(this.phase){
      case PHASE.SERIF_PLAYER:
        // 返しが空なら飛ばす
        if (this.turn.serifEnemyReply){
          this.phase = PHASE.SERIF_ENEMY_REPLY;
          this._setMessage(this.turn.serifEnemyReply);
          this._waitAdvance();
        } else {
          this.phase = PHASE.APPLY_DAMAGE;
          this._applyDamageAndShow();
          this._waitAdvance();
        }
        break;

      case PHASE.SERIF_ENEMY_REPLY:
        this.phase = PHASE.APPLY_DAMAGE;
        this._applyDamageAndShow();
        this._waitAdvance();
        break;

      case PHASE.APPLY_DAMAGE:
        this.phase = PHASE.TURN_END;
        this._endTurn();
        break;

      case PHASE.TURN_END:
        if (this.pendingExit === 'win') this._saveAndReturnWin();
        if (this.pendingExit === 'lose') this._saveAndReturnLose();
        break;
    }
  }

  _waitAdvance(){
    this.waitingAdvance = true;
    this.ui.setAdvanceEnabled(true);
  }

  // -------------------------
  // phase handlers
  // -------------------------
  _applyDamageAndShow(){
    const parts = [];

    // outcome（cabajoだけ miss/crit あり）
    let outcome = 'hit';
    let dmgE = this.turn.dmgToEnemy;

    if (this.type === 'cabajo'){
      outcome = this._rollOutcome(this.rei, this.enemy);
      if (outcome === 'miss') dmgE = 0;
      else if (outcome === 'crit') dmgE = Math.max(1, Math.floor(dmgE * 1.6));
    }
    this.turn.outcome = outcome;

    // 先に「レイの行動ログ」を必ず出す（この形式だけ）
    parts.push(`${this.rei.name}の${this.turn.cmdLabel}  ${dmgE}ダメージ`);

    // 敵ダメージ適用
    if (dmgE > 0){
      this.enemy.hp = Math.max(0, this.enemy.hp - dmgE);
      this._hitFlash(0.22);
      this._blinkEnemyHit();
    } else {
      // ミス時は軽く揺らすくらい
      this.cameras.main.shake(40, 0.0025);
    }

    // =========================
    // help（倒した嬢が援護）
    // - 1バトル1回だけ
    // - プレイヤー行動後〜反撃前
    // =========================
    if (this.enemy.hp > 0){
      const helpLines = this._maybeDoHelpAttack();
      if (helpLines && helpLines.length){
        for (const ln of helpLines) parts.push(ln);
      }
    }

    // 反撃（敵が生きてる時だけ。セリフは出さない）
    if (this.enemy.hp > 0){
      const dmgP = this.turn.dmgToPlayer;
      this.rei.hp = Math.max(0, this.rei.hp - dmgP);
      this._hitFlash(0.16);
      parts.push(`${this.enemy.name}の反撃  ${dmgP}ダメージ`);
      if (dmgP > 0){
        this._blinkReiHit();
      }
    }

    // mood遷移（ここで確定情報が揃う）
    if (this.type === 'cabajo'){
      this._advanceEnemyMood(this.turn.cmdTag, outcome, dmgE);
    }

    // 勝敗セリフ（ここだけはOK）
    if (this.type === 'cabajo'){
      if (this.enemy.hp <= 0){
        const lose = this._pickEnemyLine('lose');
        if (lose) parts.push(lose);
      } else if (this.rei.hp <= 0){
        const win = this._pickEnemyLine('win');
        if (win) parts.push(win);
      }
    }

    this.turn.resultText = parts.join('\n');
    this._setMessage(this.turn.resultText);
    this._syncHud();
  }

  _endTurn(){
    // 勝ち
    if (this.enemy.hp <= 0){
      this.phase = PHASE.TURN_END;
      this.ui.setEnabled(false);

      // 表情：勝利
      this._setReiExpr('win');
      this._setEnemyExpr('lose');

      const base = this.turn.resultText || '';
      this._setMessage(base ? (base + '\n勝利') : '勝利');

      this.pendingExit = 'win';
      this._waitAdvance();
      return;
    }

    // 負け
    if (this.rei.hp <= 0){
      this.phase = PHASE.TURN_END;
      this.ui.setEnabled(false);

      // 表情：敗北
      this._setReiExpr('lose');
      this._setEnemyExpr('win');

      const base = this.turn.resultText || '';
      this._setMessage(base ? (base + '\n敗北') : '敗北');

      this.pendingExit = 'lose';
      this._waitAdvance();
      return;
    }

    // 次ターン
    this.pendingExit = null;
    this.phase = PHASE.PLAYER_SELECT;
    this.waitingAdvance = false;
    this.ui.setAdvanceEnabled(false);
    this.ui.setEnabled(true);

    // 表情を戻す
    this._setReiExpr('normal');
    this._setEnemyExpr('normal');

    this._setMessage('コマンドを選んで');
    this.turn = {
      cmdId:null, cmdLabel:null, cmdPower:1.0,
      cmdTag:null,
      serifPlayer:'', serifEnemyReply:'',
      dmgToEnemy:0, dmgToPlayer:0, resultText:'',
      outcome:'hit'
    };
  }

  // -------------------------
  // helpers
  // -------------------------
  _applyCabajoBalance(){
    // DBが強い前提でも「確実に勝てない」状況を避けるための丸め
    const p = this.rei;

    // hpはプレイヤー基準の 0.95〜1.20 に寄せる
    const hpMin = Math.floor(p.maxHp * 0.95);
    const hpMax = Math.floor(p.maxHp * 1.20);
    this.enemy.maxHp = Phaser.Math.Clamp(this.enemy.maxHp, hpMin, hpMax);
    this.enemy.hp = Phaser.Math.Clamp(this.enemy.hp, hpMin, hpMax);

    // atkはプレイヤー以下に寄せる
    const atkMax = p.atk;
    this.enemy.atk = Math.max(6, Math.min(this.enemy.atk, atkMax));

    // defはプレイヤーと同等以下に寄せる
    const defMax = p.def;
    this.enemy.def = Math.max(2, Math.min(this.enemy.def, defMax));

    // spdは大きく乖離させない（miss/crit崩壊防止）
    const spdMin = Math.max(6, p.spd - 2);
    const spdMax = p.spd + 3;
    this.enemy.spd = Phaser.Math.Clamp(this.enemy.spd, spdMin, spdMax);
  }

  _damageValue(v){
    if (typeof v === 'number') return v;
    if (!v) return 0;
    if (typeof v === 'object'){
      const n = v.dmg ?? v.damage ?? v.value ?? v.amount ?? 0;
      return (typeof n === 'number') ? n : 0;
    }
    return 0;
  }

  _layoutActors(force=false){
    const w = this.scale.width;
    const h = this.scale.height;

    // 立ち絵は bottom 基準で置く（origin 0.5,1 前提）
    // ログ枠の上端より少し上を bottomY にする
    const bottomY = (this.ui)
      ? this.ui.getPortraitBottomY()
      : (h * 0.62);

    const px = Math.floor(w * 0.30);
    const ex = Math.floor(w * 0.70);

    if (this.reiSprite){
      this.reiSprite.setOrigin(0.5, 1);
      this.reiSprite.x = px;
      this.reiSprite.y = bottomY;
    }
    if (this.enemySprite){
      this.enemySprite.setOrigin(0.5, 1);
      this.enemySprite.x = ex;
      this.enemySprite.y = bottomY;
    }

    if (force) this._fitFlash();
  }

  _fitFlash(){
    const w = this.scale.width;
    const h = this.scale.height;
    if (this.flash){
      this.flash.setPosition(0,0);
      this.flash.width = w;
      this.flash.height = h;
    }
  }

  _getCommandDef(cmdId){
    const cmds = this.cache.json.get('commands_rei')?.commands || [];
    const found = cmds.find(c => this._mapCmdId(c.id) === cmdId);
    if (found){
      return { label: found.label, power: found.power, tag: found.tag ?? null };
    }

    const map = {
      kogeki:     { label:'口撃', power:1.0,  tag:'push'  },
      aori:       { label:'煽り', power:1.05, tag:'break' },
      home:       { label:'誉め殺し', power:0.95, tag:'flow' },
      kirikaeshi: { label:'切り返し', power:1.1,  tag:'break' }
    };
    return map[cmdId] || map.kogeki;
  }

  _mapCmdId(id){
    const m = { attack:'kogeki', taunt:'aori', praise:'home', counter:'kirikaeshi' };
    return m[id] || id;
  }

  _pickPlayerLine(cmdId){
    const key = cmdId;

    if (this.type === 'guest'){
      const by = this.linesGuest?.byGuest?.[this.id]?.player?.[key] || [];
      const common = this.linesGuest?.player?.[key] || [];
      return this._pick(by.length ? by : common) || 'レイ「……」';
    } else {
      const arr = this.linesCabajo?.player?.[key] || [];
      return this._pick(arr) || 'レイ「……」';
    }
  }

  _pickGuestEnemyAfter(cmdId){
    const afterKey = {
      kogeki: 'after_kogeki',
      aori: 'after_aori',
      home: 'after_home',
      kirikaeshi: 'after_kirikaeshi'
    }[cmdId] || 'after_kogeki';

    const by = this.linesGuest?.byGuest?.[this.id]?.enemy?.[afterKey] || [];
    const common = this.linesGuest?.enemy?.[afterKey] || [];

    return this._pick(by.length ? by : common) || '客「……で？」';
  }

  _pickCabajoEnemyReply(cmdId){
    const k = {
      kogeki: 'after_kogeki',
      aori: 'after_aori',
      home: 'after_home',
      kirikaeshi: 'after_kirikaeshi'
    }[cmdId] || 'after_kogeki';

    const a = this.enemy?.lines?.[k];
    if (a && a.length) return this._pick(a);

    // 返しが無いなら空でいい（テンポ優先）
    return '';
  }

  _pick(arr){
    if (!arr || !arr.length) return '';
    return String(arr[Math.floor(Math.random() * arr.length)]);
  }

  _setMessage(s){
    if (this.ui) this.ui.setMessage(s || '');
  }

  _syncHud(forceLayout=false){
    if (!this.ui) return;
    if (forceLayout) this.ui.layout(this.scale.width, this.scale.height);

    this.ui.setHpTag('player', this.reiSprite, this.rei.name, this.rei.hp, this.rei.maxHp);
    this.ui.setHpTag('enemy',  this.enemySprite, this.enemy.name, this.enemy.hp, this.enemy.maxHp);
  }

  _hitFlash(alpha=0.28){
    if (!this.flash) return;
    this.flash.setAlpha(alpha);
    this.tweens.add({ targets:this.flash, alpha:0, duration:180, ease:'Quad.easeOut' });
    this.cameras.main.shake(70, 0.0045);
  }

  // =========================
  // help system
  // =========================
  _initHelpCandidate(dbCabajo){
    // 倒したキャバ嬢一覧
    const defeated = this.state?.progress?.defeatedCabajo || {};
    const ids = Object.keys(defeated).filter(id => !!defeated[id]);

    // 自分自身は呼ばない（再戦で自分がヘルプは変）
    const filtered = ids.filter(id => id && id !== this.id);

    if (!filtered.length){
      this.help.id = null;
      return;
    }

    // guestの方が出やすい（テンポ用）
    const chance = (this.type === 'guest') ? 0.40 : 0.30;

    // バトル開始時点で候補を固定（途中でセーブが変わってもブレない）
    const pickId = Phaser.Utils.Array.GetRandom(filtered);

    const d = dbCabajo?.[pickId];
    const name = d?.name || pickId;
    const expr = `${pickId}_normal`;

    // テクスチャ無いなら無効化（事故防止）
    if (!this._texExists(expr)){
      this.help.id = null;
      return;
    }

    this.help.id = pickId;
    this.help.name = name;
    this.help.expr = expr;
    this.help.chance = chance;
  }

  _maybeDoHelpAttack(){
    if (!this.help || this.help.used) return null;
    if (!this.help.id) return null;

    // 終盤は出さない（勝敗の余韻を邪魔しない）
    if (this.enemy.hp <= 0 || this.rei.hp <= 0) return null;

    // ランダム発火（バトル中1回だけ）
    if (Math.random() > (this.help.chance || 0)) return null;

    this.help.used = true;

    const lines = [];
    lines.push(`${this.help.name}がヘルプについた`);

    // ダメージは「盛りすぎない」固定寄り
    const base = Math.floor((this.rei.atk || 16) * 0.35);
    const roll = Phaser.Math.Between(2, 7);
    const dmg = Phaser.Math.Clamp(base + roll, 6, 22);

    this.enemy.hp = Math.max(0, this.enemy.hp - dmg);
    lines.push(`${this.help.name}の援護  ${dmg}ダメージ`);

    // カットイン演出
    this._playHelpCutin();

    // ついでに敵ヒット演出
    this._hitFlash(0.14);
    if (this.type === 'cabajo') this._blinkEnemyHit();

    return lines;
  }

  _playHelpCutin(){
    // 既に出てたら更新だけ
    if (this.help?.sprite){
      this.help.sprite.destroy(true);
      this.help.sprite = null;
    }
  
    const w = this.scale.width;
    const h = this.scale.height;
  
    // 立ち絵と同じ「足元」基準（ログ枠の上）
    const bottomY = (this.ui?.getPortraitBottomY)
      ? this.ui.getPortraitBottomY()
      : Math.floor(h * 0.62);
  
    const cx = Math.floor(w * 0.5);
  
    // container（全体まとめてスライド）
    const c = this.add.container(0, 0)
      .setDepth(980)
      .setScrollFactor(0);
  
    this.help.sprite = c;
  
    // 画像（足元合わせ）
    const img = this.add.image(cx, bottomY, this.help.expr)
      .setOrigin(0.5, 1)
      .setScale(0.52);
  
    // 文字はログ枠に被らないよう「足元より上」に
    const name = this.help?.name || '？？？';
    const msgY = Math.floor(bottomY - (img.displayHeight * 0.78));
    const msg = this.add.text(cx, msgY, `${name}がヘルプについた`, {
      fontSize:'26px',
      color:'#fff',
      backgroundColor:'rgba(0,0,0,0.62)',
      padding:{ left:16, right:16, top:10, bottom:10 }
    }).setShadow(2,2,'#000',2).setOrigin(0.5, 0.5);
  
    // 光帯は「メッセ周辺」にだけ出す（上に飛ばない）
    const bandH = Math.max(90, Math.floor(h * 0.13));
    const bandY = msgY;
    const band = this.add.rectangle(cx, bandY, Math.floor(w*0.92), bandH, 0xffffff, 0.10)
      .setOrigin(0.5, 0.5);
    band.blendMode = Phaser.BlendModes.ADD;
  
    const lineTop = this.add.rectangle(cx, bandY - Math.floor(bandH*0.48), Math.floor(w*0.92), 2, 0xffffff, 0.18)
      .setOrigin(0.5, 0.5);
    lineTop.blendMode = Phaser.BlendModes.ADD;
  
    c.add([band, lineTop, img, msg]);
  
    // どっちから入るか
    const fromLeft = (Math.random() < 0.5);
    c.x = fromLeft ? -Math.floor(w * 1.05) : Math.floor(w * 1.05);
    c.y = 0;
    c.setAlpha(0);
  
    // 中央へ
    this.tweens.add({
      targets: c,
      x: 0,
      alpha: 1,
      duration: 150,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        // 反動ちょい
        this.tweens.add({
          targets: c,
          x: fromLeft ? 14 : -14,
          duration: 90,
          ease: 'Quad.easeOut'
        });
      }
    });
  
    // 退場
    this.time.delayedCall(980, () => {
      if (!c || !c.scene) return;
      this.tweens.add({
        targets: c,
        alpha: 0,
        y: -6,
        duration: 180,
        ease: 'Quad.easeIn',
        onComplete: () => {
          c.destroy(true);
          if (this.help && this.help.sprite === c) this.help.sprite = null;
        }
      });
    });
  }
  
  

  // =========================
  // tag耐性 + 流れ（連打ペナ/切替ボナ）
  // =========================
  _getEnemyTagResist(tag){
    if (!tag) return 1.0;
    const tr = this.enemy?.traits?.tagResist;
    const v = tr?.[tag];
    return (typeof v === 'number') ? v : 1.0;
  }

  _calcStreakMultiplier(tag){
    if (!tag) return 1.0;

    const last = this.flow.lastTag;

    // 初手
    if (!last){
      this.flow.lastTag = tag;
      this.flow.streakCount = 0;
      return 1.0;
    }

    // 同tag連打：徐々に効きにくくする
    if (last === tag){
      this.flow.streakCount = Math.min(4, (this.flow.streakCount ?? 0) + 1);

      // 1回目 0.88 / 2回目 0.78 / 3回目 0.70 / 4回目 0.64
      const table = [1.0, 0.88, 0.78, 0.70, 0.64];
      const m = table[this.flow.streakCount] ?? 0.64;

      this.flow.lastTag = tag;
      return m;
    }

    // tag切替：ちょいボーナス
    this.flow.lastTag = tag;
    this.flow.streakCount = 0;
    return 1.05;
  }

  // =========================
  // mood（おすすめの最小構成）
  // - 露骨に表示しない
  // - 次ターンの刺さり方と反撃気味さだけ変える
  // - 遷移は「行動tag + outcome + 被ダメ」で決める
  // =========================
  _initialEnemyMood(){
    const p = String(this.enemy?.traits?.personality || '').toLowerCase();

    // personalityが無ければ calm
    if (!p) return MOOD.CALM;

    // 雑に初期気分だけ寄せる（ここは好みで調整）
    if (p.includes('queen') || p.includes('proud')) return MOOD.CALM;
    if (p.includes('shy') || p.includes('soft'))  return MOOD.EMBARRASSED;
    if (p.includes('hot') || p.includes('aggr'))  return MOOD.AGGRESSIVE;
    if (p.includes('clingy') || p.includes('jealous')) return MOOD.IRRITATED;

    return MOOD.CALM;
  }

  _getMoodMultiplier(tag){
    if (this.type !== 'cabajo') return 1.0;
    if (!tag) return 1.0;

    const mood = this.enemyMood || MOOD.CALM;

    // 刺さり方の基本テーブル（控えめに振ってる）
    const table = {
      [MOOD.CALM]:        { push:0.95, break:1.00, flow:1.05 },
      [MOOD.IRRITATED]:   { push:0.90, break:1.05, flow:1.12 },
      [MOOD.EMBARRASSED]: { push:1.12, break:0.92, flow:1.00 },
      [MOOD.AGGRESSIVE]:  { push:1.02, break:1.10, flow:0.88 }
    };

    const m = table[mood]?.[tag];
    return (typeof m === 'number') ? m : 1.0;
  }

  _getMoodCounterMul(){
    if (this.type !== 'cabajo') return 1.0;
    const mood = this.enemyMood || MOOD.CALM;

    const map = {
      [MOOD.CALM]:        0.92,
      [MOOD.IRRITATED]:   1.00,
      [MOOD.EMBARRASSED]: 0.96,
      [MOOD.AGGRESSIVE]:  1.10
    };
    return map[mood] ?? 1.0;
  }

  _advanceEnemyMood(tag, outcome, dmgToEnemy){
    if (this.type !== 'cabajo') return;

    const prev = this.enemyMood || MOOD.CALM;

    // 被ダメ量で刺激を少し入れる（大ダメほど荒れる）
    const hitLevel =
      (dmgToEnemy >= 18) ? 2 :
      (dmgToEnemy >= 10) ? 1 : 0;

    let next = prev;

    if (tag === 'push'){
      if (prev === MOOD.CALM) next = (hitLevel >= 1) ? MOOD.IRRITATED : MOOD.CALM;
      else if (prev === MOOD.EMBARRASSED) next = MOOD.IRRITATED;
      else if (prev === MOOD.IRRITATED) next = (hitLevel >= 2) ? MOOD.AGGRESSIVE : MOOD.IRRITATED;
      else if (prev === MOOD.AGGRESSIVE) next = MOOD.AGGRESSIVE;
    }

    if (tag === 'break'){
      if (prev === MOOD.CALM) next = (hitLevel >= 1) ? MOOD.EMBARRASSED : MOOD.CALM;
      else if (prev === MOOD.EMBARRASSED) next = (hitLevel >= 2) ? MOOD.IRRITATED : MOOD.EMBARRASSED;
      else if (prev === MOOD.IRRITATED) next = MOOD.EMBARRASSED;
      else if (prev === MOOD.AGGRESSIVE) next = (hitLevel >= 2) ? MOOD.IRRITATED : MOOD.AGGRESSIVE;
    }

    if (tag === 'flow'){
      if (prev === MOOD.AGGRESSIVE) next = MOOD.IRRITATED;
      else if (prev === MOOD.IRRITATED) next = MOOD.CALM;
      else if (prev === MOOD.EMBARRASSED) next = MOOD.CALM;
      else next = MOOD.CALM;
    }

    if (outcome === 'miss'){
      if (next === MOOD.CALM) next = MOOD.IRRITATED;
      else if (next === MOOD.IRRITATED) next = MOOD.AGGRESSIVE;
      else if (next === MOOD.EMBARRASSED) next = MOOD.IRRITATED;
    } else if (outcome === 'crit'){
      if (next === MOOD.CALM) next = MOOD.EMBARRASSED;
      else if (next === MOOD.IRRITATED) next = MOOD.EMBARRASSED;
      else if (next === MOOD.AGGRESSIVE) next = MOOD.IRRITATED;
    }

    this.enemyMood = next;
  }

  // =========================
  // save + return (NO progress updates here)
  // =========================
  _writeLastBattle(result){
    if (!result) return;

    this.state.lastBattle = {
      type: this.type || 'guest',
      id: this.id,
      result
    };
  }

  _returnToField(result){
    // HPは常に保存（lose時は全回復にする）
    if (this.state?.player){
      if (result === 'lose'){
        this.state.player.hp = this.rei.maxHp;
      } else {
        this.state.player.hp = this.rei.hp;
      }
    }

    this._writeLastBattle(result);

    storeSave(this.state);
    this.time.delayedCall(80, ()=> this.scene.start('Field'));
  }

  _saveAndReturnWin(){
    this._returnToField('win');
  }

  _saveAndReturnLose(){
    this._returnToField('lose');
  }

  _rollOutcome(attacker, defender){
    const diff = (attacker?.spd ?? 10) - (defender?.spd ?? 10);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    let miss = clamp(0.10 - diff * 0.01, 0.05, 0.20);
    let crit = clamp(0.12 + diff * 0.01, 0.06, 0.25);

    if (miss + crit > 0.40){
      const s = (miss + crit) / 0.40;
      miss /= s;
      crit /= s;
    }

    const r = Math.random();
    if (r < miss) return 'miss';
    if (r < miss + crit) return 'crit';
    return 'hit';
  }

  _pickEnemyLine(key){
    const arr = this.enemy?.lines?.[key] || [];
    return this._pick(arr);
  }

  // =========================
  // expression
  // =========================
  _texExists(key){
    return !!(key && this.textures.exists(key));
  }

  _setReiExpr(state){
    const key = `rei_${state}`;
    if (this.reiSprite && this._texExists(key)) this.reiSprite.setTexture(key);
    else if (this.reiSprite && this._texExists('rei_normal')) this.reiSprite.setTexture('rei_normal');
  }

  _setEnemyExpr(state){
    if (this.type !== 'cabajo'){
      // guest は差分表情が無い前提
      return;
    }
    const key = `${this.enemy.id}_${state}`;
    if (this.enemySprite && this._texExists(key)) this.enemySprite.setTexture(key);
    else if (this.enemySprite && this._texExists(`${this.enemy.id}_normal`)) this.enemySprite.setTexture(`${this.enemy.id}_normal`);
  }

  // ★競合しない blink（対象を分ける + トークンで古いタイマーを捨てる）
  _blinkTo(sprite, setFn, resetFn, ms=160){
    if (!sprite) return;

    sprite.__blinkToken = (sprite.__blinkToken ?? 0) + 1;
    const token = sprite.__blinkToken;

    setFn?.();

    this.time.delayedCall(ms, ()=>{
      if (sprite.__blinkToken !== token) return;
      if (this.phase === PHASE.TURN_END) return;
      resetFn?.();
    });
  }

  _blinkEnemyHit(){
    if (this.type !== 'cabajo') return;
    this._blinkTo(
      this.enemySprite,
      ()=> this._setEnemyExpr('hit'),
      ()=> this._setEnemyExpr('normal'),
      160
    );
  }

  _blinkReiHit(){
    this._blinkTo(
      this.reiSprite,
      ()=> this._setReiExpr('hit'),
      ()=> this._setReiExpr('normal'),
      160
    );
  }

  shutdown(){
    if (this._onResize) this.scale.off('resize', this._onResize);
    if (this.ui) this.ui.destroy();
    if (this.help?.sprite){
      this.help.sprite.destroy();
      this.help.sprite = null;
    }
  }
}
