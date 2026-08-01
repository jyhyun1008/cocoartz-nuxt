#!/bin/sh
set -e

node server/db/migrate.mjs

echo "서버 시작..."
exec node .output/server/index.mjs
