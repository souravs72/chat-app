FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --production; else npm install --production; fi

COPY . .

EXPOSE 8080

CMD ["node", "src/index.js"]

