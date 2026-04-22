# syntax=docker/dockerfile:1.7

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps kept minimal. Add build-essential only if a wheel is missing.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
# Gunicorn for production-grade serving. Bind to $PORT so the container works
# on PaaS hosts (Render, Fly, etc.) that inject a dynamic port, with 8000 as
# the local fallback. Shell form is required so $PORT expands at runtime.
# Locally, `docker compose` can override this with `runserver` for live-reload.
CMD gunicorn server.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --access-logfile -
