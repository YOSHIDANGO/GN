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

    this._runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this._resultMoving = false;

    // 送信中ガード
    this.pending = false;
    this._abortCtrl = null;

    this._offWakeResumeHandlers();
    this._destroyFixedInputBar();
    this._clearDbg();

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

    this._dbg(`Club create runId=${this._runId} returnTo=${this.returnTo} char=${this.characterId}`);

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
    this.bg = this.add.image(0, 0, this.char.bgKey).setOrigin(0.5, 0.5).setDepth(0);

    const fitBg = () => {
      const w = this.scale.width;
      const h = this.scale.height;
      this.bg.setPosition(w/2, h/2);
      const sx = w / (this.bg.width || 1);
      const sy = h / (this.bg.height || 1);
      this.bg.setScale(Math.max(sx, sy));
    };

    this.ui = null;
    this._recreateDialogueUi();

    this.portrait = this.add.image(0, 0, this.char.portraitKey)
      .setOrigin(0.5, 1)
      .setDepth(900);

    this.turnText = this.add.text(0, 0, '', {
      fontSize:'18px',
      color:'#ffffff'
    }).setShadow(2,2,'#000',2).setDepth(2000).setScrollFactor(0);

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

    this._fixedBar = null;
    this._fixedInput = null;
    this._fixedSend = null;
    this._fixedHandlers = null;

    this._createFixedInputBar();

    this._wakeHandler = () => this._onWakeOrResume();
    this._resumeHandler = () => this._onWakeOrResume();
    this.events.on('wake', this._wakeHandler);
    this.events.on('resume', this._resumeHandler);

    this.keyEsc = this.input.keyboard?.addKey('ESC');

    const layout = () => {
      const w = this.scale.width;
      const h = this.scale.height;

      fitBg();

      this.turnText.setPosition(
        Math.max(14, Math.floor(w*0.02)),
        Math.max(10, Math.floor(h*0.02))
      );

      let bottomY = h - Math.floor(h * 0.06);
      if (this.ui && this.ui.backdrop){
        const uiTop = this.ui.backdrop.y - (this.ui.backdrop.height || 0) / 2;
        bottomY = Math.min(bottomY, uiTop - 8);
      }

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

    this._renderTurn();
    this._showNpc('いらっしゃい。今日はどうする');

    this.events.once('shutdown', () => this._cleanup());
    this.events.once('destroy', () => this._cleanup());
  }

  update(){
    if (this.keyEsc && Phaser.Input.Keyboard.JustDown(this.keyEsc)){
      this._endAndReturn();
    }
  }

  _ensureDebugPanel(){}

  _dbg(message){}

  _clearDbg(){
    try{
      const el = document.getElementById('club-debug-panel');
      if (el) el.remove();
      this._debugPanel = null;
    }catch(_){ }
  }

  _offWakeResumeHandlers(){
    try{
      if (this._wakeHandler){
        this.events.off('wake', this._wakeHandler);
        this._wakeHandler = null;
      }
      if (this._resumeHandler){
        this.events.off('resume', this._resumeHandler);
        this._resumeHandler = null;
      }
    }catch(_){ }
  }


  _recreateDialogueUi(){
    try{
      if (this.ui && typeof this.ui.destroy === 'function'){
        this.ui.destroy(true);
      }
    }catch(_){ }
    this.ui = new DialogueUI(this);
    this._bringDialogueUiToTop();
  }

  _dialogueUiLooksBroken(){
    return !this.ui || !this.ui.bodyText || !this.ui.nameText || !this.ui.backdrop;
  }

  _bringDialogueUiToTop(){
    try{
      if (this.ui?.backdrop){
        this.ui.backdrop.setDepth(1800);
        this.children.bringToTop(this.ui.backdrop);
      }
      if (this.ui?.nameText){
        this.ui.nameText.setDepth(1801);
        this.children.bringToTop(this.ui.nameText);
      }
      if (this.ui?.bodyText){
        this.ui.bodyText.setDepth(1802);
        this.children.bringToTop(this.ui.bodyText);
      }
    }catch(_){ }
    try{
      if (this.turnText){
        this.turnText.setDepth(2000);
        this.children.bringToTop(this.turnText);
      }
      if (this.debug?.text){
        this.debug.text.setDepth(2001);
        this.children.bringToTop(this.debug.text);
      }
    }catch(_){ }
  }

  _ensureDialogueUiAlive(source=''){
    const broken = this._dialogueUiLooksBroken();
    this._dbg(`_ensureDialogueUiAlive source=${source} broken=${broken}`);
    if (broken){
      this._recreateDialogueUi();
    } else {
      this._bringDialogueUiToTop();
    }
  }

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
    bar.style.pointerEvents = 'auto';

    bar.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;width:100%;box-sizing:border-box;">
        <input id="club-fixed-input" type="text" placeholder="ここに入力"
          autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"
          inputmode="text"
          style="flex:1;min-width:0;height:48px;font-size:18px;padding:0 14px;border-radius:14px;border:1px solid rgba(255,255,255,0.25);background:rgba(0,0,0,0.55);color:#fff;outline:none;box-sizing:border-box;"
        />
        <button id="club-fixed-send" type="button"
          style="width:110px;height:48px;font-size:16px;border-radius:14px;border:1px solid rgba(255,255,255,0.25);background:rgba(0,0,0,0.55);color:#fff;box-sizing:border-box;"
        >送信</button>
      </div>
    `;

    document.body.appendChild(bar);

    const input = bar.querySelector('#club-fixed-input');
    const btn = bar.querySelector('#club-fixed-send');

    if (!input || !btn){
      bar.remove();
      return;
    }

    const myRunId = this._runId;

    const doSend = () => {
      this._dbg(`doSend start runId=${myRunId} current=${this._runId} ended=${this.ended} pending=${this.pending}`);

      if (myRunId !== this._runId){
        this._dbg('doSend blocked: stale run');
        return;
      }
      if (this.ended){
        this._dbg('doSend blocked: ended');
        return;
      }
      if (this.pending){
        this._dbg('doSend blocked: pending');
        return;
      }

      const v = (input.value || '').trim();
      this._dbg(`doSend value="${v}"`);
      if (!v){
        this._dbg('doSend blocked: empty');
        return;
      }

      input.value = '';
      this._dbg('doSend -> _submitText');
      this._submitText(v);
      input.blur();
    };

    const stopOnly = (e) => { e?.stopPropagation?.(); };
    const onBtnPointerDown = (e) => {
      e?.stopPropagation?.();
      doSend();
    };
    const onBtnClick = (e) => {
      e?.stopPropagation?.();
      doSend();
    };
    const onInputKeyDown = (e) => {
      if (e.key === 'Enter'){
        e.preventDefault();
        e.stopPropagation?.();
        doSend();
      }
    };

    bar.addEventListener('pointerdown', stopOnly, true);
    bar.addEventListener('touchstart', stopOnly, true);
    bar.addEventListener('mousedown', stopOnly, true);
    input.addEventListener('pointerdown', stopOnly, true);
    input.addEventListener('touchstart', stopOnly, true);
    input.addEventListener('mousedown', stopOnly, true);
    btn.addEventListener('pointerdown', onBtnPointerDown, true);
    btn.addEventListener('click', onBtnClick);
    input.addEventListener('keydown', onInputKeyDown);

    this._fixedHandlers = { stopOnly, onBtnPointerDown, onBtnClick, onInputKeyDown };
    this._fixedBar = bar;
    this._fixedInput = input;
    this._fixedSend = btn;
  }

  _destroyFixedInputBar(){
    try{
      const el = document.getElementById('club-fixed-bar');
      if (el && el !== this._fixedBar) el.remove();
    }catch(_){ }

    if (this._fixedBar){
      this._fixedBar.remove();
    }

    this._fixedBar = null;
    this._fixedInput = null;
    this._fixedSend = null;
    this._fixedHandlers = null;
  }

  _setFixedBarEnabled(enabled){
    if (!this._fixedInput || !this._fixedSend) return;
    this._fixedInput.disabled = !enabled;
    this._fixedSend.disabled = !enabled;
    this._fixedInput.style.opacity = enabled ? '1' : '0.6';
    this._fixedSend.style.opacity = enabled ? '1' : '0.6';
  }

  _onWakeOrResume(){
    this._dbg(`_onWakeOrResume runId=${this._runId} ended=${this.ended} pending=${this.pending}`);
    this.pending = false;
    this._ensureDialogueUiAlive('wake/resume');

    if (!this._fixedBar || !document.getElementById('club-fixed-bar')){
      this._createFixedInputBar();
    }

    if (!this.ended){
      this._setFixedBarEnabled(true);
      try{ this._fixedInput?.focus?.(); }catch(_){ }
    }

    if (this.input){
      this.input.enabled = true;
    }
  }

  _renderTurn(){
    const t = `Turn ${this.turn}/10`;
    this.turnText.setText(t);

    if (this.debug.text){
      this.debug.text.setText(
        `aff=${this.affinity} int=${this.interest} irr=${this.irritation}`
      );
    }
  }

  _formatNpcText(text){
    const src = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!src) return '';

    const normalized = src.replace(/\n{3,}/g, '\n\n');
    const parts = normalized.split(/\n+/);
    const maxChars = 30;
    const wrapped = [];

    const wrapChunk = (chunk) => {
      const chars = Array.from(chunk || '');
      let line = '';

      for (const ch of chars){
        line += ch;

        if ('。！？!?'.includes(ch) && line.length >= 6){
          wrapped.push(line);
          line = '';
          continue;
        }

        if (line.length >= maxChars){
          wrapped.push(line);
          line = '';
        }
      }

      if (line) wrapped.push(line);
    };

    for (let i = 0; i < parts.length; i += 1){
      wrapChunk(parts[i]);
      if (i < parts.length - 1){
        wrapped.push('');
      }
    }

    return wrapped.join('\n');
  }

  _showNpc(text){
    this.lastNpcText = this._formatNpcText(text || '');
    this._dbg(`_showNpc runId=${this._runId} text="${String(this.lastNpcText).slice(0, 60)}"`);
    this._ensureDialogueUiAlive('_showNpc');
    try{
      this.ui.setName(this.char.name);
      this.ui.setText(this.lastNpcText);
      this._bringDialogueUiToTop();
    }catch(e){
      this._dbg(`_showNpc recreate after error=${e?.message || e}`);
      this._recreateDialogueUi();
      this.ui.setName(this.char.name);
      this.ui.setText(this.lastNpcText);
      this._bringDialogueUiToTop();
    }
  }

  _buildNightSummary(){
    const t = this.turn <= 3 ? '序盤' : this.turn <= 7 ? '中盤' : '終盤';
    const mood =
      this.irritation >= 70 ? '空気ピリつき' :
      this.affinity >= 30 ? '距離近め' :
      this.interest >= 60 ? 'ノリ良め' :
      '様子見';

    const s = `${t}。${mood}。`.trim();
    return s.length > 60 ? s.slice(0, 60) : s;
  }

  async _submitText(text){
    this._dbg(`_submitText start text="${text}" ended=${this.ended} pending=${this.pending} runId=${this._runId}`);

    if (this.ended){
      this._dbg('_submitText return: ended');
      return;
    }
    if (this.pending){
      this._dbg('_submitText return: pending');
      return;
    }

    this.pending = true;
    this._setFixedBarEnabled(false);
    this._dbg('_submitText pending=true disabled=true');

    try {
      this.lastPlayerText = text;

      const payload = this._makeTurnPayload(text);
      const out = await this._callServer(payload);

      const d = out?.delta || { affinity:0, interest:0, irritation:0 };
      this.affinity += Number(d.affinity || 0);
      this.interest += Number(d.interest || 0);
      this.irritation = Math.max(0, this.irritation + Number(d.irritation || 0));

      this.affinity = Phaser.Math.Clamp(this.affinity, -50, 999);
      this.interest = Phaser.Math.Clamp(this.interest, -50, 999);
      this.irritation = Phaser.Math.Clamp(this.irritation, 0, 999);

      this.turn += 1;
      this._renderTurn();
      this._ensureDialogueUiAlive('submit');
      this._showNpc(out?.npcText || '……');

      const forceEnd = !!out?.flags?.forceEnd;
      if (forceEnd){
        this._finishNight({ forced:true });
        return;
      }

      if (this.turn > 10){
        this._finishNight({ forced:false });
        return;
      }

    } finally {
      this.pending = false;
      this._dbg(`_submitText finally ended=${this.ended}`);
      if (!this.ended){
        this._setFixedBarEnabled(true);
        this._dbg('_submitText re-enable input');
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
      this._dbg(`_callServer start turn=${payload?.turn} runId=${this._runId}`);

      if (this._abortCtrl) {
        try { this._abortCtrl.abort(); } catch (_) {}
      }

      const ctrl = new AbortController();
      this._abortCtrl = ctrl;

      const res = await fetch('/api/club/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify(payload)
      });

      this._dbg(`_callServer response status=${res.status}`);
      const rawText = await res.text();
      this._dbg(`_callServer raw=${String(rawText || '').slice(0, 120)}`);

      if (!res.ok) {
        this._dbg(`_callServer HTTP error ${res.status}`);
        return {
          npcText: `[HTTP ${res.status}] ${String(rawText || '').slice(0, 120)}`,
          signals: { mood: 'neutral', distance: 0 },
          delta: { affinity: 0, interest: 0, irritation: 0 },
          flags: { forceEnd: false }
        };
      }

      let json;
      try {
        json = JSON.parse(rawText);
      } catch (_parseErr) {
        this._dbg('_callServer JSON parse error');
        return {
          npcText: `[JSON PARSE ERROR] ${String(rawText || '').slice(0, 120)}`,
          signals: { mood: 'neutral', distance: 0 },
          delta: { affinity: 0, interest: 0, irritation: 0 },
          flags: { forceEnd: false }
        };
      }

      if (typeof json.npcText !== 'string') json.npcText = '……';
      if (!json.signals || typeof json.signals !== 'object') json.signals = { mood: 'neutral', distance: 0 };
      if (!json.delta || typeof json.delta !== 'object') json.delta = { affinity: 0, interest: 0, irritation: 0 };
      if (!json.flags || typeof json.flags !== 'object') json.flags = { forceEnd: false };

      this._dbg(`_callServer success npcText=${String(json.npcText || '').slice(0, 60)}`);
      return json;
    } catch (e) {
      let message = 'UNKNOWN ERROR';
      if (e && typeof e === 'object') {
        if (e.name === 'AbortError') message = 'ABORT ERROR';
        else if (e.message) message = e.message;
        else if (e.name) message = e.name;
      } else if (typeof e === 'string') {
        message = e;
      }

      this._dbg(`[REQUEST ERROR] ${String(message).slice(0, 120)}`);
      return {
        npcText: `[REQUEST ERROR] ${String(message).slice(0, 120)}`,
        signals: { mood: 'neutral', distance: 0 },
        delta: { affinity: 0, interest: 0, irritation: 0 },
        flags: { forceEnd: false }
      };
    } finally {
      this._abortCtrl = null;
      this._dbg('_callServer finally');
    }
  }

  _goToResult(forced){
    if (this._resultMoving) return;
    this._resultMoving = true;
    this._dbg(`_goToResult forced=${!!forced}`);

    this._cleanup();

    try{ this.scene.stop('Club'); }catch(_){ }
    try{
      this.scene.launch('ClubResult', {
        returnTo: this.returnTo,
        characterId: this.characterId,
        affinity: this.affinity,
        interest: this.interest,
        irritation: this.irritation,
        threshold: this.char.irritation_threshold,
        forced: !!forced
      });
      this.scene.bringToTop('ClubResult');
    }catch(e){
      this._dbg(`_goToResult error=${e?.message || e}`);
    }
  }

  _finishNight({ forced }){
    if (this.ended){
      this._dbg('_finishNight skipped: already ended');
      return;
    }

    this._dbg(`_finishNight start forced=${!!forced} turn=${this.turn} runId=${this._runId}`);
    this.ended = true;
    this._resultMoving = false;
    this._setFixedBarEnabled(false);

    if (this.ui?.backdrop) this.ui.backdrop.setAlpha(0.35);
    if (this.ui?.nameText) this.ui.nameText.setAlpha(0.55);
    if (this.ui?.bodyText) this.ui.bodyText.setAlpha(0.55);

    try{
      const w = this.scale.width;
      const h = this.scale.height;
      this._dbg('_finishNight build overlay');

      this.endOverlay = this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.25)
        .setDepth(4000)
        .setScrollFactor(0)
        .setInteractive();

      const boxW = Math.min(760, Math.floor(w * 0.88));
      const boxH = 88;
      const baseY = (this.ui?.backdrop)
        ? (this.ui.backdrop.y - this.ui.backdrop.height * 0.55)
        : (h - Math.floor(h * 0.22));
      const boxY = Math.max(Math.floor(h * 0.20), baseY);

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
      this._dbg(`_finishNight hasBoy=${hasBoy} boyKey=${this.boyKey}`);

      if (hasBoy){
        const targetX = w - Math.floor(w * 0.14);
        const targetY = h - Math.floor(h * 0.03);
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
      }

      this.endOverlay.on('pointerdown', () => {
        this._dbg('endOverlay pointerdown -> result');
        this._goToResult(!!forced);
      });

      this._dbg('_finishNight overlay ready');
      this.time.delayedCall(1500, () => {
        this._dbg('_finishNight auto fallback -> result');
        this._goToResult(!!forced);
      });
    } catch (e){
      this._dbg(`_finishNight error=${e?.message || e}`);
      this._goToResult(!!forced);
    }
  }

  _endAndReturn(){
    this._dbg('_endAndReturn');
    this._cleanup();
    this.scene.stop('Club');
    this.scene.resume(this.returnTo);
    this.scene.bringToTop(this.returnTo);
  }

  _cleanup(){
    this._dbg('_cleanup start');
    if (this._abortCtrl){
      try{ this._abortCtrl.abort(); }catch(_){ }
      this._abortCtrl = null;
    }
    if (this._onResize){
      this.scale.off('resize', this._onResize);
      this._onResize = null;
    }

    this._destroyFixedInputBar();
    this._offWakeResumeHandlers();

    try{
      if (this.ui && typeof this.ui.destroy === 'function') this.ui.destroy(true);
    }catch(_){ }
    this.ui = null;

    if (this.endOverlay){ this.endOverlay.destroy(); this.endOverlay = null; }
    if (this.endBoy){ this.endBoy.destroy(); this.endBoy = null; }
    if (this.endBox){ this.endBox.destroy(); this.endBox = null; }
    if (this.endText){ this.endText.destroy(); this.endText = null; }
  }
}
