echo "Writing Jasper Config to Service Worker"

nsgw="/usr/share/nginx/html/ngsw.json"

if [ -f "$nsgw" ]; then
    sed -i "s;\"/;\"$BASE_HREF;" "$nsgw"
    escaped_jasper_api="$(printf '%s' "$JASPER_API" | sed 's/[][(){}.^$*+?|\\/]/\\&/g')"
    api_pattern="^${escaped_jasper_api}/api/.*"
    jq --arg pattern "$api_pattern" '.dataGroups[0].patterns[0] = $pattern' "$nsgw" | sponge "$nsgw"
else
    echo "Service worker not found."
fi
