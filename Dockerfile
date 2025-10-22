FROM node:22.21.0 AS builder
WORKDIR /app
RUN npm i -g @angular/cli
COPY package.json package-lock.json ./
COPY patches ./patches/
RUN npm ci
COPY . ./
RUN npm run build

FROM node:22.21.0 AS test
RUN apt-get update && apt-get install -y \
	apt-transport-https \
	ca-certificates \
	curl \
	gnupg \
	--no-install-recommends \
	&& curl -sSL https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
	&& echo "deb https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
	&& apt-get update && apt-get install -y \
	google-chrome-stable \
	fontconfig \
	fonts-ipafont-gothic \
	fonts-wqy-zenhei \
	fonts-thai-tlwg \
	fonts-kacst \
	fonts-symbola \
	fonts-noto \
	fonts-freefont-ttf \
	--no-install-recommends \
	&& apt-get purge --auto-remove -y curl gnupg \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN npm i -g @angular/cli
COPY --from=builder /app ./
CMD mkdir -p /tests /report && \
    ng test --watch=false --reporters=junit > /tests/test-output.log 2>&1 && \
    grep -A 99999 '<?xml version' /tests/test-output.log | grep -B 99999 '</testsuites>' > /tests/junit-report.xml || true && \
    cat > /report/index.html <<'EOF' && \
<!DOCTYPE html>\
<html><head><meta charset="UTF-8"><title>Vitest Test Report</title>\
<style>body{font-family:sans-serif;max-width:1200px;margin:0 auto;padding:20px;background:#f5f5f5}h1{color:#333;border-bottom:3px solid #4CAF50;padding-bottom:10px}.summary{background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);margin:20px 0}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin:20px 0}.stat{background:white;padding:15px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)}.stat-label{font-size:14px;color:#666;margin-bottom:5px}.stat-value{font-size:32px;font-weight:bold}.passed{color:#4CAF50}.failed{color:#f44336}pre{background:#f8f8f8;padding:15px;border-radius:4px;overflow-x:auto;white-space:pre-wrap;word-wrap:break-word}</style>\
</head><body><h1>🧪 Vitest Test Report</h1><div class="summary"><h2>Test Summary</h2><div class="stats">\
EOF\
    PASSED_FILES=$(grep -oP '\d+(?= passed)' /tests/test-output.log | head -1 || echo "0") && \
    FAILED_FILES=$(grep -oP '\d+(?= failed)' /tests/test-output.log | head -1 || echo "0") && \
    TOTAL_FILES=$(grep -oP 'Test Files.*\((\d+)\)' /tests/test-output.log | grep -oP '\d+(?=\))' | head -1 || echo "0") && \
    PASSED_TESTS=$(grep -oP 'Tests.*\d+ failed \| (\d+) passed' /tests/test-output.log | grep -oP '\d+ passed' | grep -oP '\d+' | head -1 || echo "0") && \
    FAILED_TESTS=$(grep -oP '(\d+) failed' /tests/test-output.log | grep -oP '\d+' | head -1 || echo "0") && \
    TOTAL_TESTS=$(grep -oP 'Tests.*\((\d+)\)' /tests/test-output.log | grep -oP '\d+(?=\))' | head -1 || echo "0") && \
    echo "<div class=\"stat\"><div class=\"stat-label\">Total Test Files</div><div class=\"stat-value\">$TOTAL_FILES</div></div>" >> /report/index.html && \
    echo "<div class=\"stat\"><div class=\"stat-label\">Passed Files</div><div class=\"stat-value passed\">$PASSED_FILES</div></div>" >> /report/index.html && \
    echo "<div class=\"stat\"><div class=\"stat-label\">Failed Files</div><div class=\"stat-value failed\">$FAILED_FILES</div></div>" >> /report/index.html && \
    echo "<div class=\"stat\"><div class=\"stat-label\">Total Tests</div><div class=\"stat-value\">$TOTAL_TESTS</div></div>" >> /report/index.html && \
    echo "<div class=\"stat\"><div class=\"stat-label\">Passed Tests</div><div class=\"stat-value passed\">$PASSED_TESTS</div></div>" >> /report/index.html && \
    echo "<div class=\"stat\"><div class=\"stat-label\">Failed Tests</div><div class=\"stat-value failed\">$FAILED_TESTS</div></div>" >> /report/index.html && \
    echo "</div></div><div class=\"summary\"><h2>Test Output</h2><pre>" >> /report/index.html && \
    cat /tests/test-output.log >> /report/index.html && \
    echo "</pre></div></body></html>" >> /report/index.html

FROM nginx:1.27-alpine3.19-slim AS deploy
RUN apk add jq moreutils
WORKDIR /var/lib/jasper/
COPY --from=builder /app/dist/jasper-ui ./
ARG BASE_HREF="/"
ENV BASE_HREF=$BASE_HREF
RUN date -R -u > /build-timestamp
COPY docker/security-headers.conf /etc/nginx
COPY docker/default.conf /etc/nginx/conf.d
COPY docker/nginx.conf /etc/nginx
COPY docker/00-select-locale.sh /docker-entrypoint.d
COPY docker/40-create-jasper-config.sh /docker-entrypoint.d
COPY docker/41-proxy.sh /docker-entrypoint.d
COPY docker/50-set-base-href.sh /docker-entrypoint.d
COPY docker/60-set-title.sh /docker-entrypoint.d
COPY docker/70-csp.sh /docker-entrypoint.d
COPY docker/80-nsgw.sh /docker-entrypoint.d
COPY docker/90-logging.sh /docker-entrypoint.d
WORKDIR /usr/share/nginx/html/
