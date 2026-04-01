# Debian slim (glibc): Tailwind v4 / lightningcss optional native binaries are reliable here.
# Alpine (musl) often misses lightningcss.linux-*-musl.node when node_modules is on a volume.
FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
