from PIL import Image, ImageDraw, ImageFont

node_ids = ["residential", "hospital", "school", "harbor", "radio"]
labels = ["Residential", "Hospital", "School", "Harbor", "Radio"]
tiles = [Image.open(f"/home/ubuntu/road-main-{node_id}-review.png").convert("RGB").resize((406, 188)) for node_id in node_ids]
canvas = Image.new("RGB", (812, 564), "#081426")
draw = ImageDraw.Draw(canvas)
font = ImageFont.load_default()
for index, (tile, label) in enumerate(zip(tiles, labels)):
    x = (index % 2) * 406
    y = (index // 2) * 188
    canvas.paste(tile, (x, y))
    draw.rectangle((x + 8, y + 8, x + 82, y + 24), fill="#081426")
    draw.text((x + 12, y + 11), label, fill="#ffffff", font=font)
canvas.save("/home/ubuntu/main-road-corridors-contact.png")
