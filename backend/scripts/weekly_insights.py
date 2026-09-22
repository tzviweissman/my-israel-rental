"""Dry run of the Monday "how your listings did" email (routes/weekly_insights).

Lists who would get it this week and why the rest would not, and writes
one English and one Hebrew email to preview in a browser. Sends nothing
and writes nothing to the database.

    python -m scripts.weekly_insights                  # dry run, prints the list
    python -m scripts.weekly_insights --html OUT_DIR   # also writes the two previews
"""
import asyncio
import collections
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from routes import weekly_insights as wi  # noqa: E402
from routes.deps import db  # noqa: E402


async def main() -> None:
    print(f"database: {db.name} | dry run, nothing is sent")
    report = await wi.run(dry_run=True)
    tally = collections.Counter(r["result"] for r in report)
    print(f"week {report[0]['week'] if report else '-'}: " + ", ".join(f"{k} {v}" for k, v in tally.most_common()))
    for r in report:
        if r["result"] in ("would_send", "already_sent"):
            s = r["stats"]
            bits = [f"{half}: " + " ".join(f"{k}={m['n']}" + (f"(was {m['before']})" if m["before"] is not None else "")
                                           for k, m in s[half].items()) for half in ("services", "rentals") if s[half]]
            print(f"  {r['result']:12} {r['lang']} {r['email']}  " + " | ".join(bits))

    if "--html" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--html") + 1])
        out.mkdir(parents=True, exist_ok=True)
        # The fullest one: a person with both a business and rentals, if any.
        sample = max((r for r in report if r["result"] in ("would_send", "already_sent")),
                     key=lambda r: sum(bool(h) for h in r["stats"].values()), default=None)
        if not sample:
            print("no one to preview")
            return
        w = wi.week_windows(__import__("datetime").datetime.now(wi.UTC))
        for lang in ("en", "he"):
            subject, html = wi.render("Dev", sample["stats"], w, lang, f"{wi.FRONTEND_URL}/insights-emails-off?t=preview")
            (out / f"weekly-{lang}.html").write_text(html, encoding="utf-8")
            print(f"  {lang}: {subject}  -> {out / f'weekly-{lang}.html'}")


asyncio.run(main())
