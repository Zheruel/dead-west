#!/usr/bin/env python3
"""Sprite post-processing for GPT-image output. Run with ../.venv-art/bin/python.

  strip: N frames in one horizontal row  -> normalised horizontal strip (N x fw, fh) + meta json
  grid : R x C separate items (icons/props/tiles-with-alpha) -> one horizontal atlas strip, row-major order
  one  : single image -> trimmed, fitted into fw x fh cell

Common: input must have real alpha (gen_image.sh default). All frames share ONE scale factor
(so relative size is stable), are registered by mass-centroid X and bottom Y (ground line), and are
downsampled only (LANCZOS). Writes OUT.png, OUT.meta.json (used by tools/build_manifest.py) and
OUT.preview.png (3x on dark checker, for eyeballing).

  sprites.py strip IN.png OUT.png --frames 6 --fw 64 --fh 64 --key player_walk_down [--anchor bottom|center] [--pad 2]
  sprites.py grid  IN.png OUT.png --cols 4 --rows 3 --fw 48 --fh 48 --key items_a [--names a,b,c,...]
  sprites.py one   IN.png OUT.png --fw 96 --fh 96 --key boss_x [--anchor center]
"""
import argparse, json, sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def load(path):
    im = Image.open(path).convert("RGBA")
    return im


def find_blobs(im, dil=4, min_frac=0.004):
    a = np.array(im.getchannel("A")) > 24
    lab, n = ndi.label(ndi.binary_dilation(a, iterations=dil))
    lab = lab * a  # restore original pixels only
    blobs = []
    total = a.sum()
    for i in range(1, n + 1):
        m = lab == i
        cnt = m.sum()
        if cnt < total * min_frac:
            continue
        ys, xs = np.where(m)
        blobs.append(dict(mask=m, x0=xs.min(), x1=xs.max() + 1, y0=ys.min(), y1=ys.max() + 1, cx=xs.mean(), cy=ys.mean(), area=cnt))
    return blobs


def merge_to(blobs, n):
    """merge nearest-in-x blobs until n remain (fragments of the same frame)."""
    blobs = sorted(blobs, key=lambda b: b["cx"])
    while len(blobs) > n:
        gaps = [(blobs[i + 1]["x0"] - blobs[i]["x1"], i) for i in range(len(blobs) - 1)]
        _, i = min(gaps)
        a, b = blobs[i], blobs[i + 1]
        m = a["mask"] | b["mask"]
        ys, xs = np.where(m)
        blobs[i:i + 2] = [dict(mask=m, x0=xs.min(), x1=xs.max() + 1, y0=ys.min(), y1=ys.max() + 1, cx=xs.mean(), cy=ys.mean(), area=m.sum())]
    return blobs


def crop_blob(im, b):
    arr = np.array(im)
    out = np.zeros_like(arr)
    out[b["mask"]] = arr[b["mask"]]
    return Image.fromarray(out).crop((b["x0"], b["y0"], b["x1"], b["y1"])), b


def fit_scale(crops, fw, fh, pad):
    s = min((fw - 2 * pad) / max(c.width for c, _ in crops), (fh - 2 * pad) / max(c.height for c, _ in crops))
    return s


def compose(crops, fw, fh, pad, anchor, scale=None):
    s = scale if scale is not None else fit_scale(crops, fw, fh, pad)
    if s > 1.0:
        print(f"WARN: source smaller than target (would upscale x{s:.2f}); keeping scale 1.0", file=sys.stderr)
        s = 1.0
    sheet = Image.new("RGBA", (fw * len(crops), fh), (0, 0, 0, 0))
    for i, (c, b) in enumerate(crops):
        w, h = max(1, round(c.width * s)), max(1, round(c.height * s))
        r = c.resize((w, h), Image.LANCZOS)
        # centroid x within crop, scaled
        cx = (b["cx"] - b["x0"]) * s
        x = int(round(i * fw + fw / 2 - cx))
        x = max(i * fw, min(i * fw + fw - w, x))
        y = fh - pad - h if anchor == "bottom" else int(round((fh - h) / 2))
        sheet.alpha_composite(r, (x, y))
    return sheet, s


def preview(sheet, path, fw):
    z = 3
    big = sheet.resize((sheet.width * z, sheet.height * z), Image.NEAREST)
    bg = Image.new("RGBA", big.size, (40, 36, 34, 255))
    for yy in range(0, big.height, 24):
        for xx in range(0, big.width, 24):
            if (xx // 24 + yy // 24) % 2:
                bg.paste((56, 50, 46, 255), (xx, yy, xx + 24, yy + 24))
    bg.alpha_composite(big)
    d = bg.copy()
    from PIL import ImageDraw
    dr = ImageDraw.Draw(d)
    for x in range(0, big.width, fw * z):
        dr.line([(x, 0), (x, big.height)], fill=(255, 0, 255, 120))
    d.save(path)


def order_grid(blobs, rows, cols):
    blobs = sorted(blobs, key=lambda b: b["cy"])
    per = max(1, len(blobs) // rows)
    out = []
    for r in range(rows):
        row = blobs[r * per:(r + 1) * per] if r < rows - 1 else blobs[r * per:]
        out += sorted(row, key=lambda b: b["cx"])
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("mode", choices=["strip", "grid", "one"])
    p.add_argument("inp"); p.add_argument("out")
    p.add_argument("--frames", type=int, default=1)
    p.add_argument("--cols", type=int, default=1); p.add_argument("--rows", type=int, default=1)
    p.add_argument("--fw", type=int, required=True); p.add_argument("--fh", type=int, required=True)
    p.add_argument("--key", required=True); p.add_argument("--anchor", default="bottom", choices=["bottom", "center"])
    p.add_argument("--pad", type=int, default=2); p.add_argument("--names", default="")
    p.add_argument("--dil", type=int, default=4, help="dilation (px at source res) for merging fragments")
    a = p.parse_args()

    im = load(a.inp)
    blobs = find_blobs(im, dil=a.dil)
    if a.mode == "one":
        blobs = merge_to(blobs, 1)
        n = 1
    elif a.mode == "strip":
        n = a.frames
        if len(blobs) < n:
            sys.exit(f"ERROR: found {len(blobs)} blobs, need {n}. Frames touching? regenerate with clearer gaps or lower --dil")
        blobs = merge_to(blobs, n)
    else:
        n = a.cols * a.rows
        if len(blobs) < n:
            sys.exit(f"ERROR: found {len(blobs)} blobs, need {n}")
        blobs = sorted(blobs, key=lambda b: -b["area"])[:n]
        blobs = order_grid(blobs, a.rows, a.cols)
    crops = [crop_blob(im, b) for b in blobs]
    sheet, s = compose(crops, a.fw, a.fh, a.pad, a.anchor)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    sheet.save(a.out)
    preview(sheet, a.out.replace(".png", ".preview.png"), a.fw)
    names = [x for x in a.names.split(",") if x] if a.names else []
    meta = {a.key: dict(file=os.path.relpath(a.out, "public/assets") if os.path.abspath(a.out).startswith(os.path.abspath("public/assets")) else a.out,
                        frameWidth=a.fw, frameHeight=a.fh, frames=n, mode=a.mode, anchor=a.anchor, scale=round(s, 4), names=names)}
    json.dump(meta, open(a.out.replace(".png", ".meta.json"), "w"), indent=1)
    print(f"OK {a.out}: {n} frames @ {a.fw}x{a.fh}, scale {s:.3f}")


if __name__ == "__main__":
    main()
