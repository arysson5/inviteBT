"""Recorta margens pretas de src/carta_fechada.png (só o envelope)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "carta_fechada.png"


def bbox_conteudo(img: Image.Image) -> tuple[int, int, int, int] | None:
    """Retângulo mínimo que contém pixels que não são fundo preto."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    def eh_fundo(r: int, g: int, b: int, a: int) -> bool:
        if a < 40:
            return True
        m = max(r, g, b)
        s = r + g + b
        return m < 22 and s < 55

    min_x, min_y = w, h
    max_x, max_y = 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not eh_fundo(r, g, b, a):
                found = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if not found:
        return None
    return (min_x, min_y, max_x + 1, max_y + 1)


def main() -> None:
    img = Image.open(SRC)
    bb = bbox_conteudo(img)
    if not bb:
        print("Nada a recortar.")
        return
    out = img.crop(bb)
    out.save(SRC, optimize=True)
    print(f"Recortado {SRC}: {img.size} -> {out.size}")


if __name__ == "__main__":
    main()
