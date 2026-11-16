import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * pi-game-studio lifecycle extension.
 *
 * Pi port of the enforcement half of `.claude/hooks/` from
 * Claude Code Game Studios. The original suite is mostly advisory
 * (design-doc scans, branch reminders, audit logs); its single BLOCKING
 * check is "staged JSON data files must parse" (validate-commit.sh), so
 * that is what this extension enforces. Everything else from the original
 * suite ships as runnable scripts under `scripts/` + `hooks/` and as
 * guidance in the `studio-rules` skill.
 */

function cwdOf(ctx: unknown): string {
	const c = (ctx ?? {}) as { cwd?: unknown };
	return typeof c.cwd === "string" && c.cwd.length > 0 ? c.cwd : process.cwd();
}

/** Staged *.json files under game data dirs (mirrors rules/data-files.md globs). */
function stagedDataJsonFiles(cwd: string): string[] {
	try {
		const out = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], {
			cwd,
			encoding: "utf8",
			timeout: 10_000,
			stdio: ["ignore", "pipe", "ignore"],
		});
		return String(out)
			.split("\n")
			.map((s) => s.trim())
			.filter((s) => s.endsWith(".json") && /(^|\/)(assets\/.*\/data|data|content\/.*\/data)\//i.test(s));
	} catch {
		return []; // git unavailable: fail open, the model still sees the guidance
	}
}

export default function (pi: ExtensionAPI) {
	// Port of hooks/session-start.sh (essence): make sure the production
	// state tree exists so skills can read/write checkpoints from turn one.
	pi.on("session_start", async (_event, ctx) => {
		try {
			const cwd = cwdOf(ctx);
			for (const d of ["production/session-state", "production/session-logs"]) {
				mkdirSync(join(cwd, d), { recursive: true });
			}
			appendFileSync(join(cwd, "production/session-logs/sessions.log"), `${new Date().toISOString()} session_start\n`);
		} catch {
			// Bootstrap must never break session start.
		}
	});

	// Port of hooks/validate-commit.sh (the ONLY blocking check in the
	// original suite): staged JSON data files must parse.
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;
		const command = String((event.input as { command?: unknown }).command ?? "");
		if (!/\bgit\s+commit\b/.test(command)) return undefined;

		const cwd = cwdOf(ctx);
		const bad: string[] = [];
		for (const f of stagedDataJsonFiles(cwd)) {
			try {
				JSON.parse(readFileSync(join(cwd, f), "utf8"));
			} catch {
				bad.push(f);
			}
		}
		if (bad.length > 0) {
			return {
				block: true,
				reason:
					"BLOCKED (pi-game-studio commit gate): staged data files are not valid JSON:\n" +
					bad.map((f) => `  - ${f}`).join("\n") +
					"\nFix the JSON and commit again.",
			};
		}
		return undefined;
	});

	// Port of hooks/validate-push.sh (advisory in the original: always
	// exits 0): append a release-gate reminder to protected-branch pushes.
	pi.on("tool_result", async (event) => {
		if (event.toolName !== "bash") return undefined;
		const command = String((event.input as { command?: unknown }).command ?? "");
		if (!/\bgit\s+push\b/.test(command)) return undefined;
		if (!/(main|master|release|production)/.test(command)) return undefined;
		return {
			content: [
				...event.content,
				{
					type: "text",
					text: "[pi-game-studio] Pushed to a protected branch — confirm the build passes, tests pass, and release-gate bugs are closed.",
				},
			],
		};
	});

	pi.registerCommand("game-studio", {
		description: "Show pi-game-studio status and entry points",
		handler: async (_args, ctx) => {
			ctx.ui.notify(
				"pi-game-studio: 49 role skills + 74 workflow skills. Start with /skill:start, orientation with /skill:help. Commit gate: staged JSON data files must parse.",
				"info",
			);
		},
	});
}
