echo "Setting Title"

sed -i "s/JasperUi/$JASPER_TITLE/" /usr/share/nginx/html/index.html
sed -i "s/jasper-ui/$JASPER_TITLE/" /usr/share/nginx/html/manifest.webmanifest
echo "Set Title to $JASPER_TITLE"
