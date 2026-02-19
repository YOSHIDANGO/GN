// assets/js/scenes/ClubScene.js
import { DialogueUI } from '../ui/DialogueUI.js';

export class ClubScene extends Phaser.Scene {
  constructor(){ super('Club'); }

  create(data){
    // =========================
    // basic routing
    // =========================
    this.returnTo = data?.returnTo || 'Field';
    this.characterId = data?.characterId || 'rei';
    this.boyKey = data?.boyKey || 'boy_normal';

    this.input.setTopOnly(true);

    // スマホ判定（ざっくり）
    this.isTouch = !this.sys.game.device.os.desktop;

    // 送信中ガード
    this.pending = false;

    // =========================
    // character def（表示だけに使う）
    // =========================
    const defKey = `club_char_${this.characterId}`;
    const def = this.cache.json.get(defKey) || {};

    this.char = {
      id: this.characterId,
      name: def.name || 'レイ',
      portraitKey: def.portraitKey || 'rei_normal',
      bgKey: def.bgKey || 'bg_shop_inside',

      irritation_threshold: Number(def.irritation_threshold ?? 70)
    };

    // =========================
    // local state（正はクライアント）
    // =========================
    this.turn = 1;
    this.affinity = 0;
    this.interest = 0;
    this.irritation = 0;

    this.ended = false;
    this.lastPlayerText = '';
    this.lastNpcText = '';

    // =========================
    // visuals
    // =========================
    this.bg = this.add.image(0, 0, this.char.bgKey).setOrigin(0.5, 0.5);

    const fitBg = () => {
      const w = this.scale.width;
      const h = this.scale.height;
      this.bg.setPosition(w/2, h/2);
      const sx = w / (this.bg.width || 1);
      const sy = h / (this.bg.height || 1);
      this.bg.setScale(Math.max(sx, sy));
    };

    // Dialogue UI
    this.ui = new DialogueUI(this);

    // 立ち絵（中央寄せ）
    this.portrait = this.add.image(0, 0, this.char.portraitKey)
      .setOrigin(0.5, 1)
      .setDepth(900);

    // ターン表示
    this.turnText = this.add.text(0, 0, '', {
      fontSize:'18px',
      color:'#ffffff'
    }).setShadow(2,2,'#000',2).setDepth(2000).setScrollFactor(0);

    // デバッグ
    this.debug = {
      show: !!data?.debug,
      text: null
    };
    if (this.debug.show){
      this.debug.text = this.add.text(0, 0, '', {
        fontSize:'14px',
        color:'#ffffff'
      }).setShadow(2,2,'#000',2).setDepth(2001).setScrollFactor(0);
    }

    // =========================
    // PC input buffer（見た目は出さない）
    // =========================
    this.buf = '';
    this.maxChars = 60;

    // =========================
    // fixed input bar (スマホ用 / DOMはPhaser外)
    // =========================
    this._fixedBar = null;
    this._fixedInput = null;
    this._fixedSend = null;

    if (this.isTouch){
      this._createFixedInputBar();
    }

    // =========================
    // interaction (PC)
    // =========================
    this.keyEsc = this.input.keyboard.addKey('ESC');

    this._onKeyDown = (ev) => {
      if (this.ended) return;
      if (this.isTouch) return;
      if (this.pending) return;

      const k = ev.key;

      if (k === 'Enter'){
        ev.preventDefault?.();
        this._submit();
        return;
      }
      if (k === 'Backspace'){
        ev.preventDefault?.();
        this.buf = this.buf.slice(0, -1);
        return;
      }
      if (k === 'Escape'){
        this._endAndReturn();
        return;
      }

      if (k && k.length === 1){
        if (this.buf.length >= this.maxChars) return;
        this.buf += k;
      }
    };

    this.input.keyboard.on('keydown', this._onKeyDown);

    // =========================
    // resize/layout
    // =========================
    const layout = () => {
      const w = this.scale.width;
      const h = this.scale.height;

      fitBg();

      this.turnText.setPosition(
        Math.max(14, Math.floor(w*0.02)),
        Math.max(10, Math.floor(h*0.02))
      );

      const bottomY = this.ui.getPortraitBottomY(Math.max(8, Math.floor(h * 0.015)));
      this.portrait.setPosition(Math.floor(w * 0.5), bottomY);

      const safeTop = Math.max(10, Math.floor(h*0.02));
      const maxH = Math.max(220, bottomY - safeTop);
      const maxW = Math.min(Math.floor(w * 0.60), 820);

      const texW = this.portrait.width || 1;
      const texH = this.portrait.height || 1;
      const s = Math.min(0.62, maxH/texH, maxW/texW);
      this.portrait.setScale(s);

      if (this.debug.text){
        this.debug.text.setPosition(w - 10, 10).setOrigin(1,0);
      }
    };

    layout();
    this._onResize = () => this.time.delayedCall(0, layout);
    this.scale.on('resize', this._onResize);

    // 初回表示（stateless）
    this._renderTurn();
    this._showNpc('いらっしゃい。今日はどうする');

    this.events.once('shutdown', () => {
        this._cleanup();
    });
    this.events.once('destroy', () => {
        this._cleanup();
    });
  
  }

  update(){
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)){
      this._endAndReturn();
    }
  }

  // =========================
  // fixed input bar helpers
  // =========================
  _createFixedInputBar(){
    this._destroyFixedInputBar();

    const bar = document.createElement('div');
    bar.id = 'club-fixed-bar';

    bar.style.position = 'fixed';
    bar.style.left = '0';
    bar.style.right = '0';
    bar.style.bottom = '0';
    bar.style.zIndex = '99999';
    bar.style.padding = '10px 12px calc(10px + env(safe-area-inset-bottom)) 12px';
    bar.style.background = 'rgba(0,0,0,0.35)';
    bar.style.backdropFilter = 'blur(6px)';
    bar.style.webkitBackdropFilter = 'blur(6px)';
    bar.style.boxSizing = 'border-box';

    bar.innerHTML = `
      <div style="
        display:flex;
        gap:10px;
        align-items:center;
        width:100%;
        box-sizing:border-box;
      ">
        <input id="club-fixed-input" type="text" placeholder="ここに入力"
          style="
            flex:1;
            min-width:0;
            height:48px;
            font-size:18px;
            padding:0 14px;
            border-radius:14px;
            border:1px solid rgba(255,255,255,0.25);
            background:rgba(0,0,0,0.55);
            color:#fff;
            outline:none;
            box-sizing:border-box;
          "
        />
        <button id="club-fixed-send"
          style="
            width:110px;
            height:48px;
            font-size:16px;
            border-radius:14px;
            border:1px solid rgba(255,255,255,0.25);
            background:rgba(0,0,0,0.55);
            color:#fff;
            box-sizing:border-box;
          "
        >送信</button>
      </div>
    `;

    document.body.appendChild(bar);

    const input = bar.querySelector('#club-fixed-input');
    const btn = bar.querySelector('#club-fixed-send');

    const doSend = () => {
      if (this.ended) return;
      if (this.pending) return;

      const v = (input.value || '').trim();
      if (!v) return;

      input.value = '';
      this._submitText(v);
      input.blur();
    };

    btn.addEventListener('click', doSend);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter'){
        e.preventDefault();
        doSend();
      }
    });

    this._fixedBar = bar;
    this._fixedInput = input;
    this._fixedSend = btn;
  }

  _destroyFixedInputBar(){
    if (this._fixedBar){
      this._fixedBar.remove();
      this._fixedBar = null;
      this._fixedInput = null;
      this._fixedSend = null;
    }
  }

  _setFixedBarEnabled(enabled){
    if (!this.isTouch) return;
    if (!this._fixedInput || !this._fixedSend) return;

    this._fixedInput.disabled = !enabled;
    this._fixedSend.disabled = !enabled;

    this._fixedInput.style.opacity = enabled ? '1' : '0.6';
    this._fixedSend.style.opacity = enabled ? '1' : '0.6';
  }

  // =========================
  // render helpers
  // =========================
  _renderTurn(){
    const t = `Turn ${this.turn}/10`;
    this.turnText.setText(t);

    if (this.debug.text){
      this.debug.text.setText(
        `aff=${this.affinity} int=${this.interest} irr=${this.irritation}`
      );
    }
  }

  _showNpc(text){
    this.lastNpcText = text || '';
    this.ui.setName(this.char.name);
    this.ui.setText(this.lastNpcText);
  }

  // =========================
  // night summary（ローカル生成）
  // =========================
  _buildNightSummary(){
    const t =
      this.turn <= 3 ? '序盤' :
      this.turn <= 7 ? '中盤' : '終盤';

    const mood =
      this.irritation >= 70 ? '空気ピリつき' :
      this.affinity >= 30 ? '距離近め' :
      this.interest >= 60 ? 'ノリ良め' :
      '様子見';

    // 必要なら topic とかここに足す（固定で短く）
    const extra = '';

    const s = `${t}。${mood}。${extra}`.trim();
    return s.length > 60 ? s.slice(0, 60) : s;
  }

  // =========================
  // turn flow
  // =========================
  _submit(){
    const text = (this.buf || '').trim();
    if (!text) return;

    this.buf = '';
    this._submitText(text);
  }

  async _submitText(text){
    if (this.ended) return;
    if (this.pending) return;

    this.pending = true;
    this._setFixedBarEnabled(false);

    try {
      this.lastPlayerText = text;

      const payload = this._makeTurnPayload(text);
      const out = await this._callServer(payload);

      // stateless：常にdeltaで更新（クライアントが正）
      const d = out?.delta || { affinity:0, interest:0, irritation:0 };

      this.affinity += Number(d.affinity || 0);
      this.interest += Number(d.interest || 0);
      this.irritation = Math.max(0, this.irritation + Number(d.irritation || 0));

      // clamp
      this.affinity = Phaser.Math.Clamp(this.affinity, -50, 999);
      this.interest = Phaser.Math.Clamp(this.interest, -50, 999);
      this.irritation = Phaser.Math.Clamp(this.irritation, 0, 999);

      this.turn += 1;
      this._renderTurn();

      // 表示
      this._showNpc(out?.npcText || '……');

      // 終了判定（基本はサーバ flags）
      const forceEnd = !!out?.flags?.forceEnd;

      if (forceEnd){
        this._finishNight({ forced:true });
        return;
      }

      // 10ターン（表示上は turn/10）
      if (this.turn > 10){
        this._finishNight({ forced:false });
        return;
      }

    } finally {
      this.pending = false;
      if (!this.ended){
        this._setFixedBarEnabled(true);
      }
    }
  }

  _makeTurnPayload(playerText){
    return {
      characterId: this.characterId,
      turn: this.turn,

      affinity: this.affinity,
      interest: this.interest,
      irritation: this.irritation,
      threshold: this.char.irritation_threshold,

      nightSummary: this._buildNightSummary(),

      last: {
        npcText: this.lastNpcText || '',
        playerText: this.lastPlayerText || ''
      },

      playerText
    };
  }

  async _callServer(payload){
    try {
      const res = await fetch('/api/club/turn', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      let json = await res.json();
      if (!json || typeof json !== 'object') json = {};

      if (typeof json.npcText !== 'string') json.npcText = '……';

      if (!json.signals || typeof json.signals !== 'object'){
        json.signals = { mood:'soft', distance:0 };
      } else {
        if (typeof json.signals.mood !== 'string') json.signals.mood = 'soft';
        if (typeof json.signals.distance !== 'number') json.signals.distance = 0;
      }

      if (!json.delta || typeof json.delta !== 'object'){
        json.delta = { affinity:0, interest:0, irritation:0 };
      } else {
        json.delta.affinity = Number(json.delta.affinity || 0);
        json.delta.interest = Number(json.delta.interest || 0);
        json.delta.irritation = Number(json.delta.irritation || 0);
      }

      if (!json.flags || typeof json.flags !== 'object'){
        json.flags = { forceEnd:false };
      } else {
        json.flags.forceEnd = !!json.flags.forceEnd;
      }

      return json;

    } catch (e){
      // サーバ死んだ時：最低限の形
      return {
        npcText: 'ごめん、聞き取れなかった',
        signals: { mood:'neutral', distance:0 },
        delta: { affinity:0, interest:0, irritation:0 },
        flags: { forceEnd:false }
      };
    }
  }

  // =========================
  // end flow (boy)
  // =========================
  _finishNight({ forced }){
    this.ended = true;
    this._setFixedBarEnabled(false);

    // 会話UIを薄くして被り軽減
    if (this.ui?.backdrop) this.ui.backdrop.setAlpha(0.35);
    if (this.ui?.nameText) this.ui.nameText.setAlpha(0.55);
    if (this.ui?.bodyText) this.ui.bodyText.setAlpha(0.55);

    this.time.delayedCall(220, () => {
      const w = this.scale.width;
      const h = this.scale.height;

      this.endOverlay = this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.25)
        .setDepth(4000)
        .setScrollFactor(0)
        .setInteractive();

      const boxW = Math.min(760, Math.floor(w*0.88));
      const boxH = 88;

      const baseY = (this.ui?.backdrop)
        ? (this.ui.backdrop.y - this.ui.backdrop.height * 0.55)
        : (h - Math.floor(h*0.22));

      const boxY = Math.max(Math.floor(h*0.20), baseY);

      this.endBox = this.add.rectangle(w/2, boxY, boxW, boxH, 0x000000, 0.70)
        .setStrokeStyle(2, 0xffffff, 0.22)
        .setOrigin(0.5, 0.5)
        .setDepth(4100)
        .setScrollFactor(0);

      this.endText = this.add.text(w/2, boxY, 'お時間です', {
        fontSize:'22px',
        color:'#ffffff'
      })
        .setOrigin(0.5, 0.5)
        .setDepth(4101)
        .setScrollFactor(0);

      const hasBoy = this.textures.exists(this.boyKey);
      if (hasBoy){
        const targetX = w - Math.floor(w*0.14);
        const targetY = h - Math.floor(h*0.03);

        this.endBoy = this.add.image(w + 200, targetY, this.boyKey)
          .setOrigin(0.5, 1)
          .setScale(0.55)
          .setDepth(4090)
          .setScrollFactor(0);

        this.tweens.add({
          targets: this.endBoy,
          x: targetX,
          duration: 180,
          ease: 'Sine.out'
        });
      } else {
        this.endBoy = null;
      }

      this.endOverlay.on('pointerdown', () => {
        this._cleanup();

        this.scene.stop('Club');
        this.scene.launch('ClubResult', {
          returnTo: this.returnTo,
          characterId: this.characterId,
          affinity: this.affinity,
          interest: this.interest,
          irritation: this.irritation,
          threshold: this.char.irritation_threshold,
          forced: !!forced
        });
      });
    });
  }

  _endAndReturn(){
    this._cleanup();
    this.scene.stop('Club');
    this.scene.resume(this.returnTo);
  }

  _cleanup(){
    if (this._onResize){
      this.scale.off('resize', this._onResize);
      this._onResize = null;
    }
    if (this._onKeyDown){
      this.input.keyboard.off('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }

    this._destroyFixedInputBar();

    if (this.endOverlay){ this.endOverlay.destroy(); this.endOverlay = null; }
    if (this.endBoy){ this.endBoy.destroy(); this.endBoy = null; }
    if (this.endBox){ this.endBox.destroy(); this.endBox = null; }
    if (this.endText){ this.endText.destroy(); this.endText = null; }
  }
}
