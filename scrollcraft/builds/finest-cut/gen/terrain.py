"""The film's first stills, drawn free from their own photo: the board as a landscape seen by a tiny camera.
The photo gives the colour; a height map made from it raises each piece, and the three cups stay flat (voxel-space drawing).
The API has no photo-editing model, and a text-only still would not be their chicken.
Run from gen/: python terrain.py        writes film/S1.png, film/S2.png, film/S3.png
"""
import cv2
import numpy as np
from PIL import Image

photo = np.asarray(Image.open('../src/owner/p02.jpg').convert('RGB')).astype(np.float32)
H0, W0 = photo.shape[:2]
SIZE = (1920, 1080)
CUPS = [(.419, .424, .068), (.558, .424, .068), (.489, .575, .068)]   # measured on the photo: x, y, radius, as fractions of its width and height


def height_map():
    luma = cv2.cvtColor(photo.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    food = cv2.GaussianBlur((luma > .22).astype(np.float32), (0, 0), 7)
    h = cv2.GaussianBlur(luma, (0, 0), 16) * .75 + cv2.GaussianBlur(luma, (0, 0), 3) * .25
    h = h * food
    yy, xx = np.mgrid[0:H0, 0:W0].astype(np.float32)
    for cx, cy, r in CUPS:
        d = np.hypot(xx - cx * W0, yy - cy * H0) / (r * W0)
        h = h * np.clip((d - .95) / .25, 0, 1) + .34 * (1 - np.clip((d - .95) / .25, 0, 1))
    return h


def draw(cam, angle, cam_h, horizon, relief, far=1100, fog_from=.45):
    """Front to back along each screen column; each step paints what rises above the line drawn so far."""
    W, H = SIZE
    hm = height_map() * relief
    out = np.zeros((H, W, 3), np.float32)
    top = np.full(W, H, np.int32)
    s, c = np.sin(angle), np.cos(angle)
    z, dz = 3., .6
    xs = np.arange(W)
    while z < far:
        half = z * .62
        lx, ly = cam[0] + (-c * half - -s * -z * -1) * 0, 0
        # the two ends of this slice of the view, across the screen
        ax = cam[0] + s * z - c * half
        ay = cam[1] - c * z - s * half
        bx = cam[0] + s * z + c * half
        by = cam[1] - c * z + s * half
        mx = np.clip(ax + (bx - ax) * xs / W, 0, W0 - 1).astype(np.int32)
        my = np.clip(ay + (by - ay) * xs / W, 0, H0 - 1).astype(np.int32)
        y = ((cam_h - hm[my, mx]) / z * 620 + horizon).astype(np.int32)
        y = np.clip(y, 0, H)
        fog = 1 - np.clip((z / far - fog_from) / (1 - fog_from), 0, .9)
        for x in np.nonzero(y < top)[0]:
            out[y[x]:top[x], x] = photo[my[x], mx[x]] * fog
            top[x] = y[x]
        z += dz
        dz *= 1.004
    img = out.clip(0, 255).astype(np.uint8)
    # far things soft, near crumbs sharp, as a real tiny lens
    soft = cv2.GaussianBlur(img, (0, 0), 7)
    mask = np.clip((horizon + 160 - np.arange(H)) / 220, 0, 1)[:, None, None]
    img = (img * (1 - mask) + soft * mask).astype(np.uint8)
    sharp = cv2.addWeighted(img, 1.35, cv2.GaussianBlur(img, (0, 0), 2), -.35, 0)
    return sharp


def end_frame():
    """Their photo whole and centred on 16:9, its black stone continued from its own edge pixels."""
    W, H = 3200, 1800
    p = cv2.resize(photo, (2250, 1800), interpolation=cv2.INTER_AREA)
    x = (W - 2250) // 2
    canvas = cv2.copyMakeBorder(p, 0, 0, x, W - 2250 - x, cv2.BORDER_REFLECT_101)
    ramp = np.clip(np.abs(np.arange(W) - W / 2) / (W / 2), 0, 1)[None, :, None]
    # the mirrored stone darkens outward so no mirror line reads
    canvas = canvas * (1 - np.clip((ramp - .6) / .4, 0, 1) * .55)
    return cv2.resize(canvas.clip(0, 255).astype(np.uint8), SIZE, interpolation=cv2.INTER_AREA)


if __name__ == '__main__':
    # low over the crust at the lower right, looking up the board towards the cups
    Image.fromarray(draw((W0 * .78, H0 * .86), np.radians(-24), 118, 250, 150)).save('film/S1.png')
    # higher, nearer the cups, looking on up the board
    Image.fromarray(draw((W0 * .55, H0 * .76), np.radians(-8), 210, 150, 110, far=1500, fog_from=.7)).save('film/S2.png')
    Image.fromarray(end_frame()).save('film/S3.png')
