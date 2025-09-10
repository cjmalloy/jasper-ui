#!/bin/sh

LOCALE=${JASPER_LOCALE:-en}
echo "Deploying locale: $LOCALE"

if [ ! -d "/var/lib/jasper/$LOCALE" ]; then
  echo "Locale $LOCALE does not exist, defaulting to en"
  LOCALE="en"

rm -rf /usr/share/nginx/html
ln -s /var/lib/jasper/$LOCALE /usr/share/nginx/html
