FROM node:20-alpine AS build

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .
ARG VITE_ANALYTICS_API_BASE_URL=https://analytics.naturalyield.com.au
ENV VITE_ANALYTICS_API_BASE_URL=${VITE_ANALYTICS_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
