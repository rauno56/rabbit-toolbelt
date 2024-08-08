FROM node:22-slim

LABEL org.opencontainers.image.description="RabbitMQ toolbelt for managing, validating and deploying your definitions.json"

ARG BUILD_DIR=/tmp/build

RUN mkdir -p ${BUILD_DIR}
# install curl for calling rabbitmq API to apply the config. Perhaps a desirable usecase after validation.
RUN apt-get update && apt-get install -y curl jq && apt-get clean

# We don't want to change original image's WORKDIR, thus using cd before every command
COPY package.json package-lock.json ${BUILD_DIR}/
RUN cd ${BUILD_DIR} && npm ci

COPY . ${BUILD_DIR}
RUN cd ${BUILD_DIR} && npm i --global "./`npm pack`"

RUN rm -rf ${BUILD_DIR}
