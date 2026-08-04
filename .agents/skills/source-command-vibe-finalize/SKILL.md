---
name: "source-command-vibe-finalize"
description: "Graduate the project after init - move one-time bootstrap files into _vibekit-cleanup/ for deletion. Reversible; refuses to run on the kit source repo."
---

# source-command-vibe-finalize

Use this skill when the user asks to run the migrated source command `vibe-finalize`.

## Command Template

# vibe-finalize

Graduate this project once init and the first prompt are complete. Run `node .vibekit/scripts/vibekit-finalize.mjs . --propose` to preview, then `--write --yes` to move one-time bootstrap files (.vibekit/init/FIRST_TIME_INIT.md, .vibekit/init/FIRST_PROMPT.md, .vibekit/init/PUSH_TO_GITHUB.md, .vibekit/init/Codex-template.md) into `_vibekit-cleanup/` for deletion. It refuses to run on the kit source repo and is reversible with `--restore --write`.
