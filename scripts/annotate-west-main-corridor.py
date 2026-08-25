from PIL import Image, ImageDraw, ImageFont

source = "/home/ubuntu/webdev-static-assets/rescue-network-expanded-map-port-school-road.webp"
target = "/home/ubuntu/rescue-road-corridor-west-main.png"
world_box = (220, 180, 620, 500)
world_width = 1000
world_height = 640

image = Image.open(source).convert("RGBA")
scale = image.height / world_height
x_crop = (image.width - world_width * scale) / 2
left, top, right, bottom = world_box
pixel_box = (round(x_crop + left * scale), round(top * scale), round(x_crop + right * scale), round(bottom * scale))
crop = image.crop(pixel_box).resize((1400, 1120), Image.Resampling.LANCZOS)
overlay = Image.new("RGBA", crop.size, (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)
font = ImageFont.load_default()
for x in range(left, right + 1, 20):
    px = round((x - left) * crop.width / (right - left))
    draw.line((px, 0, px, crop.height), fill=(255, 247, 141, 145), width=2)
    if x % 40 == 0:
        draw.rectangle((px + 3, 3, px + 31, 19), fill=(4, 18, 30, 210))
        draw.text((px + 5, 6), str(x), fill=(255, 250, 210, 255), font=font)
for y in range(top, bottom + 1, 20):
    py = round((y - top) * crop.height / (bottom - top))
    draw.line((0, py, crop.width, py), fill=(255, 247, 141, 145), width=2)
    if y % 40 == 0:
        draw.rectangle((3, py + 3, 31, py + 19), fill=(4, 18, 30, 210))
        draw.text((5, py + 6), str(y), fill=(255, 250, 210, 255), font=font)
Image.alpha_composite(crop, overlay).convert("RGB").save(target, "PNG")
