"""Build the original game's media (data/story/media.json) into web/assets/media/.

- backgrounds: location photos -> WebP, long side 1600 px;
- portraits: cut-out PNGs -> trimmed to the figure (alpha bounding box, so they centre themselves),
  1000 px tall, WebP with transparency;
- audio and videos: copied as they are.
Sources are relative to the project root ('../' = the DEMO folder next to it). Existing outputs are
skipped unless --force.

Usage: python tools/build-media.py [--force]     (needs: pip install pillow)
"""
import json
import pathlib
import shutil
import sys

from PIL import Image, ImageChops, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "assets" / "media"


def background(src, dst):
    im = Image.open(src).convert("RGB")
    im.thumbnail((1600, 1600), Image.LANCZOS)
    im.save(dst, "WEBP", quality=72, method=6)


def portrait(src, dst):
    im = Image.open(src).convert("RGBA")
    alpha = im.getchannel("A").point(lambda a: 255 if a > 24 else 0)   # ignore faint halo pixels
    # Stray hairlines left in some cut-outs (Petronio's "inside" has a white one along the top and right edge): drop
    # whatever is thinner than a few pixels and detached from the figure, so it neither shows nor stretches the crop.
    k = max(3, (im.height // 250) | 1)
    body = alpha.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k + 4))
    im.putalpha(ImageChops.multiply(im.getchannel("A"), body))
    alpha = ImageChops.multiply(alpha, body)
    im = im.crop(alpha.getbbox())
    h = 1000
    im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    im.save(dst, "WEBP", quality=82, method=6)


def main():
    force = "--force" in sys.argv
    media = json.loads((ROOT / "data" / "story" / "media.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [(f, src, background) for f, src in media["backgroundFiles"].items()]
    jobs += [(p["file"], p["src"], portrait) for p in media["portraits"].values()]
    jobs += [(a["file"], a["src"], shutil.copyfile) for a in {**media["audio"], **media["videos"]}.values()]
    for name, src, make in jobs:
        dst = OUT / name
        if dst.exists() and not force:
            continue
        make(ROOT / src, dst)
        print(f"{name:40} {dst.stat().st_size // 1024:6d} KB")
    total = sum(p.stat().st_size for p in OUT.iterdir()) // 1024
    print(f"{len(jobs)} files in {OUT.relative_to(ROOT)} ({total // 1024} MB)")


if __name__ == "__main__":
    main()
