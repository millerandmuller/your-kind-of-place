FROM python:3.12-slim
WORKDIR /srv
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/app backend/app
COPY demo-data demo-data
ENV PYTHONUNBUFFERED=1 QLOO_CACHE_DIR=/tmp/qloo-cache
WORKDIR /srv/backend
# Cloud Run sets PORT; the Qloo and model keys come from the service environment, never the image.
CMD ["sh", "-c", "uvicorn app.api:app --host 0.0.0.0 --port ${PORT:-8080}"]
