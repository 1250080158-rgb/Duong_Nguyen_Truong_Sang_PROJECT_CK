# =====================================================================
# Ảnh Docker cho ASP.NET Core API.
# Build nhiều tầng để chỉ copy kết quả cuối sang ảnh chạy, image nhỏ hơn
# và không kèm source code.
# =====================================================================

# ---------- Tầng build ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy trước file project để restore được cache lại khi code đổi
COPY backend/MedEquip.slnx ./
COPY backend/src/MedEquip.Domain/MedEquip.Domain.csproj         src/MedEquip.Domain/
COPY backend/src/MedEquip.Infrastructure/MedEquip.Infrastructure.csproj src/MedEquip.Infrastructure/
COPY backend/src/MedEquip.Api/MedEquip.Api.csproj                 src/MedEquip.Api/
RUN dotnet restore src/MedEquip.Api/MedEquip.Api.csproj

COPY backend/ ./
RUN dotnet publish src/MedEquip.Api/MedEquip.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

# ---------- Tầng chạy ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# curl dùng cho HEALTHCHECK; ảnh aspnet gọn không bảo đảm có sẵn
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Tạo user chạy ứng dụng. Ảnh .NET 10 dựa trên Ubuntu nên dùng
# useradd (Debian mới có adduser).
# Các bước cài đặt và phân quyền phải xong TRƯỚC khi chuyển sang user
# thường, vì sau đó không còn quyền root để chown.
RUN useradd --system --uid 1001 --create-home --shell /usr/sbin/nologin appuser

COPY --from=build /app/publish ./

# Thư mục lưu bằng chứng phải ghi được cho appuser
RUN mkdir -p /app/uploads && chown -R appuser:appuser /app

USER appuser

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

EXPOSE 8080

# Container chạy được thì /health phải trả 200 (endpoint còn kiểm tra CSDL)
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
    CMD curl -fsS http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "MedEquip.Api.dll"]
