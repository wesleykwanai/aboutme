# pi-game-studio

Claude Code Game Studios 嘅 Pi 移植版（原 repo MIT license，upstream：https://github.com/Donchitos/Claude-Code-Game-Studios）。成個 concept 照搬：director／lead／specialist 三層架構、workflow 指令、gates、templates，全部保留。

## 有咩喺入面

| 嘢 | 數量 | 喺邊 |
|---|---|---|
| 角色 skills（49 個原 agents：directors、leads、specialists、三套 engine 專家） | 49 | `skills/<角色名>/SKILL.md` |
| 流程 skills（原 74 個 slash commands：brainstorm、design-system、dev-story、sprint-plan、team-* 等） | 74 | `skills/<指令名>/SKILL.md` |
| `studio-rules`（原 14 條 path-scoped rules 嘅 Pi 入口） | 1 | `skills/studio-rules/` |
| 文件 templates（GDD、ADR、sprint plan 等）+ 框架 docs | 原樣 | `docs/` |
| Commit/push lifecycle 強制執行 | 1 個 extension | `extensions/game-studio.ts` |
| 原 hooks／scripts（bash，要 Git Bash 先跑到） | 原樣 | `hooks/`、`scripts/` |
| 原 rules 全文 | 原樣 | `rules/` |

## 安裝

```bash
# 任揀其一
pi install ./pi-game-studio
# 或者試用一次
pi -e ./pi-game-studio
```

裝完打 `/reload`，再打 `/game-studio` 睇狀態。

## 用法

- 開工：`/skill:start`（onboarding），唔知做咩下一步：`/skill:help`
- 流程指令：原嚟 `/dev-story` 而家係 `/skill:dev-story`，如此類推（名全部一樣，淨係加咗 `skill:` 前綴）
- 角色：`/skill:game-designer`、`/skill:gameplay-programmer`、`/skill:creative-director`……
- 開團：`/skill:team-combat`、`/skill:team-ui` 等 9 個 team skills
- 掂到 gameplay/engine/AI/network/UI/data/test 等路徑之前：`/skill:studio-rules` 睇對應標準

## Team skills 點跑

9 條 `team-*`（`/skill:team-combat` 等）跟 `docs/pi-team-execution.md`：runtime 有 subagent 機制就分頭做，冇就模型自己逐個 phase 做。你淨係負責答佢問你嘅嘢。

## 同原版嘅差異（誠實話）

1. **指令改名**：`/x` → `/skill:x`。Pi 嘅 skill 命令就係呢個格式，冇得保留原名（唔起 74 個重複 wrapper，係故意慳位）。
2. **Team 執行識變通**：原版靠 Task-tool 開子代理；Pi 版跟 `docs/pi-team-execution.md`——有 spawn 能力就用，冇就喺主 session 逐 phase 做（human-in-the-loop 照保留）。行為唔係 1:1，但知識（設計理論、checklist、gate 標準）係 1:1。
3. **冇 model tiers**：原版 directors 指定 Opus、部分指定 Sonnet；Pi 一律用你 session 嘅 model。Tier 變咗只係角色 seniority，唔係計費。
4. **只得一個真 gate**：原版 18 個 hooks 入面，得 commit 個 JSON check 係真擋（staged data JSON parse 唔到就 block，已 port 做 extension）。push 去 protected branch 會加提醒。其餘 hooks／scripts 原樣保留但要 bash 先跑到——**呢部機而家冇 bash**（冇 Git Bash），要跑 scripts 請先裝 Git for Windows。
5. **工具名映射**：`AskUserQuestion`→`ask_user_question`、`TaskCreate/TaskGet/TaskList/TaskUpdate`→`todo`、`WebSearch`→`web_search`、`WebFetch`→`fetch_content`、`Glob`→`find`。認唔到嘅工具名已刪，唔阻開機。
6. **內容英文原樣**：skills 內文保留英文（game dev 術語本身都係英文），呢份 README 同溝通用中文。
7. **路徑重寫**：skill 內文嘅 `.claude/docs/` 等已改做 package 內相對路徑（`../../docs/`…）；`production/` 路徑唔郁（係你 game project 嘅嘢）。extension 每次開 session 會起 `production/session-state/` 同 `production/session-logs/`。

## 目錄

```
pi-game-studio/
  package.json            Pi package manifest（skills + extension）
  skills/                 124 個 skills（49 roles + 74 workflows + studio-rules）
  extensions/game-studio.ts  session_start 起目錄＋commit JSON gate＋push 提醒＋/game-studio
  docs/                   原框架文件（quick-start、workflow-modes、director-gates…）
  rules/                  原 14 條 rules 全文
  hooks/、scripts/         原 bash 腳本（要 Git Bash）
```

授權：MIT（跟上游）。
