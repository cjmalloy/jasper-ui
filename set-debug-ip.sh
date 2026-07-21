#!/bin/bash

# Function to get the first project name from angular.json
get_project_name() {
    jq -r '.projects | keys[]' angular.json | head -n 1
}

# Function to get the local IP address
get_local_ip() {
    ip addr | grep -Eo 'inet (192\.168|10)\.[0-9]+\.[0-9]+\/[0-9]+' | awk '{ print $2 }' | cut -d/ -f1 | head -n 1
}

# Function to check if jq is installed
check_jq_installed() {
    if ! command -v jq &> /dev/null
    then
        echo "jq could not be found, please install it."
        echo "On Debian-based systems: sudo apt-get install jq"
        exit 1
    fi
}

# Function to check if sponge is installed
check_sponge_installed() {
    if ! command -v sponge &> /dev/null
    then
        echo "sponge could not be found, please install it."
        echo "On Debian-based systems: sudo apt-get install moreutils"
        exit 1
    fi
}

# Function to update angular.json
update_angular_json() {
    local ip=$1

    # Replace the CSP section in angular.json
    sed -i "s|\"Content-Security-Policy\": \"default-src 'self' [^;]*;|\"Content-Security-Policy\": \"default-src 'self' ws://localhost:4200 ws://localhost:8081 http://localhost:8081 wss://${ip}:4200 wss://${ip}:8081 https://${ip}:8081;|g" angular.json

    # Update angular.json to enable SSL and set host to 0.0.0.0 for the project
    jq ".projects[\"$PROJECT_NAME\"].architect.serve.options.ssl = true" angular.json | sponge angular.json
    jq ".projects[\"$PROJECT_NAME\"].architect.serve.options.host = \"0.0.0.0\"" angular.json | sponge angular.json
}

# Function to update config.json
update_config_json() {
    local ip=$1

    jq '.api = "//'${ip}':8081"' src/assets/config.json | sponge src/assets/config.json
}

# Ensure jq and sponge are installed
check_jq_installed
check_sponge_installed

# Get project name
PROJECT_NAME=$(get_project_name)

# Get local IP
local_ip=$(get_local_ip)

# Update the files with the local IP address
update_angular_json "$local_ip"
update_config_json "$local_ip"

echo "Updated local development IP to: $local_ip"
echo "You may need to visit https://$local_ip:8081 in your browser to allow the self-signed certs"
