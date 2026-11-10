# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN npm ci

COPY . ./

RUN npm run build

# Stage 2: Serve the built application with Nginx
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html
# SPA fallback: refreshing /profile etc. must not return 404
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
