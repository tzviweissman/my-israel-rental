"""What every paid Higgsfield API script needs: the key, and model names that exist on our account.

    import sys; from pathlib import Path; sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'starter'))
    import hf; hf.load_key()       # from scrollcraft/builds/<site>/gen/<script>.py

load_key() finds backend/.env.local in this checkout or, from a worktree (which has none), in the main checkout that
git points to (23 Nov 2026: clip.py looked next to itself, found nothing in a worktree and failed). The key is never
read or printed here, only loaded for higgsfield_client.

IMAGE_EDIT is tried in order by starter/still.py; a name the API does not have fails with model_not_found at no cost.
On 23 Nov 2026 'google/nano-banana-2/edit', 'nano-banana-2', 'nano_banana_2' and 'bytedance/seedream/v4/edit' all
came back model_not_found (the MCP catalogue's ids are not the API's), so they are left out. When one stops working or
a better one is found, change it here, not in a site's copy.
"""
import subprocess
from pathlib import Path

from dotenv import load_dotenv

IMAGE_EDIT = ['alibaba/qwen-image-3/edit']           # ignores aspect_ratio: crop or extend the result after
VIDEO = 'minimax/h3/image-to-video'                  # image_url + optional end_image_url, duration in seconds


def load_key() -> Path:
    here = Path(__file__).resolve()
    tries = [p / 'backend' / '.env.local' for p in here.parents]
    try:
        common = subprocess.run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=here.parent,
                                capture_output=True, text=True, check=True).stdout.strip()
        tries.append(Path(common).parent / 'backend' / '.env.local')
    except Exception:  # noqa: BLE001 - not a git checkout: the parents are all there is
        pass
    for f in tries:
        if f.exists():
            load_dotenv(f)
            return f
    raise SystemExit('no backend/.env.local found here or in the main checkout')


if __name__ == '__main__':
    print('key file:', load_key())
