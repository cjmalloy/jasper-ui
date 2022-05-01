FROM node as builder
WORKDIR app
RUN npm i -g @angular/cli
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN ng build --configuration production

FROM builder as test
CMD ng test -c karma-ci.conf.js

FROM nginx as deploy
WORKDIR /usr/share/nginx/html/
COPY --from=builder app/dist/jasper-ui ./
ARG BASE_HREF="/"
ENV BASE_HREF=$BASE_HREF
COPY docker/default.conf /etc/nginx/conf.d
COPY docker/40-create-jasper-config.sh /docker-entrypoint.d
COPY docker/50-set-base-href.sh /docker-entrypoint.d
COPY docker/60-set-title.sh /docker-entrypoint.d
