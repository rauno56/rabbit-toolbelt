FROM node:18-alpine

ARG BUILD_DIR=/tmp/rabbit-validator-build

RUN mkdir -p ${BUILD_DIR}
# install curl for calling rabbitmq API to apply the config. Perhaps a desirable usecase after validation.
RUN apk add --no-cache curl

# We don't want to change original image's WORKDIR, thus using cd before every command
COPY package.json package-lock.json ${BUILD_DIR}/
RUN cd ${BUILD_DIR} && npm ci

COPY . ${BUILD_DIR}
RUN cd ${BUILD_DIR} && npm i --global "./`npm pack`"

RUN rm -rf ${BUILD_DIR}
