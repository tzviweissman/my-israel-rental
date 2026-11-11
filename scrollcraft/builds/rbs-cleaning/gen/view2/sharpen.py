"""The squeegee clip blurred the view behind the cleaned glass (a focus pull) and only sharpened at the end (Tzvi,
10 Nov 2026: "fix the blurry view during the squeegee"). The camera does not move and the view is end.png (lined up:
mean difference 5 levels against end.png blurred 4 px), so wherever the cleared glass shows the view, above the
blade, the sharp end.png is put in. The pole and blade differ from the blurred view and stay as they are.
Run from the build folder with the backend venv python: gen/view2/wipe.mp4 -> gen/view2/wipe-sharp.mp4"""
import subprocess, numpy as np
from PIL import Image, ImageFilter
W, H = 2560, 1440
end = Image.open('gen/view2/end.png').convert('RGB').resize((W, H), Image.LANCZOS)
e = np.asarray(end).astype(np.float32)
eb = np.asarray(end.filter(ImageFilter.GaussianBlur(5))).astype(np.float32)
rd = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', 'gen/view2/wipe.mp4', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
wr = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '24', '-i', '-',
                       '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-pix_fmt', 'yuv420p', 'gen/view2/wipe-sharp.mp4'], stdin=subprocess.PIPE)
rows = np.arange(H)[:, None]
n = 0
while True:
    buf = rd.stdout.read(W * H * 3)
    if len(buf) < W * H * 3: break
    f = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32)
    lum = f[:, W // 5: 4 * W // 5].mean(axis=(1, 2))
    dark = np.where(lum < 70)[0]
    top = int(dark[0]) if len(dark) else 0                    # the blade's top edge; nothing above it before it comes in
    m = np.zeros((H, W), np.float32)
    if top > 8:
        d = np.abs(f - eb).max(axis=2)
        m = np.clip((60 - d) / 30, 0, 1)                        # the view, not the pole or blade
        m *= np.clip((top - 6 - rows) / 6, 0, 1)                # only above the blade, eased into its edge
        m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
    o = f + (e - f) * m[:, :, None]
    wr.stdin.write(o.clip(0, 255).astype(np.uint8).tobytes()); n += 1
wr.stdin.close(); wr.wait(); print('frames', n)
