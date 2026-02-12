FROM node:24.13.0 AS builder
WORKDIR /app
RUN npm i -g @angular/cli@20.3.15
COPY package.json package-lock.json ./
COPY patches ./patches/
RUN npm ci
COPY . ./
RUN npm run build

FROM node:24.13.0 AS test
WORKDIR /app
RUN npm i -g @angular/cli@20.3.15
COPY --from=builder /app ./
SHELL ["/bin/bash", "-c"]
CMD mkdir -p /report && \
    (NO_COLOR=1 ng test --watch=false --reporters=default --reporters=html 2>&1 | tee /report/test-output.log; echo ${PIPESTATUS[0]} > /report/exit-code.txt) && \
    (if [ -d html ]; then cp -r html/* /report/ 2>/dev/null || true; fi) && \
    exit $(cat /report/exit-code.txt)

FROM nginx:1.29.5-alpine3.23-slim AS deploy
RUN apk add --no-cache jq moreutils
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
