# Merged branch cleanup — November 3

GitHub remote branches reduced from26to1: only `main` remains. All25removed branch tips were verified ancestors of main at `cc448cea48fe9dc43411f1aa07ad72b50938de2f`. Matching local branches had no commits unique from main, and their checked-out worktrees had no tracked edits. Deletion was atomic and used expected-tip leases, so a concurrently updated branch would have prevented the cleanup rather than losing that update.

All local branches and worktrees were preserved, including unrelated developer work with tracked edits or unavailable worktree paths. No commits, source files, deployment, video or repository visibility settings were removed or changed by the remote-ref cleanup. The full server audit is privately retained under `/srv/hackathon/artifacts/branch-cleanup-20261103-audit.json`.

## Recovery references

These commits remain reachable through main. If a branch name is needed again, first fetch current main and then explicitly push its recorded commit to the desired branch name. Local refs also remain available. For new work, create a fresh branch from current main rather than recreating an old completed branch by accident.

| Removed remote branch | Recorded tip |
| --- | --- |
| `docs/demo-edit-and-cost-check-20261102` | `39d9d3cd8976ca1be5d417f11cbd164bded050e5` |
| `docs/demo-video-02-20261103` | `ca2f68b2dc48c8e93804501a3282c1a2cf9f4bc1` |
| `docs/demo-video-03-and-judge-prep` | `998c13ff50d65e39cd32c1386ac66ac21d292717` |
| `docs/demo-video-04-homepage` | `eacd2ddb48e38059f7539e648b3c3b2f9a349362` |
| `docs/demo-video-05-meeting-flow` | `3f94cc7a17107bdbeba67428bec977af2fb19afc` |
| `docs/judge-ready-video06` | `742b718c07967d6d4ee867c66439c4c7f5276f2f` |
| `docs/readme-dark-gif` | `cc448cea48fe9dc43411f1aa07ad72b50938de2f` |
| `docs/repo-showcase` | `0ebc44fc875eab8ce038e38821abd7e02536ae61` |
| `feature/demo-audio` | `a360a9884878b026010702bd5354e0854dc12526` |
| `feature/optional-join-greeting` | `2e7cb05ddfcfc052ab7533341632b94be9858595` |
| `feature/public-judge-demo` | `fffb4e3960f8e1d1eb65f7f5c93b9cedf1d04f0e` |
| `feature/simulated-regular-demo` | `5e2d6e23e4c54f5d39e362adb5e0b59b1d79ab62` |
| `feedback/demo-polish-20261030` | `2c8c0f5ccc278c4997ae1933b178f6e6cc10f86b` |
| `feedback/voice-listening-20261102` | `0439db57a373a4fc126982258bc23c8af3c859c2` |
| `fix/require-teams-invite-20261030` | `a2278e0169aa18321e89532b0166716acb5d9530` |
| `fix/theme-and-spacing-polish` | `a40deb98c14ab8f47a882cda45fb2a2dcf720756` |
| `fix/welcome-checkbox-visibility` | `23d31f4a0f8f607e54c9d60102176ea16b134785` |
| `polish/first-screen-fit-20261030` | `e6bea1de6e5e70f51fa145e20d5d6dd9f384db99` |
| `polish/hero-balance-20261030` | `010f547f3f4cabed8d96c811fb666b65f31bc7f7` |
| `polish/meta-cards-20261030` | `8205ab4305fcab9696e139f3e2b5fcb0c8bba688` |
| `polish/meta-showcase-20261030` | `883e8d35043b00617ba016a9d126eeac6d060db8` |
| `polish/rally-mascot-20261030` | `ef98b37e71eb1434ec6ebecc4d00dd7065dec23d` |
| `polish/remove-participant-setup-20261030` | `73dfd27552a47777e9772b58a84b0f11d6757e8f` |
| `research/meeting-market-20261102` | `086d40c29d23373b4205eadb1e44ad72181d131b` |
| `security/mfa-admin-20261030` | `1892f5dcc00ceea66ef604c046fd67d07859a37f` |
