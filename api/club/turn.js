// api/club/turn.js
// Stateless版：sessionなし / KVなし / DBなし / Mapなし
// 受け取ったpayloadだけで1ターン返す

export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const body = req.body || {};
  
    // =========================
    // payload（フロントが正）
    // =========================
    const characterId = String(body.characterId || '').trim();
    const turn = toInt(body.turn, 1);
    const affinity = toInt(body.affinity, 0);
    const interest = toInt(body.interest, 0);
    const irritation = toInt(body.irritation, 0);
    const threshold = toInt(body.threshold, 70);
  
    const nightSummary = String(body.nightSummary || '').trim();
  
    const lastNpcText = String(body?.last?.npcText || '').trim();
    const lastPlayerText = String(body?.last?.playerText || '').trim();
  
    const playerText = String(body.playerText || '').trim();
  
    if (!characterId || !playerText) {
      return res.status(400).json({ error: 'Bad payload' });
    }
  
    const turn01 = clamp(turn, 1, 10);
  
    // =========================
    // 入力分類
    // =========================
    const t = playerText;
  
    const isCompliment =
      /かわい|可愛|綺麗|きれい|美人|好き|タイプ|最高|素敵|似合/.test(t);
  
    const isEmpathy =
      /わかる|つら|しんど|大変|疲|がんば|無理/.test(t);
  
    const isQuestion =
      /なに|何|どう|どこ|いつ|誰|なんで|なぜ|\?|？/.test(t);
  
    const isRude =
      /つまら|うるさ|だまれ|ブス|きも|金|いくら|ヤれ|抱|死|エロ/.test(t);
  
    const isApology =
      /ごめん|すま|悪かっ|失礼/.test(t);
  
    // =========================
    // delta計算
    // =========================
    let dAff = 0;
    let dInt = 0;
    let dIrr = 0;
  
    if (isCompliment) { dAff += 2; dInt += 1; }
    if (isEmpathy)    { dAff += 1; dInt += 1; }
    if (isQuestion)   { dInt += 1; }
    if (isApology)    { dIrr -= 2; }
  
    // ★ 修正案B：後半ほどキレやすい
    if (isRude) {
      if (turn01 >= 6) {
        dIrr += 10;   // 後半は重い
      } else {
        dIrr += 6;    // 前半は軽め
      }
      dAff -= 2;
    }
  
    // ターン補正（穏やかな流れ）
    if (!isRude && turn01 >= 3) {
      dAff += 1;
    }
  
    // 1ターンの増減制限
    dAff = clamp(dAff, -3, 3);
    dInt = clamp(dInt, -2, 3);
    dIrr = clamp(dIrr, -3, 12);  // 上限拡張
  
    // =========================
    // signals
    // =========================
    const predictedIrr = clamp(irritation + dIrr, 0, 100);
  
    let mood = 'soft';
    if (predictedIrr >= 60) mood = 'cold';
    else if (isQuestion) mood = 'neutral';
  
    let distance = 0;
    if (dAff >= 2) distance = 1;
    if (isRude) distance = -1;
  
    // =========================
    // npcText
    // =========================
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const vibeTag = buildVibeTag(nightSummary, affinity, interest, irritation);
  
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
  
    if (vibeTag) {
      npcText = `${npcText} ${vibeTag}`.trim();
    }
  
    // =========================
    // 強制終了
    // =========================
    const endLine = clamp(threshold, 0, 100);
    const forceEnd = predictedIrr >= endLine;
  
    npcText = limitJP(npcText, 120);
  
    return res.status(200).json({
      npcText,
      signals: { mood, distance },
      delta: { affinity: dAff, interest: dInt, irritation: dIrr },
      flags: { forceEnd },
      meta: {
        turn: turn01,
        characterId,
        used: {
          nightSummary: !!nightSummary,
          lastNpc: !!lastNpcText,
          lastPlayer: !!lastPlayerText
        }
      }
    });
  }
  
  // =========================
  // helpers
  // =========================
  function toInt(v, def) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : def;
  }
  
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }
  
  function limitJP(s, max) {
    if (!s) return '';
    return s.length > max ? s.slice(0, max) : s;
  }
  
  function buildVibeTag(nightSummary, affinity, interest, irritation) {
    const ns = (nightSummary || '').slice(0, 60);
  
    const cold = irritation >= 60;
    const warm = affinity >= 30 || interest >= 60;
  
    if (!ns && !cold && !warm) return '';
  
    if (cold) return '…そろそろ言い方考えて';
    if (warm) return '今日は悪くない流れ';
    if (ns.includes('寒') || ns.includes('冷')) return '外、寒そ';
    if (ns.includes('酔')) return 'ちょい酔ってんの？';
    return '';
  }
  