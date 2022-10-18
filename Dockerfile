FROM node:16.16-alpine AS builder

WORKDIR /app
ADD . /app

RUN npm install
RUN npm run build

COPY . .

ENTRYPOINT ["/bin/sh", "-c", "npm run start"]