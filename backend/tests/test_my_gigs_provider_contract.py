"""Every `provider.<field>` the dashboard reads must be in the payload.

`GET /marketplace/my-gigs` hand-picks the provider fields it returns rather
than sending the document. That's the right call — the provider row holds
billing internals that have no business in a browser — but it means the
frontend can read a field the endpoint simply never sends, and nothing
anywhere fails. The value is just `undefined`, so the UI quietly takes the
wrong branch.

That has now happened twice in one day:

* `users.whatsapp_number` was read by the property detail endpoint while
  Settings wrote `users.phone`, so the WhatsApp button was dead for every
  owner.
* `provider.paypal_subscription_status` was read by MyGigsTab to render the
  cancelled state, and `/my-gigs` didn't include it — so a successful
  cancellation looked like nothing had happened, and the Upgrade button
  never came back.

Both were invisible in review because each side looked correct alone. This
test reads the two files and compares them.
"""
from __future__ import annotations

import pathlib
import re

import pytest

REPO = pathlib.Path(__file__).resolve().parent.parent.parent
GIGS_PY = REPO / "backend" / "routes" / "marketplace" / "gigs.py"
MY_GIGS_TAB = REPO / "frontend" / "src" / "components" / "dashboard" / "MyGigsTab.jsx"

# Fields the component derives locally rather than reading off the payload.
IGNORE: set[str] = set()


def _payload_fields() -> set[str]:
    """Keys in the `"provider": { … }` literal returned by /my-gigs."""
    src = GIGS_PY.read_text(encoding="utf-8")
    start = src.index('"provider": {')
    # First line that closes the dict at the same nesting level.
    end = src.index("\n        },", start)
    block = src[start:end]
    return set(re.findall(r'"([a-z_]+)":', block)) - {"provider"}


def _fields_read_by_ui() -> set[str]:
    """`provider.x` / `provider?.x` accesses in the dashboard component."""
    src = MY_GIGS_TAB.read_text(encoding="utf-8")
    return set(re.findall(r"provider\??\.([a-zA-Z_][a-zA-Z0-9_]*)", src)) - IGNORE


def test_collectors_find_something() -> None:
    """A regex that silently stops matching would make this test vacuous."""
    assert GIGS_PY.exists() and MY_GIGS_TAB.exists()
    assert _payload_fields(), "no fields parsed from the /my-gigs provider payload"
    assert _fields_read_by_ui(), "no provider.* reads found in MyGigsTab"


@pytest.mark.parametrize("field", sorted(_fields_read_by_ui()))
def test_ui_field_is_actually_sent(field: str) -> None:
    sent = _payload_fields()
    assert field in sent, (
        f"MyGigsTab reads provider.{field}, but GET /marketplace/my-gigs does "
        f"not send it — the value will be undefined and the UI will take the "
        f"wrong branch with no error anywhere. Either add {field!r} to the "
        f"provider payload in routes/marketplace/gigs.py, or stop reading it.\n"
        f"Currently sent: {', '.join(sorted(sent))}"
    )
