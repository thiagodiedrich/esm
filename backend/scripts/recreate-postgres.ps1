# Recria o container e volume do PostgreSQL, depois executa as migrations.
# Execute na pasta backend ou a partir da raiz do projeto.
# Uso: ./scripts/recreate-postgres.ps1   ou   pwsh -File scripts/recreate-postgres.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $ScriptDir

Push-Location $BackendDir

try {
    Write-Host "=== Parando e removendo container postgres ===" -ForegroundColor Cyan
    docker compose stop postgres 2>$null
    docker compose rm -f postgres 2>$null

    Write-Host "=== Removendo volume pg_data ===" -ForegroundColor Cyan
    $volumeName = docker volume ls -q --filter "name=pg_data" | Select-Object -First 1
    if ($volumeName) {
        docker volume rm $volumeName
        Write-Host "Volume removido: $volumeName" -ForegroundColor Green
    } else {
        Write-Host "Nenhum volume pg_data encontrado (ok para primeira execucao)" -ForegroundColor Yellow
    }

    Write-Host "=== Iniciando PostgreSQL ===" -ForegroundColor Cyan
    docker compose up -d postgres

    Write-Host "=== Aguardando PostgreSQL ficar pronto (15s) ===" -ForegroundColor Cyan
    Start-Sleep -Seconds 15

    Write-Host "=== Executando migrations ===" -ForegroundColor Cyan
    docker compose --profile migrations run --rm migrations-runner

    Write-Host "`n=== Concluido. PostgreSQL recriado e migrations aplicadas. ===" -ForegroundColor Green
} finally {
    Pop-Location
}
