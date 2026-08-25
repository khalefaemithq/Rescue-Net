from pathlib import Path
from PIL import Image

ASSETS = [
    (Path('/home/ubuntu/webdev-static-assets/rescue-lightning-calinou-inspired-preview.png'), Path('/home/ubuntu/webdev-static-assets/rescue-lightning-game.webp'), (600, 800)),
    (Path('/home/ubuntu/webdev-static-assets/rescue-harbor-surge-preview-alpha.png'), Path('/home/ubuntu/webdev-static-assets/rescue-harbor-surge-game.webp'), (900, 675)),
    (Path('/home/ubuntu/webdev-static-assets/rescue-cliff-collapse-preview-alpha.png'), Path('/home/ubuntu/webdev-static-assets/rescue-cliff-collapse-game.webp'), (900, 675)),
]

for source, target, maximum in ASSETS:
    image = Image.open(source).convert('RGBA')
    image.thumbnail(maximum, Image.Resampling.LANCZOS)
    image.save(target, 'WEBP', quality=88, method=6)
    print(f'{target.name}: {image.width}x{image.height}, {target.stat().st_size} bytes')
