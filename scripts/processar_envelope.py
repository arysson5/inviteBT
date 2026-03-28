"""Remove fundo preto e artefatos em carta_fechada.png (RGBA + crop)."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "carta_fechada.png"


def is_void(r: int, g: int, b: int, a: int) -> bool:
    if a < 14:
        return True
    m = max(r, g, b)
    s = r + g + b
    return m < 44 and s < 118


def parece_cinza_ou_preto(r: int, g: int, b: int) -> bool:
    """True se for fiapo preto/cinza — não bordô (vermelho dominante)."""
    m = max(r, g, b)
    n = min(r, g, b)
    if m > 62:
        return False
    if m - n > 38:
        return False
    return True


def flood_void_to_transparent(img: Image.Image) -> None:
    w, h = img.size
    px = img.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h and not visited[y][x]:
            r, g, b, a = px[x, y]
            if is_void(r, g, b, a):
                visited[y][x] = True
                q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while q:
        x, y = q.popleft()
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx in (x - 1, x, x + 1):
            for ny in (y - 1, y, y + 1):
                if nx == x and ny == y:
                    continue
                if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                    r2, g2, b2, a2 = px[nx, ny]
                    if is_void(r2, g2, b2, a2):
                        visited[ny][nx] = True
                        q.append((nx, ny))


def limpar_bordas_escuras(img: Image.Image, passes: int = 4) -> None:
    """Só remove cinza/preto junto a transparência — preserva sombras bordô."""
    w, h = img.size
    px = img.load()

    for _ in range(passes):
        alvo: list[tuple[int, int]] = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                r, g, b, a = px[x, y]
                if a < 25:
                    continue
                if not parece_cinza_ou_preto(r, g, b):
                    continue
                m = max(r, g, b)
                if m > 58:
                    continue
                viz_transp = 0
                for dx, dy in (
                    (-1, 0),
                    (1, 0),
                    (0, -1),
                    (0, 1),
                    (-1, -1),
                    (1, -1),
                    (-1, 1),
                    (1, 1),
                ):
                    r2, g2, b2, a2 = px[x + dx, y + dy]
                    if a2 < 28 or max(r2, g2, b2) < 30:
                        viz_transp += 1
                if viz_transp >= 2:
                    alvo.append((x, y))
        for x, y in alvo:
            px[x, y] = (0, 0, 0, 0)


def suavizar_manchas_claras(img: Image.Image) -> None:
    """Apaga pixels quase brancos isolados (JPEG / artefatos) no meio do bordô."""
    w, h = img.size
    px = img.load()
    for y in range(2, h - 2):
        for x in range(2, w - 2):
            r, g, b, a = px[x, y]
            if a < 160:
                continue
            if r + g + b < 580 or min(r, g, b) < 185:
                continue
            acc_r = acc_g = acc_b = 0
            cnt = 0
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                r2, g2, b2, a2 = px[x + dx, y + dy]
                if a2 > 80 and r2 + g2 + b2 < 380:
                    acc_r += r2
                    acc_g += g2
                    acc_b += b2
                    cnt += 1
            if cnt >= 3:
                px[x, y] = (
                    max(0, min(255, acc_r // cnt)),
                    max(0, min(255, acc_g // cnt)),
                    max(0, min(255, acc_b // cnt)),
                    a,
                )


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    flood_void_to_transparent(img)
    limpar_bordas_escuras(img, passes=4)
    suavizar_manchas_claras(img)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    img.save(SRC, optimize=True)
    print(f"Gravado {SRC} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
