FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY src ./src
COPY tsconfig.json ./

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
