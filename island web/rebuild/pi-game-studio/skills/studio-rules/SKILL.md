---
name: studio-rules
description: Path-scoped coding and document standards for the game project. Use when reading, writing, or reviewing gameplay, engine, AI, network, UI, shader, scene, data, narrative, design-doc, or test files.
---

# Studio Rules (Pi port of `.claude/rules/`)

The original framework loads a rule when the model **reads** a file under a
matching path. In Pi there is no path-scoped rule loader, so this skill is
the replacement: when your task touches a path below, read the rule file
first and follow it.

| You are touching | Read first |
|---|---|
| `src/gameplay/**`, `Assets/**/Gameplay/**`, `Source/**/Gameplay/**` | `rules/gameplay-code.md` |
| `src/core/**`, `Assets/**/Core/**`, `Source/**/Core/**` | `rules/engine-code.md` |
| `src/ai/**`, `Assets/**/AI/**`, `Source/**/AI/**` | `rules/ai-code.md` |
| `src/networking/**`, `Assets/**/Network(ing)/**`, `Source/**/Network(ing)/**` | `rules/network-code.md` |
| `src/ui/**`, `Assets/**/UI/**`, `Source/**/UI/**` | `rules/ui-code.md` |
| `design/gdd/**` | `rules/design-docs.md` |
| `design/narrative/**` | `rules/narrative.md` |
| `assets/data/**/*.json`, `Content/**/Data/**/*.json` | `rules/data-files.md` |
| `tests/**`, `Assets/Tests/**`, `Source/**/Tests/**` | `rules/test-standards.md` |
| New prototype code anywhere | `rules/prototype-code.md` |
| Scene files | `rules/scene-files.md` |
| Shader files | `rules/shader-code.md` |
| Agent session memory layout | `rules/agent-memory.md` |
| Writing or improving a skill | `rules/skill-authoring.md` |

Rule paths above are relative to the pi-game-studio package root
(`docs/` explains the reasoning; `rules-reference.md` in the original
docs set documents why rules are guidance, not enforcement).

Two things ARE enforced (by `extensions/game-studio.ts`, not by this skill):
1. `git commit` is blocked when a staged JSON data file does not parse.
2. `git push` to `main`/`master`/`release`/`production` appends a
   release-gate reminder to the result.
