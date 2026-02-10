# Build a partir da raiz do backend: docker build -f apps/api/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY apps/api/src ./apps/api/src

# Workspaces "modules/*", "packages/*", "workers/*" nao existem; criar dirs vazios
RUN mkdir -p modules packages workers

# npm install em vez de npm ci para evitar falha por lockfile/workspaces no contexto Docker
RUN npm install
RUN npm --workspace apps/api run build

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json /app/tsconfig.base.json ./
COPY --from=build /app/apps/api/package.json /app/apps/api/package.json
COPY --from=build /app/apps/api/dist /app/apps/api/dist
# Copiar node_modules do build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
RUN npm prune --omit=dev

EXPOSE 3000
# NODE_PATH para Nest resolver @fastify/static (e deps) em apps/api/node_modules
ENV NODE_PATH=/app/node_modules:/app/apps/api/node_modules
CMD ["node", "apps/api/dist/main.js"]
