// assets/js/scenes/DrinkBattleScene.js
import { loadSave, storeSave } from '../core/save.js';
import { playBgm } from '../util/bgm.js';

const NAMES = {
  mio:'ミオ', yuna:'ユナ', saki:'サキ', eri:'エリ',
  rina:'リナ', mako:'マコ', aya:'アヤ', karen:'カレン'
};

export class DrinkBattleScene extends Phaser.Scene {
  constructor(){ super('DrinkBattle'); }

  create(data){
    this.returnTo = data?.returnTo || 'Field';
    this.enemyId = data?.enemyId || 'mio';
    this.enemyName = NAMES[this.enemyId] || this.enemyId;
    this.enemyKey = `${this.enemyId}_normal`;

    playBgm(this, 'club');

    this.duration = 7200;
    this.elapsed = 0;
    this.player = 0;
    this.enemy = 0;
    this.heat = 0;
    this.done = false;
    this.result = null;

    const w = this.scale.width;
    const h = this.scale.height;

    this.add.image(w/2, h/2, 'bg_shop_inside')
      .setDisplaySize(w, h)
      .setDepth(0);

    this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.34).setDepth(1);

    this.add.text(w/2, Math.floor(h * 0.09), '一気飲み対決', {
      fontSize:'30px',
      color:'#ffffff',
      fontStyle:'700'
    }).setOrigin(0.5).setDepth(5).setShadow(2,2,'#000',3);

    this.rei = this.add.image(Math.floor(w * 0.28), Math.floor(h * 0.73), 'rei_normal')
      .setOrigin(0.5, 1)
      .setScale(0.42)
      .setDepth(3);

    this.enemyImg = this.add.image(Math.floor(w * 0.72), Math.floor(h * 0.73), this.enemyKey)
      .setOrigin(0.5, 1)
      .setScale(0.42)
      .setDepth(3);

    this.message = this.add.text(w/2, Math.floor(h * 0.18), `${this.enemyName}「じゃ、負けた方が文句なしね」`, {
      fontSize:'20px',
      color:'#ffffff',
      align:'center',
      wordWrap:{ width: Math.floor(w * 0.84), useAdvancedWrap:true }
    }).setOrigin(0.5).setDepth(5).setShadow(2,2,'#000',3);

    this.timeText = this.add.text(w/2, Math.floor(h * 0.26), '', {
      fontSize:'22px',
      color:'#ffffff',
      fontStyle:'700'
    }).setOrigin(0.5).setDepth(5).setShadow(2,2,'#000',3);

    this.playerBar = this._makeBar(Math.floor(w * 0.18), Math.floor(h * 0.80), Math.floor(w * 0.64), 22, 0xb86cff, 'レイ');
    this.enemyBar = this._makeBar(Math.floor(w * 0.18), Math.floor(h * 0.86), Math.floor(w * 0.64), 22, 0xff6f9d, this.enemyName);
    this.heatBar = this._makeBar(Math.floor(w * 0.18), Math.floor(h * 0.92), Math.floor(w * 0.64), 16, 0xffcf5a, '酔い');

    this.tapButton = this.add.rectangle(w/2, Math.floor(h * 0.48), Math.min(520, Math.floor(w * 0.62)), 82, 0x15151d, 0.92)
      .setStrokeStyle(3, 0xffffff, 0.24)
      .setInteractive({ useHandCursor:true })
      .setDepth(6);

    this.tapText = this.add.text(w/2, Math.floor(h * 0.48), 'タップで飲む', {
      fontSize:'25px',
      color:'#ffffff',
      fontStyle:'700'
    }).setOrigin(0.5).setDepth(7).setShadow(2,2,'#000',3);

    const tap = (pointer) => {
      pointer?.event?.stopPropagation?.();
      if (this.done){
        this._finish();
        return;
      }
      this._drink();
    };
    this.tapButton.on('pointerdown', tap);
    this.tapText.setInteractive({ useHandCursor:true }).on('pointerdown', tap);

    this.input.on('pointerdown', (pointer) => {
      if (this.done) this._finish();
      else pointer?.event?.stopPropagation?.();
    });

    this._syncBars();
  }

  update(_, delta){
    if (this.done) return;

    this.elapsed += delta;
    this.enemy = Math.min(100, this.enemy + delta * 0.0105);
    this.heat = Math.max(0, this.heat - delta * 0.018);

    if (this.enemy >= 100 || this.player >= 100 || this.elapsed >= this.duration){
      this._complete();
      return;
    }

    this._syncBars();
  }

  _makeBar(x, y, w, h, color, label){
    const text = this.add.text(x, y - h - 8, label, {
      fontSize:'15px',
      color:'#ffffff'
    }).setDepth(5).setShadow(2,2,'#000',2);
    const bg = this.add.rectangle(x, y, w, h, 0x050509, 0.82).setOrigin(0, 0.5).setDepth(5);
    const fill = this.add.rectangle(x, y, 1, h, color, 0.96).setOrigin(0, 0.5).setDepth(6);
    const frame = this.add.rectangle(x, y, w, h, 0x000000, 0).setOrigin(0, 0.5)
      .setStrokeStyle(2, 0xffffff, 0.18)
      .setDepth(7);
    return { text, bg, fill, frame, w };
  }

  _setBar(bar, value){
    bar.fill.width = Math.max(1, Math.floor(bar.w * Phaser.Math.Clamp(value, 0, 100) / 100));
  }

  _syncBars(){
    const remain = Math.max(0, (this.duration - this.elapsed) / 1000);
    this.timeText.setText(`残り ${remain.toFixed(1)} 秒`);
    this._setBar(this.playerBar, this.player);
    this._setBar(this.enemyBar, this.enemy);
    this._setBar(this.heatBar, this.heat);
  }

  _drink(){
    if (this.done) return;
    this.player = Math.min(100, this.player + Phaser.Math.Between(7, 11));
    this.heat += Phaser.Math.Between(12, 17);

    if (this.heat >= 100){
      this.player = Math.max(0, this.player - 10);
      this.heat = 58;
      this.message.setText('レイ「……っ、急ぎすぎた」');
    } else if (this.player > this.enemy + 18){
      this.message.setText(`${this.enemyName}「ちょっと速くない？」`);
    } else {
      this.message.setText('レイ「まだいける」');
    }

    this._syncBars();
  }

  _complete(){
    this.done = true;
    this.result = (this.player >= 100 || this.player >= this.enemy) ? 'win' : 'lose';
    const won = this.result === 'win';

    this.message.setText(won
      ? `${this.enemyName}「……今日は負け。文句なし」`
      : `${this.enemyName}「はい、今日は私の勝ち」`);

    this.timeText.setText(won ? '勝利' : '敗北');
    this.tapText.setText('タップで戻る');
    this.tapButton.setFillStyle(0x20202a, 0.94);
    this._applyResult(won);
  }

  _applyResult(won){
    const state = loadSave();
    if (!state) return;

    if (!state.progress) state.progress = {};
    if (!state.player) state.player = { hp:100, maxHp:100 };

    const hp = state.player.hp ?? state.player.maxHp ?? 100;
    const maxHp = state.player.maxHp ?? 100;

    if (won){
      state.player.hp = Math.min(maxHp, hp + 8);
      const cap = this._getNominationCap(state);
      const cur = Number(state.progress.nomination || 0);
      if (!Number.isFinite(cap) || cur < cap){
        state.progress.nomination = Number.isFinite(cap) ? Math.min(cur + 1, cap) : cur + 1;
      }
    } else {
      state.player.hp = Math.max(1, hp - 10);
    }

    storeSave(state);
  }

  _getNominationCap(state){
    const order = ['mio','yuna','saki','eri','rina','mako','aya','karen'];
    const defeated = state?.progress?.defeatedCabajo || {};
    for (let i=0; i<order.length; i++){
      if (!defeated[order[i]]) return (i + 1) * 5;
    }
    return Infinity;
  }

  _finish(){
    const field = this.scene.get(this.returnTo);
    try{
      if (this.scene.isPaused(this.returnTo)) this.scene.resume(this.returnTo);
      this.scene.setVisible(true, this.returnTo);
      this.scene.bringToTop(this.returnTo);
      field?._showToast?.(this.result === 'win'
        ? '一気飲みに勝った。指名 +1 / HP少し回復'
        : '一気飲みに負けた。HP少し消耗');
    }catch(_){}
    this.scene.stop('DrinkBattle');
  }
}
