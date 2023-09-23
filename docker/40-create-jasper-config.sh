echo "Writing Jasper Config"

echo "$JASPER_VERSION"
echo "$TIMESTAMP"

echo "$JASPER_VERSION"
if [[ $JASPER_VERSION = master || $JASPER_VERSION = latest ]]; then
    JASPER_VERSION=
fi
echo "$JASPER_VERSION"

config="
{
  \"title\": \"$JASPER_TITLE\",
  \"version\": \"${JASPER_VERSION:-Build: $(cat /build-timestamp)}\",
  \"api\": \"$JASPER_API\",
  \"logout\": \"$JASPER_LOGOUT\",
  \"login\": \"$JASPER_LOGIN\",
  \"signup\": \"$JASPER_SIGNUP\",
  \"scim\": ${JASPER_SCIM-false},
  \"multiTenant\": ${JASPER_MULTI_TENANT-false},
  \"websockets\": ${JASPER_WEBSOCKETS-true},
  \"support\": ${JASPER_SUPPORT-"+support"},
  \"allowedSchemes\": ${JASPER_ALLOWED_SCHEMES-[\"http:\", \"https:\", \"ftp:\", \"tel:\", \"mailto:\", \"magnet:\"]},
  \"maxPlugins\": ${JASPER_MAX_PLUGINS-0},
  \"maxTemplates\": ${JASPER_MAX_TEMPLATES-0},
  \"maxOrigins\": ${JASPER_MAX_ORIGINS-0},
  \"fetchBatch\": ${JASPER_FETCH_BATCH-0},
  \"token\": \"${JASPER_TOKEN}\",
  \"codeFlow\": ${JASPER_CODE_FLOW-false},
  \"implicitFlow\": ${JASPER_IMPLICIT_FLOW-false},
  \"issuer\": \"$JASPER_ISSUER\",
  \"clientId\": \"$JASPER_CLIENT_ID\",
  \"scope\": \"$JASPER_SCOPE\",
  \"preAuthScrape\": ${PRE_AUTH_SCRAPE-true}
}
"
echo "$config"
echo "$config" > /usr/share/nginx/html/assets/config.json
echo "Wrote to /usr/share/nginx/html/assets/config.json"
