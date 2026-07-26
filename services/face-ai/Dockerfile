# Face-AI microservice image (CPU). Kept separate from the HR backend image.
# Build:  docker build -t face-ai ./face-ai
# Run:    docker run -p 9000:9000 --env-file face-ai/.env face-ai
FROM python:3.11-slim

WORKDIR /app

# System libs OpenCV/onnxruntime need at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Base deps first (cache layer).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ML stack: CPU-only torch first (avoids the multi-GB CUDA wheel), then the rest.
COPY requirements-ml.txt .
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
        torch torchvision \
    && pip install --no-cache-dir -r requirements-ml.txt

COPY app ./app

ENV FACE_ENGINE=insightface
EXPOSE 9000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]
