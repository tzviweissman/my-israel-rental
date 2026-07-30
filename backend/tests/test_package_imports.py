"""Guard against `from <package> import <name>` that raises at runtime.

Why this exists
---------------
``routes/misc.py`` did ``from routes.marketplace import _ensure_provider_record``.
The 2026-07 refactor split the single-file ``marketplace.py`` into a package
and moved that helper into ``routes/marketplace/shared.py``; the package's
``__init__`` only re-exports ``router`` and the webhook handler. Nothing failed
at startup because the import was *lazy* (inside the request handler), so it
raised ImportError only when a user accepted the "Take Your Services to the
Next Level" upsell — no provider record, no trial, and the surrounding
``users`` update never ran either.

A whole-module import check would not have caught it, and neither would a
smoke test that never hits that one branch. This walks the AST instead, so
every ``from <local package> import <name>`` is verified whether or not any
test exercises the line.

Only *packages* are checked: a plain module can't have this failure mode, and
``from pkg import submodule`` is legal even when the package doesn't
pre-import the submodule, so that case is resolved before flagging.
"""
from __future__ import annotations

import ast
import importlib
import pathlib

import pytest

BACKEND = pathlib.Path(__file__).resolve().parent.parent

# Import roots owned by this repo. Third-party packages are out of scope --
# a broken one of those fails loudly at install time, not at request time.
LOCAL_ROOTS = {"routes", "utils", "models", "tests"}


def _local_packages() -> set[str]:
    return {
        str(p.parent.relative_to(BACKEND)).replace("\\", "/").replace("/", ".")
        for p in BACKEND.rglob("__init__.py")
        if ".venv" not in p.parts and "__pycache__" not in p.parts
    }


def _from_imports() -> list[tuple[pathlib.Path, int, str, str]]:
    """Every absolute `from <local package> import <name>` in the backend."""
    pkgs = _local_packages()
    out: list[tuple[pathlib.Path, int, str, str]] = []
    for f in BACKEND.rglob("*.py"):
        if ".venv" in f.parts or "__pycache__" in f.parts:
            continue
        try:
            tree = ast.parse(f.read_text(encoding="utf-8"))
        except (SyntaxError, UnicodeDecodeError):
            continue
        for node in ast.walk(tree):
            # `node.level` skips relative imports -- those resolve against the
            # containing package and can't drift the way absolute ones do.
            if not isinstance(node, ast.ImportFrom) or node.level:
                continue
            mod = node.module or ""
            if mod.split(".")[0] not in LOCAL_ROOTS or mod not in pkgs:
                continue
            for alias in node.names:
                if alias.name != "*":
                    out.append((f, node.lineno, mod, alias.name))
    return out


_IMPORTS = _from_imports()


def test_found_import_sites() -> None:
    """Fail loudly if the AST walk silently stops finding anything.

    Without this, a rename that breaks the collector would turn the real
    check below into a vacuous pass -- exactly how the mypy check managed to
    skip itself on every run while reporting success.
    """
    assert _IMPORTS, "collected no package imports; the collector is broken"


@pytest.mark.parametrize(
    ("path", "lineno", "module", "name"),
    _IMPORTS,
    ids=[f"{f.name}:{ln}:{mod}.{nm}" for f, ln, mod, nm in _IMPORTS],
)
def test_package_import_resolves(
    path: pathlib.Path, lineno: int, module: str, name: str
) -> None:
    mod = importlib.import_module(module)
    if hasattr(mod, name):
        return
    try:
        importlib.import_module(f"{module}.{name}")
    except Exception:  # noqa: BLE001 - any failure means the import is broken
        rel = path.relative_to(BACKEND)
        pytest.fail(
            f"{rel}:{lineno} does `from {module} import {name}`, but "
            f"`{module}` neither exports `{name}` nor has a `{name}` "
            f"submodule. Import it from the module that defines it, or "
            f"re-export it in {module.replace('.', '/')}/__init__.py."
        )
