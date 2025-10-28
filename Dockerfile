FROM oven/bun:1.3.1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
COPY patches ./patches/
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN bun install --frozen-lockfile
COPY . ./
# Note: --localize flag removed due to incompatibility with bun Docker image
# Builds only the default (en) locale. See issue #XXX
RUN ./node_modules/.bin/ng build --configuration production --source-map

FROM oven/bun:1.3.1 AS test
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
	wget \
	fontconfig \
	fonts-liberation \
	libasound2 \
	libatk-bridge2.0-0 \
	libatk1.0-0 \
	libatspi2.0-0 \
	libcups2 \
	libdbus-1-3 \
	libdrm2 \
	libgbm1 \
	libgtk-3-0 \
	libnspr4 \
	libnss3 \
	libxcomposite1 \
	libxdamage1 \
	libxfixes3 \
	libxkbcommon0 \
	libxrandr2 \
	xdg-utils \
	fonts-ipafont-gothic \
	fonts-wqy-zenhei \
	fonts-thai-tlwg \
	fonts-kacst \
	fonts-symbola \
	fonts-noto \
	fonts-freefont-ttf \
	--no-install-recommends \
	&& wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
	&& apt-get install -y ./google-chrome-stable_current_amd64.deb \
	&& rm google-chrome-stable_current_amd64.deb \
	&& apt-get purge --auto-remove -y wget \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app ./
SHELL ["/bin/bash", "-c"]
CMD mkdir -p /report && \
    (NO_COLOR=1 ng test --watch=false --reporters=default --reporters=html 2>&1 | tee /report/test-output.log; echo ${PIPESTATUS[0]} > /report/exit-code.txt) && \
    (if [ -d html ]; then cp -r html/* /report/ 2>/dev/null || true; fi) && \
    exit $(cat /report/exit-code.txt)

FROM nginx:1.27-alpine3.19-slim AS deploy
RUN apk add jq moreutils
WORKDIR /var/lib/jasper/
COPY --from=builder /app/dist/jasper-ui/browser ./
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
