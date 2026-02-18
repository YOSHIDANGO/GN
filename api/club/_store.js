// api/club/_store.js
// 開発用のメモリストア（Vercel環境だとプロセス再生成で消えることがある）
// 本番はKV/DBに差し替える想定

const g = globalThis;

// 1プロセス内で共有
if (!g.__CLUB_STORE__) {
  g.__CLUB_STORE__ = new Map();
}

export function createSession(characterId = 'rei') {
  const id = `club_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  const now = Date.now();
  const session = {
    sessionId: id,
    characterId,
    createdAt: now,
    updatedAt: now,

    // ゲーム状態（サーバが正とする）
    state: {
      turn: 1,
      affinity: 0,
      interest: 0,
      irritation: 0
    },

    // 将来用：短い要約・タグ
    summary: '',
    tags: []
  };

  g.__CLUB_STORE__.set(id, session);
  return session;
}

export function getSession(sessionId) {
  if (!sessionId) return null;
  return g.__CLUB_STORE__.get(sessionId) || null;
}

export function updateSession(sessionId, patch = {}) {
  const s = getSession(sessionId);
  if (!s) return null;

  // shallow merge
  const merged = {
    ...s,
    ...patch,
    updatedAt: Date.now()
  };

  // stateだけは深めにmerge
  if (patch.state) {
    merged.state = { ...s.state, ...patch.state };
  }

  g.__CLUB_STORE__.set(sessionId, merged);
  return merged;
}

export function deleteSession(sessionId) {
  if (!sessionId) return false;
  return g.__CLUB_STORE__.delete(sessionId);
}

// セッションTTL（ミリ秒）
const DEFAULT_TTL = 1000 * 60 * 60; // 1時間

export function cleanupExpiredSessions(ttl = DEFAULT_TTL) {
  const now = Date.now();
  const store = g.__CLUB_STORE__;
  let removed = 0;

  for (const [id, s] of store.entries()) {
    const t = Number(s?.updatedAt || s?.createdAt || 0);
    if (!t) continue;
    if (now - t > ttl) {
      store.delete(id);
      removed++;
    }
  }
  return removed;
}
