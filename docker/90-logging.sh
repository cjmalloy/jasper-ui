echo "Writing Logging Levels"

if [ -n "$NGINX_ENTRYPOINT_QUIET_LOGS" ]; then
  sed -i "s/access_log/access_log off; #/" /etc/nginx/nginx.conf
  echo "Disabled access logs"
fi

cat /etc/nginx/nginx.conf
