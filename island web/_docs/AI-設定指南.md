# 繪本島 AI 問答 — 零知識設定指南

## 0. 先搞清三樣嘢

**API key 係咩**
你嘅網站本身唔識答問題。AI 嘅腦（Gemini）住喺 Google 部伺服器，你要用一條「鎖匙」去叫佢做嘢。鎖匙 = 一串字（`AIza...`）。
**鎖匙等於你嘅信用卡**：邊個拿到，就可以用你嘅額度，甚至收你錢。

**為咩唔可以直接放網站**
你個網站係 GitHub Pages，所有檔案學生都下載得到。key 寫入 HTML/JS = 全世界都見到（F12 一撳）。所以一定要有個「中間人」幫你揸住條鎖匙 —— 就係 Cloudflare Worker。

**架構（記住呢條線就夠）**
```
學生部機（island.html）
      │  POST 問題
      ▼
Cloudflare Worker（免費，揸住 key，管規矩、限流）
      │  POST + key
      ▼
Google Gemini（答）
      │
      ▼   答案沿路返去學生畫面
```

---

## 1. 拿 Gemini key（5 分鐘，免費）

1. 去 https://aistudio.google.com/apikey
2. 用 Google 帳號登入（建議用**學校或你自己**嘅帳號，唔好用學生帳號）
3. 撳 **Create API key** → 揀一個 project（冇就自動幫你開）
4. 複製嗰串 `AIza...`，暫時貼落記事本

> 免費額度：每分鐘十幾次、每日幾百至千幾次（實際數字 Google 會改）。一班 30 人輪住問一定夠；如果全校同時用就要開 billing（信用卡），到時再講。

---

## 2. 開 Cloudflare Worker（10 分鐘，免費）

1. 去 https://dash.cloudflare.com/sign-up 註冊（email + 密碼，唔使信用卡）
2. 左邊 **Workers & Pages** → **Create** → **Worker** → **Deploy**（佢會畀個 Hello World 你）
3. 撳 **Edit code**，全選刪走，貼上 `ai-worker.js` 全文 → **Deploy**
4. 你會有個網址，類似 `https://island-ai.你的名.workers.dev`

## 3. 放 key 入 Worker（最重要一步）

1. 喺 Worker 頁面 → **Settings** → **Variables and Secrets**
2. **Add** → 名：`GEMINI_KEY`，值：貼上第 1 步嗰串 → 類型揀 **Secret**（加密）→ Save
3. 再 **Add** → 名：`ALLOW`，值：`https://你的帳號.github.io`（你網站真正嘅網址）→ 類型 Text
4. 儲存後 **Deploy** 一次令設定生效

## 4. 測試（唔使開網站）

喺電腦開 PowerShell，貼呢句（換成你自己個 Worker 網址）：

```powershell
curl.exe -X POST "https://island-ai.你的名.workers.dev" -H "content-type: application/json" -d "{\"grade\":\"P4\",\"question\":\"點解會有彩虹?\"}"
```

見到 `{"answer":"..."}` 就成功。見到 `未設定 GEMINI_KEY` = 第 3 步未生效；`AI 出錯（400）` = key 打錯。

## 5. 網站嗰邊

話我知個 Worker 網址，我幫你喺島上加「問 AI」面板（會讀學生而家係幾年級，自動傳 `grade`）。

---

## 班級規則（你想改就改呢度）

全部喺 `ai-worker.js` 嘅 `sys` 陣列，例如想小四答得更短：

```
3. 答案 2 至 3 句，最多 60 字。
```

想加「唔准講答案，只准給提示」：

```
8. 學生問功課答案，只可以講思路同提示，唔可以直接講答案。
```

改完撳 **Deploy** 即刻生效，學生部機唔使更新。

---

## 你要知嘅風險（唔講就係呃你）

1. **免費額度嘅資料可能被 Google 用嚟改進產品**。所以規則第 6 條禁講姓名班別。如果學校要求嚴格，就要開 billing 用收費版（收費版唔會用你資料訓練）。
2. **AI 會答錯**。小四學生分唔出。所以規則第 4 條叫佢「唔確定就話唔知」，你亦要同學生講「AI 講嘅都要對書」。
3. **未滿 18 歲用 API** 喺條款上係灰色地帶。正式上線前最好問學校 IT／校長一句，尤其如果要家長同意。
4. **限流係每 IP 每分鐘 12 題**，只係擋手痕，唔係防攻擊。公開網址畀全世界，理論上有人可以刷你額度。
5. Worker 免費版每日 10 萬次請求，你絕對用唔完；爆額度只會係 Gemini 嗰邊。

---

## 出事點算

| 症狀 | 原因 | 做法 |
|---|---|---|
| `Failed to fetch` | Worker 網址錯／未 Deploy | 用第 4 步 curl 試 |
| `未設定 GEMINI_KEY` | Secret 未生效 | 加完要再 Deploy |
| `AI 出錯（429）` | 撞到 Gemini 免費上限 | 等一分鐘，或換 model |
| `AI 出錯（403）` | key 過期／被撤銷 | 去 AI Studio 開新 key |
| 答案有台灣腔 | 規則未夠硬 | 喺 `sys` 加「嚴禁台灣用語，例如：影片→短片、品質→質素」 |

---

# 待議（2026-11 起暫停，等老師問人）

**狀態：計畫已定，未執行。冇開過任何帳號、冇寫過任何 key。**

已完成（檔案已存在，隨時可用）：
- `island web/ai-worker.js` — Worker 全文（含班級規則、每 IP 每分鐘 12 題限流）
- `island web/AI-設定指南.md` — 本文件

未做：
- 網站嗰邊嘅「問 AI」面板（要等 Worker 網址；會自動帶學生年級）
- 任何帳號／key／部署

要恢復呢件事，只需三樣：
1. 有冇開到 Cloudflare Worker＋拿到 `workers.dev` 網址
2. 有冇拿到 Gemini API key（`AIza...`）
3. 邊個年級先試（建議先淨開小四，規則最易調）

待人決定嘅問題：
1. 畀唔畀學生真用（學校 IT／校長／家長同意）
2. 用免費額度（資料可能被 Google 用嚟改進產品）抑或開 billing 用收費版
3. 班級規則要幾嚴（可唔可以直接答功課答案）
4. 要唔要記錄學生問過乜（教學用，但涉及私隱）

