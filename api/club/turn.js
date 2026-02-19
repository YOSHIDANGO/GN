// api/club/turn.js
// Stateless版：sessionなし / KVなし / DBなし / Mapなし
// 受け取ったpayloadだけで1ターン返す

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
    const body = req.body || {};
  
    // =========================
    // payload（フロントが正）
    // =========================
    const characterId = String(body.characterId || '').trim();
    const turn = toInt(body.turn, 1);
    const affinity = toInt(body.affinity, 0);
    const interest = toInt(body.interest, 0);
    const irritation = toInt(body.irritation, 0);
    const threshold = toInt(body.threshold, 30);
  
    const nightSummary = String(body.nightSummary || '').trim();
  
    const lastNpcText = String(body?.last?.npcText || '').trim();
    const lastPlayerText = String(body?.last?.playerText || '').trim();
  
    const playerText = String(body.playerText || '').trim();
  
    // 最低限のチェック（重くしない）
    if (!characterId || !playerText) {
      return res.status(400).json({ error: 'Bad payload' });
    }
  
    // turnは 1..10 に寄せる（クライアントが正だけど保険）
    const turn01 = clamp(turn, 1, 10);
  
    // =========================
    // 入力分類（暫定ローカルロジック）
    // =========================
    // 将来LLMに置換する前提でも、フォールバックとして残せる
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
    // delta計算（サーバは「提案」だけ）
    // =========================
    let dAff = 0;
    let dInt = 0;
    let dIrr = 0;
  
    if (isCompliment) { dAff += 2; dInt += 1; }
    if (isEmpathy)    { dAff += 1; dInt += 1; }
    if (isQuestion)   { dInt += 1; }
    if (isApology)    { dIrr -= 2; }
    if (isRude)       { dIrr += 6; dAff -= 1; }
  
    // ターン補正（ほどよく）
    if (!isRude && turn01 >= 3) dAff += 1;
  
    // でかい入力で暴れないように、1ターンの増減は抑える
    dAff = clamp(dAff, -3, 3);
    dInt = clamp(dInt, -2, 3);
    dIrr = clamp(dIrr, -3, 8);
  
    // =========================
    // signals（演出用）
    // =========================
    const predictedIrr = clamp(irritation + dIrr, 0, 100);
  
    let mood = 'soft';
    if (predictedIrr >= 60) mood = 'cold';
    else if (isQuestion) mood = 'neutral';
  
    let distance = 0;
    if (dAff >= 2) distance = 1;
    if (isRude) distance = -1;
  
    // =========================
    // npcText（暫定ローカル）
    // =========================
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  
    // 直前1往復 + nightSummary をちょい混ぜ（短く）
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
  
    // vibeTagを末尾に薄く足す（長くしない）
    if (vibeTag) {
      npcText = `${npcText} ${vibeTag}`.trim();
    }
  
    // =========================
    // 強制終了（予測で判定）
    // =========================
    // 閾値は「入力のthreshold」を尊重。なければ80相当
    const endLine = clamp(threshold, 0, 100);
    const forceEnd = predictedIrr >= endLine;
  
    // 文字数ガード（フロントでもやるけど保険）
    npcText = limitJP(npcText, 120);
  
    return res.status(200).json({
      npcText,
      signals: { mood, distance },
      delta: { affinity: dAff, interest: dInt, irritation: dIrr },
      flags: { forceEnd },
  
      // デバッグ用（いらなければ消してOK）
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
  
  // 全角っぽい上限（厳密じゃないけど安全側）
  function limitJP(s, max) {
    if (!s) return '';
    // サロゲートや結合文字の厳密対応はしない。短文用途ならこれで十分
    return s.length > max ? s.slice(0, max) : s;
  }
  
  // nightSummary / meters から薄いタグを返す（空なら足さない）
  function buildVibeTag(nightSummary, affinity, interest, irritation) {
    // LLM化したらここ要らん
    const ns = (nightSummary || '').slice(0, 60);
  
    // 雰囲気ワードを拾うだけ
    const cold = irritation >= 60;
    const warm = affinity >= 30 || interest >= 60;
  
    if (!ns && !cold && !warm) return '';
  
    // 露骨に説明しない、ひとことだけ
    if (cold) return '…そろそろ言い方考えて';
    if (warm) return '今日は悪くない流れ';
    if (ns.includes('寒') || ns.includes('冷')) return '外、寒そ';
    if (ns.includes('酔')) return 'ちょい酔ってんの？';
    return '';
  }
  