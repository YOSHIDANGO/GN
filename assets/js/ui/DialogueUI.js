// assets/js/ui/DialogueUI.js
export class DialogueUI {
    constructor(scene){
      this.scene = scene;
  
      this.container = scene.add.container(0,0)
        .setDepth(1000)
        .setScrollFactor(0);
  
      // 黒帯
      this.backdrop = scene.add.rectangle(
        0, 0, 100, 100, 0x000000, 0.55
      ).setOrigin(0.5, 1);
  
      // 名前まわりの“余白感”を出す薄いプレート（サイズじゃなく空気）
      this.namePlate = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.22)
        .setOrigin(0, 0.5);
  
      this.nameText = scene.add.text(0, 0, '', {
        fontSize:'20px',
        color:'#fff',
        fontStyle:'700'
      }).setShadow(2,2,'#000',2);
  
      this.bodyText = scene.add.text(0, 0, '', {
        fontSize:'22px',
        color:'#fff',
        fontStyle:'700',
        lineSpacing: 6,
        wordWrap:{ width: 1000, useAdvancedWrap:true }
      }).setShadow(2,2,'#000',2);
  
      // 次へマーク（点滅じゃなく、ふわっと移動）
      this.nextMark = scene.add.text(0, 0, '▶', {
        fontSize:'20px',
        color:'#fff'
      }).setOrigin(1,1).setAlpha(0.9);
  
      this.container.add([
        this.backdrop,
        this.namePlate,
        this.nameText,
        this.bodyText,
        this.nextMark
      ]);
  
      // typewriter state
      this._fullText = '';
      this._typingIndex = 0;
      this._typingEvent = null;
      this._typingDone = true;
  
      // nextMark motion
      this._nextTween = null;
      this._nextBasePos = { x:0, y:0 };
  
      this._layoutCache = null;
  
      this.layout(scene.scale.width, scene.scale.height);
  
      this._onResize = () => {
        scene.time.delayedCall(0, () => {
          this.layout(scene.scale.width, scene.scale.height);
          // リサイズで位置が変わるので、ふわっ移動の基準も更新
          this._restartNextMarkFloatIfVisible();
          this._layoutNamePlate();
        });
      };
      scene.scale.on('resize', this._onResize);
    }
  
    layout(w, h){
      const marginX = Math.max(20, Math.floor(w * 0.03));
      const marginBottom = Math.max(14, Math.floor(h * 0.02));
  
      const panelW = Math.min(1180, w - marginX*2);
  
      // 端末差で切れないように
      const panelH = Math.min(250, Math.max(200, Math.floor(h * 0.23)));
  
      const x = w / 2;
      const y = h - marginBottom;
  
      this.backdrop.setPosition(x, y);
      this.backdrop.setSize(panelW, panelH);
  
      const padX = Math.max(26, Math.floor(panelW * 0.03));
  
      // ★名前欄の存在感は「余白」で出す
      // ここを厚めにして、上に“溜め”を作る
      const padTop = Math.max(28, Math.floor(panelH * 0.19));
  
      const nameFs = Math.min(24, Math.max(18, Math.floor(h * 0.026)));
      const bodyFs = Math.min(30, Math.max(22, Math.floor(h * 0.032)));
  
      this.nameText.setFontSize(nameFs);
      this.bodyText.setFontSize(bodyFs);
      this.bodyText.setLineSpacing(Math.max(6, Math.floor(bodyFs * 0.25)));
  
      // 名前の位置（上余白を確保）
      const nameX = x - panelW/2 + padX;
      const nameY = y - panelH + padTop;
  
      this.nameText.setPosition(nameX, nameY);
  
      // 名前→本文の間も“余白”で気持ちよく
      const nameToBodyGap = Math.max(10, Math.floor(nameFs * 0.9));
      const bodyTop = nameY + Math.floor(nameFs * 1.0) + nameToBodyGap;
  
      this.bodyText.setPosition(
        nameX,
        bodyTop
      );
  
      this.bodyText.setWordWrapWidth(panelW - padX*2);
  
      this.nextMark.setFontSize(Math.max(18, Math.floor(bodyFs * 0.9)));
      this.nextMark.setPosition(
        x + panelW/2 - Math.max(22, Math.floor(padX * 0.8)),
        y - Math.max(18, Math.floor(panelH * 0.10))
      );
  
      // ふわっ移動の基準
      this._nextBasePos.x = this.nextMark.x;
      this._nextBasePos.y = this.nextMark.y;
  
      // name plate を名前に合わせて更新
      this._layoutNamePlate();
  
      // 立ち絵用にキャッシュ
      this._layoutCache = {
        w, h,
        panelW, panelH,
        x, y,
        topY: y - panelH
      };
    }
  
    _layoutNamePlate(){
      // 名前が空なら薄プレートも隠す
      const name = this.nameText.text || '';
      if (!name){
        this.namePlate.setVisible(false);
        return;
      }
      this.namePlate.setVisible(true);
  
      // 余白で存在感：文字サイズは変えず、周囲の“間”だけ作る
      const padL = 12;
      const padR = 16;
      const padY = 10;
  
      // Textのサイズ
      const tw = Math.max(1, this.nameText.width);
      const th = Math.max(1, this.nameText.height);
  
      const plateW = tw + padL + padR;
      const plateH = th + padY;
  
      // plate は左端合わせ、yは中央合わせ
      this.namePlate.setSize(plateW, plateH);
      this.namePlate.setPosition(this.nameText.x - padL, this.nameText.y + Math.floor(th * 0.45));
    }
  
    // ===== 立ち絵用 =====
    getTopY(){
      if (this._layoutCache) return this._layoutCache.topY;
      return this.backdrop.y - this.backdrop.height;
    }
  
    getPortraitBottomY(gap = 0){
      return this.getTopY() - gap;
    }
    // ==================
  
    setName(name){
      this.nameText.setText(name || '');
      this._layoutNamePlate();
    }
  
    // 1文字ずつ表示（スキップ無し）
    setText(text){
      const s = (text || '');
  
      // 既存typing停止
      this._stopTyping();
  
      this._fullText = s;
      this._typingIndex = 0;
      this._typingDone = false;
  
      // 表示開始は空
      this.bodyText.setText('');
  
      // 次へマークは「全文表示後」に出す
      this._hideNextMark();
  
      // 空文は即完了扱い
      if (!s){
        this._typingDone = true;
        this._showNextMark();
        return;
      }
  
      // 速度：環境差で破綻しにくい値
      // 22px前後の本文なら 22ms/char がだいたい気持ちいい
      const msPerChar = 22;
  
      this._typingEvent = this.scene.time.addEvent({
        delay: msPerChar,
        loop: true,
        callback: () => {
          if (this._typingIndex >= this._fullText.length){
            this._typingDone = true;
            this._stopTyping(true);
            this._showNextMark();
            return;
          }
  
          this._typingIndex += 1;
          this.bodyText.setText(this._fullText.slice(0, this._typingIndex));
        }
      });
    }
  
    _stopTyping(keepEventNull = false){
      if (this._typingEvent){
        this._typingEvent.remove(false);
        this._typingEvent = null;
      }
      if (!keepEventNull){
        // noop
      }
    }
  
    _hideNextMark(){
      this.nextMark.setVisible(false);
      if (this._nextTween){
        this._nextTween.stop();
        this._nextTween = null;
      }
    }
  
    _showNextMark(){
      this.nextMark.setVisible(true);
  
      // 基準位置へ戻す
      this.nextMark.setPosition(this._nextBasePos.x, this._nextBasePos.y);
  
      // ふわっ移動（上下にちょい漂う）
      if (this._nextTween){
        this._nextTween.stop();
        this._nextTween = null;
      }
  
      this._nextTween = this.scene.tweens.add({
        targets: this.nextMark,
        y: this._nextBasePos.y - 8,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
    }
  
    _restartNextMarkFloatIfVisible(){
      if (!this.nextMark.visible) return;
      this._showNextMark();
    }
  
    setVisible(v){
      this.container.setVisible(!!v);
    }
  
    destroy(){
      this._stopTyping();
  
      if (this._nextTween){
        this._nextTween.stop();
        this._nextTween = null;
      }
  
      if (this._onResize) {
        this.scene.scale.off('resize', this._onResize);
      }
      this.container.destroy(true);
    }
  }
  