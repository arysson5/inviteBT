import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "index.html"
t = path.read_text(encoding="utf-8")
t = t.replace('width="1200"', 'width="4000"')
t = t.replace('height="1800"', 'height="6000"')


def add_responsive_img(m):
    tag = m.group(0)
    if "srcset=" in tag:
        return tag
    src_m = re.search(r'src="([^"]+)"', tag)
    if not src_m:
        return tag
    src = src_m.group(1)
    is_hero = "conteudo__hero-slide" in tag
    sizes = "100vw" if is_hero else "(max-width: 640px) calc(100vw - 5rem), min(30rem, 85vw)"
    return tag.replace(f'src="{src}"', f'src="{src}" srcset="{src} 4000w" sizes="{sizes}"', 1)


t = re.sub(r'<img[^>]*src="src/img/[^"]+"[^>]*>', add_responsive_img, t)
path.write_text(t, encoding="utf-8")
print("patched", path)
