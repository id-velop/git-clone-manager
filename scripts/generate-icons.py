"""Generate antialiased Quick Clone icons using Python's standard library."""
from pathlib import Path
import struct
import zlib

OUTPUT = Path(__file__).resolve().parents[1] / 'chrome-extension' / 'icons'


def rounded_square(x, y, left, top, size, radius):
    dx = max(left + radius - x, 0, x - (left + size - radius))
    dy = max(top + radius - y, 0, y - (top + size - radius))
    return dx * dx + dy * dy <= radius * radius


def pixel(x, y):
    dx, dy = max(20 - x, 0, x - 108), max(20 - y, 0, y - 108)
    if dx * dx + dy * dy > 18 * 18:
        return (0, 0, 0, 0)
    back = rounded_square(x, y, 27, 27, 54, 10)
    back_inner = rounded_square(x, y, 33, 33, 42, 4)
    front = rounded_square(x, y, 47, 47, 54, 10)
    front_inner = rounded_square(x, y, 53, 53, 42, 4)
    foreground = (front and not front_inner) or (back and not back_inner and not front)
    return (255, 255, 255, 255) if foreground else (7, 190, 184, 255)


def chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))


for size in (16, 48, 128):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            samples = [pixel((x + (sx + .5) / 4) * 128 / size,
                             (y + (sy + .5) / 4) * 128 / size)
                       for sy in range(4) for sx in range(4)]
            raw.extend(round(sum(p[c] for p in samples) / 16) for c in range(4))
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    (OUTPUT / f'icon{size}.png').write_bytes(png)
