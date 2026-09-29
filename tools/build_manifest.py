#!/usr/bin/env python3
"""Merge every public/assets/**/*.meta.json (+ audio.meta.json) into public/assets/manifest.json. Run from project root."""
import json, glob, os, hashlib
root = "public/assets"

def asset_file(png_path):
    """Path of the shipped file for a `<key>.png` meta: tools/optimize_assets.py may have replaced the PNG by a .webp (original kept in art/originals/)."""
    base = png_path[:-4]
    for ext in (".png", ".webp", ".jpg"):
        if os.path.exists(base + ext):
            return base + ext
    return png_path
m = {"sprites": {}, "images": {}, "audio": {}}
for f in sorted(glob.glob(f"{root}/**/*.meta.json", recursive=True)):
    d = json.load(open(f))
    if os.path.basename(f) == "audio.meta.json":
        m["audio"].update(d)
        continue
    for k, v in d.items():
        v["file"] = os.path.relpath(asset_file(f.replace(".meta.json", ".png")), root)
        (m["sprites"] if v.get("mode") in ("strip", "grid", "one") else m["images"])[k] = v
for f in sorted(glob.glob(f"{root}/audio/*.audio.json")):
    m["audio"].update(json.load(open(f)))
for f in sorted(glob.glob(f"{root}/**/*.image.json", recursive=True)):
    d = json.load(open(f))
    for k, v in d.items():
        v["file"] = os.path.relpath(asset_file(f.replace(".image.json", ".png")), root)
        m["images"][k] = v
# cache-busting version = hash of every referenced file's content, so assets stay HTTP-cached between visits until something really changes
h = hashlib.sha1()
for sec, base in (("sprites", ""), ("images", ""), ("audio", "audio/")):
    for k in sorted(m[sec]):
        p = f"{root}/{base}{m[sec][k].get('file', '')}"
        h.update(k.encode())
        if os.path.exists(p):
            h.update(open(p, "rb").read())
m["version"] = h.hexdigest()[:10]
json.dump(m, open(f"{root}/manifest.json", "w"), indent=1, sort_keys=True)
print(f"manifest: {len(m['sprites'])} sprites, {len(m['images'])} images, {len(m['audio'])} audio")
