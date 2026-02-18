// assets/js/core/save.js
const SAVE_KEY = 'glorious_night_save_v1';

export function defaultSave(){
  return {
    version: 1,

    // 表示用
    slotName: '第1夜',
    night: 1,

    player: {
      name: 'レイ',
      hp: 100,
      maxHp: 100,
      atk: 16,
      def: 8,
      spd: 10
    },

    flags: {
      firstDayIntroShown: false,
      openingShown: false,
      bossUnlocked: false
    },

    progress: {
      nomination: 0,
      nextEventAt: 2,
      defeatedCabajo: {}
    },

    fieldPos: null,

    lastBattle: null,

    // Clubモード（会話ミニゲーム）
    club: {
      // 解放管理（例: { "rei": { cg1:true, cg2:false } }）
      unlock: {},

      // 成績（例: { "rei": { bestRank:"A", bestScore:18, aCount:2, playCount:5 } }）
      history: {}
    }
  };
}

export function loadSave(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const s = JSON.parse(raw);

    // ざっくり補完（古いセーブでも落ちないように）
    if (!s.flags) s.flags = {};
    if (typeof s.flags.firstDayIntroShown !== 'boolean') s.flags.firstDayIntroShown = false;
    if (typeof s.flags.openingShown !== 'boolean') s.flags.openingShown = false;

    if (!s.player) s.player = defaultSave().player;

    if (!s.slotName) s.slotName = '第1夜';
    if (!s.night) s.night = 1;

    if (!s.progress){
      s.progress = { nomination:0, nextEventAt:2, defeatedCabajo:{} };
    }
    if (!s.progress.defeatedCabajo){
      s.progress.defeatedCabajo = {};
    }

    if (!('lastBattle' in s)) s.lastBattle = null;
    if (!('fieldPos' in s)) s.fieldPos = null;

    // club補完（古いセーブでも落ちないように）
    if (!s.club) s.club = {};
    if (!s.club.unlock) s.club.unlock = {};
    if (!s.club.history) s.club.history = {};

    return s;
  } catch(e){
    return null;
  }
}

export function storeSave(state){
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch(e){
    // 失敗してもゲームは続ける
  }
}

export function hasSave(){
  return !!loadSave();
}

export function clearSave(){
  try { localStorage.removeItem(SAVE_KEY); } catch(e){}
}

// 表示用のスロット名を返す（SaveSceneが要求してるやつ）
export function saveSlotName(state){
  // state未指定でも落ちないように
  const night = state?.night ?? 1;
  return state?.slotName ?? `第${night}夜`;
}
