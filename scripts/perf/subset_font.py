"""Subset one woff2 font to the given code points. Usage: subset_font.py in.woff2 out.woff2 e0a6,e1b2,...
Needs: pip install fonttools brotli. Fails loudly if any requested code point is missing from the result."""
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

src, dst, cps = sys.argv[1], sys.argv[2], [int(x, 16) for x in sys.argv[3].split(',') if x]
opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['*']   # keep whatever features the glyphs need
opts.name_IDs = []             # drop the name table strings: not needed to render
opts.hinting = False           # icon glyphs; hinting only adds bytes
opts.notdef_outline = True
font = TTFont(src)
sub = subset.Subsetter(opts)
sub.populate(unicodes=cps)
sub.subset(font)
font.flavor = 'woff2'
font.save(dst)
have = set(TTFont(dst).getBestCmap().keys())
missing = [hex(c) for c in cps if c not in have]
if missing:
    sys.exit('code points missing from the subset: ' + ', '.join(missing))
print(f'{len(cps)} glyphs kept')
