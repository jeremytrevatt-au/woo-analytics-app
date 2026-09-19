FROM node:20-alpine AS build

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .
ARG VITE_ANALYTICS_API_BASE_URL
ARG VITE_FORBIDDEN_ANALYTICS_API_BASE_URL
RUN test -n "${VITE_ANALYTICS_API_BASE_URL}" || (echo "VITE_ANALYTICS_API_BASE_URL build argument is required" >&2 && exit 1)
ENV VITE_ANALYTICS_API_BASE_URL=${VITE_ANALYTICS_API_BASE_URL}
ARG VITE_WORDPRESS_BASE_URL
ENV VITE_WORDPRESS_BASE_URL=${VITE_WORDPRESS_BASE_URL}
RUN npm run build
RUN grep -R -F "${VITE_ANALYTICS_API_BASE_URL}" /app/dist >/dev/null
RUN if [ -n "${VITE_FORBIDDEN_ANALYTICS_API_BASE_URL}" ] && grep -R -F "${VITE_FORBIDDEN_ANALYTICS_API_BASE_URL}" /app/dist >/dev/null; then echo "Forbidden analytics API URL found in compiled bundle" >&2; exit 1; fi

FROM nginx:1.27-alpine

ARG BUILD_GIT_REF=unknown
LABEL org.opencontainers.image.revision=${BUILD_GIT_REF}
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
