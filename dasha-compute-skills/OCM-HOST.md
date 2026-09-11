# Skill: Host on OCM (Apple Silicon)

Paste this into your AI assistant to install the OCM provider agent on this Mac. It contributes idle GPU to the marketplace at https://www.getdasha.com/compute/ocm and earns credits (a token count, not money).

## Goal
Enroll this Mac with a one-time `ocm_enroll_` code, install the agent safely, pass doctor, and appear under Your providers. Enrolled ≠ advertising already live — never invent Mac counts.

## Facts
- Guide: https://www.getdasha.com/compute/ocm/provider
- Console (Enroll a Mac): https://www.getdasha.com/compute/ocm
- Status: https://www.getdasha.com/compute/ocm/status
- Also: https://ocm.getdasha.com · https://ocm.getdasha.com/status
- Installer: https://api.ocm.getdasha.com/install.sh (also sha256 next to it)
- Apple Silicon (arm64) + macOS 14+. One outbound connection — no inbound ports.
- Enrollment codes start `ocm_enroll_` (15 min, once). The installer exchanges the code for an `ocm_host_` token — you never paste a provider token on the command line.
- A leftover `ocm_host_` token still works at the hidden prompt. Developer keys (`ocm_live_`) are refused.
- Which key / which base: buyer `ocm_live_` hits https://www.getdasha.com/compute/ocm/v1. Compute chat is `dsk_` / `dgk_` on https://lobby.getdasha.com/compute/api/v1. Never swap. Host tokens stay `ocm_enroll_` / `ocm_host_`.
- Status **Cold** means the model loads on the first request (~1 min); Ready and Serving answer in about a second. Cold is not broken Warming.
- As a provider you can read every prompt routed here in plaintext; so can every other provider.

## Steps
1. `uname -m` must be arm64. Stop if not.
2. Download, do not pipe:
   `curl -fsSL https://api.ocm.getdasha.com/install.sh -o install.sh`
3. Compare `shasum -a 256 install.sh` with https://api.ocm.getdasha.com/install.sh.sha256 — stop if they differ.
4. Read install.sh (~340 lines). It writes only to `/opt/ocm`, `/etc/ocm`, and `/Library/LaunchDaemons`.
5. `brew install uv` first if Homebrew is present (skips the root-shell uv step).
6. Ask the human for an **enrollment code** from the console under **Enroll a Mac** (`ocm_enroll_…`, 15 min, once). Do not ask them to paste a provider token onto argv or into shell history.
7. Install (keep `OCM_AGENT_ID` stable across reinstalls). The installer prompts with typing hidden:

```bash
sudo OCM_AGENT_ID="a-stable-name" sh install.sh
```

Never put the code or a token on the command line. If you cannot drive an interactive prompt, ask the human to run that one line and paste the code when asked.

8. Confirm: `/opt/ocm/bin/ocm-agent-run --doctor` (expect `token ok`). First serve can take ~90s while the model loads.
9. Rotate later: `sudo /opt/ocm/bin/ocm-agent-token` (prompts; or pipe on stdin). Never argv. Do not edit `/opt/ocm/bin/ocm-agent-run` (generated; holds no token).
10. Update later (no retype): `sudo /opt/ocm/bin/ocm-agent-update` — reads settings/token on disk, fetches installer + checksum, runs doctor before replace. Add `--check` to only look.

## Success
- doctor: token ok
- Machine listed on the console under Your providers
- Status may show Cold/Ready/Serving — enrolled there is **not** the same as Community `providers_online` advertising

## If stuck
- REFUSED BY GATEWAY → new enrollment code under Enroll a Mac
- “a developer key…” → you used `ocm_live_`
- Connected but not listed → `--doctor` for missing models
- First request ~90s → Cold load, not a fault
