# 1. 노드 환경 설정
FROM node:20-alpine AS base

# 2. 필요한 패키지 설치
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# 3. 소스코드 복사 및 빌드
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 4. 실행 환경 설정
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
