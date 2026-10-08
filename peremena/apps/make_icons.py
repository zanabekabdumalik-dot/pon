"""Draw the «Перемена» app icon (a lesson-timer ring on ink blue) for Android and Windows.

usage: python3 make_icons.py <android_res_dir> <windows_dir>
"""
import math
import os
import sys

from PIL import Image, ImageDraw

INK = (35, 71, 176)       # #2347B0, the app's lesson colour
PAPER = (245, 247, 251)   # #F5F7FB
RED = (255, 143, 128)     # #FF8F80, the teacher's-pen mark (dark theme red)
TRACK = tuple(round(i * 0.65 + p * 0.35) for i, p in zip(INK, PAPER))  # faint ring, pre-blended on ink
SS = 4                    # supersampling factor


def ring(draw, cx, cy, r, w, frac):
    """A dial like the app's: faint full track, bright arc from 12 o'clock, a dot at its end."""
    box = (cx - r, cy - r, cx + r, cy + r)
    draw.ellipse(box, outline=TRACK + (255,), width=w)
    draw.arc(box, start=-90, end=-90 + 360 * frac, fill=PAPER + (255,), width=w)
    # round caps
    for ang in (-90, -90 + 360 * frac):
        a = math.radians(ang)
        x, y = cx + (r - w / 2) * math.cos(a), cy + (r - w / 2) * math.sin(a)
        draw.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=PAPER + (255,))
    a = math.radians(-90 + 360 * frac)
    x, y = cx + (r - w / 2) * math.cos(a), cy + (r - w / 2) * math.sin(a)
    d = w * 0.95
    draw.ellipse((x - d, y - d, x + d, y + d), fill=RED + (255,))


def legacy(size):
    """Full icon: rounded ink square with the ring (Android < 8 and Windows)."""
    S = size * SS
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    dr.rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * 0.22), fill=INK + (255,))
    ring(dr, S / 2, S / 2, S * 0.30, max(SS, int(S * 0.085)), 0.72)
    return im.resize((size, size), Image.LANCZOS)


def foreground(size):
    """Adaptive-icon foreground: 108dp canvas, ring inside the 66dp safe circle."""
    S = size * SS
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ring(ImageDraw.Draw(im), S / 2, S / 2, S * 0.24, max(SS, int(S * 0.07)), 0.72)
    return im.resize((size, size), Image.LANCZOS)


def main(res, win):
    for name, scale in (('mdpi', 1), ('hdpi', 1.5), ('xhdpi', 2), ('xxhdpi', 3), ('xxxhdpi', 4)):
        d = os.path.join(res, 'mipmap-' + name)
        os.makedirs(d, exist_ok=True)
        legacy(int(48 * scale)).save(os.path.join(d, 'ic_launcher.png'))
        foreground(int(108 * scale)).save(os.path.join(d, 'ic_launcher_foreground.png'))
    os.makedirs(win, exist_ok=True)
    big = legacy(256)
    big.save(os.path.join(win, 'icon.png'))
    big.save(os.path.join(win, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
