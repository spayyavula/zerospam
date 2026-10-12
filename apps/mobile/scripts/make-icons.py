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


def monogram(size, fg, bg=None, scale=1.0):
    """Italic Z with the signal-yellow dot, centred in a square."""
    im = Image.new('RGBA', (size, size), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    font = ImageFont.truetype(ITALIC, int(size * 0.66 * scale))
    l, t, r, b = d.textbbox((0, 0), 'Z', font=font)
    w, h = r - l, b - t
    dot = int(size * 0.13 * scale)
    gap = int(size * 0.02 * scale)
    total = w + gap + dot
    x = (size - total) / 2 - l
    y = (size - h) / 2 - t
    d.text((x, y), 'Z', font=font, fill=fg)
    dx = x + l + w + gap
    dy = y + t + h - dot
    d.ellipse([dx, dy, dx + dot, dy + dot], fill=SIGNAL)
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
    monogram(1024, INK, PAPER).convert('RGB').save(os.path.join(ASSETS, 'icon.png'))
    # Adaptive icon: Android masks to a circle/squircle and keeps the centre ~66% safe.
    monogram(1024, INK, scale=0.62).save(os.path.join(ASSETS, 'adaptive-icon.png'))
    # Status-bar notification icon: Android uses only the alpha channel.
    note = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    font = ImageFont.truetype(ITALIC, 80)
    nd = ImageDraw.Draw(note)
    l, t, r, b = nd.textbbox((0, 0), 'Z', font=font)
    nd.text(((96 - (r - l)) / 2 - l, (96 - (b - t)) / 2 - t), 'Z', font=font, fill='white')
    note.save(os.path.join(ASSETS, 'notification-icon.png'))
    wordmark(220, INK).save(os.path.join(ASSETS, 'splash-icon.png'))
    wordmark(220, INK_DARK).save(os.path.join(ASSETS, 'splash-icon-dark.png'))
    monogram(48, INK, PAPER).convert('RGB').save(os.path.join(ASSETS, 'favicon.png'))

    # Google Play listing assets.
    monogram(512, INK, PAPER).convert('RGB').save(os.path.join(STORE, 'play-icon-512.png'))
    fg = Image.new('RGB', (1024, 500), PAPER)
    wm = wordmark(150, INK, pad=0.1)
    fg.paste(wm, ((1024 - wm.width) // 2, 120), wm)
    d = ImageDraw.Draw(fg)
    tag = 'Only the people you approve reach your inbox.'
    f2 = ImageFont.truetype(SANS, 34)
    l, t, r, b = d.textbbox((0, 0), tag, font=f2)
    d.text(((1024 - (r - l)) / 2, 340), tag, font=f2, fill='#2A2A2A')
    d.rectangle([462, 300, 562, 306], fill=SIGNAL)
    fg.save(os.path.join(STORE, 'play-feature-graphic.png'))
    print('wrote assets to', ASSETS, 'and', STORE)


if __name__ == '__main__':
    main()
