// 繪本島 AI 問答代理（Cloudflare Worker）— 單檔，唔使裝任何嘢
// 作用：你個網站（學生部機）→ 呢個 Worker → Google Gemini → 返答案
// 個 key 只存在 Cloudflare，學生永遠睇唔到，亦偷唔到。
//
// 部署後去 Settings → Variables and Secrets 加兩個：
//   GEMINI_KEY = 你嘅 Google AI Studio key（揀 Secret / 加密）
//   ALLOW      = https://你的帳號.github.io    （或者 https://你的domain；留空 = 任何網都入得，唔建議）
// 可選：
//   MODEL      = gemini-2.0-flash（預設）

const GRADE = { P1: '小一', P2: '小二', P3: '小三', P4: '小四', P5: '小五', P6: '小六' };

// 簡易限流：每個 IP 每分鐘 12 題。Worker 重啟會清空，夠擋手痕同爆額度。
const hits = new Map();

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  };
}
function json(obj, code, origin) {
  return new Response(JSON.stringify(obj), { status: code, headers: cors(origin) });
}

export default {
  async fetch(req, env) {
    const origin = env.ALLOW || '*';
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (req.method !== 'POST') return json({ error: '只接受 POST' }, 405, origin);

    const ip = req.headers.get('cf-connecting-ip') || 'unknown';
    const now = Date.now();
    const rec = hits.get(ip) || { t: now, n: 0 };
    if (now - rec.t > 60000) { rec.t = now; rec.n = 0; }
    rec.n++; hits.set(ip, rec);
    if (rec.n > 12) return json({ error: '問得太快，等一分鐘再試。' }, 429, origin);

    let body;
    try { body = await req.json(); } catch (e) { return json({ error: '格式唔啱' }, 400, origin); }

    const grade = GRADE[body.grade] ? body.grade : 'P4';
    const q = String(body.question || '').slice(0, 300).trim();
    if (!q) return json({ error: '未打問題' }, 400, origin);
    if (!env.GEMINI_KEY) return json({ error: 'Worker 未設定 GEMINI_KEY' }, 500, origin);

    // 呢段就係「班級規則」。想改風格／加規矩，改呢度就夠，唔使改網站。
    const sys = [
      `你係香港小學圖書館「繪本島」嘅學習助手，服務${GRADE[grade]}學生。`,
      `1. 一律用繁體中文同香港用語（地鐵、巴士、茶餐廳、屋邨、校園），唔用台灣腔，唔用英文句子。`,
      `2. 只用${GRADE[grade]}程度嘅字詞同句式。句子要短，唔用抽象比喻，唔用中學或以上概念。`,
      `3. 答案 3 至 5 句，最多 120 字。先答重點，再舉一個香港生活例子。`,
      `4. 只講你確定嘅事實。唔確定就答：「我唔肯定，你可以問老師，或者去島上搵相關嘅書。」`,
      `5. 如果問題唔屬小學科學／數學／常識範圍，或者涉及暴力、性、政治、宗教爭議、個人資料，答：「呢個問題我唔答得，問老師最好。」`,
      `6. 唔好問學生姓名、班別、電話、地址。學生主動講都唔好重複。`,
      `7. 結尾一句，鼓勵佢去島上搵相關嘅繪本睇。`
    ].join('\n');

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
      + (env.MODEL || 'gemini-2.0-flash') + ':generateContent?key=' + env.GEMINI_KEY;

    let r;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: 'user', parts: [{ text: q }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 400 }
        })
      });
    } catch (e) {
      return json({ error: '連唔到 AI' }, 502, origin);
    }

    if (!r.ok) {
      const t = await r.text();
      return json({ error: 'AI 出錯（' + r.status + '）', detail: t.slice(0, 200) }, 502, origin);
    }

    const d = await r.json();
    const text = ((d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [])
      .map(p => p.text || '').join('').trim();

    return json({ answer: text || '我答唔到，試下問簡單啲。' }, 200, origin);
  }
};
