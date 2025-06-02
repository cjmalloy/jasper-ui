#!/bin/sh

LOCALE=${JASPER_LOCALE:-en}
echo "Deploying locale: $LOCALE"

mv /usr/share/nginx/html/$LOCALE/* /usr/share/nginx/html/
