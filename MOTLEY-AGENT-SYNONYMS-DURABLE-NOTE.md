# Motley agent synonyms durable fold

Live already shipped tip `2c9aa2bf` (2026-09-17 ~2:27 PM PT):
- `/contribute.md` → 308 `/contribute`
- `/crew.json` → 308 `/crew`
- `/bag.json` → 308 `/bag`
- `/muse` → 308 `/`

## Apply onto this branch (main Map)

Insert into `POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST` after bare `/compute/api/digest` entries:

```js
  // Apex agent-ish file synonyms + Muse brand door (2026-09-17).
  ['/contribute.md', 'https://www.getdasha.com/contribute'],
  ['/contribute.md/', 'https://www.getdasha.com/contribute'],
  ['/crew.json', 'https://www.getdasha.com/crew'],
  ['/crew.json/', 'https://www.getdasha.com/crew'],
  ['/bag.json', 'https://www.getdasha.com/bag'],
  ['/bag.json/', 'https://www.getdasha.com/bag'],
  ['/muse', 'https://www.getdasha.com/'],
  ['/muse/', 'https://www.getdasha.com/'],
```

Add comment block on Map: Apex agent-ish file synonyms; do not fold `/muse` → `/start`; stay out of `/providers` `/developers` `/network` `/start` (Muse #225).

Add test: `dasha-motley-agent-synonym-leftover-pretty-path.test.mjs` (disk: `/tmp/dasha-lobby-durable-synonyms/` or tip `/workspace/dasha-lobby-clean-tip-1cd73be2-20260913-0451pt/`).

## Stay-outs
Muse #225, Room Phase 0, people-data, poison branch `cursor/motley-agent-synonym-leftovers-ee2b` (35-byte placeholder worker — DO NOT MERGE).

## Supersedes
Dirty #237 (`cursor/motley-agent-synonym-leftovers-8899`). Abandon ee2b.
