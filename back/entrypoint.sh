#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput
exec gunicorn world_cup_pool.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 3
