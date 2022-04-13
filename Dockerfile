FROM node as builder
WORKDIR app
RUN npm i -g @angular/cli
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN ng build --base-href ./ --configuration production

FROM builder as test
RUN ng test -c karma-ci.conf.js

FROM nginx as deploy
WORKDIR /usr/share/nginx/html/
COPY --from=builder app/dist/jasper-ui ./
COPY docker/default.conf /etc/nginx/conf.d
COPY docker/40-create-jasper-config.sh /docker-entrypoint.d
