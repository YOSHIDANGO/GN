// assets/js/scenes/ClubResultScene.js
export class ClubResultScene extends Phaser.Scene {
    constructor(){ super('ClubResult'); }
  
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
  
      // 背景
      this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.72).setScrollFactor(0);
  
      const title = this.forced ? '強制終了' : '結果';
      this.add.text(w/2, Math.floor(h*0.15), title, {
        fontSize:'28px',
        color:'#ffffff',
        fontStyle:'700'
      }).setOrigin(0.5,0.5).setScrollFactor(0);
  
      const lines = [
        `親密度: ${this.affinity}`,
        `興味: ${this.interest}`,
        `苛立ち: ${this.irritation} / ${this.threshold}`
      ];
  
      this.add.text(w/2, Math.floor(h*0.30), lines.join('\n'), {
        fontSize:'20px',
        color:'#ffffff',
        align:'center',
        lineSpacing: 10
      }).setOrigin(0.5,0).setScrollFactor(0);
  
      const mkBtn = (label, y, onTap) => {
        const bw = Math.min(520, Math.floor(w*0.78));
        const bh = 64;
  
        const bg = this.add.rectangle(w/2, y, bw, bh, 0x121218, 0.92)
          .setStrokeStyle(3, 0xffffff, 0.18)
          .setOrigin(0.5,0.5)
          .setInteractive({ useHandCursor:true })
          .setScrollFactor(0)
          .setDepth(10);
  
        const tx = this.add.text(w/2, y, label, {
          fontSize:'22px',
          color:'#ffffff',
          fontStyle:'700'
        }).setOrigin(0.5,0.5).setScrollFactor(0).setDepth(11);
  
        const fire = (pointer) => {
          pointer?.event?.stopPropagation?.();
          onTap();
        };
  
        bg.on('pointerdown', fire);
        tx.setInteractive({ useHandCursor:true }).on('pointerdown', fire);
  
        return { bg, tx };
      };
  
      const y1 = Math.floor(h*0.62);
      const y2 = y1 + 84;
  
      this.btnRetry = mkBtn('もう一回', y1, () => this._retry());
      this.btnBack  = mkBtn('フィールドへ戻る', y2, () => this._backToField());
  
      // 念のため：Resultが出てる間はFieldを止める（スマホの事故防止）
      if (this.scene.isActive(this.returnTo)){
        this.scene.pause(this.returnTo);
      }
  
      this.events.once('shutdown', () => this._cleanup());
      this.events.once('destroy', () => this._cleanup());
    }
  
    _cleanup(){
      // 今は特に無し
    }
  

    _ensureFieldReady(){
        // ★DOMバー残留を最優先で殺す（シーン状態に依存しない）
        try{
        const el = document.getElementById('club-fixed-bar');
        if (el) el.remove();
        }catch(_){}

        // Clubが残ってたら止める（保険）
        if (this.scene.isActive('Club') || this.scene.isPaused('Club')){
        try{ this.scene.stop('Club'); }catch(_){}
        }

        // Fieldを起こす
        if (this.scene.get(this.returnTo)){
        if (this.scene.isPaused(this.returnTo)) this.scene.resume(this.returnTo);
        if (!this.scene.isActive(this.returnTo)) this.scene.start(this.returnTo);

        // ★これがないと「見えないField」のままになる
        this.scene.setVisible(true, this.returnTo);

        this.scene.bringToTop(this.returnTo);

        const f = this.scene.get(this.returnTo);
        if (f){
            try{
            f.modalOpen = false;
            f._pointerConsumed = false;
            f.pendingDoorOutside = false;
            }catch(_){}
        }
        }
    }
  
    _backToField(){
      this.time.delayedCall(0, () => {
        this._ensureFieldReady();
        this.scene.stop('ClubResult');
      });
    }
  
    _retry(){
      this.time.delayedCall(0, () => {
        this._ensureFieldReady();
  
        if (this.scene.get(this.returnTo)) this.scene.pause(this.returnTo);
  
        this.scene.stop('ClubResult');
        this.scene.launch('Club', {
          returnTo: this.returnTo,
          characterId: this.characterId,
          debug: false
        });
        this.scene.bringToTop('Club');
      });
    }
  }
  