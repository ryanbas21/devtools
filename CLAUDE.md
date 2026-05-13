## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on `ryanbas21/devtools`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses default label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Effect reference source

The Effect repository is vendored at `repos/effect/` as a git subtree (read-only reference material). Use it to explore APIs, find usage examples, and understand implementation details. **Never modify files under `repos/`.**

To update the vendored source:

```bash
git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git main --squash
```
