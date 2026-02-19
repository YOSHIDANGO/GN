// assets/js/scenes/ClubResultScene.js
import { loadSave, storeSave, defaultSave } from '../core/save.js';

export class ClubResultScene extends Phaser.Scene {
  constructor(){ super('ClubResult'); }

  create(data){
    this.returnTo = data?.returnTo || 'Field';
    this.characterId = data?.characterId || 'rei';

    // 念のため受け取る（表示用）
    this.affinity = Number(data?.affinity ?? 0);
    this.interest = Number(data?.interest ?? 0);
    this.irritation = Number(data?.irritation ?? 0);
    this.threshold = Number(data?.threshold ?? 70);
    this.forced = !!data?.forced;

    // ★ここが重要：Club が残ってたら必ず止める（残留バグ潰し）
    if (this.scene.isActive('Club') || this.scene.isPaused('Club')){
      this.scene.stop('Club');
    }

    const w = this.scale.width;
    const h = this.scale.height;

    this.cameras.main.fadeIn(120, 0,0,0);

    // 背景
    this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.55).setScrollFactor(0);

    const title = this.add.text(w/2, Math.floor(h*0.18), 'リザルト', {
      fontSize:'34px',
      color:'#ffffff'
    }).setOrigin(0.5,0.5);

    const line = [
      `affinity: ${this.affinity}`,
      `interest: ${this.interest}`,
      `irritation: ${this.irritation}`,
      this.forced ? '終了: 強制' : '終了: 10ターン',
    ].join('\n');

    this.add.text(w/2, Math.floor(h*0.32), line, {
      fontSize:'22px',
      color:'#ffffff',
      align:'center',
      lineSpacing: 10
    }).setOrigin(0.5,0);

    // ボタン
    const mkBtn = (label, y, onTap) => {
      const bw = Math.min(520, Math.floor(w*0.84));
      const bh = 72;

      const bg = this.add.rectangle(w/2, y, bw, bh, 0x000000, 0.70)
        .setStrokeStyle(2, 0xffffff, 0.22)
        .setInteractive({ useHandCursor:true });

      const tx = this.add.text(w/2, y, label, {
        fontSize:'24px',
        color:'#ffffff'
      }).setOrigin(0.5,0.5);

      const fireOnce = () => {
        // 二重タップ防止
        bg.disableInteractive();
        onTap();
      };

      bg.on('pointerdown', (p)=>{
        p?.event?.stopPropagation?.();
        fireOnce();
      });
      tx.setInteractive({ useHandCursor:true }).on('pointerdown', (p)=>{
        p?.event?.stopPropagation?.();
        fireOnce();
      });

      return { bg, tx };
    };

    const y1 = Math.floor(h*0.62);
    const y2 = Math.floor(h*0.74);

    this.btnRetry = mkBtn('もう一回', y1, ()=> this._retry());
    this.btnBack  = mkBtn('やめる',   y2, ()=> this._goBack());

    // ESC でも戻る
    this.keyEsc = this.input.keyboard?.addKey('ESC');
  }

  update(){
    if (this.keyEsc && Phaser.Input.Keyboard.JustDown(this.keyEsc)){
      this._goBack();
    }
  }

  _retry(){
    // ★再戦でも残留を絶対消す
    if (this.scene.isActive('Club') || this.scene.isPaused('Club')){
      this.scene.stop('Club');
    }

    // Field が止まってたらそのまま（Club 側で pause/resume 管理）
    // ClubResult は消して Club を起動
    this.scene.stop('ClubResult');
    this.scene.launch('Club', {
      returnTo: this.returnTo,
      characterId: this.characterId,
      debug: false
    });
    this.scene.bringToTop('Club');
  }

  _goBack(){
    // ★戻る時も必ず Club/ClubResult を消す
    if (this.scene.isActive('Club') || this.scene.isPaused('Club')){
      this.scene.stop('Club');
    }

    this.scene.stop('ClubResult');

    // returnTo を resume（無ければ start）
    if (this.scene.isPaused(this.returnTo)){
      this.scene.resume(this.returnTo);
    } else if (!this.scene.isActive(this.returnTo)){
      this.scene.start(this.returnTo);
    }

    this.scene.bringToTop(this.returnTo);
  }
}
