"""Contracts kept in private Cloudinary, the disk only a cache
(utils/contract_files, 18 Oct 2026). Cloudinary is replaced by a dict here,
so nothing leaves the machine. Needs the local MongoDB."""
import asyncio
import os
import sys
import uuid
from pathlib import Path

import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

LOCAL = any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1"))
pytestmark = pytest.mark.skipif(not LOCAL, reason="needs the local MongoDB")


@pytest.fixture
def cloud(monkeypatch):
    import utils.contract_files as cf
    store: dict[str, bytes] = {}

    async def upload(content, *, public_id_hint):
        store[f"{cf.CONTRACT_FOLDER}/{public_id_hint}"] = content
        return {"public_id": f"{cf.CONTRACT_FOLDER}/{public_id_hint}", "bytes": len(content)}

    async def fetch(public_id):
        return store.get(public_id)

    def delete(public_id):
        store.pop(public_id, None)
        return True

    monkeypatch.setattr(cf, "CLOUDINARY_ENABLED", True)
    monkeypatch.setattr(cf, "upload_contract_to_cloudinary", upload)
    monkeypatch.setattr(cf, "fetch_contract_from_cloudinary", fetch)
    monkeypatch.setattr(cf, "delete_contract_from_cloudinary", delete)
    return store


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _new_file(text=b"%PDF-1.4 test contract"):
    from routes.deps import CONTRACT_DIR
    path = CONTRACT_DIR / f"test-cloud-{uuid.uuid4()}.pdf"
    path.write_bytes(text)
    return path


def test_a_kept_contract_survives_losing_the_disk(cloud):
    import utils.contract_files as cf
    path = _new_file()
    _run(cf.keep_contract_file(path))
    assert cloud[cf.contract_cloud_id(path.name)] == path.read_bytes()
    path.unlink()  # what a redeploy without the volume does
    back = _run(cf.ensure_contract_file(f"/api/uploads/{path.name}"))
    try:
        assert back is not None and back.name == path.name and back.read_bytes() == b"%PDF-1.4 test contract"
    finally:
        cf.forget_contract_file(path.name)
    assert cf.contract_cloud_id(path.name) not in cloud and not path.exists()


def test_a_migrated_row_falls_back_to_its_own_public_id(cloud):
    import utils.contract_files as cf
    cloud["myisraelrental/contracts/contract-prop-1"] = b"migrated in july"
    name = f"contract_{uuid.uuid4()}.pdf"
    back = _run(cf.ensure_contract_file(f"/api/uploads/{name}", public_id="myisraelrental/contracts/contract-prop-1"))
    try:
        assert back.read_bytes() == b"migrated in july"
    finally:
        back.unlink()


def test_a_save_that_cannot_be_made_durable_is_refused(cloud, monkeypatch):
    import utils.contract_files as cf
    from fastapi import HTTPException

    async def broken(content, *, public_id_hint):
        return None

    monkeypatch.setattr(cf, "upload_contract_to_cloudinary", broken)
    path = _new_file()
    try:
        with pytest.raises(HTTPException) as e:
            _run(cf.keep_contract_file(path))
        assert e.value.status_code == 503
    finally:
        path.unlink()


def test_a_path_trick_resolves_to_nothing(cloud):
    import utils.contract_files as cf
    assert _run(cf.ensure_contract_file("../../etc/passwd")) is None
    assert cf.contract_cloud_id("../../secret.pdf") == f"{cf.CONTRACT_FOLDER}/secret.pdf"


def test_startup_mirror_copies_each_file_once(cloud):
    import utils.contract_files as cf
    from routes.deps import CONTRACT_DIR
    path = _new_file(b"only on the volume")
    try:
        first = _run(cf.mirror_local_contracts())
        assert cloud[cf.contract_cloud_id(path.name)] == b"only on the volume"
        assert first["failed"] == 0 and first["copied"] >= 1
        second = _run(cf.mirror_local_contracts())
        assert second["copied"] == 0
    finally:
        cf.forget_contract_file(path.name)
        from pymongo import MongoClient
        db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        # Only this test's rows: the local disk has other files the mirror recorded.
        names = [p.name for p in CONTRACT_DIR.iterdir()] + [path.name]
        db.contract_cloud.delete_many({"_id": {"$in": names}})
