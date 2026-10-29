FROM node:26.12.1
WORKDIR /app
COPY package.json package-lock.json ./
COPY patches ./patches/
RUN npm ci
COPY . ./
RUN npm run build:e2e
