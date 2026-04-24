FROM node:20-slim

WORKDIR /app

# Copy package files and install deps
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy the rest of the app
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
# Leave headroom below the container memory ceiling (1024mb on fly.io) so
# native allocations from transformers.js / background-removal / sharp have
# room to breathe. Hard crashes on the 256mb tier were OOM kills from the
# transformers pipeline + imgly background removal exceeding the RSS budget.
ENV NODE_OPTIONS="--max-old-space-size=896"

EXPOSE 8080

CMD ["node", "server/index.js"]
