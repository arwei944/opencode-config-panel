<#
.SYNOPSIS
  opencode 配置面板 — 一键启动脚本
.DESCRIPTION
  同时启动后端 API 服务器和前端开发服务器（开发模式）
  或构建前端后由后端托管（生产模式）
.PARAMETER Mode
  启动模式: dev（默认）或 prod
.PARAMETER Port
  后端端口（默认 3456）
.EXAMPLE
  .\scripts\start-panel.ps1
  .\scripts\start-panel.ps1 -Mode prod
  .\scripts\start-panel.ps1 -Mode dev -Port 3456
#>

param(
  [ValidateSet('dev', 'prod')]
  [string]$Mode = 'dev',
  [int]$Port = 3456
)

$RootDir = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$BackendCmd = "npx tsx server/index.ts"
$FrontendCmd = "npx vite"
$BuildCmd = "npx vite build"

# 设置端口环境变量
$env:PORT = $Port

Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   opencode 配置面板                      ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  模式: $($Mode.PadRight(31))║" -ForegroundColor Cyan
Write-Host "║  端口: $($Port.ToString().PadRight(31))║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

if ($Mode -eq 'prod') {
  Write-Host "→ 正在构建前端..." -ForegroundColor Yellow
  Push-Location $RootDir
  Invoke-Expression $BuildCmd
  if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ 构建失败，请检查错误信息" -ForegroundColor Red
    Pop-Location
    exit 1
  }
  Write-Host "✓ 构建完成，启动生产服务器..." -ForegroundColor Green
  Pop-Location

  # 生产模式：后端同时托管前端静态文件
  Invoke-Expression $BackendCmd
} else {
  # 开发模式：同时启动前后端
  Write-Host "→ 启动后端 API 服务器 (端口 $Port)..." -ForegroundColor Yellow
  Write-Host "→ 启动前端开发服务器 (端口 5173)..." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  前端地址: http://localhost:5173" -ForegroundColor Green
  Write-Host "  API 地址: http://localhost:$Port/api" -ForegroundColor Green
  Write-Host ""
  Write-Host "按 Ctrl+C 停止所有服务" -ForegroundColor Gray
  Write-Host ""

  # 使用 PowerShell 作业同时启动前后端
  $backendJob = Start-Job -ScriptBlock {
    param($dir, $cmd)
    Set-Location $dir
    Invoke-Expression $cmd
  } -ArgumentList $RootDir, $BackendCmd

  $frontendJob = Start-Job -ScriptBlock {
    param($dir, $cmd)
    Set-Location $dir
    Invoke-Expression $cmd
  } -ArgumentList $RootDir, $FrontendCmd

  try {
    # 等待任意一个作业完成（或按 Ctrl+C）
    while ($true) {
      $completed = Wait-Job -Job $backendJob, $frontendJob -Timeout 1
      if ($completed) {
        foreach ($job in $completed) {
          Receive-Job -Job $job
        }
        break
      }
      if ([Console]::KeyAvailable) {
        $key = [Console]::ReadKey($true)
        if ($key.Key -eq 'C' -and $key.Modifiers -eq 'Control') {
          Write-Host "`n收到中断信号，正在停止服务..." -ForegroundColor Yellow
          break
        }
      }
    }
  } finally {
    Stop-Job -Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
  }
}
