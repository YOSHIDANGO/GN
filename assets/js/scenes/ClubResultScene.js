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

    // セーブ反映
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
    // UI
    // =========================
    const w = this.scale.width;
    const h = this.scale.height;

    // このシーンが最前面で入力受ける
    this.input.setTopOnly(true);

    // 背景暗幕
    this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.72).setScrollFactor(0);

    // パネル（余白増やす）
    const panelW = Math.min(980, w - 50);
    const panelH = Math.min(610, h - 110);

    this.add.rectangle(w/2, h/2, panelW, panelH, 0x000000, 0.55)
      .setStrokeStyle(2, 0xffffff, 0.25)
      .setScrollFactor(0);

    // タイトル
    this.add.text(w/2, h/2 - panelH/2 + 26, 'Result', {
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5, 0).setScrollFactor(0);

    // ランク
    this.add.text(w/2, h/2 - 70, `Rank ${rank}`, {
      fontSize: '64px',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0);

    // 詳細
    const lines = [
      `affinity: ${affinity}`,
      `interest: ${interest}`,
      `irritation: ${irritation} / ${threshold}`,
      `score: ${score}`
    ];

    this.add.text(w/2, h/2 + 5, lines.join('\n'), {
      fontSize: '18px',
      color: '#ffffff',
      lineSpacing: 10
    }).setOrigin(0.5, 0).setAlpha(0.9).setScrollFactor(0);

    // 解放表示
    const unlocked = this._readUnlockedFromSave(this.characterId);
    const unlockLines = [];
    if (unlocked?.cg1) unlockLines.push('CG①（アフター）');
    if (unlocked?.cg2) unlockLines.push('CG②（親密）');

    const unlockText = unlockLines.length
      ? `Unlocked:\n${unlockLines.join('\n')}`
      : 'Unlocked:\nなし';

    this.add.text(w/2, h/2 + 160, unlockText, {
      fontSize: '16px',
      color: '#ffffff',
      lineSpacing: 8
    }).setOrigin(0.5, 0).setAlpha(0.85).setScrollFactor(0);

    // ボタン
    const mkBtn = (label, x, y, onClick) => {
      const bg = this.add.rectangle(x, y, 250, 60, 0x000000, 0.68)
        .setStrokeStyle(2, 0xffffff, 0.25)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });

      const tx = this.add.text(x, y, label, {
        fontSize: '18px',
        color: '#ffffff'
      }).setOrigin(0.5).setScrollFactor(0);

      bg.on('pointerdown', onClick);
      return { bg, tx };
    };

    const btnY = h/2 + panelH/2 - 64;
    mkBtn('戻る',   w/2 - 150, btnY, () => this._goBack());
    mkBtn('もう一回', w/2 + 150, btnY, () => this._retry());

    // ESCでも戻る
    this.keyEsc = this.input.keyboard.addKey('ESC');

    // 念のため、表示をトップへ
    this.scene.bringToTop('ClubResult');
  }

  update(){
    if (this.keyEsc && Phaser.Input.Keyboard.JustDown(this.keyEsc)){
      this._goBack();
    }
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

    if (!state.club.unlock[cid]) state.club.unlock[cid] = { cg1:false, cg2:false };

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

    if (result.score > Number(hist.bestScore ?? -999)){
      hist.bestScore = result.score;
    }

    if (this._rankValue(result.rank) > this._rankValue(hist.bestRank)){
      hist.bestRank = result.rank;
    }

    // CG①: Rank A かつ 危険域なし（60未満） かつ 強制終了じゃない
    const canCg1 = (result.rank === 'A') && !result.forced && (result.irritation < 60);
    if (canCg1){
      state.club.unlock[cid].cg1 = true;
    }

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
    return 0;
  }

  // =========================
  // nav
  // =========================
  _reviveReturnScene(){
    const key = this.returnTo;

    // どの状態でも戻せるように
    if (this.scene.isPaused(key)) {
      this.scene.resume(key);
    } else if (this.scene.isSleeping(key)) {
      this.scene.wake(key);
    } else if (!this.scene.isActive(key)) {
      // まさか止まってたら start
      this.scene.start(key);
      return;
    }

    // 表示順が裏に潜るのを防ぐ
    try { this.scene.bringToTop(key); } catch (e) {}
  }

  _goBack(){
    this._reviveReturnScene();
    try { this.scene.bringToTop(this.returnTo); } catch(e){}
    this.scene.stop('ClubResult');
  }

  _retry(){
    if (this.scene.isActive('Club')) this.scene.stop('Club');

    // 戻り先は pause して上に Club を重ねるのが安定
    const key = this.returnTo;

    if (this.scene.isActive(key) && !this.scene.isPaused(key)){
      this.scene.pause(key);
    } else if (this.scene.isSleeping(key)){
      this.scene.wake(key);
      this.scene.pause(key);
    }

    this.scene.stop('ClubResult');

    this.scene.launch('Club', {
      returnTo: this.returnTo,
      characterId: this.characterId
    });

    this.scene.bringToTop('Club');
  }
}
