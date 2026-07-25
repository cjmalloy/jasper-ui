echo "Writing Jasper Config to Service Worker"

nsgw="/usr/share/nginx/html/ngsw.json"

if [[ $JASPER_PWA != true ]]; then
    echo "PWA disabled."
    rm -f "$nsgw" /usr/share/nginx/html/ngsw-worker.js /usr/share/nginx/html/safety-worker.js /usr/share/nginx/html/worker-basic.min.js
    sed -i '/rel="manifest"/d' /usr/share/nginx/html/index.html
    exit 0
fi

if [ -f "$nsgw" ]; then
    sed -i "s;\"/;\"$BASE_HREF;" "$nsgw"
    escaped_jasper_api="$(printf '%s' "$JASPER_API" | sed 's/[][(){}.^$*+?|\\/]/\\&/g')"
    api_pattern="^${escaped_jasper_api}/api/.*"
    jq --arg pattern "$api_pattern" '.dataGroups[0].patterns[0] = $pattern' "$nsgw" | sponge "$nsgw"
else
    echo "Service worker not found."
fi
