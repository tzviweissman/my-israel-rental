# Site reviews, 21 Oct 2026

Tzvi: "run all the rules and new video lessons and audits to all our already built pages and show me side by side comparisons what you would change". Every built site was reviewed against the page rules and the nine re-watched videos (docs/ui-videos/notes/r3). For each, the proposed version is in its folder here (the changed html/css/js only; photos come from scrollcraft/builds/<site>) with changes.json listing each change, why, and the owner questions.

The comparison page Tzvi sees is the artifact https://claude.ai/artifact/CVVVfcWNqZHAoaXjLwFK85 .

Nothing here is live. To adopt a change, make it in the site's generator (gen/) or built files, run the checks, and publish with scripts/publish-page.mjs. To see a proposal: `node pair.mjs`-style serving with serve-overlay.mjs <this folder>/<site> scrollcraft/builds/<site> <port>.
