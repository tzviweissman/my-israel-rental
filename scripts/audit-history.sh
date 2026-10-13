#!/usr/bin/env bash
# Collect every audit report ever pushed, from every branch, into one folder,
# so an audit can see what earlier runs already found before it reports.
#
# Why: each cloud run pushes to its own claude/<name>-<random> branch, which
# nobody merges, so main's docs/audits stopped at 23 Sep 2026 while the
# audits kept running. Each run then saw none of the others and reported the
# same issues as new, night after night (found 12 Oct 2026).
#
#   bash scripts/audit-history.sh        # -> /tmp/prior-audits/, newest last
#
# Prints one line per report: date, kind, branch it lives on.
set -u
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT"
OUT=/tmp/prior-audits
rm -rf "$OUT"; mkdir -p "$OUT"
git fetch -q origin '+refs/heads/*:refs/remotes/origin/*' 2>/dev/null || echo "(fetch failed: only local branches are searched)"
for ref in $(git for-each-ref --format='%(refname)' refs/remotes/origin refs/heads); do
  for f in $(git ls-tree -r --name-only "$ref" -- docs/audits 2>/dev/null | grep -E '\.md$'); do
    name=$(basename "$f")
    [ -e "$OUT/$name" ] && continue   # the same report on several branches
    git show "$ref:$f" > "$OUT/$name" 2>/dev/null && echo "$name  ${ref#refs/remotes/}" >> "$OUT/INDEX"
  done
done
sort -o "$OUT/INDEX" "$OUT/INDEX" 2>/dev/null
# open-issues.md is edited by every run, so take the most recently changed copy.
best=0
for ref in $(git for-each-ref --format='%(refname)' refs/remotes/origin refs/heads); do
  t=$(git log -1 --format=%ct "$ref" -- docs/audits/open-issues.md 2>/dev/null)
  [ -n "$t" ] && [ "$t" -gt "$best" ] && best=$t && git show "$ref:docs/audits/open-issues.md" > "$OUT/open-issues.md"
done
cat "$OUT/INDEX" 2>/dev/null | tail -40
echo "($(wc -l < "$OUT/INDEX" 2>/dev/null || echo 0) reports in $OUT; open-issues.md there is the newest copy found)"
