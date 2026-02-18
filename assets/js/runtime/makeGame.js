import { BootScene } from '../scenes/BootScene.js';
import { TitleScene } from '../scenes/TitleScene.js';
import { FieldScene } from '../scenes/FieldScene.js';
import { BattleScene } from '../scenes/BattleScene.js';
import { DialogueScene } from '../scenes/DialogueScene.js';
import { SaveScene } from '../scenes/SaveScene.js';
import { EndingScene } from '../scenes/EndingScene.js';
import { ClubScene } from '../scenes/ClubScene.js';
import { ClubResultScene } from '../scenes/ClubResultScene.js';


// game/assets/js/runtime/makeGame.js
export function makeGame(page){

  const isLandscape = window.innerWidth > window.innerHeight;

  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0b0b10',

    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,

      // ★画面サイズ
      width: isLandscape ? 1600 : 1280,
      height: 720
    },

    input: { activePointers: 2 },

    // ★ここ追加（スマホ入力用）
    dom: {
      createContainer: true
    },

    scene: [
      BootScene,
      TitleScene,
      FieldScene,
      BattleScene,
      DialogueScene,
      SaveScene,
      EndingScene,
      ClubScene,
      ClubResultScene
    ],

    physics: {
      default: 'arcade',
      arcade: { debug: false }
    }
  };

  const game = new Phaser.Game(config);
  game.registry.set('startPage', page);

  const root = document.getElementById('game');

  root.style.position = 'fixed';
  root.style.left = '0';
  root.style.top = '0';
  root.style.margin = '0';
  root.style.padding = '0';

  document.documentElement.style.height = '100%';
  document.body.style.height = '100%';
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  let raf = 0;
  let lastW = 0;
  let lastH = 0;
  let lastTop = 0;

  const fitRoot = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const vv = window.visualViewport;

      const wRaw = vv ? vv.width : window.innerWidth;
      const hRaw = vv ? vv.height : window.innerHeight;
      const top  = vv ? vv.offsetTop : 0;

      const w = Math.floor(wRaw / 2) * 2;
      const h = Math.floor(hRaw / 2) * 2;

      if (w === lastW && h === lastH && top === lastTop) return;
      lastW = w;
      lastH = h;
      lastTop = top;

      root.style.width  = `${w}px`;
      root.style.height = `${h}px`;

      // ★キーボードでviewportがズレるのを吸収
      root.style.transform = `translateY(${top}px)`;
      root.style.transformOrigin = 'top left';

      if (game.scale) game.scale.refresh();
    });
  };

  fitRoot();
  window.addEventListener('resize', fitRoot, { passive: true });
  if (window.visualViewport){
    window.visualViewport.addEventListener('resize', fitRoot, { passive: true });
    window.visualViewport.addEventListener('scroll', fitRoot, { passive: true });
  }

  return game;
}
