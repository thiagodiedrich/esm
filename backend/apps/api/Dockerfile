FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY apps/api/src ./apps/api/src

RUN npm ci
RUN npm --workspace apps/api install @nestjs/swagger
RUN npm --workspace apps/api install @fastify/static
RUN npm --workspace apps/api run build

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json /app/tsconfig.base.json ./
COPY --from=build /app/apps/api/package.json /app/apps/api/package.json
COPY --from=build /app/apps/api/dist /app/apps/api/dist

RUN npm ci --omit=dev

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
