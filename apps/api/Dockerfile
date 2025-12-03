FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY src ./src
EXPOSE 4000
CMD ["node","src/index.js"]
