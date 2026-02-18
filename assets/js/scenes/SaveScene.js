
import { loadSave, storeSave, saveSlotName } from '../core/save.js';

export class SaveScene extends Phaser.Scene {
  constructor(){ super('Save'); }

  create(){
    const s = loadSave();
    this.add.image(640, 360, 'bg_shop_inside').setDisplaySize(1280,720);

    this.add.image(640, 600, 'ui_panel').setOrigin(0.5,0.5);

    this.title = this.add.text(100, 520, 'セーブ/ロード', { fontSize:'26px', color:'#fff' }).setShadow(2,2,'#000',2);
    this.body = this.add.text(100, 560, `${saveSlotName(s.night)}  HP ${s.player.hp}/${s.player.maxHp}`, { fontSize:'24px', color:'#fff' }).setShadow(2,2,'#000',2);
    this.hint = this.add.text(100, 640, 'SPACEで戻る', { fontSize:'20px', color:'#fff' }).setShadow(2,2,'#000',2);

    this.key = this.input.keyboard.addKey('SPACE');
    this.input.on('pointerdown', ()=> this.scene.start('Field'));

    // auto-save
    storeSave(s);
  }

  update(){
    if (Phaser.Input.Keyboard.JustDown(this.key)) this.scene.start('Field');
  }
}
