# Bundled math font

`mt-math.woff2` is **STIX Two Math** (version 2.13 b171), (c) 2001-2021 The STI Pub Companies, licensed under the
SIL Open Font License 1.1 (`OFL.txt`). Source: <https://github.com/stipub/stixfonts> (release v2.13b171,
`fonts/static_otf/STIXTwoMath-Regular.otf`).

It is a subset (about 5,700 of 6,760 glyphs, 371 KB as WOFF2) made with `scripts/subset-math-font.py`: Latin, Greek,
punctuation, arrows, mathematical operators and symbols, and the mathematical alphanumerics. The OpenType `MATH` table is
kept; that table is what lets the browser stretch brackets, integrals and radicals.

The OFL allows bundling and subsetting; the font is not sold on its own, and the name "STIX Two Math" is a Reserved Font
Name only if the licence says so for modified versions: this file is renamed `mt-math` internally by being loaded as
the family "MT Math".
