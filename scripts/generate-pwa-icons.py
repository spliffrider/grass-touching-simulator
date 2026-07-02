from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
GRASS_TILE = PUBLIC / "assets" / "tiles" / "grass-thick-lush.png"
GRASS_TOUCHER = PUBLIC / "assets" / "ui" / "classes" / "grass-toucher.png"


def resampling_nearest():
    return getattr(Image, "Resampling", Image).NEAREST


def resampling_lanczos():
    return getattr(Image, "Resampling", Image).LANCZOS


def make_texture(size: int) -> Image.Image:
    background = Image.new("RGBA", (size, size), (14, 40, 23, 255))
    tile = Image.open(GRASS_TILE).convert("RGBA")
    tile_scale = max(2, round(size / 96))
    tile = tile.resize((tile.width * tile_scale, tile.height * tile_scale), resampling_nearest())

    pattern = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for y in range(-tile.height, size + tile.height, tile.height):
        offset = 0 if (y // tile.height) % 2 == 0 else -(tile.width // 3)
        for x in range(offset, size + tile.width, tile.width):
            pattern.alpha_composite(tile, (x, y))

    pattern = ImageEnhance.Color(pattern).enhance(0.58)
    pattern = ImageEnhance.Brightness(pattern).enhance(0.48)
    pattern.putalpha(62)
    background.alpha_composite(pattern)

    draw = ImageDraw.Draw(background, "RGBA")
    inset = round(size * 0.047)
    corner = round(size * 0.16)
    draw.rounded_rectangle(
        (inset, inset, size - inset, size - inset),
        radius=corner,
        outline=(194, 238, 142, 72),
        width=max(3, round(size * 0.014)),
    )
    draw.rounded_rectangle(
        (inset * 2, inset * 2, size - inset * 2, size - inset * 2),
        radius=round(corner * 0.78),
        outline=(38, 87, 45, 108),
        width=max(2, round(size * 0.008)),
    )

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow, "RGBA")
    glow_box = (
        round(size * 0.16),
        round(size * 0.19),
        round(size * 0.84),
        round(size * 0.82),
    )
    glow_draw.ellipse(glow_box, fill=(189, 230, 96, 44))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(2, round(size * 0.035))))
    background.alpha_composite(glow)

    return background


def paste_touch_art(canvas: Image.Image, maskable: bool) -> None:
    size = canvas.width
    art = Image.open(GRASS_TOUCHER).convert("RGBA")
    bbox = art.getbbox()
    if bbox:
        art = art.crop(bbox)

    target_width = round(size * (0.74 if maskable else 0.8))
    target_height = round(art.height * target_width / art.width)
    art = art.resize((target_width, target_height), resampling_nearest())

    x = round((size - art.width) / 2)
    y = round(size * 0.54 - art.height / 2)

    alpha = art.getchannel("A")
    shadow_alpha = alpha.filter(ImageFilter.MaxFilter(max(3, round(size * 0.026) | 1)))
    shadow_alpha = shadow_alpha.filter(ImageFilter.GaussianBlur(radius=max(1, round(size * 0.014))))
    shadow = Image.new("RGBA", art.size, (4, 20, 10, 165))
    shadow.putalpha(shadow_alpha)
    canvas.alpha_composite(shadow, (x + round(size * 0.018), y + round(size * 0.022)))

    canvas.alpha_composite(art, (x, y))


def build_icon(size: int, maskable: bool) -> Image.Image:
    canvas = make_texture(size)
    paste_touch_art(canvas, maskable)
    return canvas


def save_png(path: Path, image: Image.Image, size: int) -> None:
    resized = image if image.width == size else image.resize((size, size), resampling_lanczos())
    resized.save(path, "PNG", optimize=True)


def main() -> None:
    any_512 = build_icon(512, maskable=False)
    maskable_512 = build_icon(512, maskable=True)

    outputs = {
        "icon-512.png": (any_512, 512),
        "icon-192.png": (any_512, 192),
        "icon-512-v2.png": (any_512, 512),
        "icon-192-v2.png": (any_512, 192),
        "icon-maskable-512-v2.png": (maskable_512, 512),
        "icon-maskable-192-v2.png": (maskable_512, 192),
        "apple-touch-icon.png": (any_512, 180),
        "favicon-32x32.png": (any_512, 32),
    }
    for name, (source, size) in outputs.items():
        save_png(PUBLIC / name, source, size)

    any_512.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == "__main__":
    main()
