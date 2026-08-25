from PIL import Image, ImageDraw

source = "/home/ubuntu/webdev-static-assets/rescue-network-expanded-map-port-school-road.webp"
target = "/home/ubuntu/rescue-road-corridor-west-overlay.png"
world_box = (220, 180, 620, 500)
world_width = 1000
world_height = 640

routes = [
    ((255, 91, 91), [(555, 360), (542, 370), (530, 374), (516, 393), (498, 398), (482, 395), (462, 384), (447, 370), (430, 350), (414, 332), (395, 314), (382, 303), (370, 292), (357, 284), (350, 278), (338, 268), (326, 258), (314, 247), (302, 238), (290, 230), (278, 222), (264, 214), (250, 210)]),
    ((103, 230, 154), [(555, 360), (544, 373), (528, 391), (512, 409), (495, 427), (476, 441), (455, 452), (433, 462), (410, 471), (385, 478), (360, 483), (340, 484), (320, 484), (304, 482), (290, 480)]),
    ((246, 87, 185), [(290, 480), (304, 482), (320, 484), (340, 484), (360, 483), (385, 478), (410, 471), (433, 462), (455, 452), (447, 439), (435, 426), (425, 405), (412, 384), (403, 350), (395, 314), (382, 303), (370, 292), (357, 284), (350, 278), (338, 268), (326, 258), (314, 247), (302, 238), (290, 230), (278, 222), (264, 214), (250, 210)]),
]

image = Image.open(source).convert("RGBA")
scale = image.height / world_height
x_crop = (image.width - world_width * scale) / 2
left, top, right, bottom = world_box
pixel_box = (round(x_crop + left * scale), round(top * scale), round(x_crop + right * scale), round(bottom * scale))
crop = image.crop(pixel_box).resize((1400, 1120), Image.Resampling.LANCZOS)
overlay = Image.new("RGBA", crop.size, (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)

def project(point):
    x, y = point
    return (round((x - left) * crop.width / (right - left)), round((y - top) * crop.height / (bottom - top)))

for color, route in routes:
    points = [project(point) for point in route]
    draw.line(points, fill=(*color, 85), width=24, joint="curve")
    draw.line(points, fill=(*color, 250), width=7, joint="curve")

Image.alpha_composite(crop, overlay).convert("RGB").save(target, "PNG")
