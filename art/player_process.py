#!/usr/bin/env python3
"""Player sprite post-process: same as tools/sprites.py strip/one, but with a FIXED px-per-source-px scale
derived from a target height of the reference (standing) frames, so the player keeps the same on-screen size
across walk_down/up/side/fire/roll/death. Falls back to fit-to-frame if that scale would overflow the frame.
  player_process.py strip IN OUT --frames N --key K --target 110 [--refs 0,1,2] [--fw 128 --fh 128 --pad 4 --dil 4]
"""
import argparse, json, os, sys, statistics
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tools"))
import sprites as S

p = argparse.ArgumentParser()
p.add_argument("mode", choices=["strip"])
p.add_argument("inp"); p.add_argument("out")
p.add_argument("--frames", type=int, required=True)
p.add_argument("--key", required=True)
p.add_argument("--fw", type=int, default=128); p.add_argument("--fh", type=int, default=128)
p.add_argument("--pad", type=int, default=4); p.add_argument("--dil", type=int, default=4)
p.add_argument("--target", type=float, default=110, help="target px height of the reference frames")
p.add_argument("--refs", default="", help="comma list of frame indices used to measure the scale (default all)")
p.add_argument("--dim", default="h", choices=["h", "w", "max"], help="which dimension of ref frames to match to target")
p.add_argument("--names", default="")
p.add_argument("--rowcounts", default="", help="grid layout: figures per row, e.g. 2,2 or 3,2 (row-major order)")
p.add_argument("--colsplit", action="store_true", help="force column-valley splitting")
a = p.parse_args()

im = S.load(a.inp)
import numpy as np
blobs = S.find_blobs(im, dil=a.dil)
if a.rowcounts:
    # multi-row layout (row-major order): take the N biggest blobs, cut into rows by centroid-y, sort each row by x
    counts = [int(x) for x in a.rowcounts.split(",")]
    assert sum(counts) == a.frames, "rowcounts must sum to frames"
    if len(blobs) < a.frames:
        sys.exit(f"ERROR: found {len(blobs)} blobs, need {a.frames}")
    blobs = sorted(blobs, key=lambda b: -b["area"])[:a.frames]
    blobs = sorted(blobs, key=lambda b: b["cy"])
    ordered, k = [], 0
    for c in counts:
        ordered += sorted(blobs[k:k + c], key=lambda b: b["cx"]); k += c
    blobs = ordered
    print("grid order (cx,cy):", [(int(b["cx"]), int(b["cy"])) for b in blobs])
elif len(blobs) < a.frames or a.colsplit:
    # fallback: cut at the emptiest column near each expected frame boundary (frames touching in the raw)
    A = np.array(im.getchannel("A")) > 24
    W = A.shape[1]; cell = W / a.frames
    occ = A.sum(axis=0).astype(float)
    cuts = [0]
    for k in range(1, a.frames):
        c = int(k * cell); lo, hi = int(c - 0.22 * cell), int(c + 0.22 * cell)
        cuts.append(lo + int(np.argmin(occ[lo:hi])))
    cuts.append(W)
    blobs = []
    for i in range(a.frames):
        m = np.zeros_like(A); m[:, cuts[i]:cuts[i + 1]] = A[:, cuts[i]:cuts[i + 1]]
        from scipy import ndimage as ndi
        lab, n = ndi.label(ndi.binary_dilation(m, iterations=3)); lab = lab * m
        if n > 1:  # drop specks (< 2% of the biggest component)
            sizes = ndi.sum(m, lab, range(1, n + 1)); keep = [j + 1 for j, z in enumerate(sizes) if z > 0.02 * max(sizes)]
            m = np.isin(lab, keep)
        ys, xs = np.where(m)
        blobs.append(dict(mask=m, x0=xs.min(), x1=xs.max() + 1, y0=ys.min(), y1=ys.max() + 1, cx=xs.mean(), cy=ys.mean(), area=m.sum()))
    print("colsplit cuts:", cuts)
if not a.rowcounts:
    blobs = S.merge_to(blobs, a.frames)
crops = [S.crop_blob(im, b) for b in blobs]
refs = [int(x) for x in a.refs.split(",")] if a.refs else list(range(a.frames))
def dim(c):
    return {"h": c.height, "w": c.width, "max": max(c.width, c.height)}[a.dim]
ref_sz = statistics.median(dim(crops[i][0]) for i in refs)
s_target = a.target / ref_sz
s_fit = S.fit_scale(crops, a.fw, a.fh, a.pad)
s = min(s_target, s_fit)
sheet, s = S.compose(crops, a.fw, a.fh, a.pad, "bottom", scale=s)
# remove tiny stray specks per frame (fragments of neighbouring frames / noise)
from scipy import ndimage as ndi
arr = np.array(sheet)
for i in range(a.frames):
    cell = arr[:, i * a.fw:(i + 1) * a.fw]
    m = cell[..., 3] > 0
    lab, n = ndi.label(ndi.binary_dilation(m, iterations=1))
    if n > 1:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        for j, z in enumerate(sizes):
            if z < 0.02 * max(sizes):
                cell[(lab == j + 1) & m] = 0
sheet = Image.fromarray(arr) if False else __import__("PIL.Image", fromlist=["Image"]).fromarray(arr)
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
sheet.save(a.out)
S.preview(sheet, a.out.replace(".png", ".preview.png"), a.fw)
names = [x for x in a.names.split(",") if x] if a.names else []
rel = os.path.relpath(a.out, "public/assets") if os.path.abspath(a.out).startswith(os.path.abspath("public/assets")) else a.out
json.dump({a.key: dict(file=rel, frameWidth=a.fw, frameHeight=a.fh, frames=a.frames, mode="strip", anchor="bottom", scale=round(s, 4), names=names)},
          open(a.out.replace(".png", ".meta.json"), "w"), indent=1)
print(f"OK {a.out}: {a.frames} frames @ {a.fw}x{a.fh}, scale {s:.3f} (target {s_target:.3f}, fit {s_fit:.3f}); out sizes:",
      [(round(c.width * s), round(c.height * s)) for c, _ in crops])
