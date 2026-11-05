"""The ad cut-out keeps the product and drops stray bits (utils/cutout.py)."""
import io
import os

import numpy as np
import pytest
from PIL import Image, ImageDraw

from utils import cutout


def test_largest_part_drops_stray_bits():
    mask = np.zeros((400, 400), np.uint8)
    mask[100:300, 100:300] = 255  # the board
    mask[10:30, 10:30] = 200  # a stray leaf
    out = cutout.largest_part(mask)
    assert out[200, 200] == 255
    assert out[20, 20] == 0


@pytest.mark.skipif(not os.path.exists(cutout.MODEL_PATH), reason="cut-out model not downloaded here")
def test_cut_returns_the_object_alone():
    im = Image.new("RGB", (800, 600), (235, 235, 230))
    ImageDraw.Draw(im).ellipse((250, 150, 550, 450), fill=(180, 40, 30))
    buf = io.BytesIO()
    im.save(buf, "JPEG")
    png = cutout.cut(buf.getvalue())
    assert png
    out = Image.open(io.BytesIO(png))
    assert out.mode == "RGBA"
    assert 250 <= out.width <= 330 and 250 <= out.height <= 330  # cropped to the ball


def test_edge_is_not_cut_into_stairs():
    """A diagonal edge keeps every step of the fine mask: the 256-cell map only picks the piece."""
    import numpy as np
    from utils.cutout import largest_part
    mask = np.zeros((1600, 1600), np.uint8)
    for y in range(1600):
        mask[y, :max(0, y - 100)] = 255
    out = largest_part(mask)
    assert (out == mask).mean() > 0.9999
