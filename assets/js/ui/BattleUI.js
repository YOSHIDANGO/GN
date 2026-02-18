// assets/js/ui/BattleUI.js
export class BattleUI {
    constructor(scene){
      this.scene = scene;
  
      this.container = scene.add.container(0,0)
        .setDepth(1000)
        .setScrollFactor(0);
  
      // ====== 上：名前+HP（固定UI） ======
      this.tags = {
        player: this._makeHpTag('player'),
        enemy:  this._makeHpTag('enemy')
      };
      this.container.add([
        this.tags.player.wrap,
        this.tags.enemy.wrap
      ]);
  
      // ====== 中：ログ枠（見出し無し） ======
      this.msg = this._makeMessageBox();
      this.container.add(this.msg.wrap);
  
      // ====== 下：コマンド4つ ======
      this.buttons = [];
      this.enabled = true;
      this._onCommand = null;
      this._makeButtons();
  
      // 画面タップで次へ（会話進行用）
      this._onAdvance = null;
      this._advanceZone = scene.add.zone(0,0,10,10).setOrigin(0,0);
      this._advanceZone.disableInteractive();
      this._advanceZone.on('pointerdown', () => {
        if (this._onAdvance) this._onAdvance();
      });
      this.container.add(this._advanceZone);
  
      // レイアウト
      this._layoutCache = null;
      this.layout(scene.scale.width, scene.scale.height);
  
      this._onResize = () => {
        scene.time.delayedCall(0, () => this.layout(scene.scale.width, scene.scale.height));
      };
      scene.scale.on('resize', this._onResize);
    }
  
    // -------------------------
    // factories
    // -------------------------
    _makeHpTag(side){
      const wrap = this.scene.add.container(0,0);
  
      // ベース
      const bg = this.scene.add.rectangle(0,0,10,10,0x000000,0.68)
        .setOrigin(0.5,0.5)
        .setStrokeStyle(3, 0xf2c66d, 0.55);
  
      // 内枠（薄い光）
      const inner = this.scene.add.rectangle(0,0,10,10,0x000000,0.0)
        .setOrigin(0.5,0.5)
        .setStrokeStyle(2, 0xffffff, 0.12);
  
      // 名前
      const name = this.scene.add.text(0,0,'', {
        fontSize:'22px',
        color:'#ffffff',
        fontStyle:'700'
      }).setOrigin(0.5,0.5).setShadow(2,2,'#000',4);
  
      // HP文字
      const hp = this.scene.add.text(0,0,'', {
        fontSize:'16px',
        color:'#eaeaea'
      }).setOrigin(0.5,0.5).setShadow(2,2,'#000',3);
  
      // HPバー（細め）
      const barBg = this.scene.add.rectangle(0,0,10,10,0x2a2a2a,0.9).setOrigin(0,0.5);
      const barFill = this.scene.add.rectangle(0,0,10,10,0x39d98a,0.95).setOrigin(0,0.5);
      const barFrame = this.scene.add.rectangle(0,0,10,10,0x000000,0).setOrigin(0,0.5)
        .setStrokeStyle(2, 0xffffff, 0.14);
  
      wrap.add([bg, inner, barBg, barFill, barFrame, name, hp]);
  
      return { wrap, bg, inner, name, hp, barBg, barFill, barFrame, side, _ratio:1 };
    }
  
    _makeMessageBox(){
      const wrap = this.scene.add.container(0,0);
  
      // 外枠
      const bg = this.scene.add.rectangle(0,0,10,10,0x000000,0.62)
        .setOrigin(0.5,0.5)
        .setStrokeStyle(3, 0xf2c66d, 0.55);
  
      // 内枠
      const inner = this.scene.add.rectangle(0,0,10,10,0x000000,0.0)
        .setOrigin(0.5,0.5)
        .setStrokeStyle(2, 0xffffff, 0.10);
  
      // ログ本文（3行想定）
      // 見出しを消した分、上余白を少し確保して切れにくく
      const text = this.scene.add.text(0,0,'', {
        fontSize:'22px',
        color:'#ffffff',
        fontStyle:'700',
        lineSpacing: 4,
        wordWrap:{ width: 1000, useAdvancedWrap:true }
      }).setOrigin(0,0).setShadow(2,2,'#000',4);
  
      wrap.add([bg, inner, text]);
      return { wrap, bg, inner, text };
    }
  
    _makeButtons(){
      const defs = [
        { id:'kogeki',     label:'口撃' },
        { id:'aori',       label:'煽り' },
        { id:'home',       label:'誉め殺し' },
        { id:'kirikaeshi', label:'切り返し' }
      ];
  
      for (const d of defs){
        const bg = this.scene.add.rectangle(0,0,10,10,0x0f0f12,0.78)
          .setOrigin(0,0)
          .setStrokeStyle(3, 0xf2c66d, 0.35)
          .setInteractive();
  
        const shine = this.scene.add.rectangle(0,0,10,10,0xffffff,0.06)
          .setOrigin(0,0);
  
        const label = this.scene.add.text(0,0,d.label,{
          fontSize:'22px',
          color:'#ffffff',
          fontStyle:'700'
        }).setOrigin(0.5,0.5).setShadow(2,2,'#000',4);
  
        bg.on('pointerdown', ()=>{
          if (!this.enabled) return;
          if (this._onCommand) this._onCommand(d.id);
        });
  
        this.container.add([bg, shine, label]);
        this.buttons.push({ id:d.id, bg, shine, label });
      }
    }
  
    // -------------------------
    // layout
    // -------------------------
    layout(w, h){
      // advance zone
      this._advanceZone.setPosition(0,0);
      this._advanceZone.setSize(w,h);
  
      // safe margins
      const marginX = Math.max(18, Math.floor(w * 0.03));
      const marginY = Math.max(14, Math.floor(h * 0.02));
  
      // ---- 下：ボタン（下固定） ----
      const panelW = Math.min(1180, w - marginX*2);
      const gap = 12;
  
      const btnH = Math.min(76, Math.max(62, Math.floor(h * 0.11)));
      const btnW = Math.floor((panelW - gap*5) / 4);
  
      const btnLeft = (w/2) - panelW/2;
      const btnTop  = h - marginY - btnH;
      const btnBottom = btnTop + btnH;
  
      for (let i=0; i<this.buttons.length; i++){
        const b = this.buttons[i];
        const bx = btnLeft + gap + i * (btnW + gap);
        const by = btnTop;
  
        b.bg.setPosition(bx, by);
        b.bg.setSize(btnW, btnH);
  
        b.shine.setPosition(bx, by);
        b.shine.setSize(btnW, Math.floor(btnH*0.35));
  
        b.label.setPosition(bx + btnW/2, by + btnH/2);
      }
  
      // ---- 中：ログ（見出し無しで薄く）----
      const msgW = Math.min(1120, w - marginX*2);
  
      // ★ここが今回のメイン：高さを下げる（薄くする）
      // 目安：1080pでだいたい 120〜145px くらい
      const msgH = Math.min(148, Math.max(118, Math.floor(h * 0.17)));
  
      const msgGapToButtons = 10;
  
      const msgX = w/2;
      const msgY = btnTop - msgGapToButtons - (msgH/2);
  
      this.msg.bg.setPosition(msgX, msgY);
      this.msg.bg.setSize(msgW, msgH);
  
      this.msg.inner.setPosition(msgX, msgY);
      this.msg.inner.setSize(msgW-10, msgH-10);
  
      // 見出し無しになった分、上余白を増やして本文を少し下げる
      const padX = 18;
      const padTop = 16;
  
      this.msg.text.setPosition(msgX - msgW/2 + padX, msgY - msgH/2 + padTop);
      this.msg.text.setWordWrapWidth(msgW - padX*2);
  
      // ---- 上：HP（薄くして被り減らす）----
      const tagW = Math.min(360, Math.max(280, Math.floor(w * 0.30)));
  
      // ★ここ重要：高さをガッツリ削る
      const tagH = Math.min(84, Math.max(70, Math.floor(h * 0.105)));
  
      const y = marginY + tagH/2 + 2;
  
      const leftX  = marginX + tagW/2;
      const rightX = w - marginX - tagW/2;
  
      this._layoutHpTag(this.tags.player, leftX,  y, tagW, tagH);
      this._layoutHpTag(this.tags.enemy,  rightX, y, tagW, tagH);
  
      // cache（BattleScene側が立ち絵のy決める用に使える）
      this._layoutCache = {
        w, h,
        marginX, marginY,
        btnTop, btnBottom,
        msgTop: msgY - msgH/2,
        msgBottom: msgY + msgH/2,
        msgH
      };
    }
  
    _layoutHpTag(t, x, y, w, h){
      t.wrap.setPosition(x, y);
  
      t.bg.setSize(w, h);
      t.inner.setSize(w-10, h-10);
  
      // ★並びを固定：名前 → HP文字 → HPバー（下）
      const nameY = -h*0.28;
      const hpY   =  0;          // 真ん中
      const barY  =  h*0.28;     // 下寄せ
  
      t.name.setPosition(0, nameY);
      t.hp.setPosition(0, hpY);
  
      const barW = w * 0.80;
      const barH = Math.max(8, Math.floor(h * 0.16)); // ★細め
  
      const barX = -barW/2;
  
      t.barBg.setPosition(barX, barY);
      t.barBg.setSize(barW, barH);
  
      t.barFill.setPosition(barX, barY);
      t.barFill.setSize(Math.max(1, barW * (t._ratio ?? 1)), barH);
  
      t.barFrame.setPosition(barX, barY);
      t.barFrame.setSize(barW, barH);
    }
  
    // -------------------------
    // API
    // -------------------------
    onCommand(fn){ this._onCommand = fn; }
    onAdvance(fn){ this._onAdvance = fn; }
  
    setAdvanceEnabled(v){
      if (v) this._advanceZone.setInteractive();
      else this._advanceZone.disableInteractive();
    }
  
    setEnabled(v){
      this.enabled = !!v;
      for (const b of this.buttons){
        b.bg.setAlpha(this.enabled ? 0.78 : 0.35);
        b.shine.setAlpha(this.enabled ? 0.06 : 0.02);
        b.bg.setStrokeStyle(3, 0xf2c66d, this.enabled ? 0.35 : 0.18);
      }
    }
  
    setMessage(text){
      this.msg.text.setText(text || '');
    }
  
    // HPタグ更新
    setHpTag(which, _sprite, name, hp, maxHp){
      const t = this.tags[which];
      if (!t) return;
  
      t.name.setText(name ?? '');
      t.hp.setText(`HP ${hp}/${maxHp}`);
  
      const ratio = (maxHp > 0) ? (hp / maxHp) : 0;
      t._ratio = Phaser.Math.Clamp(ratio, 0, 1);
  
      // 現在サイズから再計算して反映
      const w = t.bg.width || 320;
      const barW = w * 0.80;
      const barH = t.barBg.height || 10;
  
      const barX = -barW/2;
      const barY = t.barBg.y;
  
      t.barFill.setPosition(barX, barY);
      t.barFill.setSize(Math.max(1, barW * t._ratio), barH);
    }
  
    // ログ枠の上端（BattleScene側で立ち絵配置に使える）
    getMessageTopY(){
      return this.msg.bg.y - this.msg.bg.height/2;
    }
  
    // コマンド枠の上端（立ち絵の下限に使える）
    getCommandTopY(){
      const info = this._layoutCache;
      return info ? info.btnTop : (this.scene.scale.height * 0.85);
    }
  
    // 立ち絵の下端におすすめのY（ログ枠の上に少し余白）
    // 立ち絵を setOrigin(0.5,1) にして setY() する想定
    getPortraitBottomY(){
      const top = this.getMessageTopY();
      const gap = Math.max(10, Math.floor((this.scene.scale.height || 720) * 0.015));
      return top - gap;
    }
  
    getLayoutInfo(){
      return this._layoutCache || null;
    }
  
    destroy(){
      if (this._onResize){
        this.scene.scale.off('resize', this._onResize);
      }
      this.container.destroy(true);
    }
  }
  