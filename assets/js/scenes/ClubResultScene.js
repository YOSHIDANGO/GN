// assets/js/scenes/ClubResultScene.js
export class ClubResultScene extends Phaser.Scene {
  constructor(){
    super('ClubResult');
  }

  create(data){
    this.returnTo = data?.returnTo || 'Field';
    this.characterId = data?.characterId || 'rei';

    this.affinity = Number(data?.affinity || 0);
    this.interest = Number(data?.interest || 0);
    this.irritation = Number(data?.irritation || 0);
    this.threshold = Number(data?.threshold ?? 70);
    this.forced = !!data?.forced;

    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.72).setScrollFactor(0);

    const title = this.forced ? '強制終了' : '結果';
    this.add.text(w / 2, Math.floor(h * 0.15), title, {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: '700'
    }).setOrigin(0.5, 0.5).setScrollFactor(0);

    const lines = [
      `親密度: ${this.affinity}`,
      `興味: ${this.interest}`,
      `苛立ち: ${this.irritation} / ${this.threshold}`
    ];

    this.add.text(w / 2, Math.floor(h * 0.30), lines.join('\n'), {
      fontSize: '20px',
      color: '#ffffff',
      align: 'center',
      lineSpacing: 10
    }).setOrigin(0.5, 0).setScrollFactor(0);

    const makeButton = (label, y, onTap) => {
      const width = Math.min(520, Math.floor(w * 0.78));
      const height = 64;

      const bg = this.add.rectangle(w / 2, y, width, height, 0x121218, 0.92)
        .setStrokeStyle(3, 0xffffff, 0.18)
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
        .setDepth(10);

      const text = this.add.text(w / 2, y, label, {
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: '700'
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11);

      const fire = (pointer) => {
        pointer?.event?.stopPropagation?.();
        onTap();
      };

      bg.on('pointerdown', fire);
      text.setInteractive({ useHandCursor: true }).on('pointerdown', fire);

      return { bg, text };
    };

    const y1 = Math.floor(h * 0.62);
    const y2 = y1 + 84;

    this.btnRetry = makeButton('もう一回', y1, () => this._retry());
    this.btnBack = makeButton('フィールドへ戻る', y2, () => this._backToField());

    this.events.once('shutdown', () => this._cleanup());
    this.events.once('destroy', () => this._cleanup());
  }

  _cleanup(){
    try{
      const el = document.getElementById('club-fixed-bar');
      if (el) el.remove();
    }catch(_){}
  }

  _stopIfRunning(key){
    try{
      if (this.scene.get(key) && (
        this.scene.isActive(key) ||
        this.scene.isPaused(key) ||
        this.scene.isSleeping(key)
      )){
        this.scene.stop(key);
      }
    }catch(_){}
  }

  _reviveField(){
    this._cleanup();

    for (const key of ['Club', 'Dialogue', 'Battle', 'BattleUI']){
      this._stopIfRunning(key);
    }

    let field = null;
    try{
      field = this.scene.get(this.returnTo);
    }catch(_){}

    if (!field) return;

    try{
      field.modalOpen = false;
      field._pointerConsumed = false;
      field.pendingDoorOutside = false;
      field._sceneTransitioning = false;
      field._resumeReason = '';
      if (field.ev) field.ev.running = false;
      if (field.input) field.input.enabled = true;
    }catch(_){}

    try{
      if (this.scene.isPaused(this.returnTo)){
        this.scene.resume(this.returnTo);
      }
      this.scene.setVisible(true, this.returnTo);
      this.scene.bringToTop(this.returnTo);
    }catch(_){}
  }

  _backToField(){
    this.time.delayedCall(0, () => {
      this._reviveField();
      this.scene.stop('ClubResult');
    });
  }

  _retry(){
    this.time.delayedCall(0, () => {
      this._cleanup();
      this._stopIfRunning('Club');
      this._stopIfRunning('Dialogue');
      this._stopIfRunning('Battle');
      this._stopIfRunning('BattleUI');

      this.scene.stop('ClubResult');
      this.scene.start('Club', {
        returnTo: this.returnTo,
        characterId: this.characterId,
        debug: false
      });
      this.scene.bringToTop('Club');
    });
  }
}
