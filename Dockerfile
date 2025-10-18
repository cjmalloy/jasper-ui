FROM oven/bun:1.3.0 AS builder
WORKDIR /app
RUN bun add -g @angular/cli
COPY package.json bun.lock ./
COPY patches ./patches/
RUN bun install --frozen-lockfile
COPY . ./
RUN bun run build

FROM oven/bun:1.3.0 AS test
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
RUN bun add -g @angular/cli
COPY --from=builder /app ./
CMD bun run ng test --karma-config karma-ci.conf.js && \
    mkdir -p /report && \
    cp -r /reports/*/* /report/

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
