
nginx_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}
if [ -n "$JASPER_API_PROXY" ]; then
  JASPER_PROXY_USER_TAG=$(nginx_escape "${JASPER_PROXY_USER_TAG:-}")
  JASPER_PROXY_USER_ROLE=$(nginx_escape "${JASPER_PROXY_USER_ROLE:-}")
  JASPER_PROXY_READ_ACCESS=$(nginx_escape "${JASPER_PROXY_READ_ACCESS:-}")
  JASPER_PROXY_WRITE_ACCESS=$(nginx_escape "${JASPER_PROXY_WRITE_ACCESS:-}")
  JASPER_PROXY_TAG_READ_ACCESS=$(nginx_escape "${JASPER_PROXY_TAG_READ_ACCESS:-}")
  JASPER_PROXY_TAG_WRITE_ACCESS=$(nginx_escape "${JASPER_PROXY_TAG_WRITE_ACCESS:-}")
  config="
    location ^~ /api/ {
      port_in_redirect off;

      client_max_body_size                    2g;

      proxy_set_header Host                   \$http_host;

      # Add WebSocket support
      proxy_http_version 1.1;
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection \"upgrade\";
      # Increase timeouts for WebSocket connections
      proxy_read_timeout 86400s;
      proxy_send_timeout 86400s;

      #proxy_set_header X-Request-ID           \$req_id;
      proxy_set_header X-Real-IP              \$remote_addr;

      proxy_set_header X-Forwarded-For        \$remote_addr;
      proxy_set_header X-Forwarded-Host       \$http_host;
      proxy_set_header X-Forwarded-Port       \$server_port;
      proxy_set_header X-Forwarded-Proto      \$scheme;
      proxy_set_header X-Forwarded-Scheme     \$scheme;

      proxy_set_header X-Scheme               \$scheme;

      # Pass the original X-Forwarded-For
      proxy_set_header X-Original-Forwarded-For  \$http_x_forwarded_for;
      # Pass the original X-Forwarded-Host
      proxy_set_header X-Original-Forwarded-Host \$http_x_forwarded_host;

      # mitigate HTTPoxy Vulnerability
      # https://www.nginx.com/blog/mitigating-the-httpoxy-vulnerability-with-nginx/
      proxy_set_header Proxy                  \"\";

      # Never trust client supplied auth headers. Empty values are not passed upstream.
      # Authorization is intentionally passed through for bearer tokens.
      proxy_set_header User-Tag               \"${JASPER_PROXY_USER_TAG}\";
      proxy_set_header User-Role              \"${JASPER_PROXY_USER_ROLE}\";
      proxy_set_header Read-Access            \"${JASPER_PROXY_READ_ACCESS}\";
      proxy_set_header Write-Access           \"${JASPER_PROXY_WRITE_ACCESS}\";
      proxy_set_header Tag-Read-Access        \"${JASPER_PROXY_TAG_READ_ACCESS}\";
      proxy_set_header Tag-Write-Access       \"${JASPER_PROXY_TAG_WRITE_ACCESS}\";

      proxy_connect_timeout                   5s;
      #proxy_send_timeout                      60s;
      #proxy_read_timeout                      60s;

      proxy_buffering                         off;
      proxy_buffer_size                       8k;
      proxy_buffers                           4 4k;

      proxy_busy_buffers_size                 8k;

      proxy_max_temp_file_size                1024m;

      proxy_request_buffering                 on;

      proxy_cookie_domain                     off;
      proxy_cookie_path                       off;

      # In case of errors try the next upstream server before returning an error
      proxy_next_upstream                     error timeout;
      proxy_next_upstream_timeout             0;
      proxy_next_upstream_tries               3;

      include /etc/nginx/security-headers.conf;
      proxy_pass $JASPER_API_PROXY;

      proxy_redirect                          off;
    }
    "
fi
printf '%s\n' "$config"
printf '%s\n' "$config" > /etc/nginx/proxy.conf
echo "Wrote to /etc/nginx/proxy.conf"
