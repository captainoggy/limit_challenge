#!/bin/sh
# Applies migrations and seeds once (seed command is idempotent — it skips if
# data already exists). Then hands off to the CMD (runserver by default).
set -e

# Ensure the volume-mounted DB directory exists before Django touches it.
if [ -n "${DJANGO_DB_PATH}" ]; then
  mkdir -p "$(dirname "${DJANGO_DB_PATH}")"
fi

echo "▸ Applying migrations..."
python manage.py migrate --noinput

echo "▸ Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "▸ Seeding demo data (no-op if already seeded)..."
python manage.py seed_submissions

exec "$@"
