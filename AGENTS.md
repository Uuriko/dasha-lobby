# getdasha.com — agents

Worker-first. Exclusive write. Closest AGENTS.md wins. User chat overrides. Locks live in `CLAIMS.json`, not this file. Claude Code still prefers `CLAUDE.md`; that file is a single `@AGENTS.md` pointer. Do not maintain two rulebooks.

## Product
- One room: `/lobby` — chat, then Play, then threads. Chess is in-room Play, never a home door.
- `/forum` and `/chat` 308 → `https://www.getdasha.com/lobby` (keep `?t=`).
- `/studio` `/verse` `/learn` `/graph` 308 → `/`. Do not restore Studio.
- `/privacy` 200. `/compute` 200 (Use / Provide / Night / Build), not 410. `/crew` 200 (Crew). `/dasha` `/desk` 308 → `/how-to-buy`.
- Mint `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump`. Buy `jup.ag` only. Never `plugin.jup.ag`.

## Write
- One writer per path. Claim first (`dg-claim` / `dasha-claim-preflight --owner grok-bot`). Do not steal.
- Grok Bot: live Workers from this tree. Deploy only with `dasha-lobby-wrangler.deploy.jsonc` (`npx wrangler@3.114.15 deploy -c dasha-lobby-wrangler.deploy.jsonc`).
- Never Designer-publish. Never run `dasha-lobby-static-gen.mjs` while Codex owns worker/gen/landing/simp-board.
- Never TUI-inject. Never chess-door on home. Never restore Studio.
