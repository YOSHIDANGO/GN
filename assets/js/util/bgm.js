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

function setVolume(sound, volume){
  try{
    if (typeof sound?.setVolume === 'function') sound.setVolume(volume);
    else if (sound) sound.volume = volume;
  }catch(_){}
}

function stopAndDestroy(sound){
  try{ sound?.stop?.(); }catch(_){}
  try{ sound?.destroy?.(); }catch(_){}
}

export function preloadBgm(scene){
  for (const [key, def] of Object.entries(BGM_CONFIG)){
    if (!scene.cache.audio.exists(key)){
      scene.load.audio(key, def.sources);
    }
  }
}

export function playBgm(scene, key){
  if (!scene || !key) return;
  if (!scene.cache.audio.exists(key)) return;

  const registry = scene.game.registry;
  const currentKey = registry.get('bgmKey');
  const current = scene.game.registry.get('bgm');
  const def = BGM_CONFIG[key] || {};
  const baseVolume = def.volume ?? 0.5;
  const ducked = !!registry.get('bgmDucked');
  const targetVolume = ducked ? baseVolume * 0.38 : baseVolume;

  if (current && currentKey === key){
    registry.set('bgmBaseVolume', baseVolume);
    setVolume(current, targetVolume);
    return;
  }

  if (current) stopAndDestroy(current);

  const bgm = scene.sound.add(key, {
    loop: true,
    volume: targetVolume
  });

  registry.set('bgm', bgm);
  registry.set('bgmKey', key);
  registry.set('bgmBaseVolume', baseVolume);

  try{
    bgm.play();
  }catch(_){
    stopAndDestroy(bgm);
    registry.remove('bgm');
    registry.remove('bgmKey');
  }
}

export function duckBgm(scene, ducked){
  const bgm = scene?.game?.registry?.get('bgm');
  if (!scene || !bgm) return;

  const baseVolume = scene.game.registry.get('bgmBaseVolume') ?? 0.5;
  const target = ducked ? baseVolume * 0.38 : baseVolume;

  scene.game.registry.set('bgmDucked', !!ducked);
  setVolume(bgm, target);
}
