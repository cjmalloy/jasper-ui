#!/bin/sh

LOCALE=${JASPER_LOCALE:-en}
echo "Deploying locale: $LOCALE"

ln -s /usr/share/nginx/html /var/lib/jasper/$LOCALE
