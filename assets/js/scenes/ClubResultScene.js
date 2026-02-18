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
    // UI
    // =========================
    const w = this.scale.width;
    const h = this.scale.height;

    // 背景暗幕
    this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.72).setScrollFactor(0);

    // パネル
    const panelW = Math.min(920, w - 60);
    const panelH = Math.min(560, h - 120);

    this.add.rectangle(w/2, h/2, panelW, panelH, 0x000000, 0.55)
      .setStrokeStyle(2, 0xffffff, 0.25)
      .setScrollFactor(0);

    // タイトル
    this.add.text(w/2, h/2 - panelH/2 + 28, 'Result', {
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5, 0).setScrollFactor(0);

    // ランク
    this.add.text(w/2, h/2 - 60, `Rank ${rank}`, {
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

    this.add.text(w/2, h/2 + 10, lines.join('\n'), {
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

    this.add.text(w/2, h/2 + 170, unlockText, {
      fontSize: '16px',
      color: '#ffffff',
      lineSpacing: 8
    }).setOrigin(0.5, 0).setAlpha(0.85).setScrollFactor(0);

    // ボタン
    const mkBtn = (label, x, y, onClick) => {
      const bg = this.add.rectangle(x, y, 240, 56, 0x000000, 0.65)
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

    const btnY = h/2 + panelH/2 - 62;

    mkBtn('戻る', w/2 - 140, btnY, () => this._goBack());
    mkBtn('もう一回', w/2 + 140, btnY, () => this._retry());

    // ESCでも戻る
    this.keyEsc = this.input.keyboard.addKey('ESC');
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
    this.scene.stop('ClubResult');
    this.scene.resume(this.returnTo);
  }

  _retry(){
    this.scene.stop('ClubResult');

    // returnTo を pause したまま Club を重ねる想定
    this.scene.launch('Club', {
      returnTo: this.returnTo,
      characterId: this.characterId
    });
  }
}
