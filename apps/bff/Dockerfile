FROM node:22-bookworm-slim AS deps

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/bff/package.json apps/bff/package.json
RUN npm install --workspace @smart-home/bff

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/bff apps/bff
WORKDIR /app/apps/bff
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/apps/bff /app/apps/bff
WORKDIR /app/apps/bff
EXPOSE 3000
CMD ["npm", "run", "start"]
