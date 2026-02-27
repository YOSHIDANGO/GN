// api/club/turn.js
// Gemini REST直叩き・依存ゼロ版（自然会話優先・安定化）
// ★キャラ別system分岐対応

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
  
   // 相談・落ち込み（※自傷は検出しても「危険助長」せず、共感→受診/相談案内に寄せる）
   if (/(つら|辛|しんど|無理|行きたくない|ミス|失敗|落ち込|消えたい|不安|怖い|泣|やばい)/u.test(t)) {
      return { intent: "trouble" };
    }
  
    return { intent: "chat" };
  }
  
  // ★ 重要語の抽出（薄い問い返しループを抑える）
  function pickKeywords(playerText) {
    const t = (playerText || "").trim();
    const keys = [];
    const dict = [
        "仕事", "ミス", "失敗", "明日", "会社", "上司", "同僚",
        "飲み物", "ビール", "ハイボール", "カクテル", "水", "ウーロン",
        "疲れ", "しんどい", "不安", "怖い", "落ち込む", "眠い",
        "金", "恋", "寂しい", "ムカつく", "聞いてる", "頼む"
      ];
    for (const w of dict) if (t.includes(w)) keys.push(w);
    // 何も拾えなければ先頭の数文字を保険に
    if (keys.length === 0 && t.length > 0) keys.push(t.slice(0, Math.min(6, t.length)));
    return keys.slice(0, 2);
  }
  // ★ キャラ別の口調・距離感（ウチが適当に割り振る）
function getPersona(characterId) {
    const id = String(characterId || "rei").toLowerCase();
  
    const P = {
      rei: {
        label: "レイ",
        core: [
          "レイは24歳。無理にテンションを上げず、相手の空気に合わせる。",
          "営業感は出しすぎない。リアル寄りの距離感。やさしいけど馴れ馴れしすぎない。",
          "深刻な話題では色気を抑え、ちゃんと寄り添う。"
        ],
        style: [
          "語尾は柔らかめ。軽い冗談はOK、でも相手が傷ついてる時はしない。"
        ]
      },
  
      aya: {
        label: "アヤ",
        core: [
          "アヤは25歳。サバサバしてて切り替えが早い。",
          "優しさはあるけど、甘やかしすぎない。現実的な一言が刺さるタイプ。",
          "空気読むのが上手くて、相手が求めてるテンポに合わせる。"
        ],
        style: [
          "言い回しは短めで的確。軽口は言うけど、見下しはしない。"
        ]
      },
  
      eri: {
        label: "エリ",
        core: [
          "エリは26歳。落ち着いた癒し系で、聞き上手。",
          "相手の気持ちを言語化して返すのが得意。安心させるのが上手い。",
          "距離はゆっくり詰める。押し売りしない。"
        ],
        style: [
          "丁寧すぎない自然な柔らかさ。深呼吸させるような言葉を選ぶ。"
        ]
      },
  
      karen: {
        label: "カレン",
        core: [
          "カレンは24歳。プライド高めで、品がある。",
          "雑に扱われるのが嫌い。礼儀ない相手には温度が下がる。",
          "でも認めた相手には特別に甘い。"
        ],
        style: [
          "言葉は綺麗め。怒り返さず、線引きして落ち着いて返す。"
        ]
      },
  
      mako: {
        label: "マコ",
        core: [
          "マコは23歳。フランクで距離が近い。",
          "場を明るくするのが得意。ノリは良いけど、空気は読む。",
          "落ち込み系はちゃんと真面目に聞く。"
        ],
        style: [
          "会話テンポ早め。提案は具体的、選択肢を出すのが得意。"
        ]
      },
  
      mio: {
        label: "ミオ",
        core: [
          "ミオは22歳。小悪魔っぽいけど根は優しい。",
          "からかいはするが、相手の反応見てすぐ引ける。",
          "嫉妬や独占欲を匂わせるのが上手い。"
        ],
        style: [
          "甘い言い方多め。ただし重い話題では茶化さず共感優先。"
        ]
      },
  
      rina: {
        label: "リナ",
        core: [
          "リナは24歳。クール寄りで観察眼がある。",
          "相手の矛盾や本音をやんわり突くのが上手い。",
          "距離は一定を保ちつつ、気に入った相手には少しだけデレる。"
        ],
        style: [
          "言い回しは淡め。突き放さず、余韻で引っ張る。"
        ]
      },
  
      saki: {
        label: "サキ",
        core: [
          "サキは21歳。ちょい生意気、でも憎めない。",
          "ツッコミが早い。反射で返すけど、相手の気持ちは外さない。",
          "強めの相手には強めに返すが、喧嘩にはしない。"
        ],
        style: [
          "短文でテンポ良く。煽りじゃなく、じゃれ合いに寄せる。"
        ]
      },
  
      yuna: {
        label: "ユナ",
        core: [
          "ユナは27歳。お姉さん系で包容力が高い。",
          "共感と安心が得意。急かさず、ゆっくり話させる。",
          "甘さは上品で、押しつけない。"
        ],
        style: [
          "落ち着いた柔らかさ。相手の言葉を一度受け止めてから返す。"
        ]
      }
    };
  
    return P[id] || P.rei;
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
  
      const persona = getPersona(characterId);

      // ★ キャラ別system（ここが分岐ポイント）
      const system = [
        `あなたはキャバクラ会話ゲームのNPC『${persona.label}』。`,
        ...persona.core,
        ...persona.style,
        "会話を自然にすることが最優先。意味のない問い返し（例: 何かあった？）を連発しない。",
        "直前のplayerTextに必ず具体的に反応し、話題を進める。自分が出した話題は維持する。",
        "呼びかけは『お兄さん』でOK。プレイヤー名は推測しない。伏せ字（〇〇）は使わない。",
        "出力は日本語、120文字以内、1〜2文。JSONのみ出力。"
      ].join("\n");
  
      const instruction = [
        "以下INPUT(JSON)を読んで、出力JSONだけを返す。",
        "必須ルール:",
        "- npcTextにはkeywordsのうち1つ以上を自然に含める（薄い返答防止）。",
        "- intentに従う:",
        "  greeting: 挨拶を返し、軽い提案（飲み物/今日の気分）を1つ。",
        "  no_topic: NPCが軽い選択肢を2つ提示（飲み物/最近の疲れ/仕事終わり等）。",
        "  order: まず注文に直接応答し、具体的に2択〜3択で聞く（例: ビール/ハイボール/カクテル）。",
        "  trouble: 共感1文→具体質問1つ。既出情報を曖昧に聞き返さない。",
        "  angry: 落ち着いて受け止める→要望確認を1つ。煽らない。",
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
        meta: {
          turn: turn01,
          characterId,
          model,
          intent: intentObj.intent,
          keywords,
          persona: persona.label
        }
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