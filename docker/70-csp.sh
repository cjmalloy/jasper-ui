echo "Writing Content-Security-Policy"

if [ -n "$CSP_DEFAULT_SRC" ]; then
  sed -i "s;default-src;default-src $CSP_DEFAULT_SRC;" /etc/nginx/security-headers.conf
  echo "Added $CSP_DEFAULT_SRC to CSP default-src"
else
  echo "No changed to CSP default-src"
fi

if [ -n "$CSP_SCRIPT_SRC" ]; then
  sed -i "s;script-src;script-src $CSP_SCRIPT_SRC;" /etc/nginx/security-headers.conf
  echo "Added $CSP_SCRIPT_SRC to CSP script-src"
else
  echo "No changed to CSP script-src"
fi

if [ -n "$CSP_STYLE_SRC" ]; then
  sed -i "s;style-src;style-src $CSP_STYLE_SRC;" /etc/nginx/security-headers.conf
  echo "Added $CSP_STYLE_SRC to CSP style-src"
else
  echo "No changed to CSP style-src"
fi

if [ -n "$CSP_CONNECT_SRC" ]; then
  sed -i "s;connect-src;connect-src $CSP_CONNECT_SRC;" /etc/nginx/security-headers.conf
  echo "Added $CSP_CONNECT_SRC to CSP connect-src"
else
  echo "No changed to CSP connect-src"
fi

if [ -n "$CSP_FONT_SRC" ]; then
  sed -i "s;font-src;font-src $CSP_FONT_SRC;" /etc/nginx/security-headers.conf
  echo "Added $CSP_FONT_SRC to CSP font-src"
else
  echo "No changed to CSP font-src"
fi

cat /etc/nginx/security-headers.conf
