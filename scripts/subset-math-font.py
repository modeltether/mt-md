#!/usr/bin/env python3
"""Rebuild fonts/mt-math.woff2 from STIX Two Math.  usage: subset-math-font.py <STIXTwoMath-Regular.otf>
Download the source from https://github.com/stipub/stixfonts (release v2.13b171, fonts/static_otf/). Needs fontTools + brotli."""
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

src = Path(sys.argv[1])
out = Path(__file__).resolve().parent.parent / "fonts" / "mt-math.woff2"
opts = subset.Options()
opts.layout_features = ["*"]
opts.flavor = "woff2"
opts.notdef_outline = True
opts.hinting = False
opts.desubroutinize = True
ranges = [(0x20, 0x7e), (0xa0, 0x24f), (0x2b0, 0x2ff), (0x300, 0x36f), (0x370, 0x3ff), (0x1f00, 0x1fff), (0x2000, 0x206f),
          (0x2070, 0x209f), (0x20a0, 0x20cf), (0x20d0, 0x20ff), (0x2100, 0x214f), (0x2150, 0x218f), (0x2190, 0x21ff),
          (0x2200, 0x22ff), (0x2300, 0x23ff), (0x2460, 0x24ff), (0x2500, 0x257f), (0x25a0, 0x25ff), (0x2600, 0x26ff),
          (0x2700, 0x27bf), (0x27c0, 0x27ef), (0x27f0, 0x27ff), (0x2900, 0x297f), (0x2980, 0x29ff), (0x2a00, 0x2aff),
          (0x2b00, 0x2bff), (0x1d400, 0x1d7ff), (0x1ee00, 0x1eeff)]
font = TTFont(str(src))
sub = subset.Subsetter(opts)
sub.populate(unicodes=[c for a, b in ranges for c in range(a, b + 1)])
sub.subset(font)
font.flavor = "woff2"
font.save(str(out))
check = TTFont(str(out))
assert "MATH" in check, "the MATH table was lost"
print(f"{out}: {out.stat().st_size} bytes, {len(check.getGlyphOrder())} glyphs")
