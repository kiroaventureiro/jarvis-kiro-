FROM node:24-alpine
WORKDIR /app
COPY cloud/n8n-worker/index.mjs ./index.mjs
USER node
CMD ["node", "index.mjs"]
