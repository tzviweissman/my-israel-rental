# Review one finished business site against every rule and video lesson, and show the proposed changes side by side

Tzvi: "run all the rules and new video lessons and audits to all our already built pages and show me side by side comparisons what you would change to enhance them". You do one site. You do NOT change the real site: you make a proposed copy and pictures comparing it with the real one.

Paths below: R = C:\Users\tzviw\Documents\my-israel-rental, S = C:\Users\tzviw\AppData\Local\Temp\claude\C--Users-tzviw-Documents-my-israel-rental\1bdff3b6-6465-411c-891d-3a47066435e5\scratchpad

## 1. Serve the real site and an editable copy
- Real: run in the background from the build folder: `python -m http.server <P> --bind 127.0.0.1` (P given to you).
- Copy: make `S\after\<site>\` and copy into it ONLY the build folder's top-level `*.html`, `*.css`, `*.js` files (never the media; never gen/). Serve it in the background with `node S/serve-overlay.mjs S/after/<site> <build folder> <P+1>`; it serves your copy first and the original's photos and videos for everything else. Use forward slashes in paths for node.
- Edit only the copy's files (directly in the html/css/js). Never edit anything in the build folder or anywhere else in R.

## 2. Find what to change
Read, in this order:
1. R\docs\page-review-checklist.md and the rule sections of R\docs\page-generation-rules.md from "## 3" onwards (skim the history; the rules are the bold lines and numbered points). Key ones: 3c (one screen, honest persuasion), 3e, 3j (deals shown as money: old price struck through + "Save ₪X"), 3k (website with menu bar, Shop/Book page as a product page, orders in steps with a remove button on every basket line), 3l (similar items clear), 3p, 3s (the 18 craft rules and prices).
2. The "## For our pages" sections of the nine files R\docs\ui-videos\notes\r3\{qJ4qYhTqAz0,V77dzdX8uQs,oYskl2ZBoBc,AH_ugxmLeUM,7pviK2SBpGg,yH0QwDpV4ZM,U7jTCgIWS4w,OKOingYdtVw,GGg61sdEjeI}.md.
3. R\docs\ui-videos\notes\r3\apply-whipped-cup.md "Top fixes" as an example of the kind of findings wanted.
4. The site itself: every page, at 1440x900 and 390x844 (screenshot it with Playwright from R: `createRequire('R/')('playwright')`), and its BRIEF / CONCEPT / message-to-owner files for what the owner told us.
5. Run the checkers on the real site from R: `node scripts/check-site.mjs <url>`, `node scripts/check-fits.mjs <url>`, `node scripts/check-motion.mjs <url>` for each page. What they report is a finding.

Pick the 8 to 12 changes that would most make this site look and work like a professional, high-end site, the biggest first. Each must be concrete and visible.

## 3. Hard limits
- No invented facts: no reviews, ratings, counts, "best seller"/"most popular", years, delivery areas, fees, guarantees, payment or cancellation terms that are not already on the site or in its files. A change that needs one becomes a question for the owner, not a change.
- Savings only as money; no percentages; no long dashes; no exclamation marks; the business says "we" (or "I" if it is one person and the site already does), never "they".
- Keep each site's signature effect and opening as they are (Tzvi chose them); you may improve what is around them.
- Every section must still fit one screen at 1280x650 and on a phone; motion for controls under 0.5 s; text contrast at least 4.5:1.
- These are live sites: do not publish, commit, push or touch R.

## 4. Make the changes in the copy, check them, picture them
- Make each change in the copy. Run check-site and check-fits on the copy's URL (P+1) and fix what they report.
- For each change make one picture with `node S/pair.mjs <real url> <copy url> S/compare/<site>/NN.jpg <laptop|phone> <css selector or scrollY of the area> ["<js to run first, e.g. open the basket>"]` (run from R). Look at every picture yourself; if the change is not clearly visible in it, pick a better area or a phone view.
- Write `S/compare/<site>/changes.json`: `{"site": "<business name>", "changes": [{"img": "01.jpg", "title": "<what changes, plain words, under 12 words>", "why": "<one sentence: the problem now and the rule or video lesson behind the fix>"}], "questions": ["<plain question for the owner>", ...], "checks_now": "<one line: what the checkers found on the real site>"}`. Plain words for a non-technical reader; no file names or CSS in titles or whys.

Stop the two servers when done. Reply with only: the number of changes, the number of questions, and anything that blocked you.
