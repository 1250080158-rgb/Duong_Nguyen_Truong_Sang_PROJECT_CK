# =====================================================================
# Ảnh Docker cho giao diện React (Vite build → nginx phục vụ tĩnh).
# =====================================================================

# ---------- Tầng build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Copy manifest trước để tận dụng cache của npm
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_API_BASE được đọc lúc build, nên phải truyền vào ở đây.
ARG VITE_API_BASE=/api
ARG VITE_OIDC_ENABLED=false
ARG VITE_OIDC_AUTHORITY=http://localhost:8080/realms/medequip
ARG VITE_OIDC_CLIENT_ID=medequip-ui
ARG VITE_OIDC_SCOPE=openid\ profile\ email
ARG VITE_OIDC_REDIRECT_URI=http://localhost:3000/auth/callback
ARG VITE_OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:3000/login

ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_OIDC_ENABLED=$VITE_OIDC_ENABLED \
    VITE_OIDC_AUTHORITY=$VITE_OIDC_AUTHORITY \
    VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID \
    VITE_OIDC_SCOPE=$VITE_OIDC_SCOPE \
    VITE_OIDC_REDIRECT_URI=$VITE_OIDC_REDIRECT_URI \
    VITE_OIDC_POST_LOGOUT_REDIRECT_URI=$VITE_OIDC_POST_LOGOUT_REDIRECT_URI

RUN npm run build

# ---------- Tầng chạy ----------
FROM nginx:1.27-alpine AS runtime

COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
