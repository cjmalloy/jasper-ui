echo "Writing Jasper Config to Service Worker"

nsgw="/usr/share/nginx/html/ngsw.json"

if [ -f "$nsgw" ]; then
    sed -i "s;\"/;\"$BASE_HREF;" "$nsgw"
    api_pattern=$(printf '%s/.*' "$JASPER_API" | sed 's/\\/\\\\/g; s/"/\\"/g')
    tmp="$nsgw.tmp"
    if awk -v api="$api_pattern" '
        BEGIN {
            inDataGroups = 0
            inPatterns = 0
            replaced = 0
        }
        /"dataGroups":[[:space:]]*\[/ {
            inDataGroups = 1
        }
        inDataGroups && !replaced && /"patterns":[[:space:]]*\[/ {
            inPatterns = 1
            print
            next
        }
        inPatterns {
            sub(/".*"/, "\"" api "\"")
            print
            inPatterns = 0
            replaced = 1
            next
        }
        {
            print
        }
    ' "$nsgw" > "$tmp"; then
        mv "$tmp" "$nsgw"
    else
        rm -f "$tmp"
        echo "Unable to update service worker API pattern."
    fi
else
    echo "Service worker not found."
fi
