echo "Writing Content-Security-Policy default-src"

if [ -n "$CSP_DEFAULT_SRC" ]; then
  sed -i "s;default-src 'self';default-src 'self' $CSP_DEFAULT_SRC;" /etc/nginx/conf.d/security-headers.conf
  echo "Added $CSP_DEFAULT_SRC to CSP default-src"
else
  echo "No changed to CSP default-src"
fi
