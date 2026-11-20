#!/usr/bin/env python3
"""Chrome Web Store small promo tile (440x280) from the 128px icon. usage: store-tile.py <out.png>"""
import sys
from PIL import Image, ImageDraw, ImageFont
W, H = 440, 280
im = Image.new("RGB", (W, H), (20, 20, 43))
icon = Image.open("icons/icon-128.png").convert("RGBA")
im.paste(icon, (34, (H - 128) // 2 - 10), icon)
d = ImageDraw.Draw(im)
big = ImageFont.truetype("/usr/share/fonts/TTF/JetBrainsMono-ExtraBold.ttf", 52)
small = ImageFont.truetype("/usr/share/fonts/noto/NotoSans-Bold.ttf", 19)
d.text((188, 92), "mt-md", font=big, fill=(249, 115, 22))
d.text((190, 156), "Markdown, rendered.", font=small, fill=(230, 233, 240))
d.text((190, 182), "Diagrams · math · print", font=small, fill=(154, 164, 184))
im.save(sys.argv[1])
