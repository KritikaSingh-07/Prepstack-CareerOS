# Builds the React client, then runs the Express API which also serves the client.
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package*.json ./
# The in-memory MongoDB is a dev convenience; production uses MONGO_URI, so skip its binary download.
ENV MONGOMS_DISABLE_POSTINSTALL=1
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client /app/client/dist /app/client/dist
EXPOSE 5000
CMD ["node", "src/index.js"]
