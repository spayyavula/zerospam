#!/usr/bin/env python3
"""Regenerate the app's brand images from the Reading Room tokens.

Usage (from the repo root, after `npm install`):  python3 apps/mobile/scripts/make-icons.py
Needs Pillow. Writes into apps/mobile/assets and apps/mobile/store/.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
FONTS = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'source-serif-4')
ITALIC = os.path.join(FONTS, '600SemiBold_Italic', 'SourceSerif4_600SemiBold_Italic.ttf')
REGULAR_ITALIC = os.path.join(FONTS, '400Regular_Italic', 'SourceSerif4_400Regular_Italic.ttf')
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
ASSETS = os.path.join(ROOT, 'apps', 'mobile', 'assets')
STORE = os.path.join(ROOT, 'apps', 'mobile', 'store')

PAPER, INK, SIGNAL, PAPER_DARK, INK_DARK = '#FBF8F1', '#0A0A0A', '#FFD52E', '#0E0E0C', '#F3EFE4'


def mark_mask(size, scale=1.0):
    """The ZeroSpam mark as an alpha mask: a bold zero cut by a mail slot (also reads as Ø,
    the empty set). Drawn at 4x and downsampled for clean edges."""
    S = size * 4
    u = S / 100 * scale
    c = S / 2
    m = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(m)
    # Ring: outer 60x72, inner 34x46 (units of 1/100 at scale 1).
    d.ellipse([c - 30 * u, c - 36 * u, c + 30 * u, c + 36 * u], fill=255)
    d.ellipse([c - 17 * u, c - 23 * u, c + 17 * u, c + 23 * u], fill=0)
    # The slot: a band cut through the ring, with the letter-slot bar inside it.
    d.rounded_rectangle([c - 36 * u, c - 4 * u, c + 36 * u, c + 4 * u], radius=4 * u, fill=0)
    d.rounded_rectangle([c - 30 * u, c - 2.5 * u, c + 30 * u, c + 2.5 * u], radius=2.5 * u, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def monogram(size, fg, bg=None, scale=1.0):
    """Mark in `fg` on `bg` (transparent when bg is None)."""
    im = Image.new('RGBA', (size, size), bg or (0, 0, 0, 0))
    ink = Image.new('RGBA', (size, size), fg)
    im.paste(ink, (0, 0), mark_mask(size, scale))
    return im


def wordmark(height, fg, pad=0.25):
    font = ImageFont.truetype(REGULAR_ITALIC, height)
    probe = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    parts = [('Zero', fg), ('·', SIGNAL), ('Spam', fg)]
    widths = [probe.textbbox((0, 0), p, font=font)[2] for p, _ in parts]
    l, t, r, b = probe.textbbox((0, 0), 'ZeroSpam', font=font)
    W = int(sum(widths) + height * pad * 2)
    H = int((b - t) + height * pad * 2)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = height * pad
    for (p, color), w in zip(parts, widths):
        d.text((x, height * pad - t), p, font=font, fill=color)
        x += w
    return im


def main():
    os.makedirs(STORE, exist_ok=True)
    monogram(1024, INK, SIGNAL).convert('RGB').save(os.path.join(ASSETS, 'icon.png'))
    # Adaptive icon: Android masks to a circle/squircle and keeps the centre ~66% safe.
    monogram(1024, INK, scale=0.66).save(os.path.join(ASSETS, 'adaptive-icon.png'))
    # Status-bar notification icon: Android uses only the alpha channel.
    note = monogram(96, (255, 255, 255, 255), scale=1.25)
    note.save(os.path.join(ASSETS, 'notification-icon.png'))
    wordmark(220, INK).save(os.path.join(ASSETS, 'splash-icon.png'))
    wordmark(220, INK_DARK).save(os.path.join(ASSETS, 'splash-icon-dark.png'))
    monogram(48, INK, SIGNAL).convert('RGB').save(os.path.join(ASSETS, 'favicon.png'))

    # Google Play listing assets.
    monogram(512, INK, SIGNAL).convert('RGB').save(os.path.join(STORE, 'play-icon-512.png'))
    fg = Image.new('RGB', (1024, 500), PAPER)
    wm = wordmark(150, INK, pad=0.1)
    mk = monogram(170, INK)
    x0 = (1024 - (mk.width + 24 + wm.width)) // 2
    fg.paste(mk, (x0, 95), mk)
    fg.paste(wm, (x0 + mk.width + 24, 120), wm)
    d = ImageDraw.Draw(fg)
    tag = 'Only the people you approve reach your inbox.'
    f2 = ImageFont.truetype(SANS, 34)
    l, t, r, b = d.textbbox((0, 0), tag, font=f2)
    d.text(((1024 - (r - l)) / 2, 340), tag, font=f2, fill='#2A2A2A')
    fg.save(os.path.join(STORE, 'play-feature-graphic.png'))
    print('wrote assets to', ASSETS, 'and', STORE)


if __name__ == '__main__':
    main()
