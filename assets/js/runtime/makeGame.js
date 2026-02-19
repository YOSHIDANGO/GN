// game/assets/js/runtime/makeGame.js
import { BootScene } from '../scenes/BootScene.js';
import { TitleScene } from '../scenes/TitleScene.js';
import { FieldScene } from '../scenes/FieldScene.js';
import { BattleScene } from '../scenes/BattleScene.js';
import { DialogueScene } from '../scenes/DialogueScene.js';
import { SaveScene } from '../scenes/SaveScene.js';
import { EndingScene } from '../scenes/EndingScene.js';
import { ClubScene } from '../scenes/ClubScene.js';
import { ClubResultScene } from '../scenes/ClubResultScene.js';

export function makeGame(page){
  const isLandscape = window.innerWidth > window.innerHeight;

  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0b0b10',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: isLandscape ? 1600 : 1280,
      height: 720
    },
    input: { activePointers: 2 },
    dom: { createContainer: true },
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
    physics: { default: 'arcade', arcade: { debug: false } }
  };

  // ★ここが重要：ローカル変数で受ける
  const phaserGame = new Phaser.Game(config);

  // ★グローバルも div と被らない名前に
  window.__PHASER_GAME__ = phaserGame;
  window.phaserGame = phaserGame;

  phaserGame.registry.set('startPage', page);

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
      lastW = w; lastH = h; lastTop = top;

      root.style.width  = `${w}px`;
      root.style.height = `${h}px`;
      root.style.transform = `translateY(${top}px)`;
      root.style.transformOrigin = 'top left';

      if (phaserGame.scale) phaserGame.scale.refresh();
    });
  };

  fitRoot();
  window.addEventListener('resize', fitRoot, { passive: true });
  if (window.visualViewport){
    window.visualViewport.addEventListener('resize', fitRoot, { passive: true });
    window.visualViewport.addEventListener('scroll', fitRoot, { passive: true });
  }

  return phaserGame;
}
