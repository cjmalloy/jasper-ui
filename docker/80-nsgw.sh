echo "Writing Jasper Config to Service Worker"

nsgw="/usr/share/nginx/html/ngsw.json"

if [ -f "$nsgw" ]; then
    sed -i "s;\"/;\"$BASE_HREF;" "$nsgw"
    jq ".dataGroups[0].patterns[0] = \"$JASPER_API\"" "$nsgw" | sponge "$nsgw"
else
    echo "Service worker not found."
fi
