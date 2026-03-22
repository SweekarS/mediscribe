#!/usr/bin/env python3
"""Build brand assets from public/logo-source.png: favicon, Electron app icon, tray icons."""
from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ELECTRON_ASSETS = ROOT / "electron" / "assets"
SOURCE = PUBLIC / "logo-source.png"
OUT_FAVICON = PUBLIC / "favicon.png"
OUT_APP_ICON = ELECTRON_ASSETS / "icon.png"
FAVICON_SIZE = 512
APP_ICON_SIZE = 512


def build_square_logo_png(size: int) -> Image.Image:
    """Full logo letterboxed on transparent square, resized to ``size`` (matches UI / app icon framing)."""
    im = Image.open(SOURCE).convert("RGBA")
    w, h = im.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def letterbox_rgba(im: Image.Image, size: int, bg: tuple[int, int, int, int] | None = None) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    scale = min(size / w, size / h)
    nw = max(1, int(w * scale))
    nh = max(1, int(h * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    canvas.paste(im, ((size - nw) // 2, (size - nh) // 2), im)
    return canvas


def rgba_to_mac_template(im: Image.Image) -> Image.Image:
    """Black glyph on transparent; alpha from luminance (for macOS *Template.png)."""
    im = im.convert("RGBA")
    w, h = im.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    src = im.load()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            lum = int(0.299 * r + 0.587 * g + 0.114 * b)
            na = lum * a // 255
            dst[x, y] = (0, 0, 0, na)
    return out


def add_badge_dot(im: Image.Image) -> Image.Image:
    """Small red notification dot (Windows/Linux color tray)."""
    w, h = im.size
    out = im.copy()
    draw = ImageDraw.Draw(out)
    br = max(2, int(w * 0.14))
    bx, by = w * 0.75, h * 0.2
    draw.ellipse((bx - br, by - br, bx + br, by + br), fill=(220, 50, 50, 255))
    return out


def add_badge_template_dot(im: Image.Image) -> Image.Image:
    """Solid black badge mark for macOS *Template* assets."""
    w, h = im.size
    out = im.copy()
    draw = ImageDraw.Draw(out)
    br = max(2, int(w * 0.14))
    bx, by = w * 0.75, h * 0.2
    draw.ellipse((bx - br, by - br, bx + br, by + br), fill=(0, 0, 0, 255))
    return out


def build_favicon() -> None:
    out = build_square_logo_png(FAVICON_SIZE)
    out.save(OUT_FAVICON, "PNG", optimize=True)
    print(f"Wrote {OUT_FAVICON}")


def build_app_icon() -> None:
    canvas = build_square_logo_png(APP_ICON_SIZE)
    ELECTRON_ASSETS.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT_APP_ICON, "PNG", optimize=True)
    print(f"Wrote {OUT_APP_ICON}")


def build_tray_icons() -> None:
    im = Image.open(SOURCE).convert("RGBA")
    ELECTRON_ASSETS.mkdir(parents=True, exist_ok=True)

    sizes = [
        ("tray-icon.png", 32),
        ("tray-iconTemplate.png", 22),
        ("tray-iconTemplate@2x.png", 44),
    ]
    for name, sz in sizes:
        lb = letterbox_rgba(im, sz)
        path = ELECTRON_ASSETS / name
        if name.startswith("tray-iconTemplate"):
            lb = rgba_to_mac_template(lb)
        lb.save(path, "PNG", optimize=True)
        print(f"Wrote {path}")

    for name, sz in (("tray-icon-badge.png", 32),):
        lb = letterbox_rgba(im, sz)
        lb = add_badge_dot(lb)
        path = ELECTRON_ASSETS / name
        lb.save(path, "PNG", optimize=True)
        print(f"Wrote {path}")

    for name, sz in (("tray-icon-badgeTemplate.png", 22), ("tray-icon-badgeTemplate@2x.png", 44)):
        lb = letterbox_rgba(im, sz)
        lb = rgba_to_mac_template(lb)
        lb = add_badge_template_dot(lb)
        path = ELECTRON_ASSETS / name
        lb.save(path, "PNG", optimize=True)
        print(f"Wrote {path}")


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing {SOURCE}")
    build_favicon()
    shutil.copy2(SOURCE, PUBLIC / "mediscribe-logo.png")
    print(f"Copied {SOURCE} -> {PUBLIC / 'mediscribe-logo.png'}")
    build_app_icon()
    build_tray_icons()


if __name__ == "__main__":
    main()
