echo "Writing Jasper Config"

config="
{
  \"title\": \"$JASPER_TITLE\",
  \"version\": \"$JASPER_VERSION\",
  \"api\": \"$JASPER_API\",
  \"logout\": \"$JASPER_LOGOUT\",
  \"login\": \"$JASPER_LOGIN\",
  \"signup\": \"$JASPER_SIGNUP\",
  \"scim\": ${JASPER_SCIM-false},
  \"blockedSchemes\": ${JASPER_BLOCKED_SCHEMES-['comment:', 'internal:']},
  \"token\": \"${JASPER_TOKEN}\",
  \"codeFlow\": ${JASPER_CODE_FLOW-false},
  \"implicitFlow\": ${JASPER_IMPLICIT_FLOW-false},
  \"issuer\": \"$JASPER_ISSUER\",
  \"clientId\": \"$JASPER_CLIENT_ID\",
  \"scope\": \"$JASPER_SCOPE\"
}
"
echo "$config"
echo "$config" > /usr/share/nginx/html/assets/config.json
echo "Wrote to /usr/share/nginx/html/assets/config.json"
