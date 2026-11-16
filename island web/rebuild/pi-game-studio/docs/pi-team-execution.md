# Team skills 喺 Pi 點跑（pi-team-execution）

原版每個 `team-*` pipeline 都係叫 Claude Code 開 subagents 分頭做嘢。
Pi 唔同 runtime 有唔同能力，所以劃一規則如下，9 條 `team-*` skills 全部跟呢份：

## 核心規則：spawn 到就 spawn，spawn 唔到就自己做

Pipeline 入面每次見到「spawn `<角色>`」，按次序試：

1. **有開工 tool 就用** — 如果你嘅 runtime 有 spawn subagent 嘅 tool
   （例如 Orca／OMP runtime 下嘅 subagent 機制），就按 pipeline 要求開工：
   每個角色開一個，brief = 該角色 skill（`skills/<角色>/SKILL.md`）+ 當前 phase
   嘅任務，然後收返結果繼續下一個 phase。
2. **冇就自己做晒** — 冇 spawn 能力唔係錯，唔使停，唔使問：
   你自己按住同一個 phase  brief、同一個角色 skill、同一順序、同一 gates，
   逐個 phase 做。效果一樣，淨係慢啲同埋慳唔到 context。

唔好為咗等 (1) 而停低。如果唔肯定自己有冇 spawn tool，直接當冇，做 (2)。

## 其他 Claude 習慣對照

| 原版寫法 | Pi 做法 |
|---|---|
| `AskUserQuestion` decision point | 直接問 user，等答覆先繼續 |
| `` !`bash ...` `` setup 行 | 冇 bash 就人手跟住步驟做 |
| `${CLAUDE_SKILL_DIR}`、`skills/` 相對路徑 | 本 package 內：`skills/<名>/SKILL.md`、`docs/`、`templates/` |
| `log_decision` | 寫入 `production/` 底（開 session 嗰陣 extension 會起好） |

## 對用家嚟講

你咩都唔使識。打 `/skill:team-combat 做個近戰格擋系統` 之類，佢問你嘢你答，
佢就會行晒成條 pipeline。背後係分頭做定自己做，你唔使理。
