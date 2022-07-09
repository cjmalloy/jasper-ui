FROM node as builder
WORKDIR app
RUN npm i -g @angular/cli
COPY package.json package-lock.json ./
RUN npm ci --force # use --force to ignore ngx-monaco-editor peer dependencies
COPY . ./
RUN ng build --configuration production --source-map

FROM node as test
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
WORKDIR app
RUN npm i -g @angular/cli
COPY --from=builder app ./
CMD ng test --karma-config karma-ci.conf.js

FROM nginx as deploy
WORKDIR /usr/share/nginx/html/
COPY --from=builder app/dist/jasper-ui ./
ARG BASE_HREF="/"
ENV BASE_HREF=$BASE_HREF
COPY docker/default.conf /etc/nginx/conf.d
COPY docker/40-create-jasper-config.sh /docker-entrypoint.d
COPY docker/50-set-base-href.sh /docker-entrypoint.d
COPY docker/60-set-title.sh /docker-entrypoint.d
