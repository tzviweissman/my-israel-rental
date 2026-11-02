# Hooks run by ~/.claude/settings.json

Copies of the hooks in `~/.claude/hooks/`, kept here so they are in one place with the rules they enforce
(1 Nov 2026). `.claude/hooks` is gitignored, so they live here. Edit both copies together;
`node scripts/check-rule-copies.mjs` says when they differ.

- `ideas-gate.mjs`: no paid generation or idea sketch until check-ideas passes (rules 0b.4).
- `film-gate.mjs`: no paid video until the brief has "How it really happens", "Key moment", the object list and approval (rules 3h.21).
