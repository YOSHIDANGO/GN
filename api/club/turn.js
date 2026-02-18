// api/club/turn.js
import { getSession, updateSession, cleanupExpiredSessions } from './_store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  cleanupExpiredSessions();

  const body = req.body || {};
  const sessionId = body.sessionId;
  const playerText = (body.playerText || '').trim();

  const sess = getSession(sessionId);

  if (!sess) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }

  const state = sess.state;
  const turn = state.turn;

  // =========================
  // 入力分類（レイ専用）
  // =========================
  const t = playerText;

  const isCompliment =
    /かわい|可愛|綺麗|きれい|美人|好き|タイプ|最高|素敵|似合/.test(t);

  const isEmpathy =
    /わかる|つら|しんど|大変|疲|がんば|無理/.test(t);

  const isQuestion =
    /なに|何|どう|どこ|いつ|誰|なんで|なぜ|\?|？/.test(t);

  const isRude =
    /つまら|うるさ|だまれ|ブス|きも|金|いくら|ヤれ|抱|エロ/.test(t);

  const isApology =
    /ごめん|すま|悪かっ|失礼/.test(t);

  // =========================
  // 数値計算
  // =========================
  let dAff = 0;
  let dInt = 0;
  let dIrr = 0;

  if (isCompliment) { dAff += 2; dInt += 1; }
  if (isEmpathy)    { dAff += 1; dInt += 1; }
  if (isQuestion)   { dInt += 1; }
  if (isApology)    { dIrr -= 2; }
  if (isRude)       { dIrr += 6; dAff -= 1; }

  // ターン進行補正（穏やかな場合）
  if (!isRude && turn >= 3) {
    dAff += 1;
  }

  // =========================
  // 状態更新（サーバが正）
  // =========================
  const newState = {
    turn: turn + 1,
    affinity: state.affinity + dAff,
    interest: state.interest + dInt,
    irritation: Math.max(0, state.irritation + dIrr)
  };

  // clamp
  newState.affinity = Math.max(-50, Math.min(999, newState.affinity));
  newState.interest = Math.max(-50, Math.min(999, newState.interest));
  newState.irritation = Math.max(0, Math.min(999, newState.irritation));

  updateSession(sessionId, { state: newState });

  // =========================
  // mood / distance
  // =========================
  let mood = 'soft';
  if (newState.irritation >= 60) mood = 'cold';
  else if (isQuestion) mood = 'neutral';

  let distance = 0;
  if (dAff >= 2) distance = 1;
  if (isRude) distance = -1;

  // =========================
  // レイ口調生成
  // =========================
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let npcText = '';

  if (isRude) {
    npcText = pick([
      'それ、普通に嫌なんだけど',
      'いまの発言、減点ね',
      '空気読めないタイプ？'
    ]);
  } else if (isApology) {
    npcText = pick([
      'まぁいいよ。次ちゃんとね',
      'ん。わかった',
      'じゃあ続きいこ'
    ]);
  } else if (isCompliment) {
    npcText = pick([
      '…そういうの言えるんだ。悪くない',
      'ふーん。見る目あるじゃん',
      'ありがと。でもそれだけ？'
    ]);
  } else if (isEmpathy) {
    npcText = pick([
      'わかる。そういう日ある',
      '無理しすぎないでね',
      'ん、そういうのは嫌いじゃない'
    ]);
  } else if (isQuestion) {
    npcText = pick([
      '質問多いね。嫌いじゃない',
      'ちゃんと聞きたいんだ',
      'んー…それはね'
    ]);
  } else {
    npcText = pick([
      'へぇ。それで？',
      '続きある？',
      'もう少し具体的に言って'
    ]);
  }

  // =========================
  // 強制終了
  // =========================
  const forceEnd = newState.irritation >= 80;

  return res.status(200).json({
    npcText,
    signals: { mood, distance },
    deltaHint: {
      affinity: dAff,
      interest: dInt,
      irritation: dIrr
    },
    flags: { forceEnd },
    state: newState
  });
}
