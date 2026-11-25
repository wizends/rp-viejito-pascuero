"""Preprocesamiento con OpenCV para cartas fotografiadas.

Pasos: escala de grises → corrección de perspectiva (si se detecta la hoja) →
deskew → reducción de ruido → binarización adaptativa.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from numpy.typing import NDArray

Img = NDArray[np.uint8]


def load(path: Path) -> Img:
    data = np.fromfile(str(path), dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("No se pudo leer la imagen")
    return img.astype(np.uint8)


def _order_corners(pts: NDArray[np.float32]) -> NDArray[np.float32]:
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array(
        [pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]],
        dtype=np.float32,
    )


def correct_perspective(gray: Img) -> Img:
    """Busca el contorno cuadrilátero más grande (la hoja) y lo endereza."""
    h, w = gray.shape[:2]
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
        area = cv2.contourArea(c)
        if area < 0.4 * h * w:
            break
        approx = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
        if len(approx) == 4:
            src = _order_corners(approx.reshape(4, 2).astype(np.float32))
            tl, tr, br, bl = src
            width = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
            height = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
            if width < 100 or height < 100:
                break
            dst = np.array(
                [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype=np.float32
            )
            m = cv2.getPerspectiveTransform(src, dst)
            return cv2.warpPerspective(gray, m, (width, height)).astype(np.uint8)
    return gray


def estimate_skew(gray: Img) -> float:
    """Ángulo (grados) de inclinación del texto usando minAreaRect sobre la tinta."""
    inv = cv2.bitwise_not(gray)
    thr = cv2.threshold(inv, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    pts = cv2.findNonZero(thr)
    if pts is None or len(pts) < 50:
        return 0.0
    angle = float(cv2.minAreaRect(pts)[-1])
    # Normaliza a (-45, 45]: el signo indica hacia dónde rotar para enderezar.
    if angle > 45:
        angle -= 90
    elif angle <= -45:
        angle += 90
    return angle if abs(angle) <= 20 else 0.0


def deskew(gray: Img) -> Img:
    angle = estimate_skew(gray)
    if abs(angle) < 0.3:
        return gray
    h, w = gray.shape[:2]
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(
        gray, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    ).astype(np.uint8)


def preprocess(img: Img) -> tuple[Img, Img]:
    """Devuelve (gris_enderezado, binarizada). El OCR usa una u otra según el motor."""
    gray: Img = (cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img).astype(np.uint8)
    gray = correct_perspective(gray)
    gray = deskew(gray)
    denoised = cv2.fastNlMeansDenoising(gray, None, h=12, templateWindowSize=7, searchWindowSize=21)
    binary = cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
    )
    return denoised.astype(np.uint8), binary.astype(np.uint8)


def split_lines(binary: Img, min_height: int = 12) -> list[tuple[int, int]]:
    """Segmenta renglones por proyección horizontal (útil para TrOCR, que lee una línea)."""
    ink = (255 - binary).sum(axis=1) / 255
    threshold = max(2.0, float(ink.max()) * 0.04) if ink.size else 0
    rows = ink > threshold
    lines: list[tuple[int, int]] = []
    start: int | None = None
    for y, on in enumerate(rows):
        if on and start is None:
            start = y
        elif not on and start is not None:
            if y - start >= min_height:
                lines.append((max(0, start - 4), min(len(rows), y + 4)))
            start = None
    if start is not None and len(rows) - start >= min_height:
        lines.append((start, len(rows)))
    return lines
