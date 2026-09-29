#!/usr/bin/env python3
"""Idempotent asset optimiser for load time. Run from project root:  .venv-art/bin/python tools/optimize_assets.py [--dry] [--force] [--only substr]

What it does (originals are ALWAYS kept in art/originals/<same relative path>, never lost):
  * public/assets/images/*.png that are fully opaque and large (room backgrounds, title_bg)  -> high-quality WebP (q90, method 6),
    the PNG is moved to art/originals/. build_manifest.py then points the manifest at the .webp automatically.
  * every other PNG under public/assets/sprites|images (transparent sprites, UI, portraits; *.preview.png excluded)
    -> pngquant palette PNG (quality 82-98, dithered only where needed) - still PNG, so tools/sprites.py output format is unchanged.
    If pngquant cannot reach the quality floor the file is left untouched.
  * public/assets/audio/music/*.mp3 above ~110 kbps -> LAME 96 kbps joint-stereo mp3 (same length, loops stay gapless; Chrome/Firefox/Safari honour LAME padding info).
State: art/originals/.optimized.json {relpath: sha1 of the optimised file}. A file whose current sha1 matches is skipped, so re-running after
new art lands (tools/sprites.py rewrites PNGs) only touches new/changed files. Afterwards run tools/build_manifest.py.
"""
import sys, os, io, json, hashlib, shutil, subprocess, glob
from PIL import Image
import numpy as np

ROOT = 'public/assets'
ORIG = 'art/originals'
STATE = f'{ORIG}/.optimized.json'
DRY = '--dry' in sys.argv
FORCE = '--force' in sys.argv
ONLY = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
WEBP_Q = 90
PNGQUANT_Q = '82-98'
MUSIC_KBPS = 96


def sha1(p):
    return hashlib.sha1(open(p, 'rb').read()).hexdigest()


state = json.load(open(STATE)) if os.path.exists(STATE) else {}
stats = {'before': 0, 'after': 0, 'files': 0, 'skipped': 0}


def rel(p):
    return os.path.relpath(p, ROOT)


def backup(p):
    dst = os.path.join(ORIG, rel(p))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(p, dst)
    return dst


def atomic_write(p, data):
    tmp = p + '.tmp'
    open(tmp, 'wb').write(data)
    os.replace(tmp, p)


def log(name, b, a, note=''):
    stats['before'] += b
    stats['after'] += a
    stats['files'] += 1
    print(f'  {name:38s} {b/1024:8.0f} KB -> {a/1024:7.0f} KB  {note}')


def is_opaque(im):
    if im.mode == 'RGB' or im.mode == 'L':
        return True
    a = np.array(im.convert('RGBA'))[..., 3]
    return a.min() == 255


def do_image_png(p):
    r = rel(p)
    name = os.path.basename(p)
    if not FORCE and state.get(r) == sha1(p):
        stats['skipped'] += 1
        return
    im = Image.open(p)
    before = os.path.getsize(p)
    in_images = r.startswith('images/')
    if in_images and im.width >= 512 and is_opaque(im):
        out = io.BytesIO()
        im.convert('RGB').save(out, 'WEBP', quality=WEBP_Q, method=6)
        dst = p[:-4] + '.webp'
        log(name, before, len(out.getvalue()), '-> webp')
        if DRY:
            return
        backup(p)
        atomic_write(dst, out.getvalue())
        os.remove(p)
        state[rel(dst)] = sha1(dst)
        return
    # palette PNG via pngquant
    res = subprocess.run(['pngquant', '--quality', PNGQUANT_Q, '--speed', '1', '--strip', '-'], input=open(p, 'rb').read(), capture_output=True)
    if res.returncode != 0 or len(res.stdout) >= before:
        log(name, before, before, f'kept (pngquant rc={res.returncode})')
        state[r] = sha1(p)
        return
    log(name, before, len(res.stdout), 'pngquant')
    if DRY:
        return
    backup(p)
    atomic_write(p, res.stdout)
    state[r] = sha1(p)


def do_music(p):
    r = rel(p)
    if not FORCE and state.get(r) == sha1(p):
        stats['skipped'] += 1
        return
    br = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=bit_rate', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout.strip()
    before = os.path.getsize(p)
    if br.isdigit() and int(br) <= 110000:
        state[r] = sha1(p)
        return
    tmp = p + '.tmp.mp3'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', p, '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', f'{MUSIC_KBPS}k', '-joint_stereo', '1', tmp], check=True)
    after = os.path.getsize(tmp)
    log(os.path.basename(p), before, after, f'{br} bps -> {MUSIC_KBPS}k')
    if DRY:
        os.remove(tmp)
        return
    backup(p)
    os.replace(tmp, p)
    state[r] = sha1(p)


def main():
    pngs = sorted(glob.glob(f'{ROOT}/sprites/*.png') + glob.glob(f'{ROOT}/images/*.png'))
    pngs = [p for p in pngs if not p.endswith('.preview.png') and (not ONLY or ONLY in p)]
    print(f'images/sprites: {len(pngs)} candidates')
    for p in pngs:
        do_image_png(p)
    mus = sorted(glob.glob(f'{ROOT}/audio/music/*.mp3'))
    mus = [p for p in mus if not ONLY or ONLY in p]
    print(f'music: {len(mus)} candidates')
    for p in mus:
        do_music(p)
    if not DRY:
        os.makedirs(ORIG, exist_ok=True)
        json.dump(state, open(STATE, 'w'), indent=1, sort_keys=True)
    print(f"done: {stats['files']} files changed, {stats['skipped']} already optimised; {stats['before']/1e6:.2f} MB -> {stats['after']/1e6:.2f} MB")


if __name__ == '__main__':
    main()
