from pathlib import Path
from PIL import Image, ImageDraw

SOURCE = Path('/home/ubuntu/webdev-static-assets/calinou-lightning/lightning')
TARGET = Path('/home/ubuntu/webdev-static-assets/calinou-lightning-animation-cc0-preview.png')
frames = [Image.open(SOURCE / f'{index}.png').convert('RGBA') for index in range(11)]
tile_width, tile_height = 256, 192
columns, rows = 4, 3
sheet = Image.new('RGBA', (columns * tile_width, rows * tile_height), '#081729')
draw = ImageDraw.Draw(sheet)

for index, frame in enumerate(frames):
    frame.thumbnail((tile_width - 18, tile_height - 28), Image.Resampling.LANCZOS)
    x = (index % columns) * tile_width + (tile_width - frame.width) // 2
    y = (index // columns) * tile_height + 18 + (tile_height - 28 - frame.height) // 2
    sheet.alpha_composite(frame, (x, y))
    draw.text(((index % columns) * tile_width + 10, (index // columns) * tile_height + 7), f'frame {index}', fill='#b7d7ff')

sheet.save(TARGET, optimize=True)
print(TARGET)
