echo "Setting Base HREF"

sed -i "s;\"\./;\"$BASE_HREF;" /usr/share/nginx/html/index.html
echo "Set Base HREF to $BASE_HREF"
