// api/club/session.js
import { createSession, cleanupExpiredSessions } from './_store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ついでに掃除（軽いので毎回でOK）
  cleanupExpiredSessions();

  const body = req.body || {};
  const characterId = (body.characterId || 'rei').toString();

  const sess = createSession(characterId);

  // レイ固定の初手（後でキャラ差分）
  const npcText = 'いらっしゃい。今日はどうする';

  return res.status(200).json({
    sessionId: sess.sessionId,
    npcText,
    signals: { mood: 'soft', distance: 0 },
    state: sess.state
  });
}
