// assets/js/scenes/EndingScene.js
export class EndingScene extends Phaser.Scene {
    constructor(){
      super('Ending');
    }
  
    init(data){
      this.returnTo = data?.returnTo || 'Title';
      this.phase = 0;
      this.lineIndex = 0;
      this._exiting = false;
      this._creditCueTimers = [];
    }
  
    create(){
      const w = this.scale.width;
      const h = this.scale.height;
  
      // 背景
      this.cameras.main.setBackgroundColor('#000000');
      this.cameras.main.fadeIn(400, 0, 0, 0);
  
      // 入力
      this.input.on('pointerdown', ()=> this._onTap());
  
      // =====================
      // phase 0：余韻モノローグ
      // =====================
      this.monoText = this.add.text(w/2, h/2, '', {
        fontSize: 26,
        color: '#ffffff',
        align: 'center',
        lineSpacing: 14
      }).setOrigin(0.5).setAlpha(0).setDepth(10);
  
      // =====================
      // phase 1：会話
      // =====================
      this.dialogText = this.add.text(w/2, h - 140, '', {
        fontSize: 22,
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.65)',
        padding:{ left:16, right:16, top:12, bottom:12 },
        wordWrap:{ width: w - 160 }
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(100); // ★最前面
  
      // 立ち絵（縮小＋左右分離）
      this.rei = this.add.image(-200, h, 'rei_win')
        .setOrigin(0,1)
        .setAlpha(0)
        .setScale(0.6)
        .setDepth(20);
  
      this.karen = this.add.image(w + 200, h, 'karen_win')
        .setOrigin(1,1)
        .setAlpha(0)
        .setScale(0.6)
        .setDepth(20);
  
      // =====================
      // phase 2：エンドロール
      // =====================
      this.creditText = this.add.text(w/2, h + 40, '', {
        fontSize: 22,
        color: '#ffffff',
        align: 'center',
        lineSpacing: 12
      }).setOrigin(0.5, 0).setAlpha(0).setDepth(10);
  
      this.creditPortrait = this.add.image(0, 0, 'rei_win')
        .setOrigin(0.5, 1)
        .setAlpha(0)
        .setDepth(30)
        .setScale(0.55);
  
      // =====================
      // phase 3：ラスト
      // =====================
      this.twoshot = this.add.image(w / 2, h / 2, 'bg_shop_front')
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(20);
    
        // ★画面内に収める
        const maxW = w * 0.9;
        const maxH = h * 0.75;
        
        const scale = Math.min(
        maxW / this.twoshot.width,
        maxH / this.twoshot.height
        );
    
        this.twoshot.setScale(scale);
  
      this.finalText = this.add.text(w/2, h * 0.35, 'THANK YOU FOR PLAYING', {
        fontSize: 32,
        color: '#ffffff'
      }).setOrigin(0.5).setAlpha(0).setDepth(40);
  
      this._startPhase0();
    }
  
    // =====================
    // phase 0
    // =====================
    _startPhase0(){
      this.phase = 0;
  
      const text =
      `グロリアスの夜は、まだ終わらない。
      
      次は――
      この街のナンバーワンを目指して。
      
      レイの勝負は、
      これからも続いていく。`;
  
      this.monoText.setText(text).setAlpha(0);
  
      this.tweens.add({
        targets:this.monoText,
        alpha:1,
        duration:600
      });
  
      this.time.delayedCall(4200, ()=> this._startPhase1());
    }
  
    // =====================
    // phase 1
    // =====================
    _startPhase1(){
      const w = this.scale.width;
      this.phase = 1;
  
      this.monoText.setAlpha(0);
  
      this.rei.setAlpha(1);
      this.karen.setAlpha(1);
  
      this.tweens.add({
        targets:this.rei,
        x: Math.floor(w * 0.12),
        duration:600,
        ease:'Cubic.out'
      });
  
      this.tweens.add({
        targets:this.karen,
        x: Math.floor(w * 0.88),
        duration:600,
        ease:'Cubic.out',
        delay:200
      });
  
      this.dialogLines = [
        'カレン「ここからが本番だね」',
        'レイ「グロリアスで、ススキノ一番」',
        'カレン「二人で取る」',
        'レイ「取ったら？」',
        'カレン「次は、ウチが勝つ」',
        'レイ「言うじゃん」'
      ];
  
      this.lineIndex = 0;
      this.dialogText.setAlpha(1);
      this._showNextLine();
    }
  
    _showNextLine(){
      if (this.lineIndex >= this.dialogLines.length){
        this.dialogText.setAlpha(0);
        this._startPhase2();
        return;
      }
      this.dialogText.setText(this.dialogLines[this.lineIndex]);
      this.lineIndex++;
    }
  
    // =====================
    // phase 2
    // =====================
    _startPhase2(){
        const w = this.scale.width;
        const h = this.scale.height;
        this.phase = 2;
      
        this.rei.setAlpha(0);
        this.karen.setAlpha(0);
      
        const credits =
      `CAST
      
      レイ
      ミオ
      ユナ
      サキ
      エリ
      リナ
      マコ
      アヤ
      カレン
      
      GUESTS
      サラリーマン
      観光客
      常連さん
      エリートサラリーマン
      外国人観光客
      社長さん
      街の男1
      街の男2
      街の男3
      街の男4
      街の女1
      街の女2
      街の女3
      街の女4
      
      BOYS
      ボーイA
      ボーイB
      
      -
      
      STORY
      Scenario S.Y
      Writing S.Y
      Direction S.Y
      
      SYSTEM
      Game Design S.Y
      Battle Design S.Y
      Balance Tuning S.Y
      UI / UX Design S.Y
      Save System S.Y
      Event System S.Y
      
      FIELD
      NPC Placement S.Y
      NPC Wander Logic S.Y
      Door Interaction S.Y
      Talk UI S.Y
      
      BATTLE
      Damage Calculation S.Y
      Mood System S.Y
      Serif Phases S.Y
      Animation Control S.Y
      
      ART
      Character Illustration S.Y
      Character Pixel Art S.Y
      Background Art S.Y
      Logo Design S.Y
            
      DEBUG
      Playtest S.Y
      Bug Fix S.Y
      Optimization S.Y
      
      SPECIAL THANKS
      YOU`;
      
        this.creditText.setText(
            credits.replace(/^\s+/gm, '')
        );
        this.creditText.setAlpha(1);
        this.creditText.setPosition(Math.floor(w * 0.5), h + 40);
        this.creditText.setOrigin(0.5, 0);
      
        // 立ち絵キュー（勝利絵）
        const cues = [
          // CAST（主役なので一番ゆっくり）
          { time: 1200,  key:'rei_win',   side:'left'  },
          { time: 4400,  key:'mio_win',   side:'right' },
          { time: 7600,  key:'yuna_win',  side:'left'  },
          { time: 10800, key:'saki_win',  side:'right' },
          { time: 14000, key:'eri_win',   side:'left'  },
          { time: 17200, key:'rina_win',  side:'right' },
          { time: 20400, key:'mako_win',  side:'left'  },
          { time: 23600, key:'aya_win',   side:'right' },
      
          // GUEST（少しテンポ上げる）
          { time: 27000, key:'guest_salaryman', side:'left'  },
          { time: 29400, key:'guest_tourist',   side:'right' },
          { time: 31800, key:'guest_regular',   side:'left'  },
          { time: 34200, key:'guest_elite',     side:'right' },
          { time: 36600, key:'guest_foreign',   side:'left'  },
          { time: 39000, key:'guest_ceo',       side:'right' },
      
          // BOY（間を作る）
          { time: 42400, key:'boy_normal', side:'left' },
      
          // KAREN（締め）
          { time: 46800, key:'karen_win', side:'right' }
        ];
      
        // スクロール速度（px/sec）
        const speedPxPerSec = 52;
        const distance = (h + 40) + (this.creditText.height + 120);
        const duration = Math.floor((distance / speedPxPerSec) * 1000);
      
        // ★キューの最後まで必ず流れるように延長
        const lastCueTime = Math.max(...cues.map(c => c.time));
        const need = lastCueTime + 3200;
        const durationFixed = Math.max(duration, need);
      
        // 既存タイマー破棄
        if (this._creditCueTimers?.length){
          for (const t of this._creditCueTimers) t.remove(false);
        }
        this._creditCueTimers = [];
      
        const showPortrait = (key, side) => {
          const x =
            side === 'left'  ? Math.floor(w * 0.20) :
            side === 'right' ? Math.floor(w * 0.80) :
                               Math.floor(w * 0.80);
      
          const y = Math.floor(h * 0.96);
      
          this.creditPortrait.setTexture(key);
          this.creditPortrait.setPosition(x, y);
          this.creditPortrait.setAlpha(0);
          this.creditPortrait.setScale(0.55);
      
          this.tweens.killTweensOf(this.creditPortrait);
      
          // フェード（少しゆっくりめの方が見やすい）
          this.tweens.add({
            targets: this.creditPortrait,
            alpha: 0.85,
            duration: 400,
            onComplete: ()=>{
              this.tweens.add({
                targets: this.creditPortrait,
                alpha: 0,
                duration: 500,
                delay: 2000
              });
            }
          });
        };
      
        for (const c of cues){
          if (c.time >= durationFixed - 600) continue;
          const t = this.time.delayedCall(c.time, ()=> showPortrait(c.key, c.side));
          this._creditCueTimers.push(t);
        }
      
        this.tweens.add({
          targets:this.creditText,
          y: -this.creditText.height - 80,
          duration: durationFixed,
          ease:'Linear',
          onComplete: ()=>{
            this.creditPortrait.setAlpha(0);
            this._startPhase3();
          }
        });
      }
      
  
    // =====================
    // phase 3：ラスト
    // =====================
    _startPhase3(){
      this.phase = 3;
  
      // クレジット完全に消す
      this.creditText.setAlpha(0);
      this.creditPortrait.setAlpha(0);
  
      // ラストショットフェードイン
      this.tweens.add({
        targets: this.twoshot,
        alpha: 1,
        duration: 800,
        ease: 'Linear'
      });
  
      // THANK YOU を少し遅らせて出す
      this.finalText.setAlpha(0);
      this.finalText.setPosition(
        this.scale.width / 2,
        this.scale.height * 0.82
      );
  
      this.time.delayedCall(600, ()=>{
        this.tweens.add({
          targets: this.finalText,
          alpha: 1,
          duration: 600,
          ease: 'Linear'
        });
      });
    }
  
    // =====================
    // input
    // =====================
    _onTap(){
      if (this._exiting) return;
  
      if (this.phase === 1){
        this._showNextLine();
        return;
      }
  
      if (this.phase === 3){
        this._exit();
      }
    }
  
    _exit(){
      this._exiting = true;
  
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(450, ()=>{
        // Fieldはpauseのまま残るので止める
        this.scene.stop('Ending');
        if (this.scene.isPaused('Field') || this.scene.isActive('Field')){
          this.scene.stop('Field');
        }
        // Dialogueが残ってたら止める（保険）
        if (this.scene.isPaused('Dialogue') || this.scene.isActive('Dialogue')){
          this.scene.stop('Dialogue');
        }
  
        this.scene.start(this.returnTo);
      });
    }
  }
  