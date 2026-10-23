"""Table QR codes (routes/marketplace/tables.py): only the printed code orders to a table."""
from routes.marketplace.tables import table_code, table_ok

BIZ = {"_id": "b1", "table_ordering": {"on": True, "tables": 10, "key": "k" * 32}}


def test_only_the_printed_code_orders_to_a_table():
    good = table_code(BIZ, 5)
    assert table_ok(BIZ, 5, good)
    assert not table_ok(BIZ, 5, None)            # a guessed ?table=5 link
    assert not table_ok(BIZ, 6, good)            # table 5's code on table 6
    assert not table_ok(BIZ, 11, table_code(BIZ, 11))   # past the number of tables
    assert not table_ok({**BIZ, "table_ordering": {**BIZ["table_ordering"], "on": False}}, 5, good)
    assert not table_ok({"_id": "b1", "table_ordering": {"on": True, "tables": 10}}, 5, "")  # no key yet
