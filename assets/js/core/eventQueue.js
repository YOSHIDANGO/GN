// assets/js/core/eventQueue.js
export class EventQueue {
    constructor(scene){
      this.scene = scene;
      this.q = [];
      this.running = false;
    }
  
    push(fn){
      this.q.push(fn);
    }
  
    run(){
      if (this.running) return;
      this.running = true;
      this._next();
    }
  
    _next(){
      const fn = this.q.shift();
      if (!fn){
        this.running = false;
        return;
      }
  
      // fn は true を返したら「イベント起動した」扱いで停止
      // false なら次へ
      const started = !!fn();
      if (started) return;
  
      this._next();
    }
  
    // Dialogue 終了後に呼ぶ用
    resume(){
      if (!this.running) return;
      this._next();
    }
  }
  