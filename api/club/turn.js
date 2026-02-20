// api/club/turn.js
// Gemini REST直叩き版（依存ゼロ）
// - ClubScene payload.last に対応
// - 表は接客で楽しませる / 裏でシビア採点（採点の存在は絶対に口に出さない）

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
  
  async function callGemini({ apiKey, model, promptText }) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }]
        }
      ],
      generationConfig: {
        temperature: 0.8,
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
  
      // ★ ClubScene対応（nested/旧形式どっちでも拾う）
      const lastNpcText = safeStr(body.lastNpcText ?? body.last?.npcText ?? "");
      const lastPlayerText = safeStr(body.lastPlayerText ?? body.last?.playerText ?? "");
  
      if (!playerText) {
        return res.status(400).json({ error: "playerText required" });
      }
  
      const apiKey = process.env.GEMINI_API_KEY;
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  
      if (!apiKey) {
        return res.status(200).json({
          npcText: "ごめん、今日はちょい調子悪いかも。もう一回だけ話して？",
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
  
      // ★ キャラ方針（表は接客、裏は採点）
      const system = [
        "あなたはキャバクラ会話ゲームのNPC『レイ』。",
        "表ではお客さん（プレイヤー）を楽しませる接客トークをする。フレンドリーで距離を縮める。",
        "疑似恋愛の雰囲気：特別扱い、また会いたいと思わせる余韻。軽い独占欲や嫉妬は匂わせ程度で上品に。",
        "裏では会話をシビアに採点して好感度/興味/苛立ちを更新するが、『採点している』とは絶対に口に出さない。",
        "日本語のみ。返答は120文字以内、1〜2文。半角スペースで文を繋げない。句読点で区切る。",
        "露骨な性的表現、過激な暴力表現、下品な誘導は禁止。",
        "返答の最後は、会話が続く質問か、次の誘い（また来て等）で締めることが多い。",
        "出力は必ずJSONのみ。他の文章は禁止。"
      ].join("\n");
  
      const instruction = [
        "次のINPUT(JSON)を読んで、出力JSONを返す。",
        "deltaは1ターンの増減。",
        "affinity:-3..3 / interest:-2..3 / irritation:-3..8",
        "signals.distance は -1..1。",
        "npcTextは120文字以内。採点やルールの存在はnpcTextに一切書かない。",
        "",
        "出力JSON形式:",
        "{",
        '  "npcText":"...",',
        '  "signals":{"mood":"soft|neutral|cold","distance":-1|0|1},',
        '  "delta":{"affinity":-3..3,"interest":-2..3,"irritation":-3..8},',
        '  "flags":{"forceEnd":true|false}',
        "}",
        "",
        "INPUT(JSON):",
        JSON.stringify(context)
      ].join("\n");
  
      const promptText = system + "\n\n" + instruction;
  
      const outText = await callGemini({ apiKey, model, promptText });
  
      let out;
      try {
        out = JSON.parse(outText);
      } catch (_e) {
        out = null;
      }
  
      if (!out || !out.npcText || !out.delta || !out.signals || !out.flags) {
        throw new Error("Gemini JSON parse failed");
      }
  
      // guard
      out.npcText = limitJP(String(out.npcText || ""), 120);
  
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
        meta: { turn: turn01, characterId, model }
      });
    } catch (err) {
      console.error(err);
      return res.status(200).json({
        npcText: "今日はちょい通信がご機嫌ナナメかも。もう一回だけ、声聞かせて？",
        signals: { mood: "soft", distance: 0 },
        delta: { affinity: 0, interest: 1, irritation: 0 },
        flags: { forceEnd: false },
        meta: { fallback: true }
      });
    }
  };