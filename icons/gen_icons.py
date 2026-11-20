#!/usr/bin/env python3
"""mt-md icon: the Model Tether base mark (gen_icons.py from a shared/icons folder outside this repository) in the background, ".md" in orange in front.
Writes icons/mt-md.svg (large, 128px store icon), icons/mt-md-small.svg (heavy, for 16/32/48) and icon-{16,32,48,128}.png.
PNGs are rasterised by headless Chromium (set CHROMIUM, default `chromium`). The text is converted to outlines so the SVGs need no font."""
import os, subprocess, sys, tempfile
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image

here = Path(__file__).resolve().parent
base_dir = here.parent.parent.parent / "shared" / "icons"
if not base_dir.is_dir():
    sys.exit(f"the base mark script is not part of this repository: expected gen_icons.py in {base_dir}")
sys.path.insert(0, str(base_dir))
import gen_icons as base

FONT = "/usr/share/fonts/TTF/JetBrainsMono-ExtraBold.ttf"
ORANGE = "#f97316"
# text width (as a fraction of the 128 canvas) and the outline that keeps it clear of the ring behind it
LARGE = dict(params=base.LARGE, text_w=78, cy=82, outline=0)
SMALL = dict(params=base.SMALL, text_w=74, cy=82, outline=0)

def text_path(text, width, cx, cy):
    font = TTFont(FONT); gs = font.getGlyphSet(); cmap = font.getBestCmap()
    x = 0; pieces = []
    bp = BoundsPen(gs)
    for ch in text:
        g = cmap[ord(ch)]; pieces.append((g, x)); gs[g].draw(TransformPen(bp, (1, 0, 0, 1, x, 0))); x += font["hmtx"][g][0]
    x0, y0, x1, y1 = bp.bounds
    s = width / (x1 - x0)
    d = []
    for g, ox in pieces:
        pen = SVGPathPen(gs)
        # font units are y-up: flip, scale, and centre the ink box on (cx, cy)
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, cx - s*(x0 + x1)/2 + s*ox, cy + s*(y0 + y1)/2)))
        d.append(pen.getCommands())
    return " ".join(d)

def svg(v):
    mark = base.mark(v["params"])
    d = text_path(".md", v["text_w"], 64, v["cy"])
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><title>mt-md</title>'
            f'{mark}<path d="{d}" fill="{ORANGE}"/></svg>\n')

def raster(svg_file, size, out):
    chromium = os.environ.get("CHROMIUM", "chromium")
    with tempfile.TemporaryDirectory() as td:
        html = Path(td) / "a.html"; shot = Path(td) / "s.png"
        html.write_text(f'<body style="margin:0;background:transparent"><img src="{svg_file.as_uri()}" width="{size}" height="{size}"></body>')
        subprocess.run([chromium, "--headless=new", "--no-sandbox", f"--user-data-dir={td}/p", "--window-size=700,700",
                        "--default-background-color=00000000", "--hide-scrollbars", f"--screenshot={shot}", html.as_uri()],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
        Image.open(shot).convert("RGBA").crop((0, 0, size, size)).save(out)

if __name__ == "__main__":
    (here / "mt-md.svg").write_text(svg(LARGE))
    (here / "mt-md-small.svg").write_text(svg(SMALL))
    raster(here / "mt-md.svg", 128, here / "icon-128.png")
    for s in (16, 32, 48): raster(here / "mt-md-small.svg", s, here / f"icon-{s}.png")
