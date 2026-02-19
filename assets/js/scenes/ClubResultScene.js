export class ClubResultScene extends Phaser.Scene {
  constructor(){
    super('ClubResult');
  }

  init(data){
    this.returnTo = data?.returnTo || 'Field';
    this.characterId = data?.characterId || null;
    // support both {result:{...}} and the older flat payload
    this.result = data?.result || {
      affinity: data?.affinity,
      interest: data?.interest,
      irritation: data?.irritation,
      threshold: data?.threshold,
      forced: data?.forced
    };
    this._busy = false;
  }

  create(){
    const { width:w, height:h } = this.scale;

    // 背景
    this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.75).setDepth(0);

    const title = this.add.text(w/2, Math.floor(h*0.22), 'RESULT', {
      fontFamily: 'sans-serif',
      fontSize: '42px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(1);

    const lines = [];
    if (this.result?.win != null) lines.push(this.result.win ? 'WIN' : 'LOSE');
    if (typeof this.result?.score === 'number') lines.push(`SCORE: ${this.result.score}`);

    if (typeof this.result?.affinity === 'number') lines.push(`好感度: ${this.result.affinity}`);
    if (typeof this.result?.interest === 'number') lines.push(`興味: ${this.result.interest}`);
    if (typeof this.result?.irritation === 'number') lines.push(`イラつき: ${this.result.irritation}`);

    this.add.text(w/2, Math.floor(h*0.36), lines.join('\n') || '', {
      fontFamily: 'sans-serif',
      fontSize: '26px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5).setDepth(1);

    const mkBtn = (x, y, label, onClick)=>{
      const bg = this.add.rectangle(x, y, 360, 74, 0x111111, 0.85)
        .setStrokeStyle(2, 0xffffff, 0.25)
        .setDepth(2)
        .setInteractive({ useHandCursor: true });

      const t = this.add.text(x, y, label, {
        fontFamily: 'sans-serif',
        fontSize: '26px',
        color: '#ffffff'
      }).setOrigin(0.5).setDepth(3);

      bg.on('pointerdown', ()=> onClick());
      return { bg, t };
    };

    mkBtn(w/2, Math.floor(h*0.62), 'もう一回', ()=> this._retry());
    mkBtn(w/2, Math.floor(h*0.74), 'フィールドへ', ()=> this._goBack());

    // returnTo は結果表示中は止めて見えなくする
    this._hideReturnScene(this.returnTo);

    // ESC で戻る
    this._esc = this.input.keyboard?.addKey?.(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  update(){
    if (this._esc && Phaser.Input.Keyboard.JustDown(this._esc)){
      this._goBack();
    }
  }

  // =========================
  // actions
  // =========================
  _retry(){
    if (this._busy) return;
    this._busy = true;

    this._stopIfExists('Club');
    this._hideReturnScene(this.returnTo);

    this.scene.stop('ClubResult');
    this.scene.launch('Club', {
      returnTo: this.returnTo,
      characterId: this.characterId
    });
    this.scene.bringToTop('Club');
  }

  _goBack(){
    if (this._busy) return;
    this._busy = true;

    this._stopIfExists('Club');
    this._reviveReturnScene(this.returnTo);
    this.scene.stop('ClubResult');
  }

  // =========================
  // helpers
  // =========================
  _stopIfExists(key){
    if (!key) return;
    try{
      if (this.scene.isActive(key) || this.scene.isPaused(key) || this.scene.isSleeping(key)){
        this.scene.stop(key);
      }
    }catch(_){ }
  }

  _hideReturnScene(key){
    if (!key) return;
    try{
      const s = this.scene.getScene(key);
      if (!s) return;

      this.scene.setVisible(false, key);

      if (this.scene.isActive(key) && !this.scene.isPaused(key)){
        this.scene.pause(key);
      } else if (this.scene.isSleeping(key)){
        this.scene.wake(key);
        this.scene.pause(key);
      }
    }catch(_){ }
  }

  _reviveReturnScene(key){
    if (!key) return;
    try{
      const s = this.scene.getScene(key);
      if (!s) return;

      this.scene.setVisible(true, key);

      if (this.scene.isSleeping(key)) this.scene.wake(key);
      if (this.scene.isPaused(key)) this.scene.resume(key);
      this.scene.bringToTop(key);
    }catch(_){ }
  }
}
