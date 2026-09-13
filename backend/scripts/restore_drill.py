"""Restore drill: prove a production backup can actually be restored.

A backup nobody has restored is a hope, not a backup. This takes a logical
backup of production, restores it into a THROWAWAY database on the local
mongod, checks the restore against the backup itself, reports how long it
took, and then deletes everything it made.

WHAT IT WILL NEVER DO

  * Write to production. Production is only ever the SOURCE of mongodump and
    of read-only lookups. mongorestore is pointed at localhost, and the script
    refuses to start if the restore target is anything else.
  * Touch the local dev database. The restore goes into a new database named
    restore_test_<UTC timestamp>; if that name already exists it stops.
  * Print the connection string. It is read from backend/.env.restore (which
    .gitignore covers via `.env.*`) and passed to mongodump through a
    temporary config file, not on the command line, so it is not in the
    process list either. Error text is scrubbed of credentials before display.
  * Leave customer data lying around. The throwaway database is dropped and
    the dump directory deleted in a `finally`, pass or fail. Use --keep only
    when a human is going to inspect the copy and delete it by hand.
  * PASS WITHOUT VERIFYING ANYTHING. The first version parsed mongodump's log
    text for its counts, found none, and reported "0 collections, 0 documents,
    PASS" against a source of 48 collections. A drill that can pass vacuously
    would tell you a broken backup is fine. So counts now come from the dump
    FILES, and the run FAILS if the backup is empty, if it is empty while the
    source is not, or if any non-empty source collection is missing from it.

WHY IT CHECKS AGAINST THE DUMP, NOT AGAINST PRODUCTION

Production keeps taking writes while this runs. Comparing the restored copy
with live production would report every order placed during the dump as a
restore failure. The dump is the thing being tested, so the dump is ground
truth: counts are read out of the dump files, and sample documents are
decoded straight from them and compared field for field.

WHAT THIS DOES NOT TEST

Atlas's own cloud backups (snapshots, point-in-time restore). Those live in
the Atlas project, need Atlas access, and do not exist at all on the free M0
tier. This drill tests the logical-backup path, which works on every tier and
is the one you control.

SETUP

  backend/.env.restore:
      PROD_MONGO_URL=mongodb+srv://<read-only user>:<password>@<cluster>/
      PROD_DB_NAME=myisraelrental

  Use a READ-ONLY database user if you can: then even a bug here could not
  write to production. The machine's public IP must be on the Atlas project's
  network access list.

USAGE

  backend/.venv/Scripts/python.exe backend/scripts/restore_drill.py --preflight
      Connects read-only and lists collections and counts. Nothing is copied.

  backend/.venv/Scripts/python.exe backend/scripts/restore_drill.py
      The full drill.
"""
from __future__ import annotations

import argparse
import gzip
import json
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ENV_FILE = REPO / "backend" / ".env.restore"
TOOLS = Path("C:/Program Files/MongoDB/Tools/100/bin")
LOCAL_URI = "mongodb://127.0.0.1:27017"
LOCAL_DEV_DB = "israel_rental_dev"
# A drill must not wander into the other database that lives on the cluster.
NEVER_SOURCE = {"sample_mflix", "admin", "local", "config"}
SAMPLES_PER_COLLECTION = 3


def scrub(text: str) -> str:
    """Remove anything that looks like credentials from a message."""
    out = []
    for token in str(text).split():
        if "://" in token and "@" in token:
            scheme, rest = token.split("://", 1)
            token = f"{scheme}://<redacted>@{rest.split('@', 1)[1]}"
        out.append(token)
    return " ".join(out)


def load_env() -> tuple[str, str]:
    if not ENV_FILE.exists():
        # A fixed string, not ENV_FILE.relative_to(REPO): that raises its own
        # ValueError when the path is outside the repo, and a message whose
        # whole job is to stop cleanly must not be able to crash instead.
        sys.exit("STOP: backend/.env.restore does not exist. See SETUP at the top of this file.")
    cfg = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.strip().strip('"').strip("'")
    url = cfg.get("PROD_MONGO_URL", "")
    db = cfg.get("PROD_DB_NAME", "myisraelrental")
    if not url:
        sys.exit("STOP: PROD_MONGO_URL is not set in backend/.env.restore.")
    if "localhost" in url or "127.0.0.1" in url:
        sys.exit("STOP: PROD_MONGO_URL points at localhost. A drill of the local database proves nothing.")
    if db in NEVER_SOURCE:
        sys.exit(f"STOP: refusing to drill the '{db}' database.")
    return url, db


def dump_counts(dump_dir: Path, db: str) -> dict[str, int]:
    """Documents per collection, counted out of the dump files themselves.

    Not parsed from mongodump's log output: that text varies between tool
    versions and output streams, and parsing it is how the first version of
    this drill counted zero collections and still reported a pass.
    """
    import bson
    folder = dump_dir / db
    counts: dict[str, int] = {}
    if not folder.is_dir():
        return counts
    for path in sorted(folder.glob("*.bson.gz")):
        name = path.name[: -len(".bson.gz")]
        with gzip.open(path, "rb") as fh:
            counts[name] = sum(1 for _ in bson.decode_file_iter(fh))
    return counts


def dump_samples(dump_dir: Path, db: str, coll: str) -> list[dict]:
    """The first few documents of a collection, decoded straight from the dump."""
    import bson
    path = dump_dir / db / f"{coll}.bson.gz"
    if not path.exists():
        return []
    out = []
    with gzip.open(path, "rb") as fh:
        for doc in bson.decode_file_iter(fh):
            out.append(doc)
            if len(out) >= SAMPLES_PER_COLLECTION:
                break
    return out


def dump_index_names(dump_dir: Path, db: str, coll: str) -> set[str]:
    path = dump_dir / db / f"{coll}.metadata.json.gz"
    if not path.exists():
        return set()
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        meta = json.load(fh)
    return {ix.get("name") for ix in meta.get("indexes", []) if ix.get("name")}


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--preflight", action="store_true", help="read-only connection check; copies nothing")
    ap.add_argument("--keep", action="store_true", help="do not drop the throwaway database or delete the dump")
    args = ap.parse_args()

    from pymongo import MongoClient

    url, src_db = load_env()

    # ── Preflight: can we reach production, read-only? ───────────────────────
    try:
        src = MongoClient(url, serverSelectionTimeoutMS=15000)
        names = sorted(src[src_db].list_collection_names())
        source_counts = {n: src[src_db][n].estimated_document_count() for n in names}
    except Exception as e:  # noqa: BLE001 - shown to a human, scrubbed
        sys.exit(f"STOP: could not read production: {type(e).__name__}: {scrub(e)}\n"
                 "Usual causes: this machine's IP is not on the Atlas network access list, "
                 "or the user or password is wrong.")
    source_total = sum(source_counts.values())
    print(f"source database '{src_db}': {len(names)} collections, approx {source_total} documents")
    if args.preflight:
        for n in names:
            print(f"   {source_counts[n]:>7}  {n}")
        print("preflight OK. Nothing was copied.")
        return

    # ── Target safety ───────────────────────────────────────────────────────
    target_db = "restore_test_" + datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    assert LOCAL_URI.startswith("mongodb://127.0.0.1"), "restore target must be localhost"
    assert target_db != LOCAL_DEV_DB and target_db.startswith("restore_test_")
    local = MongoClient(LOCAL_URI, serverSelectionTimeoutMS=5000)
    if target_db in local.list_database_names():
        sys.exit(f"STOP: {target_db} already exists locally.")

    work = Path(tempfile.mkdtemp(prefix="restore_drill_"))
    dump_dir = work / "dump"
    cfg = work / "source.yaml"
    cfg.write_text(f"uri: {url}\n", encoding="utf-8")

    try:
        # ── 1. Back up the source (read-only) ────────────────────────────────
        t0 = time.monotonic()
        d = run([str(TOOLS / "mongodump.exe"), f"--config={cfg}", f"--db={src_db}",
                 f"--out={dump_dir}", "--gzip"])
        dump_s = time.monotonic() - t0
        cfg.unlink(missing_ok=True)  # the only file holding the secret, gone as soon as it is used
        if d.returncode != 0:
            sys.exit(f"FAIL: mongodump exited {d.returncode}: {scrub(d.stderr)[-800:]}")
        dumped = dump_counts(dump_dir, src_db)
        dumped_total = sum(dumped.values())
        print(f"\n1. backup: {len(dumped)} collections, {dumped_total} documents, {dump_s:.1f}s")

        # A backup that holds nothing cannot pass, however the rest goes.
        if not dumped:
            sys.exit("FAIL: the backup contains no collections, so nothing could be verified.\n"
                     f"mongodump said: {scrub(d.stderr)[-600:] or '(nothing)'}")
        if dumped_total == 0 and source_total > 0:
            sys.exit(f"FAIL: the backup holds 0 documents but the source has about {source_total}.")
        missing = sorted(n for n, c in source_counts.items()
                         if c > 0 and not n.startswith("system.") and n not in dumped)
        if missing:
            print(f"   MISSING from the backup (non-empty in the source): {', '.join(missing)}")

        # ── 2. Restore into the throwaway local database ─────────────────────
        t0 = time.monotonic()
        r = run([str(TOOLS / "mongorestore.exe"), f"--uri={LOCAL_URI}",
                 f"--nsInclude={src_db}.*", f"--nsFrom={src_db}.*", f"--nsTo={target_db}.*",
                 "--gzip", str(dump_dir)])
        restore_s = time.monotonic() - t0
        if r.returncode != 0:
            sys.exit(f"FAIL: mongorestore exited {r.returncode}: {scrub(r.stderr)[-800:]}")
        print(f"2. restore into local '{target_db}': {restore_s:.1f}s")

        # ── 3. Verify the restore against the dump ───────────────────────────
        print("\n3. verification (restored copy vs the backup itself)")
        print(f"   {'collection':<34}{'backup':>8}{'restored':>10}  samples  indexes")
        problems = len(missing)
        verified_docs = 0
        for coll in sorted(dumped):
            want = dumped[coll]
            got = local[target_db][coll].count_documents({})
            samples = dump_samples(dump_dir, src_db, coll)
            sample_ok = all(local[target_db][coll].find_one({"_id": s["_id"]}) == s for s in samples)
            idx_want = dump_index_names(dump_dir, src_db, coll)
            idx_got = {ix["name"] for ix in local[target_db][coll].list_indexes()} if got or idx_want else set()
            idx_ok = idx_want <= idx_got
            ok = (want == got) and sample_ok and idx_ok
            problems += 0 if ok else 1
            verified_docs += got if ok else 0
            print(f"   {coll:<34}{want:>8}{got:>10}  {'ok' if sample_ok else 'DIFF':<7}  "
                  f"{'ok' if idx_ok else 'MISSING ' + ','.join(sorted(idx_want - idx_got))}"
                  f"{'' if ok else '   <-- PROBLEM'}")

        passed = problems == 0 and verified_docs == dumped_total and dumped_total > 0
        print(f"\nRESULT: {'PASS' if passed else 'FAIL'} - {len(dumped)} collections and "
              f"{verified_docs} of {dumped_total} documents verified, {problems} problem(s)")
        print(f"recovery time for a logical restore of this size: about {dump_s + restore_s:.0f}s "
              f"(backup {dump_s:.0f}s + restore {restore_s:.0f}s)")
        if not passed:
            sys.exit(1)
    finally:
        cfg.unlink(missing_ok=True)
        if args.keep:
            print(f"\n--keep: left '{target_db}' in local mongod and the dump at {work}. Delete both by hand.")
        else:
            try:
                local.drop_database(target_db)
            except Exception as e:  # noqa: BLE001
                print(f"WARNING: could not drop {target_db}: {scrub(e)}")
            shutil.rmtree(work, ignore_errors=True)
            gone = target_db not in local.list_database_names() and not work.exists()
            print(f"\ncleanup: throwaway database dropped and dump deleted: {'yes' if gone else 'NO - check by hand'}")


if __name__ == "__main__":
    main()
