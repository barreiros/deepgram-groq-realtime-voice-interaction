FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm i --only=production

COPY . .

ARG VITE_WS_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

EXPOSE 7860

ENV NODE_ENV=production

CMD ["npm", "start"]
