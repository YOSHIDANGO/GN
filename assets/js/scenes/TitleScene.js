// assets/js/scenes/TitleScene.js
import { defaultSave, loadSave, storeSave } from '../core/save.js';

export class TitleScene extends Phaser.Scene {
  constructor(){ super('Title'); }

  create(){
    this.saved = loadSave();
    this.hasSave = !!this.saved;

    // 背景
    this.bg = this.add.rectangle(0,0,10,10,0x0b0b10,1).setOrigin(0.5);

    // ロゴ
    if (this.textures.exists('title_logo')){
      this.logo = this.add.image(0,0,'title_logo').setOrigin(0.5);
    } else {
      this.logo = this.add.text(0,0,'glorious_night',{
        fontSize:'42px',
        color:'#fff'
      }).setOrigin(0.5).setShadow(2,2,'#000',2);
    }

    // 情報
    const info = this.hasSave
      ? `${this.saved.slotName || '第1夜'}  HP ${this.saved.player?.hp}/${this.saved.player?.maxHp}`
      : 'セーブなし';

    this.infoText = this.add.text(0,0,info,{
      fontSize:'18px',
      color: this.hasSave ? '#ddd' : '#666'
    }).setOrigin(0.5).setShadow(2,2,'#000',2);

    // メニュー枠（★確認ボタン追加で少し高さ増やす）
    this.menuBox = this.add.rectangle(0,0,520,250,0x000000,0.45)
      .setOrigin(0.5)
      .setStrokeStyle(2,0xffffff,0.15);

    // ---- ボタン：はじめから ----
    this.btnNew = this.add.text(0,0,'はじめから',{
      fontSize:'26px',
      color:'#ffffff'
    }).setOrigin(0.5).setShadow(2,2,'#000',2)
      .setInteractive({ useHandCursor:true });

    this.btnNew.on('pointerdown', ()=> this._startNew());

    // ---- ボタン：つづきから ----
    this.btnContinue = this.add.text(0,0,'つづきから',{
      fontSize:'26px',
      color: this.hasSave ? '#ffffff' : '#555555'
    }).setOrigin(0.5).setShadow(2,2,'#000',2);

    if (this.hasSave){
      this.btnContinue
        .setInteractive({ useHandCursor:true })
        .on('pointerdown', ()=> this._continue());
    }

    // ---- ボタン：エンディング確認（★追加）----
    this.btnEnding = this.add.text(0,0,'エンディング確認',{
      fontSize:'22px',
      color:'#cfcfcf'
    }).setOrigin(0.5).setShadow(2,2,'#000',2)
      .setInteractive({ useHandCursor:true });

    this.btnEnding.on('pointerdown', ()=> this._testEnding());

    // 注意文
    this.warnText = this.add.text(0,0,
      this.hasSave ? '' : 'つづきからはセーブが必要',
      { fontSize:'14px', color:'#ffcccc' }
    ).setOrigin(0.5).setShadow(2,2,'#000',2);

    // resize対応
    this._onResize = ()=> this.time.delayedCall(0,()=>this.layout());
    this.scale.on('resize', this._onResize);

    this.layout();

    this.events.once('shutdown', ()=>{
      this.scale.off('resize', this._onResize);
    });
  }

  layout(){
    const w = this.scale.width;
    const h = this.scale.height;

    // 背景
    this.bg.setPosition(w/2,h/2);
    this.bg.width = w;
    this.bg.height = h;

    // ロゴ
    const logoY = Math.floor(h * 0.22);
    this.logo.setPosition(w/2, logoY);

    if (this.logo.width){
      const maxW = Math.min(620, w - 80);
      this.logo.setScale(Math.min(1, maxW / this.logo.width));
    }

    // info
    this.infoText.setPosition(w/2, Math.floor(h * 0.36));

    // menu
    const boxY = Math.floor(h * 0.58);
    this.menuBox.setPosition(w/2, boxY);

    // ★3段に配置
    this.btnNew.setPosition(w/2, boxY - 55);
    this.btnContinue.setPosition(w/2, boxY - 5);
    this.btnEnding.setPosition(w/2, boxY + 50);

    this.warnText.setPosition(w/2, boxY + 100);
  }

  _startNew(){
    const s = defaultSave();
    storeSave(s);
    this.scene.start('Field', { fromTitle:true, newGame:true });
  }

  _continue(){
    if (!this.hasSave) return;
    this.scene.start('Field', { fromTitle:true, newGame:false });
  }

  // ★エンディング確認用
  _testEnding(){
    // もし他シーンのBGMが残ってても、とりあえず無音で確認したいなら止める
    // 必要なければコメントアウトしてOK
    this.sound.stopAll();

    this.scene.start('Ending', { returnTo: 'Title' });
  }
}
