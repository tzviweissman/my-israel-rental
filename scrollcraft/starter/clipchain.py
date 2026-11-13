"""The clip chain, from the starter (12 Nov 2026, rules as a blueprint; first used on Gremier Coffee). One story, by
construction: every clip starts on the last frame of the one before, so the camera never cuts and the objects stay the
same objects (new rules one story, one world, same objects), and every prompt carries the same world line (one ground,
one light) from the build's chain.json. Each clip is checked as it arrives (check-clip: jumps, fades); a failed clip
stops the chain before the next one is paid for. The last slide may be a still (the business's own photo), joined by a
slide push, never by a fade.

    gen/chain.json  {"world": "<one ground, one light, the material>", "first": "gen/world/w1.png",
                     "steps": [{"name": "W1", "prompt": "...", "frame": "the whole grinder, large, centred on the cream
                     ground", "phone": "<optional 9:16 clip>"}, ...], "end_still": "assets/open-wide.webp", "ground": "#F6EEE3"}

    python ../../starter/clipchain.py make      the paid clips, in order (HF_KEY from backend/.env.local, never printed)
    python ../../starter/clipchain.py encode    assets/film/s<n>-d.mp4 / -m.mp4 and posters, every frame a keyframe

Run from the build folder with the backend venv python. Paid generation also needs gen/*-brief.md (film-gate)."""
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path('C:/Users/tzviw/Documents/my-israel-rental')
# a second chain (the phone's tall clips, "aspect": "9:16") is run as: clipchain.py make gen/chain-tall.json
SPEC = json.loads(Path(sys.argv[2] if len(sys.argv) > 2 else 'gen/chain.json').read_text(encoding='utf8'))
W = Path('gen/world'); W.mkdir(parents=True, exist_ok=True)
OUT = Path('assets/film'); OUT.mkdir(parents=True, exist_ok=True)


def sh(*a):
    subprocess.run(list(a), check=True)


def last_frame(clip, out):
    sh('ffmpeg', '-v', 'error', '-y', '-sseof', '-0.3', '-i', str(clip), '-frames:v', '1', str(out))


def floor_line(p):
    """Where a straight line runs across over 85% of the width in the lower 55% of a picture (a floor, table edge, shelf,
    horizon), as a share of the height; None if there is none. Tried 12 Nov 2026: the floored grinder still 0.91 and a
    shelf frame 1.0 are caught, the same still with its floor painted out 0.64 is not."""
    from PIL import Image, ImageFilter
    im = Image.open(p).convert('L').resize((320, 180)).filter(ImageFilter.GaussianBlur(1))
    px = im.load()
    for y in range(81, 176):
        if sum(abs(px[x, y + 4] - px[x, y]) >= 5 for x in range(320)) / 320 > .85:
            return y / 180
    return None


def check(clip, step=None):
    r = subprocess.run(['node', str(ROOT / 'scripts/check-clip.mjs'), str(Path(clip).resolve())], capture_output=True, text=True)
    print(r.stdout.strip())
    # a check is a claim, not a fact: a step may carry "eye_ok": what was seen frame by frame and why the flag is wrong
    # (water rippling across the whole frame reads as RUSH). Only after looking; the reason stays in chain.json.
    if r.returncode and step and len(str(step.get('eye_ok', '')).split()) >= 8:
        print(f"{step['name']}: passed by eye: {step['eye_ok']}")
        return
    if r.returncode:
        sys.exit(f'{clip} failed check-clip: the chain stops before the next clip is paid for. Change the step, not only the prompt.')


def make():
    from dotenv import load_dotenv
    load_dotenv(ROOT / 'backend/.env.local')
    import higgsfield_client as h
    prev = Path(SPEC['first'])
    # the right distance is planned, never left to the model (rules 3aa.8, Tzvi 12 Nov 2026: "its so zoomed in i cant see
    # much of whats goin on"): every step says what is in the frame, the object whole and large on its ground
    bad = [st['name'] for st in SPEC['steps'] if len(str(st.get('frame', '')).split()) < 6]
    if bad:
        sys.exit(f'chain.json steps {bad} have no "frame" line (what the viewer sees: the object whole, large, on its ground; 3aa.8)')
    # the words fit the scene (rules 3aa.20, Tzvi 12 Nov 2026: COLD stood by the beans): each step names its word and what
    # in this scene it names; "none" when the step has no word of its own
    bad = [st['name'] for st in SPEC['steps'] if str(st.get('word', '')).strip().lower() != 'none' and len(str(st.get('word', '')).split()) < 6]
    if bad:
        sys.exit(f'chain.json steps {bad} have no "word" line ("GRIND: the beans being ground in this scene", or "none"; 3aa.20)')
    # the start picture is looked at before any clip (rules 3aa.21): what was seen at its edges, nothing that matters cut off
    bad = [st['name'] for st in SPEC['steps'] if not (W / f"{st['name']}.mp4").exists() and len(str(st.get('start_seen', '')).split()) < 8]
    if bad:
        sys.exit(f'chain.json steps {bad} have no "start_seen" line (looked at the start picture: what touches each edge, nothing cut off; 3aa.21)')
    # the start is the before (rules 3aa.22, Gremier 12 Nov: the grinder was drawn already apart, so it never came apart):
    # the line says what the start shows before the step's action happens
    bad = [st['name'] for st in SPEC['steps'] if not (W / f"{st['name']}.mp4").exists() and 'before' not in str(st.get('start_seen', '')).lower()]
    if bad:
        sys.exit(f'chain.json steps {bad}: start_seen does not say what the start shows "before" the action of its step (3aa.22)')
    # the phone is planned with the film, not after the review (rules 3aa.24; Gremier's review: each phone screen 60% cream)
    if SPEC.get('aspect') != '9:16' and len(str(SPEC.get('phone_plan', '')).split()) < 6:
        sys.exit('chain.json has no "phone_plan" line: tall 9:16 clips (12 credits each) or the whole width on the ground, and whose choice it was, the owner or Tzvi (3aa.24)')
    # Tzvi is always asked, never "for now" (rules 3aa.26, 13 Nov 2026: Gremier's phones got the wide film on cream without
    # asking, then needed five more clips): phone_plan quotes his own answer
    import re
    if SPEC.get('aspect') != '9:16' and not re.search(r'["“][^"”]{2,}["”]', str(SPEC.get('phone_plan', ''))):
        sys.exit('chain.json phone_plan does not quote the answer Tzvi gave: ask him first, tall 9:16 clips (their get_cost credits) or the whole width on the ground, and put his words in quotes (3aa.26)')
    for step in SPEC['steps']:
        out = W / f"{step['name']}.mp4"
        if not out.exists():
            # free check before a paid clip (rules 3aa.23, Gremier 12 Nov: a faint floor band in the start became a shelf the
            # camera fell past, 12 credits remade): a straight line across nearly the whole width in the lower half
            y = floor_line(prev)
            if y is not None and len(str(step.get('floor_ok', '')).split()) < 8:
                sys.exit(f'{step["name"]}: the start picture {prev} has a straight line across the whole width at {y:.0%} down '
                         '(a floor, table, shelf or horizon). Paint it out, or say why it belongs in a "floor_ok" line (3aa.23)')
            args = {'duration': 6, 'resolution': '2K', 'aspect_ratio': SPEC.get('aspect', '16:9'), 'prompt': step['prompt'] + ' Framing: ' + step['frame'] + ' ' + SPEC['world'],
                    'image_url': h.upload_file(str(prev))}
            if step.get('end'):   # a planned end still (the next scene, or the business's own photo) the clip lands on
                args['end_image_url'] = h.upload_file(step['end'])
            ctl = h.submit('minimax/h3/image-to-video', arguments=args)
            Path(str(out) + '.req').write_text(f'{ctl.request_id}\n{ctl.status_url}\n{ctl.response_url}\n')
            print('submitted', step['name'], ctl.request_id, flush=True)
            for _ in range(240):
                try:
                    st = ctl.status()
                except Exception:  # noqa: BLE001  a slow status check is retried
                    time.sleep(10); continue
                if isinstance(st, h.Completed):
                    url = (h.sync_client.result(ctl.request_id) or {}).get('video', {}).get('url')
                    urllib.request.urlretrieve(url, out); break
                if isinstance(st, tuple(h.DONE_STATUSES)):
                    sys.exit(f'{step["name"]} failed: {type(st).__name__}')
                time.sleep(10)
        check(out, step)
        prev = W / f"{step['name']}-last.png"
        last_frame(out, prev)
    print('chain made')


def encode():
    for n, step in enumerate(SPEC['steps'], 1):
        clip = W / f"{step['name']}.mp4"
        d, m = OUT / f's{n}-d.mp4', OUT / f's{n}-m.mp4'
        sh('ffmpeg', '-v', 'error', '-y', '-ss', '0.25', '-i', str(clip), '-vf', 'scale=1600:-2', '-c:v', 'libx264', '-g', '1', '-crf', '30',
           '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', str(d))
        # a phone never gets a cut-down film (rules 3aa.14): its own tall clip when the step has one ("phone": path to a
        # 9:16 clip), else the whole width of the film on the page's ground, the words on the ground under it
        g = SPEC.get('ground', '#FFFFFF').lstrip('#')
        src, vf = (step['phone'], 'scale=720:1280') if step.get('phone') else (str(clip), f'scale=720:-2,pad=720:1280:0:(oh-ih)*0.29:color=0x{g}')
        sh('ffmpeg', '-v', 'error', '-y', '-ss', '0.25', '-i', src, '-vf', vf,
           '-c:v', 'libx264', '-g', '1', '-crf', '30', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', str(m))
        for v, k in ((d, 'd'), (m, 'm')):
            sh('ffmpeg', '-v', 'error', '-y', '-i', str(v), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '72', str(OUT / f's{n}-{k}.webp'))
    if SPEC.get('end_still'):   # the last slide: the business's own photo, as a still, pushed up from below
        n = len(SPEC['steps']) + 1
        sh('ffmpeg', '-v', 'error', '-y', '-i', SPEC['end_still'], '-vf', 'scale=1600:-2', '-c:v', 'libwebp', '-quality', '80', str(OUT / f's{n}-d.webp'))
        # on a phone the whole photo, never a crop (rules 3c.12): full width on the page's own ground ("ground" in
        # chain.json), a little above the middle, so the film and the words under it sit centred as one block has the clear ground above it (3aa.3, 3h.25)
        g = SPEC.get('ground', '#FFFFFF').lstrip('#')
        sh('ffmpeg', '-v', 'error', '-y', '-i', SPEC['end_still'], '-vf', f'scale=720:-2,pad=720:1280:0:(oh-ih)*0.29:color=0x{g}',
           '-c:v', 'libwebp', '-quality', '78', str(OUT / f's{n}-m.webp'))
    print('encoded', len(SPEC['steps']), 'clips', '+ end still' if SPEC.get('end_still') else '')


{'make': make, 'encode': encode}[sys.argv[1]]()
