"""Generate antialiased Quick Clone folder-and-download icons using Python's standard library."""
from pathlib import Path
import struct
import zlib

OUTPUT = Path(__file__).resolve().parents[1] / 'chrome-extension' / 'icons'
FOLDER = [(25, 39), (49, 39), (56, 47), (103, 47), (103, 91), (25, 91)]
INNER = [(31, 45), (46, 45), (53, 53), (97, 53), (97, 85), (31, 85)]
ARROW = [(60, 55), (68, 55), (68, 70), (76, 70), (64, 82), (52, 70), (60, 70)]


def inside(x, y, polygon):
    result = False
    for i, (ax, ay) in enumerate(polygon):
        bx, by = polygon[i - 1]
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            result = not result
    return result


def pixel(x, y):
    dx, dy = max(20 - x, 0, x - 108), max(20 - y, 0, y - 108)
    if dx * dx + dy * dy > 18 * 18:
        return (0, 0, 0, 0)
    foreground = (inside(x, y, FOLDER) and not inside(x, y, INNER)) or inside(x, y, ARROW)
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
