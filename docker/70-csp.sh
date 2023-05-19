echo "Writing Content-Security-Policy"

if [ -n "$CSP_DEFAULT_SRC" ]; then
  sed -i "s;default-src 'self';default-src 'self' $CSP_DEFAULT_SRC;" /etc/nginx/conf.d/security-headers.conf
  echo "Added $CSP_DEFAULT_SRC to CSP default-src"
else
  echo "No changed to CSP default-src"
fi


if [ -n "$CSP_SCRIPT_SRC" ]; then
  sed -i "s;script-src 'self';script-src 'self' $CSP_SCRIPT_SRC;" /etc/nginx/conf.d/security-headers.conf
  echo "Added $CSP_SCRIPT_SRC to CSP script-src"
else
  echo "No changed to CSP script-src"
fi
