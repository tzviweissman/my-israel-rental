"""The home opening's tiles drop anything deleted, hidden, unpublished or
without a photo, and keep the picked order (routes/home_tiles.py)."""
from routes import home_tiles as ht


def test_missing_and_photoless_listings_drop_out_and_order_is_kept():
    s0, s1, s2 = ht.STAY_IDS[:3]
    props = [
        {'id': s2, 'images': ['https://x/c.jpg'], 'area': 'Jerusalem - Rehavia'},
        {'id': s0, 'images': ['https://x/clip.mp4', 'https://x/a.jpg'], 'area': ''},
        # s1 is gone (deleted or hidden): not in the list at all
    ]
    g0, g1 = ht.GIG_IDS[:2]  # stored under _id, as in marketplace_gigs
    gigs = [
        {'_id': g0, 'title': 'Catering', 'gallery': [], 'products': [{'images': ['https://x/p.jpg']}]},
        {'_id': g1, 'title': 'No photos', 'gallery': [], 'products': [], 'tiers': [{'images': []}]},
    ]
    out = ht.build(props, gigs)
    assert [t['href'] for t in out['stays']] == [f'/property/{s0}', f'/property/{s2}']
    assert out['stays'][0]['src'] == 'https://x/a.jpg'  # a video is never the photo
    assert out['stays'][1]['label'] == 'Rehavia'
    assert [t['href'] for t in out['businesses']] == [f'/businesses/{g0}']
    assert out['businesses'][0]['src'] == 'https://x/p.jpg'


def test_route_is_registered_under_api():
    from server import app
    assert any(getattr(r, 'path', '') == '/api/home/opening-tiles' for r in app.routes)
