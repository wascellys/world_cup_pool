FROM node:20-alpine

WORKDIR /app

ENV PORT=3000
ARG NEXT_PUBLIC_API_BASE_URL=https://back-production-685e.up.railway.app/api
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

ENV NODE_ENV=production

EXPOSE 3000
CMD ["npm", "run", "start"]
