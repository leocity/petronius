"""Draw the app icons (web/icons/): an orange sticker with a black "P" and a hard black shadow, on the asphalt of the game.

- icon-192.png, icon-512.png: "any" icons (the sticker fills most of the square);
- icon-maskable-512.png: the sticker stays inside the central 80% safe zone, so any launcher mask can crop it;
- apple-touch-icon.png: 180 px, opaque (iOS draws its own rounded corners).
Everything is drawn at 4x and scaled down. Usage: python tools/build-icons.py   (needs: pip install pillow)
"""
import pathlib

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "icons"
ASPHALT, ORANGE, INK = (38, 42, 48), (239, 102, 48), (0, 0, 0)


def font(size):
    for name in ("arialbd.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw(size, safe):
    """Square icon of `size` px; the sticker fits in `safe` (fraction of the side) around the centre."""
    k = 4
    s = size * k
    img = Image.new("RGB", (s, s), ASPHALT)
    side = s * safe * 0.78                     # sticker side, leaving room for the shadow and the tilt
    sticker = Image.new("RGBA", (round(side), round(side)), (0, 0, 0, 0))
    d = ImageDraw.Draw(sticker)
    border = round(side * 0.045)
    d.rectangle((0, 0, side - 1, side - 1), fill=INK)
    d.rectangle((border, border, side - 1 - border, side - 1 - border), fill=ORANGE)
    f = font(round(side * 0.82))
    d.text((side / 2, side * 0.53), "P", font=f, fill=INK, anchor="mm")
    sticker = sticker.rotate(4, resample=Image.BICUBIC, expand=True)
    shadow = Image.new("RGBA", sticker.size, (0, 0, 0, 0))
    shadow.paste(INK + (255,), mask=sticker.getchannel("A"))
    off = round(side * 0.05)
    cx, cy = (s - sticker.width) // 2 - off // 2, (s - sticker.height) // 2 - off // 2
    img.paste(shadow, (cx + off, cy + off), shadow)
    img.paste(sticker, (cx, cy), sticker)
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    draw(192, 1.0).save(OUT / "icon-192.png")
    draw(512, 1.0).save(OUT / "icon-512.png")
    draw(512, 0.8).save(OUT / "icon-maskable-512.png")
    draw(180, 1.0).save(OUT / "apple-touch-icon.png")
    for p in sorted(OUT.iterdir()):
        print(f"{p.name:26} {p.stat().st_size // 1024:4d} KB")


if __name__ == "__main__":
    main()
