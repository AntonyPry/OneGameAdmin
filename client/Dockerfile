FROM node:17-alpine
WORKDIR /app
COPY package.json .
RUN npm install
RUN chmod +x node_modules/.bin/*
COPY . .
EXPOSE 3000
CMD ["npm", "start"]