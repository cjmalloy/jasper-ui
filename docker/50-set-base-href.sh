echo "Setting Base HREF"

sed -i "s|base href=\"[^\"]*\"|base href=\"$BASE_HREF\"|" /usr/share/nginx/html/index.html
echo "Set Base HREF to $BASE_HREF"
