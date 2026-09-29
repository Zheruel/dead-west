# usage: .venv-art/bin/python tools/qa/contact-sheet.py out.png cols cellW file1 file2 ...   (grid of screenshots, id label on each cell)
import sys
from PIL import Image, ImageDraw
out, cols, cw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in files]
ch = int(cw * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cw, rows * ch), (20, 14, 10))
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * cw, (i // cols) * ch
    sheet.paste(im.resize((cw, ch)), (x, y))
    d.rectangle([x, y + ch - 22, x + 130, y + ch], fill=(0, 0, 0))
    d.text((x + 4, y + ch - 18), f.split('levels_')[-1].replace('.png', ''), fill=(255, 255, 255))
sheet.save(out)
print(out, sheet.size)
