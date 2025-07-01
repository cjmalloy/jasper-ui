#!/bin/sh

LOCALE=${JASPER_LOCALE:-en}
echo "Deploying locale: $LOCALE"

rm -rf /usr/share/nginx/html
ln -s /var/lib/jasper/$LOCALE /usr/share/nginx/html
