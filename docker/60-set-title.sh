echo "Setting Title"

sed -i "s/JasperUi/$JASPER_TITLE/" /usr/share/nginx/html/index.html
echo "Set Title to $JASPER_TITLE"
