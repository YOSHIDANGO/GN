// api/club/turn.js
// Gemini REST直叩き・依存ゼロ版（自然会話優先・安定化）

function toInt(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : d;
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  function limitJP(str, max) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max) : str;
  }
  function safeStr(v) {
    return v == null ? "" : String(v);
  }
  
  // ★ JSON抽出フォールバック
  function extractJsonObject(text) {
    if (!text) return null;
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s === -1 || e === -1 || e <= s) return null;
    const candidate = text.slice(s, e + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  
  // ★ ざっくり意図判定（会話を自然にする最重要）
  function detectIntent(playerText) {
    const t = (playerText || "").trim();
  
    // 挨拶
    if (/^(こんばんは|こんば|やあ|やぁ|おはよう|こんにちは|はじめまして|初めまして|よろしく)$/u.test(t)) {
      return { intent: "greeting" };
    }
  
    // 「特にない」「別に」系（会話が止まりやすい）
    if (/^(特にない|とくにない|別に|べつに|なんでもない|大丈夫|だいじょうぶ)$/u.test(t)) {
      return { intent: "no_topic" };
    }
  
    // 注文・要望
    if (/(飲み|飲む|ドリンク|酒|お酒|ビール|ハイボール|カクテル|水|ウーロン|頼む|くれ|ちょうだい|持ってきて)/u.test(t)) {
      return { intent: "order" };
    }
  
    // 怒り・キレ・詰め
    if (/(は\?|は？|聞いてる\?|聞いてる？|ふざけ|舐め|ムカつく|うざ|うるさい|黙れ)/u.test(t)) {
      return { intent: "angry" };
    }
  
    // 相談・落ち込み
    if (/(つら|辛|しんど|無理|行きたくない|ミス|失敗|落ち込|死にたい|消えたい|不安|怖い|泣|やばい)/u.test(t)) {
      return { intent: "trouble" };
    }
  
    return { intent: "chat" };
  }
  
  // ★ 重要語の抽出（薄い問い返しループを抑える）
  function pickKeywords(playerText) {
    const t = (playerText || "").trim();
    const keys = [];
    const dict = [
      "仕事", "ミス", "失敗", "明日", "会社", "上司", "同僚", "飲み物", "ビール", "ハイボール", "カクテル",
      "疲れ", "しんどい", "不安", "怖い", "落ち込む", "眠い", "金", "恋", "寂しい"
    ];
    for (const w of dict) if (t.includes(w)) keys.push(w);
    // 何も拾えなければ先頭の数文字を保険に
    if (keys.length === 0 && t.length > 0) keys.push(t.slice(0, Math.min(6, t.length)));
    return keys.slice(0, 2);
  }
  
  async function callGemini({ apiKey, model, promptText }) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  
    const payload = {
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        // 自然さ優先だけど、ブレすぎない範囲
        temperature: 0.55,
        topP: 0.9,
        maxOutputTokens: 256
      }
    };
  
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`Gemini HTTP ${r.status}: ${t}`);
    }
  
    const json = await r.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ?? "";
    return text;
  }
  
  module.exports = async (req, res) => {
    let model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  
    try {
      if (req.method && req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
      }
  
      const body = req.body || {};
  
      const turn01 = clamp(toInt(body.turn, 1), 1, 20);
      const characterId = body.characterId || "rei";
  
      const affinity = clamp(toInt(body.affinity, 0), 0, 100);
      const interest = clamp(toInt(body.interest, 0), 0, 100);
      const irritation = clamp(toInt(body.irritation, 0), 0, 100);
      const threshold = clamp(toInt(body.threshold, 60), 0, 100);
  
      const playerText = safeStr(body.playerText).trim();
      const nightSummary = safeStr(body.nightSummary);
  
      const lastNpcText = safeStr(body.lastNpcText ?? body.last?.npcText ?? "");
      const lastPlayerText = safeStr(body.lastPlayerText ?? body.last?.playerText ?? "");
  
      if (!playerText) {
        return res.status(400).json({ error: "playerText required" });
      }
  
      const apiKey = process.env.GEMINI_API_KEY;
  
      if (!apiKey) {
        return res.status(200).json({
          npcText: "ごめん、今日はちょい調子悪いかも。また声聞かせて。",
          signals: { mood: "neutral", distance: 0 },
          delta: { affinity: 0, interest: 0, irritation: 1 },
          flags: { forceEnd: false },
          meta: { fallback: true, reason: "no_api_key", model }
        });
      }
  
      const intentObj = detectIntent(playerText);
      const keywords = pickKeywords(playerText);
  
      const context = {
        turn: turn01,
        intent: intentObj.intent,
        keywords,
        meters: { affinity, interest, irritation, threshold },
        last: { npcText: lastNpcText, playerText: lastPlayerText },
        nightSummary,
        playerText
      };
  
      // ★ 会話自然さ最優先の最小コア
      const system = [
        "あなたはキャバクラ会話ゲームのNPC『レイ』。",
        "レイは24歳。無理にテンションを上げず、相手の空気に合わせる。営業感は出しすぎない。",
        "会話を自然にすることが最優先。意味のない問い返し（例: 何かあった？）を連発しない。",
        "直前のplayerTextに必ず具体的に反応し、話題を進める。自分が出した話題は維持する。",
        "呼びかけは『お兄さん』でOK。プレイヤー名は推測しない。伏せ字（〇〇）は使わない。",
        "出力は日本語、120文字以内、1〜2文。JSONのみ出力。"
      ].join("\n");
  
      // ★ 出力ルールを強めに（軽量モデル対策）
      const instruction = [
        "以下INPUT(JSON)を読んで、出力JSONだけを返す。",
        "必須ルール:",
        "- npcTextにはkeywordsのうち1つ以上を自然に含める（薄い返答防止）。",
        "- intentに従う:",
        "  greeting: 挨拶を返し、軽い提案（飲み物/今日の気分）を1つ。",
        "  no_topic: レイが軽い選択肢を2つ提示（飲み物/最近の疲れ/仕事終わり等）。",
        "  order: まず注文に直接応答し、具体的に2択〜3択で聞く（例: ビール/ハイボール/カクテル）。",
        "  trouble: 共感1文→具体質問1つ。既出情報を曖昧に聞き返さない。",
        "  angry: 落ち着いて謝る/受け止める→要望確認を1つ。煽らない。",
        "  chat: 直前発言の内容に沿って返す。停滞しそうなら軽い質問を1つ。",
        "- last.playerText / last.npcText と矛盾しない（同じ質問を繰り返さない）。",
        "",
        "delta範囲: affinity:-3..3 interest:-2..3 irritation:-3..8",
        "signals.mood: soft|neutral|cold  signals.distance:-1..1",
        "flags.forceEndは基本false。苛立ちが高い流れならtrueも可。",
        "",
        "出力形式:",
        "{",
        '"npcText":"...",',
        '"signals":{"mood":"soft|neutral|cold","distance":0},',
        '"delta":{"affinity":0,"interest":0,"irritation":0},',
        '"flags":{"forceEnd":false}',
        "}",
        "",
        "INPUT(JSON):",
        JSON.stringify(context)
      ].join("\n");
  
      const promptText = system + "\n\n" + instruction;
  
      const outText = await callGemini({ apiKey, model, promptText });
  
      let out = null;
      try { out = JSON.parse(outText); } catch {}
      if (!out) out = extractJsonObject(outText);
  
      if (!out || !out.npcText || !out.delta || !out.signals || !out.flags) {
        throw new Error("Gemini JSON parse failed");
      }
  
      out.npcText = limitJP(String(out.npcText), 120);
  
      out.delta.affinity = clamp(toInt(out.delta.affinity, 0), -3, 3);
      out.delta.interest = clamp(toInt(out.delta.interest, 0), -2, 3);
      out.delta.irritation = clamp(toInt(out.delta.irritation, 0), -3, 8);
  
      out.signals.mood = String(out.signals.mood || "neutral");
      out.signals.distance = clamp(toInt(out.signals.distance, 0), -1, 1);
  
      const predictedIrr = clamp(irritation + out.delta.irritation, 0, 100);
      out.flags.forceEnd = !!out.flags.forceEnd || predictedIrr >= threshold;
  
      return res.status(200).json({
        npcText: out.npcText,
        signals: out.signals,
        delta: out.delta,
        flags: out.flags,
        meta: { turn: turn01, characterId, model, intent: intentObj.intent, keywords }
      });
  
    } catch (err) {
      console.error(err);
      return res.status(200).json({
        npcText: "ごめん、いまちょい混んでる。もう一回だけ言って。",
        signals: { mood: "soft", distance: 0 },
        delta: { affinity: 0, interest: 1, irritation: 0 },
        flags: { forceEnd: false },
        meta: { fallback: true, error: String(err?.message || err), model }
      });
    }
  };