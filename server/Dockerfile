# Backend image. Build context is the repository root (see .github/workflows/artproject.yml):
#   docker build -f server/Dockerfile .
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Dependencies (root package.json holds the backend deps for now)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Only the backend code goes into the image. Secrets come from `docker run --env-file`.
COPY server ./server
# Default avatar used for new accounts
COPY src/assets/baseAvatar.png ./src/assets/baseAvatar.png

USER node
EXPOSE 8080

CMD ["node", "server/server.js"]
