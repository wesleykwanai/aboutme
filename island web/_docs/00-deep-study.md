# Island OG 深研 — 00-deep-study.md（主檔）

> 來源：`C:\Users\kth\Documents\Website\island web\`
> 原帖：Yaochou Chung ~2026-10-24，`我的 obsidian 圖書島 / 參考政策島`
> 目標：唔加入政策島，起一隻類似嘅俾自己用。本檔係 OG 唯一真相來源。

## 0. Raw inventory（已驗）

| 檔 | 大小 / 長度 | 內容 |
|---|---|---|
| `AQOpENwGwfrWT... (1).mp4` | 7.0MB，57.92s，1280x720 30fps，h264 + AAC | 行島 walkthrough：高空 → 中央廣場 → Antigravity 書櫃 → 開 list |
| `AQORbxx5VLj5o...-mgaq-A.mp4` | 1.6MB，64.79s，908x718 30fps | 讀筆記＋導讀：006-ai會議錄音助理.md 全文＋Edge-TTS＋館長摘要＋問答 |
| `858131930..._n.jpg` | 80KB | Chou 行動島 3D 智慧辦公室（辦公室 reskin 版，4 島＋任務動態＋Executive Directive）|
| `858266629..._n.jpg` | 80KB | 企劃策略島 Prompt Config（每個島＝一個 AI 同仁，可改 System Prompt）|
| `860380358..._n.jpg` | 172KB | Obsidian 3D 知識群島總覽截圖（同片 1 同一產品）|
| `AQOpENwG_frames/f01-06.jpg` | 每 4 秒一格 | 片 1 storyboard（大格）|
| `AQORbxx5_frames/f01-06.jpg` | 每 4 秒一格 | 片 2 storyboard（大格）|
| `AQOpENwG_story/s01-12.jpg` + `AQORbxx5_story/s01-13.jpg` | 每 5 秒一格 640px | 密集 storyboard，防漏 UI |
| `AQOpENwG_audio.wav` 1.8MB / `AQORbxx5_audio.wav` 2.0MB | 16k mono | 已抽出，未做 STT（下一步可用 whisper 轉文字）|
| `island-concept-spec.md` | 舊版 spec | 第一版粗拆，細節以本檔為準 |

讀片方法（已驗，下次照用）：`pip install imageio-ffmpeg pillow` → `imageio_ffmpeg.get_ffmpeg_exe()` 即 ffmpeg → `-vf fps=1/4,scale=1280:-1 -vframes 6` 抽大格，`fps=1/5,scale=640:-1` 抽 story，`-vn -ac 1 -ar 16000` 抽 wav。本地 mp4 唔經 fetch_content（只食 http）。

## 1. 片 1 逐段拆（57s 行島，唔係剪接，係一鏡 orbit＋walk）

- 0-8s（f01）：高空斜睇 5 島全景。左 panel 全開：`Obsidian 3D 知識群島 / 11 種類 / 630 筆記`。頂部有 晨曦／黃昏／晝夜＋即時開關（光影模式）。下方四 tab：書櫃總覽／全館檢索／館內人物／群島視角。list 每行：名＋冊數＋所屬島＋[帶路][開啟書櫃]。左下：`左鍵旋轉·右鍵平移·滾輪縮放`。前景大牌：`西翼：視覺與繪圖藝術島 Visual Arts Pavilion`。
- 8-20s（f02 無 panel）：收起左 panel 做純展示。鏡頭轉去東島，特寫：`東翼：工程與專案實務島 Engineering Bastion`＋紅白燈塔＋藍鑽＋松樹。中央 dome＋噴水池＋紅橋清晰。可見每個書櫃頭頂有紫牌（CEMS / Github / Hermes），每本書有浮標。
- 20-32s（f03）：落返中央廣場。`中央知能總館島 Grand Library HQ`＋`北翼：AI 與技能長廊`。左 panel 返嚟，滑鼠 hover 喺 Antigravity 行（98 冊）。南翼牌：`南翼：生活與影音閱覽綠洲 Media & Daily Oasis`。
- 32-45s（f04）：全景拉遠，5 島＋橋＋帆船＋海鷗一次睇晒。北島風車＋彩書牆（441 冊繪圖島喺西邊粉紅櫃最搶眼）。證明地形＝5 個六角柱島＋沙灘邊＋紅木橋連接，唔係一塊大陸。
- 45-58s（f05/f06）：行入北翼 Antigravity 書櫃前。彈黃框：`管理員 小葵 / 總館長 艾莉絲 / 已抵達目標書櫃！請點閱`。右 panel 滑出：`[Antigravity] 書櫃目錄檢視`，tag filter：`全部(98) #Node.js(49) #node26(28) #Python(29) #React(26)`，list 每條：標題＋字數（2398 / 4235 / 8695 / 6217 / 7699 字）＋摘要兩行＋tags（#React #TypeScript #Three.js #Tailwind CSS 等）＋上下頁 `1/5`。3D 書櫃上每本書有浮牌（例：`夢境彼端 Celestial Hands - AR 婚禮小物`），小人圍住睇。左 panel 仲喺度，可隨時跳島。

漏睇位補完：書係「一 note 一 spine」但 441 冊唔會真 render 441 本——遠睇係彩牆，近先出浮牌＋list（LOD）。小人＝導覽 NPC，唔係玩家角色。

## 2. 片 2 逐段拆（64s 讀筆記＋導讀，重點在右欄）

固定畫面，零 3D，全程係 note view：`Antigravity 書櫃 / Antigravity/006-ai-會議錄音助理.md / 2026/8/7`，標題 `專案規劃書 - AI 會議錄音助理 (MA_V21.html)`。

- 左欄：`# OBSIDIAN YAML FRONTMATTER 屬性` 卡：`id:006 / title / category:專案規劃書 / tech_stack:React / local_path:D:\_AI\ai-會議錄音助理 / tags:react / updated:2026-08-07`。下有 `#react #React` pill。下面 markdown 全文：1.專案概述（Vite+React 整合成單一 HTML `MA_V21.html`）2.功能範疇（錄音／上傳／Gemini STT＋摘要／單檔執行）3.技術棧（HTML5/JS ES6+ / React 19 CDN）。證明：YAML frontmatter 係一級公民，唔係 excerpt 而已。
- 頂部三掣：`一鍵自然語音導讀 / 朗讀原文 / 編輯筆記`＋X。
- 右欄上：`雙向連結書摘索引 (3)`：`[[React]] [[004_AI_ppt]] [[007_ai-architect]]`。
- 右欄中：`Edge-TTS 自然語音導讀`＋聲線 dropdown `館長艾莉絲（曉曉自然女聲）`＋大黃掣 `一鍵導讀並發聲`＋播放／停止＋綠色狀態 `正在自然語音導讀：《專案規劃書…》`。
- 右欄下：`館長艾莉絲導讀精華與摘要`：固定三段式——開場（我是總館長艾莉絲，現為您導讀位於…）、章節點名（主要分為…1.概述 2.範疇 3.技術棧 4.實作步驟）、核心內容摘要（逐段縮寫）。底有 input `詢問館長問題（將同步語音回答）…`＋send。即：TTS＋摘要＋問答三件套。
- 結論：導讀唔係 summarize 全文咁簡單，係「預寫開場＋章節地圖＋逐段濃縮＋可追問」。重做時右欄照抄呢個結構就夠。

## 3. 三張截圖補充（片以外先有嘅資訊）

- Chou 行動島圖：同一 engine 唔同皮——4 島（處理總部／企劃策略島／秘務運作島／美編創意島）＋頂部 `Three.js Galan Living Island / 潤稿可自由輸出`＋黑牌 `Executive Directive 歡迎來到 Chou 行動島！請在左側交辦工作，秘書將跨島傳遞至各虛室！`＋左欄 `任務動態 / 歷程紀錄 / 10:15:06 …已就位`。證明：島可以係 agent 任務板，唔止係書。
- Prompt Config 圖：`企劃策略島 - 專業提示詞設定 (PROMPT CONFIG) / 同仁：安德森 (Planner Anderson) 資深策略師`。內有 `業務職能說明`＋`工作指示與輸出規範 (System Prompt)` textarea：職責／工作流程／必備包含區塊（1.願景 2.受眾 3.亮點 4.6-8 頁架構 5.時程 6.KPI＋驗收標準）。底有 `恢復預設 / 取消 / 儲存並套用`。證明：每個島綁一個可調 System Prompt 的 agent，重做時 MVP 可先 skip，phase 2 先加。

## 4. 資料模型（照抄）

```
vault/*.md --frontmatter--> {id, title, category|folder, tech_stack, local_path, tags[], updated, body}
category|folder --> 一個書櫃（牌名＝category，副牌＝冊數，位置＝所屬島）
tag --> 顏色＋filter pill（#Node.js(49) 呢種計數要預先 aggregate）
note --> 一本書 spine（高按字數，色按主 tag hash）＋右 list 一行＋全文頁
backlinks --> [[xxx]] 解析成右欄索引
```

冊數對照（左 panel 原文）：槓目錄筆記 2／知識庫 1／Antigravity 98／技能 58／Codex 1／繪圖 441／CEMS 20／Github 9／Hermes 3／YT筆記 4，總 630（11 種，截圖只列 10，差 1 係未展開）。

## 5. 重做 mapping（唔使諗，直接用）

-  island.html（Three.js CDN）＋ notes.json（手寫先）
-  5 島固定：中央總館／北 AI／東工程／南生活／西視覺（你做繪本島就改名：中央總館／北 P1-2／東 P3-4／南 P5-6／西科學）
-  左 panel：書櫃總覽 list＋[帶路 teleport][開啟書櫃 open list]＋檢索 tab（MVP 檢索可只做 filter）
-  右 panel：書櫃目錄（tag pills＋字數＋摘要＋分頁）→ 點行入全文頁（YAML 卡＋全文＋右欄導讀三件套）
-  導讀 MVP：預寫三段式摘要＋Web Speech API 朗讀（唔使 Edge-TTS key 住先），問答先做假 input
-  唔做：後端／真寫入 vault／login／DB／多人／Mixamo／Prompt Config（phase 2）

## 6. 未搞／風險

- wav 未轉文字：如要片中口白，用 whisper 轉（`pip install openai-whisper` 再跑）。
- 繪圖 441 冊大櫃 LOD 點做唔知（遠彩牆近浮牌，估係距離剔除，細 vault 無影響）。
- 原帖 3x share（1MArRfTLd5 / 1JKoFqYUJg / 19aRNNm4FC）login-walled 未睇，當截圖處理。
- shortcut：導讀先用預寫摘要＋瀏覽器 TTS，當 Edge-TTS，到要多聲線先接 key。
