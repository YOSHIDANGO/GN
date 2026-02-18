// assets/js/scenes/BootScene.js
export class BootScene extends Phaser.Scene {
    constructor(){ super('Boot'); }
  
    preload(){
      const w = this.scale.width || 1280;
      const h = this.scale.height || 720;
  
      const barBg = this.add.rectangle(w/2, h/2, 520, 18, 0x000000, 0.55)
        .setStrokeStyle(2, 0xffffff, 0.35);
      const bar = this.add.rectangle(w/2 - 260, h/2, 0, 12, 0xffffff, 0.8)
        .setOrigin(0, 0.5);
      const label = this.add.text(w/2, h/2 - 30, 'loading...', {
        fontSize:'16px', color:'#fff'
      }).setOrigin(0.5).setShadow(2,2,'#000',2);
  
      this.load.on('progress', (p) => { bar.width = Math.floor(520 * p); });
      this.load.on('complete', () => { barBg.destroy(); bar.destroy(); label.destroy(); });
  
      // 使い回すID一覧（ここで一回だけ宣言）
      const guests = ['salaryman','tourist','regular','elite','foreign','ceo'];
      const cabajoIds = ['mio','yuna','saki','eri','rina','mako','aya','karen'];
  
      // =========================
      // Backgrounds
      // =========================
      this.load.image('bg_susukino_night_01', './assets/img/bg/bg_susukino_night_01.png');
      this.load.image('bg_shop_front',       './assets/img/bg/bg_shop_front.png');
      this.load.image('bg_shop_inside',      './assets/img/bg/bg_shop_inside.png');
      this.load.image('bg_battle_generic',   './assets/img/bg/bg_battle_generic.png');

      // =========================
      // Ending
      // =========================
      //this.load.image('bg_shop_front', 'assets/img/bg/bg_shop_front.png');
  
      // =========================
      // UI
      // =========================
      this.load.image('ui_panel',   './assets/img/ui/ui_panel.png');
      this.load.image('flash_red',  './assets/img/ui/flash_red.png');
      this.load.image('title_logo', './assets/img/ui/title_logo.png');
  
      this.load.spritesheet('field_ui', './assets/img/field/ui/ui_sheet.png', {
        frameWidth: 32,
        frameHeight: 32
      });
  
      // =========================
      // Characters (battle)
      // =========================
      this.load.image('rei_normal', './assets/img/chara/rei/normal.png');
      this.load.image('rei_hit',    './assets/img/chara/rei/hit.png');
      this.load.image('rei_win',    './assets/img/chara/rei/win.png');
      this.load.image('rei_lose',   './assets/img/chara/rei/lose.png');
  
      this.load.image('boy_normal', './assets/img/chara/boy/normal.png');
  
      for (const id of guests){
        this.load.image(`guest_${id}`, `./assets/img/chara/guests/${id}.png`);
      }
  
      for (const id of cabajoIds){
        for (const st of ['normal','hit','win','lose']){
          this.load.image(`${id}_${st}`, `./assets/img/chara/cabajo/${id}/${st}.png`);
        }
      }
  
      // =========================
      // Data (battle)
      // =========================
      this.load.json('enemies_cabajo',   './data/battle/enemies_cabajo.json');
      this.load.json('enemies_guests',   './data/battle/enemies_guests.json');
      this.load.json('commands_rei',     './data/battle/commands_rei.json');
      this.load.json('formulas',         './data/battle/formulas.json');
      this.load.json('text_templates',   './data/battle/text_templates.json');
  
      // キャバ嬢/接客 共通セリフ
      this.load.json('lines_cabajo', './data/battle/lines_cabajo.json?v=dev1');
      this.load.json('lines_guest',  './data/battle/lines_guest.json?v=dev1');

      // =========================
      // Data (club)
      // =========================
      this.load.json('club_char_rei', './data/club/characters/rei.json');
  
      // =========================
      // Data (story)
      // =========================
      this.load.json('story_firstday', './data/story/story_firstday.json');
      this.load.json('story_opening',  './data/story/story_opening.json');
  
      // 指名到達で入店時に発火する解禁イベント（5刻み）
      for (const n of [5,10,15,20,25,30,35,40]){
        this.load.json(`story_event_${n}`, `./data/story/story_event_${n}.json`);
      }
  
      // 指名8到達でのボス解放演出（使うなら）
      this.load.json('story_boss_unlock', './data/story/story_boss_unlock.json');
  
      // 撃破直後イベント（8人）
      for (const id of cabajoIds){
        this.load.json(`story_after_boss_${id}`, `./data/story/story_after_boss_${id}.json`);
      }
  
      // 撃破後の通常会話（8人）
      for (const id of cabajoIds){
        this.load.json(`npc_cabajo_after_${id}`, `./data/story/npc_cabajo_after_${id}.json`);
      }
  
      // NPC会話
      this.load.json('npc_mob_m_1', './data/story/npc_mob_m_1.json');
      this.load.json('npc_mob_m_2', './data/story/npc_mob_m_2.json');
      this.load.json('npc_mob_m_3', './data/story/npc_mob_m_3.json');
      this.load.json('npc_mob_m_4', './data/story/npc_mob_m_4.json');
  
      this.load.json('npc_mob_f_1', './data/story/npc_mob_f_1.json');
      this.load.json('npc_mob_f_2', './data/story/npc_mob_f_2.json');
      this.load.json('npc_mob_f_3', './data/story/npc_mob_f_3.json');
      this.load.json('npc_mob_f_4', './data/story/npc_mob_f_4.json');
  
      this.load.json('npc_boy_1', './data/story/npc_boy_1.json');
      this.load.json('npc_boy_2', './data/story/npc_boy_2.json');
  
      // =========================
      // Field sprites (4x3)
      // =========================
      this.load.spritesheet('rei_field', './assets/img/field/sprites/player/rei.png', {
        frameWidth: 243,
        frameHeight: 317,
        spacing: 0,
        margin: 0
      });
  
      this.load.spritesheet('mob_m', './assets/img/field/sprites/npc/mob_m.png', {
        frameWidth: 237,
        frameHeight: 320,
        spacing: 0,
        margin: 1
      });
  
      this.load.spritesheet('mob_f', './assets/img/field/sprites/npc/mob_f.png', {
        frameWidth: 237,
        frameHeight: 320,
        spacing: 0,
        margin: 1
      });
  
      this.load.spritesheet('npc_boy', './assets/img/field/sprites/npc/boy.png', {
        frameWidth: 233,
        frameHeight: 321,
        spacing: 0,
        margin: 1
      });
  
      this.load.spritesheet('cabajo_symbol1', './assets/img/field/sprites/enemies/cabajo_symbol1.png', {
        frameWidth: 237,
        frameHeight: 320,
        spacing: 0,
        margin: 1
      });

      this.load.spritesheet('cabajo_symbol2', './assets/img/field/sprites/enemies/cabajo_symbol2.png', {
        frameWidth: 237,
        frameHeight: 320,
        spacing: 0,
        margin: 1
      });
    }
  
    create(){
      const page = this.game.registry.get('startPage') || 'index';
  
      const go = (key, data) => {
        if (this.scene.get(key)) this.scene.start(key, data);
        else this.scene.start('Title');
      };
  
      // 通常起動は必ず Title
      if (page === 'index' || page === 'title'){
        go('Title');
        return;
      }
  
      // デバッグ用
      if (page === 'field'){
        // Titleを経由しない直起動は「つづきから想定」に寄せる
        go('Field', { fromTitle:false, newGame:false, debug:true });
        return;
      }
      if (page === 'battle'){
        go('Battle', { type:'guest', id:'salaryman' });
        return;
      }
      if (page === 'story'){
        go('Dialogue', { scriptKey:'story_opening', returnTo:'Field' });
        return;
      }
      if (page === 'save'){
        go('Save');
        return;
      }
  
      go('Title');
    }
  }
  