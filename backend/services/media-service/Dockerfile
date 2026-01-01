FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Create credentials directory for volume mount
RUN mkdir -p /app/credentials

EXPOSE 3002

CMD ["node", "src/index.js"]

