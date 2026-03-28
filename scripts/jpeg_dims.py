"""Lê largura x altura de JPEGs (marcador SOF) sem Pillow."""
import os
import struct

def jpeg_size(path):
    with open(path, "rb") as f:
        if f.read(2) != b"\xff\xd8":
            return None
        while True:
            b = f.read(1)
            if not b:
                return None
            if b != b"\xff":
                continue
            while b == b"\xff":
                b = f.read(1)
            if not b:
                return None
            m = b[0]
            if m in (0xD8, 0xD9):
                continue
            ln = f.read(2)
            if len(ln) < 2:
                return None
            seglen = struct.unpack(">H", ln)[0]
            if m in (0xC0, 0xC1, 0xC2):
                f.read(1)
                h, w = struct.unpack(">HH", f.read(4))
                return w, h
            f.read(seglen - 2)


def main():
    root = os.path.join(os.path.dirname(__file__), "..", "src", "img")
    root = os.path.normpath(root)
    for name in sorted(os.listdir(root)):
        if not name.lower().endswith((".jpg", ".jpeg")):
            continue
        p = os.path.join(root, name)
        s = jpeg_size(p)
        print(f"{name}\t{s[0]}x{s[1]}" if s else f"{name}\t?")


if __name__ == "__main__":
    main()
