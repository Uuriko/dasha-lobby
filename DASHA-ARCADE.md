# Dasha Arcade

Three lightweight games for a new `/arcade` page, with Dasha as the player character and host. Short rules, immediate replay, touch and keyboard controls, no sign-in, and optional scores saved only on the device.

## Concepts

| Concept | Gameplay | Dasha angle | Status |
| --- | --- | --- | --- |
| Dasha After Hours | Tap or press Space to stay airborne and pass narrowing gaps. One collision ends the run. | Dasha has clocked out and is floating away from interruptions. | Implemented |
| Do Not Disturb | Switch among three lanes, collect stars, avoid pings, and protect three chances for 45 seconds. | Give Dasha a moment of peace. | Implemented |
| Dasha’s Carry-On | Sort 18 items against a visible packing list. Correct streaks earn bonus points; no timer. | Help Dasha pack her one bag. | Implemented |
| One More Take | Stop a moving timing marker inside a shrinking target over five takes. | Help Dasha nail the scene with a well-timed clap. | Follow-up concept only |

The [reference arcade](https://www.whitehouse.gov/arcade/) was inspected on September 6, 2026. The gameplay references were [one-button flight](https://www.whitehouse.gov/arcade/flappy-bill/), [steering](https://www.whitehouse.gov/arcade/rio-run/), and [sorting](https://www.whitehouse.gov/arcade/supply-line/). These games use original code, names, copy, and Dasha scenarios. No reference assets or political themes are used.

## Page and behavior

- `/arcade`, `/arcade/play.js`, `/arcade/style.css`, and `/arcade/portrait.jpg` are served by the existing Worker on both `www.getdasha.com` and `lobby.getdasha.com`. `/arcade/` redirects to `/arcade`, preserving the query string. The configured apex routes do not currently cover `/arcade`; the canonical URL is `https://www.getdasha.com/arcade`.
- A single link sits beside the existing Lobby Play control. Chat, threads, chess, the homepage, identity, and compute retain their existing behavior.
- The page uses the existing black, cream, acid-yellow palette and a first-party Dasha portrait. It makes no API calls, loads no third-party scripts, starts no audio, and requires no account or wallet.
- Animated games pause on lost focus, hidden tabs, page transitions, and long frame gaps. Game selection cancels the previous animation loop. Pause, resume, reset, and replay are explicit controls.
- The Carry-On game uses HTML, a visible packing list, text feedback, and live announcements of the next item. It remains playable if canvas is unavailable. The other two games rely on vision and movement; this is not a claim that every game is accessible to every player.
- Device best scores are optional local storage. Missing, invalid, or blocked storage does not prevent play. Scores have no monetary value and are not shared or verified.

## Source map

- `dasha-arcade-engine.mjs`: deterministic game rules, shared by the delivered script and tests.
- `dasha-arcade-client.mjs`: input, drawing, feedback, frame lifecycle, and local scores.
- `dasha-arcade-page.mjs`: responsive HTML and CSS.
- `dasha-arcade-portrait.mjs`: unchanged first-party JPEG bytes, embedded to keep the mirror self-contained.
- `dasha-arcade.mjs`: exact route handler and idempotent Lobby link.
- `dasha-lobby-worker.mjs`: import, early route dispatch, and one Lobby transformation hook.

Portrait source: [existing Dasha profile image](https://www.getdasha.com/simp/photo/profile.jpg), retrieved September 6, 2026. JPEG, 400 × 400, 24,875 bytes. SHA-256: `5bc5141841d5d65b10d3ae19c33aa6f4aeb68383dbd4d5488d14526f960e1dec`. No image transformation or new rights claim is made.

## Verification and release handoff

`node --test dasha-arcade.test.mjs dasha-arcade-client.test.mjs`: **10 passing tests** on Node 24.19.0. They cover scoring, collisions, bounded rounds, independent replay, input guards, pause/resume and page transitions, malformed storage, text-game fallback, actual Worker routes/assets, and Lobby discovery after its existing transformations. Client lifecycle checks run in a small Node VM event fixture; they are not browser or visual tests.

The broader legacy suite was attempted but did not complete after reaching live network access. No full-suite, browser, accessibility-conformance, production Watch, or deployed-page pass is claimed. Dependencies and the generated static source are unchanged.

This repository is a Cloudflare-first production mirror, as described in its README. Work started from `8ebd1d614d3f94cef0ad4138933f553507492406` and was rebased onto the newer mirror commit `79bb27a1612c580c4dbfad7e031f7a47e9e0440f`. This is not a claim to own the current live ship tree. The live claim tools and `CLAIMS.json` were not present in this isolated checkout.

For release, the existing ship-tree owner should acquire the appropriate path claim and apply these arcade modules plus the small Worker integration delta to the current source. Do not replace the current Worker wholesale with an older mirror snapshot. Run the current repository gates and browser checks at mobile, tablet, and desktop sizes, including touch, keyboard, pause on backgrounding, repeated replay, blocked storage, and Carry-On announcements. Use the existing preview/canary and Cloudflare release workflow, then verify `/arcade`, its three assets, Lobby discovery, and the existing protected routes. This change does not deploy or merge anything and does not call the static generator or Designer publishing.
