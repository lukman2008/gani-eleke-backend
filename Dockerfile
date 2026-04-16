FROM node:20-slim

# Install Chromium
RUN apt-get update && apt-get install -y chromium

# Set environment variable for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 10000

CMD ["node", "index.js"]