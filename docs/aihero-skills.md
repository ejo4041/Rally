# AI Hero repository skills

Installed October 28, 2026 from [Matt Pocock’s official collection](https://skills.sh/mattpocock/skills), linked by [AI Hero](https://www.aihero.dev/open-source).

## Installation

Repo-local location: `.agents/skills/`. No global installation or product changes.

Requested: `grill-with-docs`, `to-spec`, `implement`, `code-review`.

Included direct supporting skills: `grilling` and `domain-modeling` for `grill-with-docs`; `tdd` for `implement`.

Installed unmodified with the Codex skill-installer helper, pinned to upstream commit `59db609eb1e18aaf59b63284d0e52255aff0c63c` (package version 1.3.1). Supporting files and OpenAI agent metadata are included. MIT attribution is preserved in `.agents/skills/LICENSE.mattpocock`; source paths and SHA-256 file hashes are in `.agents/skills/upstream-lock.json`.

## Usage and limits

Available on the next turn. Invoke the requested skill by name, for example `$grill-with-docs` or `$implement`.

This installs guidance; it does not execute the workflows. Existing AGENTS.md rules continue to apply. No tracker was configured, spec published, code committed, or review subagents launched during installation. `to-spec` and `code-review` expect tracker context and otherwise refer to the optional upstream `setup-matt-pocock-skills` workflow, which is not installed. TDD may refer to the optional `codebase-design` skill when interface design is uncertain; that skill is not installed either. Configure those only when needed for future work.

## Verification

All seven installed skill directories and every included file were compared byte-for-byte with the pinned upstream checkout; all matched. No application tests were necessary for this documentation and skill installation. Actual skill invocation and runtime discovery have not been exercised in this turn. No Muse calls or spending.
