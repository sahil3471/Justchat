#!/usr/bin/env python3
"""Generate Nadi Tracker PNG icons using only Python stdlib (zlib + struct)."""
import os, struct, zlib, math

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'app', 'icons')
os.makedirs(OUT_DIR, exist_ok=True)

# Colors (RGBA)
BG       = (15, 17, 21, 255)     # --bg
IDA      = (108, 180, 255, 255)  # blue
PINGLA   = (255, 176, 102, 255)  # orange
WHITE    = (232, 236, 243, 255)
BORDER   = (38, 44, 55, 255)


def write_png(path, pixels, w, h):
    def chunk(t, d):
        return (struct.pack('>I', len(d)) + t + d +
                struct.pack('>I', zlib.crc32(t + d) & 0xffffffff))
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            raw.extend(pixels[y * w + x])
    out = b'\x89PNG\r\n\x1a\n'
    out += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))  # RGBA
    out += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    out += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(out)


def blend(dst, src):
    sa = src[3] / 255
    if sa == 0:
        return dst
    if sa == 1:
        return src
    da = dst[3] / 255
    out_a = sa + da * (1 - sa)
    if out_a == 0:
        return (0, 0, 0, 0)
    r = (src[0] * sa + dst[0] * da * (1 - sa)) / out_a
    g = (src[1] * sa + dst[1] * da * (1 - sa)) / out_a
    b = (src[2] * sa + dst[2] * da * (1 - sa)) / out_a
    return (int(r), int(g), int(b), int(out_a * 255))


class Canvas:
    def __init__(self, w, h, bg):
        self.w, self.h = w, h
        self.px = [bg] * (w * h)

    def put(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            i = y * self.w + x
            self.px[i] = blend(self.px[i], c)

    def filled_rounded_rect(self, x0, y0, x1, y1, radius, color):
        for y in range(y0, y1):
            for x in range(x0, x1):
                # distance-to-corner check
                dx = max(x0 + radius - x, 0, x - (x1 - 1 - radius))
                dy = max(y0 + radius - y, 0, y - (y1 - 1 - radius))
                d = math.hypot(dx, dy)
                if d <= radius:
                    # antialias edge
                    a = max(0.0, min(1.0, radius - d))
                    c = (color[0], color[1], color[2], int(color[3] * a))
                    self.put(x, y, c)
                elif d <= radius + 1:
                    a = max(0.0, min(1.0, radius + 1 - d))
                    c = (color[0], color[1], color[2], int(color[3] * a))
                    self.put(x, y, c)

    def filled_circle(self, cx, cy, r, color):
        x0 = int(cx - r - 1); x1 = int(cx + r + 2)
        y0 = int(cy - r - 1); y1 = int(cy + r + 2)
        for y in range(y0, y1):
            for x in range(x0, x1):
                d = math.hypot(x - cx, y - cy)
                if d <= r:
                    self.put(x, y, color)
                elif d <= r + 1:
                    a = max(0.0, min(1.0, r + 1 - d))
                    c = (color[0], color[1], color[2], int(color[3] * a))
                    self.put(x, y, c)

    def half_circle(self, cx, cy, r, color, side):
        """side='left' or 'right'."""
        x0 = int(cx - r - 1); x1 = int(cx + r + 2)
        y0 = int(cy - r - 1); y1 = int(cy + r + 2)
        for y in range(y0, y1):
            for x in range(x0, x1):
                if side == 'left' and x > cx: continue
                if side == 'right' and x < cx: continue
                d = math.hypot(x - cx, y - cy)
                if d <= r:
                    self.put(x, y, color)
                elif d <= r + 1:
                    a = max(0.0, min(1.0, r + 1 - d))
                    c = (color[0], color[1], color[2], int(color[3] * a))
                    self.put(x, y, c)

    def save(self, path):
        write_png(path, self.px, self.w, self.h)


def render_icon(size, maskable=False):
    """A two-tone moon/sun split symbol, evoking Ida (cool) + Pingla (warm)."""
    c = Canvas(size, size, (0, 0, 0, 0))
    # Background: rounded square (or full bleed if maskable for safe-zone)
    if maskable:
        # Maskable wants the icon to fill the canvas; pad inner content to safe zone (~80%)
        c.filled_rounded_rect(0, 0, size, size, int(size * 0.06), BG)
    else:
        pad = int(size * 0.04)
        c.filled_rounded_rect(pad, pad, size - pad, size - pad, int(size * 0.18), BG)

    # Inner symbol — taijitu-like split: left half pingla (warm), right half ida (cool).
    cx, cy = size / 2, size / 2
    r = int(size * (0.30 if maskable else 0.34))
    c.half_circle(cx, cy, r, PINGLA, 'left')
    c.half_circle(cx, cy, r, IDA, 'right')

    # Two small dots (yin-yang style)
    sr = int(r * 0.18)
    c.filled_circle(cx, cy - r * 0.5, sr, IDA)         # Ida dot inside Pingla? swap: above is at center-vertical; use side offsets
    c.filled_circle(cx, cy + r * 0.5, sr, PINGLA)

    # Border ring
    for ang in range(0, 720):
        a = ang / 2 * math.pi / 180
        x = cx + r * math.cos(a)
        y = cy + r * math.sin(a)
        c.put(int(round(x)), int(round(y)), WHITE)
        # thicken
        c.put(int(round(x)) + 1, int(round(y)), WHITE)
        c.put(int(round(x)), int(round(y)) + 1, WHITE)

    return c


def main():
    sizes = [(192, 'icon-192.png', False),
             (512, 'icon-512.png', False),
             (512, 'icon-maskable-512.png', True)]
    for s, name, maskable in sizes:
        c = render_icon(s, maskable=maskable)
        out = os.path.join(OUT_DIR, name)
        c.save(out)
        print('wrote', out, s)


if __name__ == '__main__':
    main()
