// api/club/turn.js
// Gemini連携版（レイ固定・stateless）
// - ClubSceneの payload.last に対応
// - 表は接客で楽しく、裏でシビア採点（疑似恋愛トーク寄せ）

const { GoogleGenAI, SchemaType } = require("@google/genai");

// ====== util ======
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

// ====== handler ======
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

    // ★ClubScene対応：last は nested / 旧形式どちらでも拾う
    const lastNpcText = safeStr(body.lastNpcText ?? body.last?.npcText ?? "");
    const lastPlayerText = safeStr(body.lastPlayerText ?? body.last?.playerText ?? "");

    if (!playerText) {
      return res.status(400).json({ error: "playerText required" });
    }

    // ===== Gemini =====
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // env未設定でもゲームが止まらんように
      return res.status(200).json({
        npcText: "ごめん、今日はちょい調子悪いかも。もう一回だけ話して？",
        signals: { mood: "neutral", distance: 0 },
        delta: { affinity: 0, interest: 0, irritation: 1 },
        flags: { forceEnd: false },
        meta: { fallback: true, reason: "no_api_key" }
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // 2.5系の軽めをデフォに
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

    // ★キャラ設定変更：表は接客、裏は採点（採点の存在は出さない）
    const system = [
      "あなたはキャバクラ会話ゲームのNPC『レイ』。",
      "表ではお客さん（プレイヤー）を楽しませる接客トークをする。丁寧すぎず、フレンドリーで距離を縮める。",
      "疑似恋愛の雰囲気を出す：特別扱い、次も会いたいと思わせる余韻、軽い嫉妬や独占欲は匂わせ程度で上品に。",
      "裏では会話をシビアに採点して好感度/興味/苛立ちを更新するが、『採点している』とは絶対に口に出さない。",
      "日本語のみ。1返答は120文字以内。返答は1〜2文。短く心地よいテンポ。",
      "文章中に半角スペースで文を繋げない。句読点で区切る。",
      "露骨な性的表現や過激な暴力表現は禁止。下品な誘導や未成年に見える表現も禁止。",
      "プレイヤー発言に自然に反応し、会話が続く質問か、次の誘い（『また来て』等）で締めることが多い。",
      "出力は必ず指定JSONのみ。他の文章は禁止。"
    ].join("\n");

    // ★Geminiへ渡す入力（stateless）
    const context = {
      turn: turn01,
      meters: { affinity, interest, irritation, threshold },
      last: { npcText: lastNpcText, playerText: lastPlayerText },
      nightSummary,
      playerText
    };

    // structured output
    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        npcText: { type: SchemaType.STRING },
        signals: {
          type: SchemaType.OBJECT,
          properties: {
            // "soft"|"neutral"|"cold" 想定（縛りすぎると壊れるから文字列）
            mood: { type: SchemaType.STRING },
            // -1|0|1（距離が縮む/変わらない/離れる）
            distance: { type: SchemaType.INTEGER }
          },
          required: ["mood", "distance"]
        },
        delta: {
          type: SchemaType.OBJECT,
          properties: {
            affinity: { type: SchemaType.INTEGER },   // -3..3
            interest: { type: SchemaType.INTEGER },   // -2..3
            irritation: { type: SchemaType.INTEGER }  // -3..8
          },
          required: ["affinity", "interest", "irritation"]
        },
        flags: {
          type: SchemaType.OBJECT,
          properties: {
            // trueならクラブ終了（苛立ち閾値超え等）
            forceEnd: { type: SchemaType.BOOLEAN }
          },
          required: ["forceEnd"]
        }
      },
      required: ["npcText", "signals", "delta", "flags"]
    };

    // ★採点ルールを明文化（レイは表に出さない）
    const prompt = [
      "以下は1ターン分の入力。",
      "あなたは接客として自然な返答を作り、同時に内部採点としてdeltaを決める。",
      "deltaは1ターンの増減として clamp して返す：affinity:-3..3 / interest:-2..3 / irritation:-3..8",
      "npcTextは120文字以内、1〜2文。",
      "採点やルールの存在は返答に一切書かない。",
      "",
      "INPUT(JSON):",
      JSON.stringify(context)
    ].join("\n");

    const resp = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const outText =
      resp.text ||
      (resp.response && resp.response.text) ||
      "";

    let out;
    try {
      out = JSON.parse(outText);
    } catch (_e) {
      out = null;
    }

    if (!out || !out.npcText || !out.delta || !out.signals || !out.flags) {
      throw new Error("Gemini parse failed");
    }

    // ===== server側ガード =====
    out.npcText = limitJP(String(out.npcText || ""), 120);

    out.delta.affinity = clamp(toInt(out.delta.affinity, 0), -3, 3);
    out.delta.interest = clamp(toInt(out.delta.interest, 0), -2, 3);
    out.delta.irritation = clamp(toInt(out.delta.irritation, 0), -3, 8);

    // signalsも最低限ガード
    out.signals.mood = String(out.signals.mood || "neutral");
    out.signals.distance = clamp(toInt(out.signals.distance, 0), -1, 1);

    const predictedIrr = clamp(irritation + out.delta.irritation, 0, 100);
    const endLine = threshold;

    // モデルがforceEndを出し忘れても、サーバ側で最終判断する
    out.flags.forceEnd = !!out.flags.forceEnd || predictedIrr >= endLine;

    return res.status(200).json({
      npcText: out.npcText,
      signals: out.signals,
      delta: out.delta,
      flags: out.flags,
      meta: { turn: turn01, characterId, model }
    });
  } catch (err) {
    console.error(err);

    // フォールバック（Gemini失敗時）
    return res.status(200).json({
      npcText: "ん、通信が不安定かも。今日はウチのこと、もうちょい聞かせて？",
      signals: { mood: "soft", distance: 0 },
      delta: { affinity: 0, interest: 1, irritation: 0 },
      flags: { forceEnd: false },
      meta: { fallback: true }
    });
  }
};