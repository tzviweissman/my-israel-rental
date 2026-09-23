# Clarity report, 23 Sep 2026 (read-only, live public pages)

Run by `backend/scripts/clarity_report.py` with the check in `backend/utils/page_clarity.py` (docs/ai-page-builder-spec.md, P4a). Read through the live site's public API, the same data a visitor's browser loads: no database access, nothing written, nothing changed based on it.

**Caveats.** The live site has no business with 25 services (the most is 3) and none written only in Hebrew, so those two cases are the closest real ones: the business with the most services, and the one with the most Hebrew in its listings. The page brief is private, so every page read this way shows no leading action and no strengths; that is a limit of a public read, not a finding about the owners.

**Summary.** All five fail in both languages on the same two rules. *proof*: no reviews, not verified, no founding year, no kosher certificate, so nothing backs a reason to choose them. *action*: no brief visible (see caveat). All five pass *where*, *offer*, *strengths* and *hero* in English and Hebrew (Hebrew passes on the auto-translated service titles). The one thing to fix first, everywhere: proof. The quickest real lever is verification and a founding year, both of which the owner or an admin can add today.

## Tzvi Stein (one service, no photos)

1 services, 0 reviews, verified: False, founded: -, joined: 2026

**English: FAIL**, fix first: proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- pass where: Answers who, what and where.
- pass offer: 1 of 1 services named in this language.
- FAIL proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- FAIL action: No leading action chosen in the page brief.
- pass strengths: No strengths chosen.
- pass empty_states: Must read as intentional with no photos, reviews.
- pass hero: Hero text within limits.

**Hebrew: FAIL**, fix first: proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- pass where: Answers who, what and where.
- pass offer: 1 of 1 services named in this language.
- FAIL proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- FAIL action: No leading action chosen in the page brief.
- pass strengths: No strengths chosen.
- pass empty_states: Must read as intentional with no photos, reviews.
- pass hero: Hero text within limits.

## Goldie Granitsky (most services (3))

3 services, 0 reviews, verified: False, founded: -, joined: 2026

**English: FAIL**, fix first: proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- pass where: Answers who, what and where.
- pass offer: 3 of 3 services named in this language.
- FAIL proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- FAIL action: No leading action chosen in the page brief.
- pass strengths: No strengths chosen.
- pass empty_states: Must read as intentional with no reviews.
- pass hero: Hero text within limits.

**Hebrew: FAIL**, fix first: proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- pass where: Answers who, what and where.
- pass offer: 3 of 3 services named in this language.
- FAIL proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- FAIL action: No leading action chosen in the page brief.
- pass strengths: No strengths chosen.
- pass empty_states: Must read as intentional with no reviews.
- pass hero: Hero text within limits.

## Ravit hen (food business)

1 services, 0 reviews, verified: False, founded: -, joined: 2026

**English: FAIL**, fix first: proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- pass where: Answers who, what and where.
- pass offer: 1 of 1 services named in this language.
- FAIL proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- FAIL action: No leading action chosen in the page brief.
- pass strengths: No strengths chosen.
- pass empty_states: Must read as intentional with no reviews.
- pass hero: Hero text within limits.

**Hebrew: FAIL**, fix first: proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- pass where: Answers who, what and where.
- pass offer: 1 of 1 services named in this language.
- FAIL proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- FAIL action: No leading action chosen in the page brief.
- pass strengths: No strengths chosen.
- pass empty_states: Must read as intentional with no reviews.
- pass hero: Hero text within limits.

## The PATH Center (newest)

1 services, 0 reviews, verified: False, founded: -, joined: 2026

**English: FAIL**, fix first: proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- pass where: Answers who, what and where.
- pass offer: 1 of 1 services named in this language.
- FAIL proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- FAIL action: No leading action chosen in the page brief.
- pass strengths: No strengths chosen.
- pass empty_states: Must read as intentional with no reviews.
- pass hero: Hero text within limits.

**Hebrew: FAIL**, fix first: proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- pass where: Answers who, what and where.
- pass offer: 1 of 1 services named in this language.
- FAIL proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- FAIL action: No leading action chosen in the page brief.
- pass strengths: No strengths chosen.
- pass empty_states: Must read as intentional with no reviews.
- pass hero: Hero text within limits.

## SHLOMO GREENFELD (most Hebrew)

1 services, 0 reviews, verified: False, founded: -, joined: 2026

**English: FAIL**, fix first: proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- pass where: Answers who, what and where.
- pass offer: 1 of 1 services named in this language.
- FAIL proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- FAIL action: No leading action chosen in the page brief.
- pass strengths: No strengths chosen.
- pass empty_states: Must read as intentional with no reviews.
- pass hero: Hero text within limits.

**Hebrew: FAIL**, fix first: proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- pass where: Answers who, what and where.
- pass offer: 1 of 1 services named in this language.
- FAIL proof: Nothing to back a reason yet: no reviews, not verified, no founding year, no kosher certificate.
- FAIL action: No leading action chosen in the page brief.
- pass strengths: No strengths chosen.
- pass empty_states: Must read as intentional with no reviews.
- pass hero: Hero text within limits.

