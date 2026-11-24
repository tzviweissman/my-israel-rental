# Saved products

One file per business, `<business-slug>.json`. Each item is the one master look of a product: the owner's own
photo and the traits a generated copy must keep. `scripts/hf.py` reads it when a gen script passes
`product="<business>/<item>"`: the photo goes in as Image 1 and the traits go into the prompt, so the product
looks the same in the film, the ads and the close-ups (memory "one look per product", page rules 3h.12).

Higgsfield's own "Elements" would do this inside Higgsfield, but its API cannot make one and only Kling 3.0 takes
them (docs.higgsfield.ai, read 24 Nov 2026). So the master lives here, in the repo, for every model.

```json
{
  "business": "Display name",
  "items": {
    "<item-slug>": {
      "name": "what the prompt calls it, e.g. Hot Poppers in their kraft paper bowl",
      "photo": "repo path to the owner's own photo (a close crop of this one item)",
      "traits": "shape, size, colour, coating or texture, count, words on it; and what must never appear round it",
      "source": "where the photo came from and which mistake each trait guards against"
    }
  }
}
```

Add an item the first time a product is generated, and add a trait every time a generation gets that product
wrong (`python scripts/hf.py verdict <file> redo "why"` records the mistake; the fix goes here).
Check one with `python scripts/hf.py product <business>/<item>`.
