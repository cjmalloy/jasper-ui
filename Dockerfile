ARG NGINX_VERSION=1.31.3
ARG ALPINE_VERSION=3.24
FROM node:26.5.0 AS builder
RUN apt-get update && apt-get install -y brotli
WORKDIR /app
RUN npm i -g @angular/cli@20.3.15
COPY package.json package-lock.json ./
COPY patches ./patches/
RUN npm ci
COPY . ./
RUN npm run build
RUN for i in $(find dist/jasper-ui/ -type f -not -name "*.br" -not -name "index.html" -not -name "config.json" -print); do brotli -9 $i; done

FROM node:26.5.0 AS test
WORKDIR /app
RUN npm i -g @angular/cli@20.3.15
COPY --from=builder /app ./
SHELL ["/bin/bash", "-c"]
CMD mkdir -p /report && \
    (NO_COLOR=1 node --localstorage-file=/tmp/jasper-ui-test-localstorage.json ./node_modules/@angular/cli/bin/ng test --watch=false \
      --coverage \
      --coverage-reporters=html \
      --coverage-reporters=json-summary \
      --coverage-reporters=text-summary \
      --reporters=default \
      --reporters=html \
      2>&1 | tee /report/test-output.log; echo ${PIPESTATUS[0]} > /report/exit-code.txt) && \
    (if [ -d html ]; then cp -r html/. /report/ 2>/dev/null || true; fi) && \
    (if [ -d coverage ]; then mkdir -p /report/coverage && cp -r coverage/. /report/coverage/ 2>/dev/null || true; fi) && \
    exit $(cat /report/exit-code.txt)

FROM nginx:${NGINX_VERSION}-alpine${ALPINE_VERSION} AS brotli-builder
ARG NGX_BROTLI_VERSION=a71f9312c2deb28875acc7bacfdd5695a111aa53
ARG NGINX_SOURCE_VERSION=073ab5db06ec5f5079280a60a28f450b8f1ac504
RUN apk add --no-cache build-base cmake git linux-headers openssl-dev pcre2-dev zlib-dev
RUN git clone --recurse-submodules https://github.com/google/ngx_brotli.git /tmp/ngx_brotli && \
    cd /tmp/ngx_brotli && \
    git checkout "${NGX_BROTLI_VERSION}" && \
    git submodule update --init --recursive && \
    cd deps/brotli && \
    mkdir out && cd out && \
    cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DCMAKE_C_FLAGS=-fPIC -DCMAKE_CXX_FLAGS=-fPIC .. && \
    cmake --build . --config Release --target brotlienc
RUN git clone https://github.com/nginx/nginx.git /tmp/nginx && \
    cd /tmp/nginx && \
    git checkout "${NGINX_SOURCE_VERSION}" && \
    CONFARGS="$(nginx -V 2>&1 | sed -n 's/^configure arguments: //p')" && \
    eval "auto/configure ${CONFARGS} --add-dynamic-module=/tmp/ngx_brotli" && \
    make modules
FROM nginx:${NGINX_VERSION}-alpine${ALPINE_VERSION} AS deploy
RUN apk add --no-cache jq moreutils
COPY --from=brotli-builder /tmp/nginx/objs/ngx_http_brotli_filter_module.so /usr/lib/nginx/modules/
COPY --from=brotli-builder /tmp/nginx/objs/ngx_http_brotli_static_module.so /usr/lib/nginx/modules/
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
