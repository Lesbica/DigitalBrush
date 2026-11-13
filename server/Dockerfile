# Backend image. Build context is the repository root (see .github/workflows/artproject.yml):
#   docker build -f server/Dockerfile .
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Backend dependencies only (server/package.json)
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Backend code (incl. assets/baseAvatar.png). Secrets come from `docker run --env-file`, never from the image.
COPY server ./

USER node
EXPOSE 8080

CMD ["node", "server.js"]
