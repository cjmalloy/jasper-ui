echo "Writing Jasper Config to Service Worker"

nsgw="/usr/share/nginx/html/ngsw.json"

if [ -f "$nsgw" ]; then
    sed -i "s;\"/;\"$BASE_HREF;" "$nsgw"
    tmp="$(mktemp)"
    awk -v api="$JASPER_API/api/.*" '
        /"name": "api"/ { in_api = 1 }
        in_api && /"patterns": \[/ { in_patterns = 1; print; next }
        in_patterns && /^[[:space:]]+"[^"]*"[[:space:]]*$/ {
            print "        \"" api "\""
            in_api = 0
            in_patterns = 0
            next
        }
        { print }
    ' "$nsgw" > "$tmp" && mv "$tmp" "$nsgw"
else
    echo "Service worker not found."
fi
