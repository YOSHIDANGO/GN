// assets/js/scenes/DialogueScene.js
import { DialogueUI } from '../ui/DialogueUI.js';

export class DialogueScene extends Phaser.Scene {
  constructor(){
    super('Dialogue');
  }

  create(data){
    this.returnTo = data?.returnTo || 'Field';
    this.scriptKey = data?.scriptKey || 'story_opening';

    const script = this.cache.json.get(this.scriptKey) || {};
    this.lines = Array.isArray(script.lines) ? script.lines : [];
    this.idx = 0;
    this.charas = [];
    this.tapLayer = null;
    this._onResizeTap = null;
    this._ended = false;

    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    this.bgKey = data?.bgKey || script?.bgKey || 'bg_susukino_night_01';
    this.bg = this.add.image(640, 360, this.bgKey)
      .setDisplaySize(1280, 720)
      .setDepth(0)
      .setVisible(false);

    this.ui = new DialogueUI(this);

    this.keySpace = this.input.keyboard?.addKey('SPACE') || null;
    this.keyEsc   = this.input.keyboard?.addKey('ESC') || null;

    // 下のシーンに入力を落とさない
    this.input.setTopOnly(true);

    const makeTapLayer = () => {
      const w = this.scale.width;
      const h = this.scale.height;

      if (this.tapLayer){
        this.tapLayer.destroy();
        this.tapLayer = null;
      }

      this.tapLayer = this.add.zone(w / 2, h / 2, w, h)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(99999)
        .setInteractive({ useHandCursor: false });

      this.tapLayer.on('pointerdown', (pointer) => {
        pointer?.event?.stopPropagation?.();
        this._next();
      });
    };

    makeTapLayer();

    this._onResizeTap = () => {
      this.time.delayedCall(0, () => makeTapLayer());
    };
    this.scale.on('resize', this._onResizeTap);

    this.events.once('shutdown', () => this._cleanup());
    this.events.once('destroy', () => this._cleanup());

    if (!this.lines.length){
      this._setFallbackMessage(`会話データが見つからない: ${this.scriptKey}`);
      return;
    }

    this._show();
  }

  update(){
    if (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)) this._next();
    if (this.keyEsc && Phaser.Input.Keyboard.JustDown(this.keyEsc)) this._end();
  }

  _setFallbackMessage(message){
    this.bg.setVisible(false);
    this._clearCharas();
    if (this.ui){
      this.ui.setName('システム');
      this.ui.setText(message || '会話データを読み込めなかった');
    }
  }

  _clearCharas(){
    for (const c of this.charas){
      try{ c.destroy(); }catch(_){ }
    }
    this.charas = [];
  }

  _addChara(def){
    if (!def || !def.key) return;

    const w = this.scale.width;
    const h = this.scale.height;

    const x = (typeof def.x === 'number') ? def.x : 360;

    const baseBottomY = this.ui.getPortraitBottomY(Math.max(8, Math.floor(h * 0.015)));
    const bottomY = (typeof def.y === 'number') ? def.y : baseBottomY;

    const reqScale = (typeof def.scale === 'number') ? def.scale : 0.5;

    const img = this.add.image(x, bottomY, def.key)
      .setOrigin(0.5, 1)
      .setDepth(900);

    const safeTop = Math.max(10, Math.floor(h * 0.02));
    const maxH = Math.max(220, bottomY - safeTop);
    const maxW = Math.min(Math.floor(w * 0.48), 680);

    const texW = img.width || 1;
    const texH = img.height || 1;

    const maxScaleH = maxH / texH;
    const maxScaleW = maxW / texW;

    const scale = Math.min(reqScale, maxScaleH, maxScaleW);

    img.setScale(scale);

    this.charas.push(img);
  }

  _show(){
    const line = this.lines[this.idx];
    if (!line){
      this._end();
      return;
    }

    const hasChara = !!(line.chars || line.charaKey);
    this.bg.setVisible(hasChara);

    this._clearCharas();

    if (Array.isArray(line.chars)){
      for (const def of line.chars) this._addChara(def);
    } else if (line.charaKey){
      this._addChara({
        key: line.charaKey,
        x: (typeof line.charaX === 'number') ? line.charaX : 360,
        y: (typeof line.charaY === 'number') ? line.charaY : undefined,
        scale: (typeof line.charaScale === 'number') ? line.charaScale : 0.5
      });
    }

    this.ui.setName(line.name || '');
    this.ui.setText(line.text || '');
  }

  _next(){
    if (!this.lines.length){
      this._end();
      return;
    }

    this.idx += 1;
    this._show();
  }

  _cleanup(){
    if (this._onResizeTap){
      this.scale.off('resize', this._onResizeTap);
      this._onResizeTap = null;
    }

    if (this.tapLayer){
      try{ this.tapLayer.destroy(); }catch(_){ }
      this.tapLayer = null;
    }

    this._clearCharas();

    if (this.ui){
      try{
        if (typeof this.ui.destroy === 'function') this.ui.destroy();
      }catch(_){ }
      this.ui = null;
    }

    this.keySpace = null;
    this.keyEsc = null;
  }

  _end(){
    if (this._ended) return;
    this._ended = true;

    this._cleanup();

    try{
      this.scene.stop('Dialogue');
    }catch(_){ }

    try{
      this.scene.resume(this.returnTo);
    }catch(_){ }
  }
}
