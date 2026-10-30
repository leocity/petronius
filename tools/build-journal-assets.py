"""Build the web copies of the game's images into web/assets/journal/.

Sources: items in data/story/clues.json (clues, pickups, endings) and cast.json (portraits).
Each item has `file` (output name, .jpg or .png) and `src`:
  - 'path.pdf#page' or an image path, relative to Journal/ (glob patterns allowed for odd filenames);
  - '../Backgrounds/x.jpg' etc. for the original game's assets in the parent DEMO folder;
  - '@/tools/assets-src/x.svg' for files made for the revival (relative to the project root).
Optional build ops, applied in this order:
  - crop: [x0, y0, x1, y1] as fractions of the source;
  - rotate: 90 / 180 / 270 (counter-clockwise);
  - grid: {"items": [{"src", "label"?}], "cols": n} composes several sources into one sheet (then `src` is unused);
  - strips: [{"label", "c", "angle", "size"}] cuts tilted strips out of `src` and stands them upright in a column
    (see `strips()` for the units);
  - max: long side in px (default 1400).
PNG outputs keep transparency (sheets). Existing outputs are skipped unless --force; a changed item
needs --force (or deleting its file).

Usage: python tools/build-journal-assets.py [--force]     (needs: pip install pymupdf)
"""
import glob
import json
import pathlib
import sys

import pymupdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
JOURNAL = ROOT / "Journal"
OUT = ROOT / "web" / "assets" / "journal"
MAX = 1400


def items(clues, cast):
    for c in clues["clues"].values():
        yield from c.get("items", [])
        yield from c.get("reveal", {}).get("items", [])
        if "image" in c:
            yield c["image"]
    for group in clues.get("pickups", {}).values():
        for p in group:
            yield from p.get("items", [])
    for group in clues.get("endings", {}).values():
        yield from group
    for c in cast["characters"].values():
        yield {"file": c["file"], "src": c["src"], "max": 900}  # dialogue portraits: smaller


def resolve(pattern):
    base = ROOT if pattern.startswith(("@/", "../")) else JOURNAL   # "../" = the DEMO folder next to the project
    hits = sorted(glob.glob(str(base / pattern.removeprefix("@/"))))
    if len(hits) != 1:
        raise SystemExit(f"{pattern!r} matches {len(hits)} files")
    return pathlib.Path(hits[0])


def load(src, size, frac=None):
    """Source -> Pixmap (optionally cropped to `frac`), rendered so its long side is about `size` px."""
    path, _, page = src.rpartition("#")  # filenames may contain '#' too ("Poster … #2.pdf#1")
    if not page.isdigit():
        path, page = src, ""
    file = resolve(path)
    if file.suffix.lower() in (".pdf", ".svg"):
        p = pymupdf.open(file)[int(page or 1) - 1]
        r = p.rect
        clip = pymupdf.Rect(r.x0 + frac[0] * r.width, r.y0 + frac[1] * r.height,
                            r.x0 + frac[2] * r.width, r.y0 + frac[3] * r.height) if frac else r
        zoom = size / max(clip.width, clip.height)
        return p.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip, alpha=file.suffix.lower() == ".svg")
    pix = pymupdf.Pixmap(file)
    return crop(pix, frac) if frac else pix


def scale(pix, size):
    k = size / max(pix.width, pix.height)
    if k >= 1:
        return pix
    return pymupdf.Pixmap(pix, max(1, round(pix.width * k)), max(1, round(pix.height * k)), None)


def crop(pix, frac):
    # (Pixmap(src, w, h, clip) segfaults on Windows builds of PyMuPDF: copy the region instead.)
    x0, y0, x1, y1 = frac
    r = pymupdf.IRect(round(x0 * pix.width), round(y0 * pix.height), round(x1 * pix.width), round(y1 * pix.height))
    out = pymupdf.Pixmap(pix.colorspace, r, pix.alpha)
    out.copy(pix, r)
    out.set_origin(0, 0)
    return out


def rotate(pix, deg):
    w, h = (pix.height, pix.width) if deg in (90, 270) else (pix.width, pix.height)
    doc = pymupdf.open()
    page = doc.new_page(width=w, height=h)
    page.insert_image(page.rect, pixmap=pix, rotate=deg)
    return page.get_pixmap(alpha=bool(pix.alpha))


def grid(spec, size):
    """Compose sources in a grid of equal cells, each with an optional label under it."""
    pixes = [scale(load(it["src"], 600), 600) for it in spec["items"]]
    cols = spec["cols"]
    cw = max(p.width for p in pixes)
    ch = max(p.height for p in pixes)
    label_h = 100 if any("label" in it for it in spec["items"]) else 0
    pad = 30
    rows = -(-len(pixes) // cols)
    doc = pymupdf.open()
    page = doc.new_page(width=cols * (cw + pad) + pad, height=rows * (ch + label_h + pad) + pad)
    page.draw_rect(page.rect, color=None, fill=(1, 1, 1), overlay=False)
    for i, (p, it) in enumerate(zip(pixes, spec["items"])):
        x = pad + (i % cols) * (cw + pad)
        y = pad + (i // cols) * (ch + label_h + pad)
        page.insert_image(pymupdf.Rect(x, y, x + cw, y + ch), pixmap=p)
        if "label" in it:
            page.insert_textbox(pymupdf.Rect(x, y + ch + 8, x + cw, y + ch + label_h), it["label"],
                                fontsize=40, fontname="helv", color=(0, 0, 0), align=pymupdf.TEXT_ALIGN_CENTER)
    zoom = size / max(page.rect.width, page.rect.height)
    return page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)


def strips(it, size):
    """Cut tilted strips out of a page and stand them upright, one under the other, each with its label.
    `strips`: [{"label", "c": [x, y], "angle": deg, "size": [w, h]}], all as fractions of the page width/height
    (c as fractions of width and height; size both as fractions of the width); angle = tilt of the strip's
    long axis, clockwise positive as seen on the page (the strip is turned back by that much)."""
    from PIL import Image, ImageDraw, ImageFont
    page = load(it["src"], 3200)
    img = Image.frombytes("RGB", (page.width, page.height), page.samples)
    W, H = img.size
    out_w = 900
    try:
        font = ImageFont.truetype("arialbd.ttf", 56)
    except OSError:
        font = ImageFont.load_default()
    tiles = []
    for s in it["strips"]:
        cx, cy = s["c"][0] * W, s["c"][1] * H
        w, h = s["size"][0] * W, s["size"][1] * W
        spin = img.rotate(s["angle"], center=(cx, cy), resample=Image.BICUBIC, fillcolor=(255, 255, 255))
        tile = spin.crop((round(cx - w / 2), round(cy - h / 2), round(cx + w / 2), round(cy + h / 2)))
        tile = tile.resize((out_w, round(out_w * h / w)), Image.LANCZOS)
        tiles.append((s["label"], tile))
    pad, label_w = 30, 150
    height = pad + sum(t.height + pad for _, t in tiles)
    sheet = Image.new("RGB", (label_w + out_w + 2 * pad, height), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    y = pad
    for label, tile in tiles:
        draw.text((pad, y + tile.height / 2), label, fill=(239, 102, 48), font=font, anchor="lm")
        sheet.paste(tile, (label_w + pad, y))
        y += tile.height + pad
    k = size / max(sheet.size)
    if k < 1:
        sheet = sheet.resize((round(sheet.width * k), round(sheet.height * k)), Image.LANCZOS)
    return pymupdf.Pixmap(pymupdf.csRGB, sheet.width, sheet.height, sheet.tobytes(), False)


def build(it, dst):
    size = it.get("max", MAX)
    if "strips" in it:
        pix = strips(it, size)
    elif "grid" in it:
        pix = grid(it["grid"], size)
    else:
        pix = load(it["src"], size, it.get("crop"))
        if "rotate" in it:
            pix = rotate(pix, it["rotate"])
        pix = scale(pix, size)
    if dst.suffix == ".jpg":
        if pix.alpha:
            pix = pymupdf.Pixmap(pix, 0)
        pix.save(dst, jpg_quality=82)
    else:
        pix.save(dst)


def main():
    force = "--force" in sys.argv
    clues = json.loads((ROOT / "data" / "story" / "clues.json").read_text(encoding="utf-8"))
    cast = json.loads((ROOT / "data" / "story" / "cast.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    done = {}
    for it in items(clues, cast):
        f = it["file"]
        key = json.dumps({k: v for k, v in it.items() if k in ("src", "crop", "rotate", "grid", "strips", "max")}, sort_keys=True)
        if done.get(f, key) != key:
            raise SystemExit(f"{f} is built from two different specs")
        if f in done:
            continue
        done[f] = key
        dst = OUT / f
        if dst.exists() and not force:
            continue
        build(it, dst)
        print(ascii(f"{f:28} {dst.stat().st_size // 1024:5d} KB  <- {it.get('src', 'grid')}"))
    stale = sorted(p.name for p in OUT.iterdir() if p.name not in done)
    if stale:
        print("not referenced any more (delete if unused):", ", ".join(stale))
    print(f"{len(done)} assets in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
