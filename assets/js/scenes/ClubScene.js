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

    // 既存ボーイ画像キー（Field側から渡せる）
    this.boyKey = data?.boyKey || 'boy_normal';

    // ★下のSceneに入力落とさない
    this.input.setTopOnly(true);

    // スマホ判定（ざっくり）
    this.isTouch = !this.sys.game.device.os.desktop;

    // 送信中ガード
    this.pending = false;

    // =========================
    // character def
    // =========================
    const defKey = `club_char_${this.characterId}`;
    const def = this.cache.json.get(defKey) || {};

    this.char = {
      id: this.characterId,
      name: def.name || 'レイ',
      portraitKey: def.portraitKey || 'rei_normal',
      bgKey: def.bgKey || 'bg_shop_inside',

      irritation_threshold: Number(def.irritation_threshold ?? 70),
      irritation_sensitivity: Number(def.irritation_sensitivity ?? 1.0),
      forgiveness_rate: Number(def.forgiveness_rate ?? 2.0),

      sexual_tolerance: Number(def.sexual_tolerance ?? 1.0),
      ego_tolerance: Number(def.ego_tolerance ?? 1.0),
      clingy_tolerance: Number(def.clingy_tolerance ?? 1.0)
    };

    // =========================
    // state (1夜)
    // =========================
    this.turn = 1;
    this.affinity = 0;
    this.interest = 0;
    this.irritation = 0;

    this.ended = false;
    this.lastPlayerText = '';
    this.lastNpcText = '';

    // irritation 自然減衰（仮）
    this.irritationDecayPerTurn = 2;

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
      if (this.isTouch) return; // スマホはfixed bar
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

      // turn text
      this.turnText.setPosition(
        Math.max(14, Math.floor(w*0.02)),
        Math.max(10, Math.floor(h*0.02))
      );

      // portrait（中央寄せ）
      const bottomY = this.ui.getPortraitBottomY(Math.max(8, Math.floor(h * 0.015)));
      this.portrait.setPosition(Math.floor(w * 0.5), bottomY);

      const safeTop = Math.max(10, Math.floor(h*0.02));
      const maxH = Math.max(220, bottomY - safeTop);
      const maxW = Math.min(Math.floor(w * 0.60), 820);

      const texW = this.portrait.width || 1;
      const texH = this.portrait.height || 1;
      const s = Math.min(0.62, maxH/texH, maxW/texW);
      this.portrait.setScale(s);

      // debug
      if (this.debug.text){
        this.debug.text.setPosition(w - 10, 10).setOrigin(1,0);
      }
    };

    layout();
    this._onResize = () => this.time.delayedCall(0, layout);
    this.scale.on('resize', this._onResize);

    // 初回表示
    this._renderTurn();

    // まず1行目
    this._showNpc('いらっしゃい。今日はどうする');
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

  // =========================
  // render helpers
  // =========================
  _renderTurn(){
    const t = `Turn ${this.turn}/10`;
    this.turnText.setText(t);

    if (this.debug.text){
      this.debug.text.setText(
        `aff=${this.affinity}  int=${this.interest}  irr=${this.irritation}/${this.char.irritation_threshold}`
      );
    }
  }

  _showNpc(text){
    this.lastNpcText = text || '';
    this.ui.setName(this.char.name);
    this.ui.setText(this.lastNpcText);
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

      // 1) irritation 自然減衰
      this.irritation = Math.max(0, this.irritation - this.irritationDecayPerTurn);

      // 2) サーバ呼び出し
      const payload = this._makeTurnPayload(text);
      const out = await this._callServer(payload);

      // 3) 反映
      const dh = out?.deltaHint || { affinity:0, interest:0, irritation:0 };
      const irrDelta = Math.round((Number(dh.irritation)||0) * this.char.irritation_sensitivity);

      this.affinity += (Number(dh.affinity)||0);
      this.interest += (Number(dh.interest)||0);
      this.irritation += irrDelta;

      this.affinity = Phaser.Math.Clamp(this.affinity, -50, 999);
      this.interest = Phaser.Math.Clamp(this.interest, -50, 999);
      this.irritation = Phaser.Math.Clamp(this.irritation, 0, 999);

      // 4) 終了判定
      const threshold = this.char.irritation_threshold;
      const forceEnd = !!out?.flags?.forceEnd || (this.irritation >= threshold);

      // 5) 表示
      this._renderTurn();
      this._showNpc(out?.npcText || '……');

      // 6) ターン進行
      if (forceEnd){
        this._finishNight({ forced:true });
        return;
      }

      if (this.turn >= 10){
        this._finishNight({ forced:false });
        return;
      }

      this.turn += 1;
      this._renderTurn();

    } finally {
      this.pending = false;
      if (!this.ended){
        this._setFixedBarEnabled(true);
      }
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

  _makeTurnPayload(playerText){
    const mood =
      (this.irritation >= this.char.irritation_threshold) ? 'cold' :
      (this.irritation >= 60) ? 'cold' :
      (this.irritation >= 40) ? 'neutral' :
      'soft';

    const stateSummary =
      `turn=${this.turn}, aff=${this.affinity}, int=${this.interest}, irr=${this.irritation}, mood=${mood}`;

    return {
      sessionId: 'local_dummy',
      characterId: this.characterId,
      turn: this.turn,
      playerText,
      stateSummary,
      debugFlags: { local:true }
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

      const json = await res.json();

      if (!json.signals) json.signals = { mood:'soft', distance:0 };
      if (!json.deltaHint) json.deltaHint = { affinity:0, interest:0, irritation:0 };
      if (!json.flags) json.flags = { forceEnd:false };

      return json;
    } catch (e){
      return this._callServerDummy(payload);
    }
  }

  _callServerDummy(payload){
    const t = payload.turn;
    const s = payload.playerText.toLowerCase();

    let npcText = '';
    let da = 0, di = 0, dr = 0;

    if (/(hello|hi|hey)/.test(s)){
      npcText = 'ふーん。挨拶はできるんだ';
      da = 1; di = 0; dr = 0;
    } else if (/(cute|kawaii|かわい)/.test(s)){
      npcText = '…そういうの、嫌いじゃない';
      da = 2; di = 1; dr = -1;
    } else if (/(sex|エロ|やら|抱)/.test(s)){
      npcText = 'それ、場違い。空気読んで';
      da = -1; di = -1; dr = 10;
    } else if (/(sorry|ごめん|すま)/.test(s)){
      npcText = '…まぁ。次から気をつけて';
      da = 0; di = 0; dr = -4;
    } else {
      npcText = `へぇ。${t}ターン目ね。もう少し詳しく言って`;
      da = 0; di = 1; dr = 0;
    }

    if (this.irritation >= 60) npcText = npcText + '…';

    return {
      npcText,
      signals: {
        mood: (this.irritation >= 60) ? 'cold' : (this.irritation >= 40 ? 'neutral' : 'soft'),
        distance: (dr >= 6) ? -1 : (da >= 2 ? +1 : 0)
      },
      deltaHint: { affinity: da, interest: di, irritation: dr },
      flags: { forceEnd:false }
    };
  }

  // =========================
  // end flow (boy)
  // =========================
  _finishNight({ forced }){
    this.ended = true;
    this._setFixedBarEnabled(false);

    // ここで一旦会話UIを消して「被り」を避ける
    // DialogueUIに setVisible が無い場合でも、主に backdrop/text が画面下なので
    // 目立つのを抑えるためにカメラで少し暗転＋オーバーレイで上書きする
    const w = this.scale.width;
    const h = this.scale.height;

    this.endOverlay = this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.45)
      .setDepth(4000)
      .setScrollFactor(0)
      .setInteractive();

    // 少し間を作ってからボーイを出す（唐突感減）
    this.time.delayedCall(220, () => {
      const hasBoy = this.textures.exists(this.boyKey);

      if (hasBoy){
        this.endBoy = this.add.image(
          w - Math.floor(w*0.14),
          h - Math.floor(h*0.02),
          this.boyKey
        )
          .setOrigin(0.5, 1)
          .setScale(0.62)
          .setDepth(4100)
          .setScrollFactor(0);
      } else {
        this.endBoy = null;
      }

      const boxW = Math.min(720, Math.floor(w*0.84));
      const boxH = 86;
      const boxY = h - Math.floor(h*0.18);

      this.endBox = this.add.rectangle(w/2, boxY, boxW, boxH, 0x000000, 0.70)
        .setStrokeStyle(2, 0xffffff, 0.25)
        .setOrigin(0.5, 1)
        .setDepth(4100)
        .setScrollFactor(0);

      this.endText = this.add.text(
        w/2,
        boxY - Math.floor(boxH*0.52),
        'お時間です',
        { fontSize:'22px', color:'#ffffff' }
      )
        .setOrigin(0.5, 0.5)
        .setDepth(4101)
        .setScrollFactor(0);
    });

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

    // fixed bar
    this._destroyFixedInputBar();

    // end overlay
    if (this.endOverlay){ this.endOverlay.destroy(); this.endOverlay = null; }
    if (this.endBoy){ this.endBoy.destroy(); this.endBoy = null; }
    if (this.endBox){ this.endBox.destroy(); this.endBox = null; }
    if (this.endText){ this.endText.destroy(); this.endText = null; }
  }
}
