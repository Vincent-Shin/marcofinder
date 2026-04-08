#!/bin/sh
set -eu

: "${PORT:=10000}"

envsubst '${PORT}' \
  < /app/deploy/nginx.render.conf.template \
  > /etc/nginx/conf.d/default.conf

exec /usr/bin/supervisord -c /app/deploy/supervisord.render.conf
