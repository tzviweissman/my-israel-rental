"""Type-coverage gate.

Guards against annotation regressions. Shells out to mypy with our
pragmatic config (`disallow_untyped_defs = True`) and asserts exit code 0.

Run explicitly:
    cd /app/backend && pytest tests/test_type_coverage.py -v

Scope: the backend app code only. Tests themselves are exempt (see mypy.ini
[mypy-tests.*] section).

Why this matters:
- Guarantees every public function in server.py, routes/, and utils/ has a
  signature annotation so IDE autocomplete & refactor tools stay useful.
- Catches common real bugs that come with annotations (e.g. calling .split
  on Optional[str]).
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent


@pytest.mark.skipif(shutil.which("mypy") is None, reason="mypy not installed")
def test_mypy_clean() -> None:
    """mypy must exit cleanly over server.py / routes/ / utils/ / models.py."""
    cfg = BACKEND / "mypy.ini"
    assert cfg.exists(), f"missing mypy config at {cfg}"

    cmd = [
        "mypy",
        "--config-file", str(cfg),
        "--no-error-summary",
        "--no-pretty",
        "server.py",
        "routes/",
        "utils/",
        "models.py",
    ]
    result = subprocess.run(cmd, cwd=str(BACKEND), capture_output=True, text=True)
    assert result.returncode == 0, (
        "mypy type check failed — new code is missing annotations or has "
        "type errors.\n\n"
        f"{result.stdout}\n{result.stderr}"
    )
