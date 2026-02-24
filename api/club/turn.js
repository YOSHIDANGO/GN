// api/club/turn.js
// Gemini REST直叩き・依存ゼロ版（安定化済み）

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
  function extractJsonObject(text){
    if (!text) return null;
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s === -1 || e === -1 || e <= s) return null;
    const candidate = text.slice(s, e + 1);
    try { return JSON.parse(candidate); } catch { return null; }
  }
  
  async function callGemini({ apiKey, model, promptText }) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  
    const payload = {
      contents: [
        { role: "user", parts: [{ text: promptText }] }
      ],
      generationConfig: {
        temperature: 0.6,
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
      json?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ??
      "";
  
    return text;
  }
  
  module.exports = async (req, res) => {
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
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  
      if (!apiKey) {
        return res.status(200).json({
          npcText: "ごめんね、今日はちょっと調子悪いかも。また話しかけてくれる？",
          signals: { mood: "neutral", distance: 0 },
          delta: { affinity: 0, interest: 0, irritation: 1 },
          flags: { forceEnd: false },
          meta: { fallback: true, reason: "no_api_key" }
        });
      }
  
      const context = {
        turn: turn01,
        meters: { affinity, interest, irritation, threshold },
        last: { npcText: lastNpcText, playerText: lastPlayerText },
        nightSummary,
        playerText
      };
  
      const system = [
        "あなたはキャバクラ会話ゲームのNPC『レイ』。",
        "表ではお客さんを楽しませる接客トークをする。",
        "プレイヤー名は不明。名前を推測せず『お兄さん』などで呼ぶ。『〇〇』などの伏せ字やプレースホルダは禁止。",
        "会話の最優先はプレイヤーの直前の発言内容に正確に反応すること。",
        "営業トークよりも、内容理解と感情への反応を優先する。",
        "落ち込み・失敗・不安が含まれる場合、まず共感を1文、その後に状況を具体的に1つだけ質問する。",
        "重い話題を無視してテンプレ営業に戻ってはいけない。",
        "疑似恋愛の空気を出す。特別扱い・距離を縮める・また来たいと思わせる余韻。",
        "甘さは出すが、営業っぽい決め台詞の連発は避ける。自然な会話の流れを優先。",
        "採点は裏で行うが、採点していることは絶対に言わない。",
        "120文字以内、日本語のみ。",
        "JSON以外の文字は一切出力しない。先頭は{、末尾は}で終わらせる。"
      ].join("\n");
  
      const instruction = [
        "以下INPUTを読んで出力JSONを返す。",
        "delta範囲: affinity:-3..3 interest:-2..3 irritation:-3..8",
        "distance:-1..1",
        "",
        "出力形式:",
        "{",
        '"npcText":"...",',
        '"signals":{"mood":"soft|neutral|cold","distance":0},',
        '"delta":{"affinity":0,"interest":0,"irritation":0},',
        '"flags":{"forceEnd":false}',
        "}",
        "",
        "INPUT:",
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
      out.signals.distance = clamp(toInt(out.signals.distance, 0), -1, 1);
  
      const predictedIrr = clamp(irritation + out.delta.irritation, 0, 100);
      out.flags.forceEnd = !!out.flags.forceEnd || predictedIrr >= threshold;
  
      return res.status(200).json({
        npcText: out.npcText,
        signals: out.signals,
        delta: out.delta,
        flags: out.flags,
        meta: { turn: turn01, characterId, model }
      });
  
    } catch (err) {
      console.error(err);
      return res.status(200).json({
        npcText: "今日はちょっと通信が不安定かも。また声聞かせてくれる？",
        signals: { mood: "soft", distance: 0 },
        delta: { affinity: 0, interest: 1, irritation: 0 },
        flags: { forceEnd: false },
        meta: { fallback: true, error: String(err?.message || err) }
      });
    }
  };