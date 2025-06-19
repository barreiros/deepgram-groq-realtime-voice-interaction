FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm i --only=production

COPY . .

RUN npm run build

EXPOSE 7860

ENV NODE_ENV=production

CMD ["npm", "start"]
