FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY docs ./docs
ENV HOST=0.0.0.0 PORT=8787 NODE_ENV=production DATA_DIR=/data
EXPOSE 8787
CMD ["node", "server/index.mjs"]
