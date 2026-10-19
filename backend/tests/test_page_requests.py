"""'Ask for a change' (19 Oct 2026): a model's plan only reaches the page's fixed places."""
from routes.marketplace.page_requests import _Keys, check_plan, parse_json

CLD = 'https://res.cloudinary.com/dirvyboe9/image/upload/v1/myisraelrental/a.jpg'
KEYS = {
    't-abc1-1': {'kind': 'text', 'tag': 'p', 'text': 'Pans from ₪275', 'page': 'index'},
    'i-abc2-1': {'kind': 'img', 'alt': 'A box', 'page': 'menu'},
}


def test_keys_found_in_html():
    p = _Keys()
    p.feed('<h1 data-mir-key="t-aaaa-1">Hello <b>you</b></h1><img data-mir-key="i-bbbb-1" alt="x" src="a.jpg"><p>none</p>')
    assert p.items['t-aaaa-1']['text'].strip() == 'Hello you' and p.items['i-bbbb-1']['kind'] == 'img'
    assert len(p.items) == 2


def test_only_existing_keys_and_sane_lengths():
    plan = check_plan({'text': [
        {'key': 't-abc1-1', 'new': 'Pans from ₪290'},
        {'key': 't-nope-1', 'new': 'x'},
        {'key': 't-abc1-1', 'new': 'x' * 200},
        {'key': 'i-abc2-1', 'new': 'text on a photo'},
    ]}, KEYS, [], 0, 0)
    assert [t['new'] for t in plan['text']] == ['Pans from ₪290']


def test_scripts_are_cleaned():
    plan = check_plan({'text': [{'key': 't-abc1-1', 'new': '<script>x</script>Pans'}]}, KEYS, [], 0, 0)
    assert all('<script' not in t['new'] for t in plan['text'])


def test_photos_only_from_the_attached_ones():
    plan = check_plan({'img': [{'key': 'i-abc2-1', 'photo': 1}, {'key': 'i-abc2-1', 'photo': 5}],
                       'gallery': [{'photo': 1}, {'photo': 'https://evil.example/x.jpg'}]}, KEYS, [CLD], 0, 0)
    assert plan['img'] == [{'key': 'i-abc2-1', 'page': 'menu', 'alt': 'A box', 'url': CLD}]
    assert plan['gallery'] == []  # already used as the swap, and the other is not an attached photo


def test_gallery_respects_the_limit_and_faq_is_plain():
    plan = check_plan({'gallery': [{'photo': 1, 'fx': 300}], 'faq': [{'q': '<b>Do you deliver?</b>', 'a': 'Yes, in central Jerusalem.'}],
                       'faq_remove': ['Old?', 'Never asked'], 'design_request': 'A new section'}, KEYS, [CLD], 23, 0, ['Old?'])
    assert plan['gallery'] == [{'url': CLD, 'fx': 100, 'fy': 50, 'alt': ''}]
    assert plan['faq'] == [{'q': 'Do you deliver?', 'a': 'Yes, in central Jerusalem.'}]
    assert plan['faq_remove'] == ['Old?'] and plan['design_request'] == 'A new section'
    assert check_plan({'gallery': [{'photo': 1}]}, KEYS, [CLD], 24, 0)['gallery'] == []


def test_parse_json_tolerates_prose():
    assert parse_json('Here you go: {"reply": "ok"} thanks') == {'reply': 'ok'}
    assert parse_json('no json') == {}
