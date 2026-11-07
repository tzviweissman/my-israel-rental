"""Readable names for short links: what may become one."""
from routes.short_links import _link_name


def test_a_business_slug_becomes_the_name():
    assert _link_name("blazin-boards") == "blazin-boards"
    assert _link_name("Blazin-Boards") == "blazin-boards"


def test_no_name_rather_than_a_useless_or_clashing_one():
    assert _link_name("business-1a2b3c4d") is None  # a Hebrew name's stand-in
    assert _link_name("mine") is None  # GET /short-links/mine
    assert _link_name("") is None
    assert _link_name(None) is None


def test_a_long_name_is_cut_at_a_word_to_print_whole():
    name = _link_name("the-very-long-business-name-of-a-family-company")
    assert name == "the-very-long-business-name"
    assert len(name) <= 28


def test_a_tattered_cut_out_is_refused():
    import numpy as np
    from utils.cutout import shredded
    y, x = np.mgrid[:400, :400]
    r = np.hypot(y - 200, x - 200)
    assert not shredded(((r < 180) * 255).astype(np.uint8))  # a solid product
    assert not shredded((((r < 180) & (r > 40)) * 255).astype(np.uint8))  # a bagel's hole is fine
    assert shredded((((r < 180) & ~((r > 60) & (r < 170))) * 255).astype(np.uint8))  # mostly hole
    assert shredded((((r < 180) & ((x // 12 + y // 12) % 2 == 0)) * 255).astype(np.uint8))  # confetti


def test_ad_instructions_fill_in():
    # 6 Nov 2026: a bare { in the new "ideas" line crashed every paid ad request.
    from routes.short_links import _AD_SYSTEM
    assert "English" in _AD_SYSTEM.format(language="English")
