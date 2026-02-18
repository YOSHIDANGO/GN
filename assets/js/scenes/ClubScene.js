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
    // character def (暫定：cacheに無ければデフォ)
    // =========================
    const defKey = `club_char_${this.characterId}`; // BootSceneで load.json('club_char_rei', ...) する想定
    const def = this.cache.json.get(defKey) || {};

    this.char = {
      id: this.characterId,
      name: def.name || 'レイ',
      portraitKey: def.portraitKey || 'rei_normal', // 立ち絵キー（仮）
      bgKey: def.bgKey || 'bg_shop_inside',

      irritation_threshold: Number(def.irritation_threshold ?? 70),
      irritation_sensitivity: Number(def.irritation_sensitivity ?? 1.0),
      forgiveness_rate: Number(def.forgiveness_rate ?? 2.0),

      // 使うのは後でOK（MVPでは保持だけ）
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
    this.bg = this.add.image(0, 0, this.char.bgKey).setOrigin(0.5,0.5);

    const fitBg = () => {
      const w = this.scale.width;
      const h = this.scale.height;
      this.bg.setPosition(w/2, h/2);
      const sx = w / (this.bg.width || 1);
      const sy = h / (this.bg.height || 1);
      this.bg.setScale(Math.max(sx, sy));
    };

    // Dialogue UI（NPCのセリフ表示に使う）
    this.ui = new DialogueUI(this);

    // 立ち絵（中央寄せで配置）
    this.portrait = this.add.image(0, 0, this.char.portraitKey)
      .setOrigin(0.5, 1)
      .setDepth(900);

    // ターン表示
    this.turnText = this.add.text(0, 0, '', {
      fontSize:'18px',
      color:'#ffffff'
    }).setShadow(2,2,'#000',2).setDepth(2000).setScrollFactor(0);

    // 入力欄（PC用：スマホでは非表示）
    this.inputBox = this.add.rectangle(0, 0, 100, 46, 0x000000, 0.55)
      .setOrigin(0.5, 1)
      .setDepth(2000)
      .setScrollFactor(0);

    this.inputText = this.add.text(0, 0, '', {
      fontSize:'18px',
      color:'#ffffff'
    }).setDepth(2001).setScrollFactor(0);

    this.hintText = this.add.text(0, 0, 'Enterで送信 / Backspaceで消す', {
      fontSize:'14px',
      color:'#ffffff'
    }).setAlpha(0.75).setDepth(2001).setScrollFactor(0);

    // デバッグ（irritation非表示が本番だけど、MVPは切替できるように）
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

    // 入力バッファ（PC用）
    this.buf = '';
    this.maxChars = 60;

    // =========================
    // DOM input (スマホ用)
    // =========================
    this.domInput = null;
    this.domInputEl = null;
    this.domFocused = false;

    if (this.isTouch){
      const wrap = document.createElement('div');
      wrap.style.width = '100%';
      wrap.style.display = 'block';

      const input = document.createElement('input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.autocapitalize = 'none';
      input.spellcheck = false;
      input.placeholder = 'ここに入力';

      input.style.width = '100%';
      input.style.height = '48px';
      input.style.fontSize = '18px';
      input.style.padding = '0 14px';
      input.style.borderRadius = '14px';
      input.style.border = '1px solid rgba(255,255,255,0.25)';
      input.style.background = 'rgba(0,0,0,0.55)';
      input.style.color = '#fff';
      input.style.outline = 'none';

      wrap.appendChild(input);

      this.domInput = this.add.dom(0, 0, wrap).setDepth(3000);
      this.domInputEl = input;

      const doSend = () => {
        if (this.ended) return;
        if (this.pending) return;

        const v = (input.value || '').trim();
        if (!v) return;
        input.value = '';
        this._submitText(v);
        input.blur();
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter'){
          e.preventDefault();
          doSend();
        }
      });

      input.addEventListener('focus', () => { this.domFocused = true; });
      input.addEventListener('blur',  () => { this.domFocused = false; });
    }

    // スマホはPC入力UIを消す
    if (this.isTouch){
      this.inputBox.setVisible(false);
      this.inputText.setVisible(false);
      this.hintText.setVisible(false);
    }

    // =========================
    // send button (Phaser)
    // =========================
    this.sendBtnBg = this.add.rectangle(0, 0, 160, 54, 0x000000, 0.65)
      .setStrokeStyle(2, 0xffffff, 0.25)
      .setOrigin(0.5, 1)
      .setDepth(2000)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    this.sendBtnTx = this.add.text(0, 0, '送信', {
      fontSize:'18px',
      color:'#ffffff'
    })
      .setOrigin(0.5, 1)
      .setDepth(2001)
      .setScrollFactor(0);

    this.sendBtnBg.on('pointerdown', () => {
      if (this.ended) return;
      if (this.pending) return;

      if (this.isTouch && this.domInputEl){
        const v = (this.domInputEl.value || '').trim();
        if (!v) return;
        this.domInputEl.value = '';
        this._submitText(v);
        this.domInputEl.blur();
        return;
      }

      // PCはbuf送信
      this._submit();
    });

    // =========================
    // interaction (PC)
    // =========================
    this.keyEsc = this.input.keyboard.addKey('ESC');

    this._onKeyDown = (ev) => {
      if (this.ended) return;
      if (this.isTouch) return; // スマホはDOM側で入力
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
        this._renderInput();
        return;
      }
      if (k === 'Escape'){
        this._endAndReturn();
        return;
      }

      if (k && k.length === 1){
        if (this.buf.length >= this.maxChars) return;
        this.buf += k;
        this._renderInput();
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

      // =========================
      // bottom input bar (DOM + send btn)
      // =========================
      const bottomMargin = Math.max(12, Math.floor(h * 0.02));
      const barH = Math.max(56, Math.floor(h * 0.08));
      const barY = h - bottomMargin;

      const btnW = Math.min(210, Math.floor(w * 0.22));
      const btnH = barH;
      const gap = Math.max(10, Math.floor(w * 0.02));

      const leftPad = Math.max(14, Math.floor(w * 0.03));
      const rightPad = Math.max(14, Math.floor(w * 0.03));

      const inputW = Math.max(220, w - leftPad - rightPad - btnW - gap);

      // DOM input（左）
      if (this.domInput){
        this.domInput.setPosition(leftPad + inputW/2, barY - barH/2);
        this.domInput.node.style.width = `${inputW}px`;
      }

      // PC用見た目（必要なら後で削る。今はスマホで非表示）
      if (!this.isTouch){
        const boxW = Math.min(1180, w - leftPad*2);
        this.inputBox.setPosition(w/2, barY);
        this.inputBox.setSize(boxW, barH);

        const padX = Math.max(18, Math.floor(boxW*0.02));
        this.inputText.setPosition(w/2 - boxW/2 + padX, barY - barH + Math.max(12, Math.floor(barH*0.25)));
        this.hintText.setPosition(w/2 - boxW/2 + padX, barY - Math.max(20, Math.floor(barH*0.22)));
      }

      // 送信ボタン（右）
      const btnX = leftPad + inputW + gap + btnW/2;
      this.sendBtnBg.setPosition(btnX, barY);
      this.sendBtnBg.setSize(btnW, btnH);
      this.sendBtnTx.setPosition(btnX, barY - Math.floor(btnH*0.28));

      // =========================
      // portrait（中央寄せ）
      // =========================
      const bottomY = this.ui.getPortraitBottomY(Math.max(8, Math.floor(h * 0.015)));
      this.portrait.setPosition(Math.floor(w*0.5), bottomY);

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
    this._renderInput();

    // まず1行目（仮）
    this._showNpc('いらっしゃい。今日はどうする');
  }

  update(){
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)){
      this._endAndReturn();
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

  _renderInput(){
    const cursor = (this.time.now % 900 < 450) ? '▍' : ' ';
    const s = (this.buf || '');
    this.inputText.setText(`> ${s}${cursor}`);
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
    this._renderInput();
    this._submitText(text);
  }

  async _submitText(text){
    if (this.ended) return;
    if (this.pending) return;

    this.pending = true;
    this.sendBtnBg.disableInteractive();
    this.sendBtnBg.setAlpha(0.55);

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
        this.sendBtnBg.setAlpha(1);
        this.sendBtnBg.setInteractive({ useHandCursor:true });
      }
    }
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

    const w = this.scale.width;
    const h = this.scale.height;

    this.endOverlay = this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.35)
      .setDepth(4000)
      .setScrollFactor(0)
      .setInteractive();

    const hasBoy = this.textures.exists(this.boyKey);
    if (hasBoy){
      this.endBoy = this.add.image(
        w - Math.floor(w*0.16),
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

    this.endBox = this.add.rectangle(w/2, boxY, boxW, boxH, 0x000000, 0.65)
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

    if (this.domInput){
      this.domInput.destroy();
      this.domInput = null;
      this.domInputEl = null;
    }

    if (this.endOverlay){ this.endOverlay.destroy(); this.endOverlay = null; }
    if (this.endBoy){ this.endBoy.destroy(); this.endBoy = null; }
    if (this.endBox){ this.endBox.destroy(); this.endBox = null; }
    if (this.endText){ this.endText.destroy(); this.endText = null; }

    if (this.sendBtnBg){ this.sendBtnBg.destroy(); this.sendBtnBg = null; }
    if (this.sendBtnTx){ this.sendBtnTx.destroy(); this.sendBtnTx = null; }
  }
}
