FROM node:17-alpine
WORKDIR /app
COPY package.json .
RUN npm ci
COPY . .
EXPOSE 3002
CMD ["npm", "start"]