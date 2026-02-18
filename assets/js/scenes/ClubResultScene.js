// assets/js/scenes/ClubResultScene.js
import { loadSave, storeSave, defaultSave } from '../core/save.js';

export class ClubResultScene extends Phaser.Scene {
  constructor(){ super('ClubResult'); }

  create(data){
    // data: { returnTo, characterId, affinity, interest, irritation, threshold, forced }
    this.returnTo = data?.returnTo || 'Field';
    this.characterId = data?.characterId || 'rei';

    const affinity = Number(data?.affinity ?? 0);
    const interest = Number(data?.interest ?? 0);
    const irritation = Number(data?.irritation ?? 0);
    const threshold = Number(data?.threshold ?? 70);
    const forced = !!data?.forced;

    const score = affinity + interest - irritation;

    let rank = 'C';
    if (forced || irritation >= threshold){
      rank = 'D';
    } else if (score >= 15){
      rank = 'A';
    } else if (score >= 5){
      rank = 'B';
    } else {
      rank = 'C';
    }

    // セーブ反映（ここでやるのが一番事故らない）
    this._applyResultToSave({
      characterId: this.characterId,
      rank,
      score,
      affinity,
      interest,
      irritation,
      threshold,
      forced
    });

    // =========================
    // UI (生成だけして、layoutで配置する)
    // =========================
    const w = this.scale.width;
    const h = this.scale.height;

    // 背景暗幕
    this.overlay = this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.72).setScrollFactor(0);

    // パネル
    this.panelBg = this.add.rectangle(w/2, h/2, 100, 100, 0x000000, 0.55)
      .setStrokeStyle(2, 0xffffff, 0.25)
      .setScrollFactor(0);

    // タイトル
    this.titleTx = this.add.text(0, 0, 'Result', {
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5, 0).setScrollFactor(0);

    // ランク
    this.rankTx = this.add.text(0, 0, `Rank ${rank}`, {
      fontSize: '64px',
      color: '#ffffff'
    }).setOrigin(0.5, 0).setScrollFactor(0);

    // 詳細
    const lines = [
      `affinity: ${affinity}`,
      `interest: ${interest}`,
      `irritation: ${irritation} / ${threshold}`,
      `score: ${score}`
    ];

    this.detailTx = this.add.text(0, 0, lines.join('\n'), {
      fontSize: '18px',
      color: '#ffffff',
      lineSpacing: 10
    }).setOrigin(0.5, 0).setAlpha(0.9).setScrollFactor(0);

    // 解放表示（保存した内容から読む）
    const unlocked = this._readUnlockedFromSave(this.characterId);
    const unlockLines = [];

    if (unlocked?.cg1) unlockLines.push('CG①（アフター）');
    if (unlocked?.cg2) unlockLines.push('CG②（親密）');

    const unlockText = unlockLines.length
      ? `Unlocked:\n${unlockLines.join('\n')}`
      : 'Unlocked:\nなし';

    this.unlockTx = this.add.text(0, 0, unlockText, {
      fontSize: '16px',
      color: '#ffffff',
      lineSpacing: 8
    }).setOrigin(0.5, 0).setAlpha(0.85).setScrollFactor(0);

    // ボタン
    const mkBtn = (label, onClick) => {
      const bg = this.add.rectangle(0, 0, 240, 56, 0x000000, 0.65)
        .setStrokeStyle(2, 0xffffff, 0.25)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });

      const tx = this.add.text(0, 0, label, {
        fontSize: '18px',
        color: '#ffffff'
      }).setOrigin(0.5).setScrollFactor(0);

      bg.on('pointerdown', onClick);
      return { bg, tx };
    };

    this.btnBack = mkBtn('戻る', () => this._goBack());
    this.btnRetry = mkBtn('もう一回', () => this._retry());

    // =========================
    // layout（ここが被り対策の本体）
    // =========================
    const layout = () => {
      const w = this.scale.width;
      const h = this.scale.height;

      this.overlay.setPosition(w/2, h/2);
      this.overlay.setSize(w, h);

      // パネルサイズ（小画面対策で上限下限つける）
      const panelW = Math.min(920, w - 40);
      const panelH = Math.min(560, h - 90);

      this.panelBg.setPosition(w/2, h/2);
      this.panelBg.setSize(panelW, panelH);

      const padX = Math.max(18, Math.floor(panelW * 0.06));
      const padY = Math.max(16, Math.floor(panelH * 0.08));

      const top = h/2 - panelH/2 + padY;
      const left = w/2 - panelW/2 + padX;
      const right = w/2 + panelW/2 - padX;

      // フォント可変（被り防止）
      const titleFs  = Math.max(16, Math.min(28, Math.floor(h * 0.03)));
      const rankFs   = Math.max(34, Math.min(64, Math.floor(h * 0.075)));
      const detailFs = Math.max(13, Math.min(18, Math.floor(h * 0.022)));
      const unlockFs = Math.max(12, Math.min(16, Math.floor(h * 0.02)));

      this.titleTx.setFontSize(titleFs);
      this.rankTx.setFontSize(rankFs);
      this.detailTx.setFontSize(detailFs);
      this.unlockTx.setFontSize(unlockFs);

      // 折り返し（超重要）
      const wrapW = Math.floor(panelW - padX*2);
      this.detailTx.setWordWrapWidth(wrapW, true);
      this.unlockTx.setWordWrapWidth(wrapW, true);

      // 縦積み配置
      let y = top;

      this.titleTx.setPosition(w/2, y).setOrigin(0.5, 0);
      y += this.titleTx.height + Math.floor(padY * 0.35);

      this.rankTx.setPosition(w/2, y).setOrigin(0.5, 0);
      y += this.rankTx.height + Math.floor(padY * 0.30);

      this.detailTx.setPosition(w/2, y).setOrigin(0.5, 0);
      y += this.detailTx.height + Math.floor(padY * 0.25);

      this.unlockTx.setPosition(w/2, y).setOrigin(0.5, 0);
      y += this.unlockTx.height + Math.floor(padY * 0.45);

      // ボタン領域（残り高さと相談して横→縦）
      const btnH = Math.max(48, Math.floor(h * 0.07));
      const gap = Math.max(12, Math.floor(panelW * 0.03));

      const panelBottom = h/2 + panelH/2 - padY;
      const remain = panelBottom - y;

      const canTwoCols = (panelW >= 520) && (remain >= btnH + 4);

      if (canTwoCols){
        const btnW = Math.floor((panelW - padX*2 - gap) / 2);
        const by = panelBottom;

        this._placeBtn(this.btnBack, left + btnW/2, by, btnW, btnH);
        this._placeBtn(this.btnRetry, right - btnW/2, by, btnW, btnH);
      } else {
        const btnW = Math.floor(panelW - padX*2);
        const by2 = panelBottom;
        const by1 = by2 - btnH - 10;

        this._placeBtn(this.btnBack, w/2, by1, btnW, btnH);
        this._placeBtn(this.btnRetry, w/2, by2, btnW, btnH);
      }
    };

    layout();
    this._onResize = () => this.time.delayedCall(0, layout);
    this.scale.on('resize', this._onResize);

    // ESCでも戻る
    this.keyEsc = this.input.keyboard.addKey('ESC');
  }

  update(){
    if (this.keyEsc && Phaser.Input.Keyboard.JustDown(this.keyEsc)){
      this._goBack();
    }
  }

  _placeBtn(btn, x, y, w, h){
    btn.bg.setPosition(x, y);
    btn.bg.setSize(w, h);
    btn.tx.setPosition(x, y);
  }

  // =========================
  // save
  // =========================
  _applyResultToSave(result){
    const s0 = loadSave();
    const state = s0 || defaultSave();

    if (!state.club) state.club = {};
    if (!state.club.unlock) state.club.unlock = {};
    if (!state.club.history) state.club.history = {};

    const cid = result.characterId;

    // unlock: キャラ単位の入れ物
    if (!state.club.unlock[cid]) state.club.unlock[cid] = { cg1:false, cg2:false };

    // history: キャラ単位の成績
    if (!state.club.history[cid]){
      state.club.history[cid] = {
        playCount: 0,
        aCount: 0,
        bestRank: 'D',
        bestScore: -999,
        lastRank: 'D',
        lastScore: -999,
        lastNight: state.night ?? 1
      };
    }

    const hist = state.club.history[cid];
    hist.playCount = Number(hist.playCount || 0) + 1;
    hist.lastRank = result.rank;
    hist.lastScore = result.score;
    hist.lastNight = state.night ?? 1;

    if (result.rank === 'A'){
      hist.aCount = Number(hist.aCount || 0) + 1;
    }

    // bestScore更新
    if (result.score > Number(hist.bestScore ?? -999)){
      hist.bestScore = result.score;
    }

    // bestRank更新（A>B>C>D）
    if (this._rankValue(result.rank) > this._rankValue(hist.bestRank)){
      hist.bestRank = result.rank;
    }

    // CG①: Rank A かつ 危険域なし（60未満） かつ 強制終了じゃない
    const canCg1 = (result.rank === 'A') && !result.forced && (result.irritation < 60);
    if (canCg1){
      state.club.unlock[cid].cg1 = true;
    }

    // CG②は後で（複数回A + トピック成功）
    // ここはまだ触らない

    storeSave(state);
  }

  _readUnlockedFromSave(characterId){
    const s = loadSave();
    if (!s?.club?.unlock) return null;
    return s.club.unlock[characterId] || null;
  }

  _rankValue(r){
    if (r === 'A') return 3;
    if (r === 'B') return 2;
    if (r === 'C') return 1;
    return 0; // D
  }

  // =========================
  // nav
  // =========================
  _goBack(){
    this._cleanup();
    this.scene.stop('ClubResult');
    this.scene.resume(this.returnTo);
  }

  _retry(){
    this._cleanup();
    this.scene.stop('ClubResult');

    // returnTo を pause したまま Club を重ねる想定
    this.scene.launch('Club', {
      returnTo: this.returnTo,
      characterId: this.characterId
    });
  }

  _cleanup(){
    if (this._onResize){
      this.scale.off('resize', this._onResize);
      this._onResize = null;
    }
  }
}
