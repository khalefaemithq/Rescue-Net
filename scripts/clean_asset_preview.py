from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path('/home/ubuntu/webdev-static-assets')
ASSETS = [
    'rescue-lightning-natural-preview.png',
    'rescue-harbor-surge-preview.png',
    'rescue-cliff-collapse-preview.png',
]


def is_background(red: int, green: int, blue: int) -> bool:
    bright_green = green > 55 and green > red * 1.22 and green > blue * 1.08
    bright_magenta = red > 75 and blue > 65 and green < (red + blue) * 0.42
    empty_black = red < 28 and green < 28 and blue < 28
    return bright_green or bright_magenta or empty_black


for asset in ASSETS:
    source = ROOT / asset
    target = ROOT / asset.replace('.png', '-alpha.png')
    image = Image.open(source).convert('RGBA')
    pixels = image.load()
    width, height = image.size
    pending = deque()
    visited = set()
    for x in range(width):
        pending.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        pending.extend(((0, y), (width - 1, y)))
    while pending:
        x, y = pending.popleft()
        if (x, y) in visited:
            continue
        visited.add((x, y))
        red, green, blue, alpha = pixels[x, y]
        if not is_background(red, green, blue):
            continue
        pixels[x, y] = (red, green, blue, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                pending.append((nx, ny))
    image.save(target, optimize=True)
    print(target)
