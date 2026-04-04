FROM node:20-slim

WORKDIR /app

# Copy package files and install deps
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy the rest of the app
COPY . .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server/index.js"]
