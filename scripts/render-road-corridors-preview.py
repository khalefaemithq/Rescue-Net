from PIL import Image, ImageDraw, ImageFont

source = "/home/ubuntu/webdev-static-assets/rescue-network-expanded-map-port-school-road.webp"
target = "/home/ubuntu/rescue-road-corridors-preview.png"
world_width = 1000
world_height = 640

corridors = {
    "1 HQ–الحي": [(555, 360), (530, 374), (498, 398), (462, 384), (430, 350), (395, 314), (370, 292), (350, 278), (326, 258), (302, 238), (278, 222), (250, 210)],
    "2 HQ–المستشفى": [(555, 360), (534, 339), (506, 319), (482, 298), (461, 271), (440, 245)],
    "3 HQ–المدرسة": [(555, 360), (578, 351), (604, 334), (634, 310), (666, 280), (706, 238), (730, 214), (750, 190)],
    "4 HQ–الميناء": [(555, 360), (548, 385), (536, 416), (575, 438), (620, 449), (674, 461), (730, 474), (774, 482), (810, 485)],
    "5 HQ–الاتصالات": [(555, 360), (528, 391), (495, 427), (455, 452), (410, 471), (360, 483), (320, 484), (290, 480)],
    "6 مدرسة–ميناء": [(750, 190), (724, 218), (706, 238), (724, 252), (742, 266), (756, 277), (768, 289), (778, 300), (786, 314), (792, 327), (792, 339), (790, 350), (782, 366), (774, 382), (771, 396), (770, 410), (776, 424), (782, 435), (790, 448), (798, 460), (804, 473), (810, 485)],
    "7 اتصالات–حي": [(290, 480), (320, 484), (360, 483), (410, 471), (455, 452), (435, 426), (412, 384), (395, 314), (370, 292), (350, 278), (326, 258), (302, 238), (278, 222), (250, 210)],
}
colors = [(255, 85, 85), (94, 217, 242), (255, 210, 82), (191, 117, 255), (105, 235, 151), (255, 141, 69), (245, 80, 180)]

image = Image.open(source).convert("RGBA")
scale = image.height / world_height
x_crop = (image.width - world_width * scale) / 2
overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)
font = ImageFont.load_default()

for index, (label, route) in enumerate(corridors.items()):
    points = [(round(x_crop + x * scale), round(y * scale)) for x, y in route]
    color = colors[index]
    draw.line(points, fill=(*color, 84), width=16, joint="curve")
    draw.line(points, fill=(*color, 238), width=5, joint="curve")
    start = points[0]
    draw.ellipse((start[0] - 9, start[1] - 9, start[0] + 9, start[1] + 9), fill=(*color, 255), outline=(255, 255, 255, 255), width=2)
    mid = points[max(1, len(points) // 2)]
    draw.rectangle((mid[0] + 5, mid[1] - 11, mid[0] + 54, mid[1] + 4), fill=(4, 18, 30, 210))
    draw.text((mid[0] + 8, mid[1] - 9), label.split()[0], fill=(255, 255, 255, 255), font=font)

Image.alpha_composite(image, overlay).convert("RGB").save(target, "PNG")
