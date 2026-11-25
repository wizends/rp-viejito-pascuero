FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.cache/hf \
    EASYOCR_MODULE_PATH=/app/.cache/easyocr

RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-spa libglib2.0-0 libgl1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt requirements-ml.txt ./
RUN pip install -r requirements.txt

# Motores pesados (EasyOCR + TrOCR). Desactivar con --build-arg INSTALL_ML=false
ARG INSTALL_ML=true
RUN if [ "$INSTALL_ML" = "true" ]; then \
      pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu \
      && pip install -r requirements-ml.txt ; \
    fi

COPY . .
RUN useradd --create-home --uid 1000 duende \
 && mkdir -p /app/data/uploads /app/.cache \
 && chown -R duende:duende /app
USER duende

EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips=*"]
