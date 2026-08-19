FROM node:20-bullseye

ENV NODE_ENV=production \
    PORT=5000

# Retries because this layer is the single flakiest step in the build: the
# ffmpeg download comes from a Debian mirror that intermittently resets the
# connection mid-transfer ("read (104: Connection reset by peer)"), which fails
# the whole deploy on a fault that has nothing to do with the app. apt does not
# retry a reset by default.
RUN apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json npm-shrinkwrap.json ./
RUN npm install

COPY . .

# Vite bakes VITE_* values into the browser bundle during this build step.
# Railway Dockerfile builds require ARG declarations before build-time variables
# are visible here.
ARG VITE_GOOGLE_CLIENT_ID
RUN VITE_GOOGLE_CLIENT_ID="$VITE_GOOGLE_CLIENT_ID" npm run build

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
