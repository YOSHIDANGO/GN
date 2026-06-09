const BGM_CONFIG = {
  opening: {
    volume: 0.55,
    sources: ['./assets/audio/bgm/opening.mp3', './assets/audio/bgm/opening.ogg']
  },
  town: {
    volume: 0.50,
    sources: ['./assets/audio/bgm/town.mp3', './assets/audio/bgm/town.ogg']
  },
  club: {
    volume: 0.50,
    sources: ['./assets/audio/bgm/club.mp3', './assets/audio/bgm/club.ogg']
  },
  battle_guest: {
    volume: 0.58,
    sources: ['./assets/audio/bgm/battle_guest.mp3', './assets/audio/bgm/battle_guest.ogg']
  },
  battle_cabajo: {
    volume: 0.60,
    sources: ['./assets/audio/bgm/battle_cabajo.mp3', './assets/audio/bgm/battle_cabajo.ogg']
  }
};

export function preloadBgm(scene){
  for (const [key, def] of Object.entries(BGM_CONFIG)){
    if (!scene.cache.audio.exists(key)){
      scene.load.audio(key, def.sources);
    }
  }
}

export function playBgm(scene, key){
  if (!scene || !key) return;
  if (scene.game.registry.get('bgmKey') === key) return;
  if (!scene.cache.audio.exists(key)) return;

  const current = scene.game.registry.get('bgm');
  if (current){
    scene.tweens.add({
      targets: current,
      volume: 0,
      duration: 350,
      onComplete: () => {
        try{ current.stop(); current.destroy(); }catch(_){}
      }
    });
  }

  const def = BGM_CONFIG[key] || {};
  const bgm = scene.sound.add(key, {
    loop: true,
    volume: 0
  });

  scene.game.registry.set('bgm', bgm);
  scene.game.registry.set('bgmKey', key);

  bgm.play();
  scene.tweens.add({
    targets: bgm,
    volume: def.volume ?? 0.5,
    duration: 450
  });
}
