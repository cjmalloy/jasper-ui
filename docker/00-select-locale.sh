#!/bin/sh

LOCALE=${JASPER_LOCALE:-en}
echo "Deploying locale: $LOCALE"

cd /usr/share/nginx/html/
for dir in */; do
    [ -d "$dir" ] && [ "$dir" != "$LOCALE/" ] && rm -rf "$dir"
done
mv ./$LOCALE/* .
rmdir ./$LOCALE
nginx -s reload
