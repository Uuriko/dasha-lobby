# Lobby forum tags

Quiet Discord-style topic chips on **`/lobby` threads only**. Room stays a separate ledger. Instinct deploys.

## Product

- Human community lobby: chat, then Play, then threads.
- Threads were a flat list. Tags make a thread findable without stuffing Room, Compute-in-lobby Start, or people-data into the room.
- Optional. One chip, or none.

## Fixed list (5)

`trade` / `meme` / `help` / `play` / `news`

No freeform. No handles, wallets, fingerprints, or custom strings. Unknown `?tag=` / POST `tag` is refused (API) or ignored (HTML).

## Surfaces

- Create: optional chip row on the new-thread composer (linked X).
- Index: filter chips + a chip on each tagged row (first paint + lobby.js).
- Thread header: the chip, if set.
- API: `POST /forum/threads` `{ title, text, tag? }`; `GET /forum/threads?tag=meme` (composes with `?q=`).
- Share: `/lobby?tag=meme#threads`. `?t=` still opens a thread.

## Stay off

Designer-publish · `plugin.jup.ag` · Room merge · Compute-in-lobby Start · agent-OS · people-data · version bump
