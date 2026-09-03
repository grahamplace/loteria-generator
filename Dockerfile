# Live game socket server. Not the Next.js app — that ships on Vercel.
# See docs/adr/0001-live-game-realtime-architecture.md
#
# Two stages, because the build needs the repo's full toolchain (pnpm, tsup,
# TypeScript) and the runtime needs almost nothing: tsup bundles the server to
# a single file, and `pg` is the only dependency left outside it.

FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable

# Deliberately no .npmrc: it is machine-local here and pins pnpm's store to a
# macOS path, which does not exist in this image. See .dockerignore.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsup.config.ts tsconfig.json ./
COPY socket ./socket
RUN pnpm socket:build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# The bundle's only two external dependencies. Installing exactly these —
# rather than copying the build stage's node_modules — keeps the image small:
# the app's production tree drags in Next, React, Stripe and OpenAI, none of
# which the socket server can reach. Pinned to what pnpm-lock resolved.
RUN npm install --omit=dev --no-package-lock --no-audit --no-fund pg@8.23.0 ws@8.20.0

COPY --from=build /app/socket/dist ./socket/dist

EXPOSE 8080
# No init shim: the server installs its own SIGTERM handler so `fly deploy`
# can drain open sockets within fly.toml's kill_timeout.
CMD ["node", "socket/dist/server.mjs"]
