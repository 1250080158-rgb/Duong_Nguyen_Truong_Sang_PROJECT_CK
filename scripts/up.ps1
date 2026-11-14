<#
.SYNOPSIS
    Dựng lại toàn bộ MED-EQUIP bằng Docker Compose.

.DESCRIPTION
    Script này thay cho `docker compose up -d --build` trên máy Windows.

    Lý do: Docker CLI không build được nhiều image trong cùng một phiên
    bake khi thư mục dự án chứa dấu tiếng Việt (thư mục này tên là
    "CK Thứ 6"). Lỗi trả về:

        failed to dial gRPC: rpc error: code = Internal desc = header key
        "x-docker-expose-session-sharedkey" contains value with
        non-printable ASCII characters

    Lỗi chỉ xuất hiện khi một phiên bake có TỪ HAI target trở lên; build
    từng image một thì chạy bình thường. `COMPOSE_PARALLEL_LIMIT=1`
    không có tác dụng vì nguyên nhân nằm ở số target, không phải số
    build chạy song song. Vì vậy script build tuần tự từng dịch vụ.

.EXAMPLE
    .\scripts\up.ps1
    .\scripts\up.ps1 -NoBuild
#>
[CmdletBinding()]
param(
    # Bỏ qua bước build, chỉ khởi động lại container.
    [switch]$NoBuild
)

# Không đặt 'Stop': docker ghi tiến trình của nó ra stderr, PowerShell sẽ
# coi đó là lỗi dừng script. Thay vào đó kiểm tra $LASTEXITCODE thủ công.
$ErrorActionPreference = 'Continue'
$PSNativeCommandUseErrorActionPreference = $false

# Build xong sẽ có tiếng vọng kiểu tiếng Việt trong log nếu console không
# dùng UTF-8.
chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    if (-not $NoBuild) {
        # Chỉ build service thực sự có mục `build:` trong compose.
        # postgres và keycloak dùng image có sẵn nên không build được.
        $config = docker compose config --format json | ConvertFrom-Json
        $services = $config.services.PSObject.Properties |
            Where-Object { $_.Value.build } |
            ForEach-Object { $_.Name }
        Write-Host "Dich vu can build: $($services -join ', ')" -ForegroundColor Cyan

        foreach ($service in $services) {
            Write-Host ""
            Write-Host "=== Build $service ===" -ForegroundColor Yellow
            docker compose build $service
            if ($LASTEXITCODE -ne 0) {
                throw "Build '$service' that bai (exit $LASTEXITCODE)."
            }
        }
    }

    Write-Host ""
    Write-Host "=== Khoi dong container ===" -ForegroundColor Yellow
    docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up that bai (exit $LASTEXITCODE)."
    }

    Write-Host ""
    Write-Host "=== Trang thai ===" -ForegroundColor Yellow
    docker compose ps

    Write-Host ""
    Write-Host "Giao dien : http://localhost:3000" -ForegroundColor Green
    Write-Host "API       : http://localhost:8081/api" -ForegroundColor Green
    Write-Host "Keycloak  : http://localhost:8080  (admin / admin)" -ForegroundColor Green
}
finally {
    Pop-Location
}
