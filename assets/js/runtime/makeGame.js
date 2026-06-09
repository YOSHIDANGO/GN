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

function isTouchDevice(){
  return navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
}

function requestFullscreenAndLandscape(){
  const root = document.documentElement;
  const tasks = [];

  if (root.requestFullscreen && !document.fullscreenElement){
    tasks.push(root.requestFullscreen().catch(() => null));
  }

  const orientation = screen.orientation;
  if (orientation?.lock){
    tasks.push(orientation.lock('landscape').catch(() => null));
  }

  return Promise.all(tasks);
}

function createLaunchGate(start){
  const overlay = document.createElement('div');
  overlay.id = 'gn-launch-gate';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '2147483647';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '24px';
  overlay.style.boxSizing = 'border-box';
  overlay.style.background = '#050509';
  overlay.style.color = '#fff';
  overlay.style.fontFamily = 'system-ui,-apple-system,Segoe UI,sans-serif';
  overlay.style.textAlign = 'center';
  overlay.style.touchAction = 'manipulation';

  const panel = document.createElement('button');
  panel.type = 'button';
  panel.style.width = 'min(520px, 92vw)';
  panel.style.minHeight = '128px';
  panel.style.border = '1px solid rgba(255,255,255,0.28)';
  panel.style.borderRadius = '14px';
  panel.style.background = 'rgba(255,255,255,0.08)';
  panel.style.color = '#fff';
  panel.style.font = '700 22px system-ui,-apple-system,Segoe UI,sans-serif';
  panel.style.lineHeight = '1.5';
  panel.style.padding = '22px';
  panel.style.cursor = 'pointer';
  panel.innerHTML = 'タップして開始<br><span style="font-size:15px;font-weight:500;color:#cfcfd8;">横向き・全画面を試します</span>';

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  let started = false;
  const begin = async () => {
    if (started) return;
    started = true;
    panel.disabled = true;
    panel.style.opacity = '0.7';

    await requestFullscreenAndLandscape();

    overlay.remove();
    window.__GN_LAUNCH_CONFIRMED__ = true;
    start();
  };

  panel.addEventListener('click', begin, { once:true });
  panel.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
}

export function makeGame(page){
  if (isTouchDevice() && !window.__GN_LAUNCH_CONFIRMED__){
    createLaunchGate(() => makeGame(page));
    return null;
  }

  const root = document.getElementById('game');

  document.documentElement.style.width = '100%';
  document.documentElement.style.height = '100%';
  document.documentElement.style.margin = '0';
  document.documentElement.style.padding = '0';
  document.documentElement.style.overflow = 'hidden';

  document.body.style.width = '100%';
  document.body.style.height = '100%';
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';

  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.width = '100vw';
  root.style.height = '100dvh';
  root.style.margin = '0';
  root.style.padding = '0';
  root.style.overflow = 'hidden';
  root.style.background = '#000';
  root.style.transform = 'none';

  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0b0b10',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720
    },
    input: { activePointers: 2 },
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
  window.__PHASER_GAME__ = phaserGame;
  window.phaserGame = phaserGame;

  phaserGame.registry.set('startPage', page);

  let raf = 0;
  let lastW = 0;
  let lastH = 0;

  const fitRoot = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const vv = window.visualViewport;

      const wRaw = vv ? vv.width : window.innerWidth;
      const hRaw = vv ? vv.height : window.innerHeight;

      const w = Math.floor(wRaw / 2) * 2;
      const h = Math.floor(hRaw / 2) * 2;

      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;

      root.style.width  = `${w}px`;
      root.style.height = `${h}px`;
      root.style.transform = 'none';

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
