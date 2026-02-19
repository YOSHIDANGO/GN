// assets/js/scenes/DialogueScene.js
import { DialogueUI } from '../ui/DialogueUI.js';

export class DialogueScene extends Phaser.Scene {
  constructor(){ super('Dialogue'); }

  create(data){
    this.returnTo = data?.returnTo || 'Field';
    this.scriptKey = data?.scriptKey || '';
    this.defaultBgKey = data?.bgKey || null;

    // script
    this.script = this.cache.json.get(this.scriptKey) || null;
    if (!this.script){
      this._return();
      return;
    }

    this.idx = 0;

    // bg（前の版で setVisible(false) してたのが「ダイアログ消えた」主因になりやすい）
    const firstBgKey = this.defaultBgKey || this.script.bgKey || 'bg_shop_inside';
    this.bg = this.add.image(0, 0, firstBgKey).setOrigin(0.5,0.5).setDepth(0);

    // UI
    this.ui = new DialogueUI(this);

    // input
    this.input.setTopOnly(true);

    // tap to next
    this._onDown = () => this._next();
    this.input.on('pointerdown', this._onDown);

    // resize
    const layout = () => {
      const w = this.scale.width;
      const h = this.scale.height;

      this.bg.setPosition(w/2, h/2);
      const sx = w / (this.bg.width || 1);
      const sy = h / (this.bg.height || 1);
      this.bg.setScale(Math.max(sx, sy));
    };

    layout();
    this._onResize = () => this.time.delayedCall(0, layout);
    this.scale.on('resize', this._onResize);

    this._renderLine();

    this.events.once('shutdown', () => this._cleanup());
    this.events.once('destroy', () => this._cleanup());
  }

  _cleanup(){
    if (this._onResize){
      this.scale.off('resize', this._onResize);
      this._onResize = null;
    }
    if (this._onDown){
      this.input.off('pointerdown', this._onDown);
      this._onDown = null;
    }
  }

  _setBg(key){
    if (!key) return;
    if (this.bg && this.bg.texture && this.bg.texture.key === key) return;

    if (this.bg) this.bg.destroy();
    this.bg = this.add.image(0, 0, key).setOrigin(0.5,0.5).setDepth(0);

    const w = this.scale.width;
    const h = this.scale.height;
    this.bg.setPosition(w/2, h/2);
    const sx = w / (this.bg.width || 1);
    const sy = h / (this.bg.height || 1);
    this.bg.setScale(Math.max(sx, sy));
  }

  _renderLine(){
    const lines = this.script?.lines || [];
    if (this.idx < 0 || this.idx >= lines.length){
      this._return();
      return;
    }

    const line = lines[this.idx] || {};
    const name = line.name || '';
    const text = line.text || '';

    const bgKey = line.bgKey || this.defaultBgKey || this.script.bgKey;
    if (bgKey) this._setBg(bgKey);

    this.ui.setName(name);
    this.ui.setText(text);
  }

  _next(){
    const lines = this.script?.lines || [];
    this.idx += 1;

    if (this.idx >= lines.length){
      this._return();
      return;
    }

    this._renderLine();
  }

  _return(){
    this.scene.stop('Dialogue');

    if (this.scene.get(this.returnTo)){
      if (this.scene.isPaused(this.returnTo)) this.scene.resume(this.returnTo);
      this.scene.bringToTop(this.returnTo);

      const f = this.scene.get(this.returnTo);
      if (f) f._resumeReason = 'dialogue';
    }
  }
}
