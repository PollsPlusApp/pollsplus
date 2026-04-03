FROM node:20-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --only=production

COPY backend/src/ ./src/

EXPOSE 3000

CMD ["node", "src/index.js"]
