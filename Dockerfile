FROM node:22-alpine

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/prisma ./prisma
COPY backend/tsconfig.json ./
COPY backend/src ./src

RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
