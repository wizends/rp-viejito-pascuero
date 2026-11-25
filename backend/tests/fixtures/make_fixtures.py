"""Genera las imágenes de prueba incluidas en el repo (ejecutar una vez si se borran)."""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).parent
TEXT = [
    "Querido Viejito Pascuero:",
    "Este año me porté muy bien.",
    "Quiero una bicicleta roja y un libro de dinosaurios.",
    "Te dejo pan de pascua y cola de mono.",
    "Con cariño, Sofi",
]


def letter(path: Path, *, angle: float = 0.0, noise: bool = False, exif_gps: bool = False) -> None:
    img = Image.new("RGB", (1400, 900), (250, 244, 228))
    d = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=44)
    for i, line in enumerate(TEXT):
        d.text((90, 90 + i * 140), line, fill=(30, 30, 60), font=font)
    if noise:
        rnd = random.Random(7)
        for _ in range(9000):
            x, y = rnd.randrange(img.width), rnd.randrange(img.height)
            d.point((x, y), fill=(rnd.randrange(120, 200),) * 3)
        img = img.filter(ImageFilter.GaussianBlur(1.2))
    if angle:
        img = img.rotate(angle, expand=True, fillcolor=(250, 244, 228))
    if exif_gps:
        exif = Image.Exif()
        exif[0x8825] = {1: "S", 2: (33.0, 27.0, 0.0), 3: "W", 4: (70.0, 39.0, 0.0)}
        exif[0x010F] = "CamaraDePrueba"
        img.save(path, format="JPEG", exif=exif, quality=90)
        return
    img.save(path)


def scribble(path: Path) -> None:
    """Garabatos sin texto legible: el OCR debe fallar."""
    rnd = random.Random(3)
    img = Image.new("RGB", (900, 600), "white")
    d = ImageDraw.Draw(img)
    for _ in range(60):
        pts = [(rnd.randrange(900), rnd.randrange(600)) for _ in range(4)]
        d.line(pts, fill=(rnd.randrange(80), 0, rnd.randrange(120)), width=rnd.randrange(2, 7))
    img.save(path)


if __name__ == "__main__":
    letter(HERE / "carta_limpia.png")
    letter(HERE / "carta_torcida.png", angle=6)
    letter(HERE / "carta_ruidosa.png", noise=True)
    letter(HERE / "carta_con_gps.jpg", exif_gps=True)
    scribble(HERE / "garabatos.png")
    print("Listo")
