# Skill: Host on OCM (Apple Silicon)

Paste this into your AI assistant to install the OCM provider agent on this Mac. It contributes idle GPU to the marketplace at https://www.getdasha.com/compute/ocm and earns credits (a token count, not money).

## Goal
Issue an `ocm_host_` token, install the agent safely, pass doctor, and appear under Your providers.

## Facts
- Guide: https://www.getdasha.com/compute/ocm/provider
- Console: https://www.getdasha.com/compute/ocm
- Installer: https://api.ocm.getdasha.com/install.sh (also sha256 next to it)
- Apple Silicon (arm64) + macOS 14+. One outbound connection — no inbound ports.
- Provider tokens start `ocm_host_`. Developer keys (`ocm_live_`) are refused.
- As a provider you can read every prompt routed here in plaintext; so can every other provider.

## Steps
1. `uname -m` must be arm64. Stop if not.
2. Download, do not pipe:
   `curl -fsSL https://api.ocm.getdasha.com/install.sh -o install.sh`
3. Compare `shasum -a 256 install.sh` with https://api.ocm.getdasha.com/install.sh.sha256 — stop if they differ.
4. Read install.sh (~190 lines). It writes only to `/opt/ocm`, `/etc/ocm`, and `/Library/LaunchDaemons`.
5. `brew install uv` first if Homebrew is present (skips the root-shell uv step).
6. Ask the human for a provider token from the console under **New provider token**.
7. Install (keep `OCM_AGENT_ID` stable across reinstalls):

```bash
sudo OCM_HOST_TOKEN="ocm_host_…" OCM_AGENT_ID="a-stable-name" sh install.sh
```

8. Confirm: `sudo /opt/ocm/bin/ocm-agent-run --doctor` (expect `token ok`). First serve can take ~90s while the model loads.
9. Rotate later with stdin only — never argv:
   `printf '%s' 'ocm_host_…' | sudo /opt/ocm/bin/ocm-agent-token`
   Do not edit `/opt/ocm/bin/ocm-agent-run` (generated; holds no token).

## Success
- doctor: token ok
- Machine listed on the console under Your providers

## If stuck
- REFUSED BY GATEWAY → new `ocm_host_` token
- “a developer key…” → you used `ocm_live_`
- Connected but not listed → `--doctor` for missing models
