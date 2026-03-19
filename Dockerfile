FROM node:20-bullseye

ENV NODE_ENV=production \
    PORT=5000

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json npm-shrinkwrap.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
