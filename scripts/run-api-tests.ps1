<#
  API 全量测试脚本
#>
$ErrorActionPreference = "Stop"
$ServerUrl = "http://127.0.0.1:3456"
$ProjectDir = Split-Path -Parent $PSScriptRoot
$testsPassed = 0
$testsFailed = 0

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  opencode-config-panel 全量 API 测试"
Write-Host "========================================" -ForegroundColor Cyan

# 启动服务器
Write-Host "`n[1] 启动后端服务器..." -ForegroundColor Yellow
$serverJob = Start-Job -ScriptBlock { param($d) Set-Location $d; npx tsx server/index.ts } -ArgumentList $ProjectDir
Start-Sleep -Seconds 5
try {
    $health = Invoke-WebRequest -Uri "$ServerUrl/api/health" -UseBasicParsing -TimeoutSec 5
    $healthData = $health.Content | ConvertFrom-Json
    Write-Host "  ✅ 服务器状态: $($healthData.data.status)" -ForegroundColor Green
} catch {
    Write-Host "  ❌ 服务器启动失败: $_" -ForegroundColor Red
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -ErrorAction SilentlyContinue
    exit 1
}

function Test-Api {
    param($Name, $Method = "GET", $Path, $Body = $null, [scriptblock]$Validate = $null)
    try {
        $params = @{
            Uri = "$ServerUrl$Path"
            Method = $Method
            UseBasicParsing = $true
            TimeoutSec = 10
            ContentType = "application/json"
        }
        if ($Body) { $params.Body = $Body }
        $response = Invoke-WebRequest @params
        $data = $response.Content | ConvertFrom-Json
        if (-not $data.success) {
            throw "API 返回错误: $($data.error)"
        }
        if ($Validate -and -not (& $Validate $data)) {
            throw "验证失败"
        }
        return $true
    } catch {
        Write-Host "  ❌ $Name : $_" -ForegroundColor Red
        return $false
    }
}

# 运行测试并计数
function Run-Test {
    param($Desc, $Method = "GET", $Path, $Body = $null, [scriptblock]$Validate = $null)
    Write-Host "  测试: $Method $Path" -NoNewline
    if (Test-Api -Name $Desc -Method $Method -Path $Path -Body $Body -Validate $Validate) {
        Write-Host "  ✅" -ForegroundColor Green
        $script:testsPassed++
    } else {
        Write-Host "  ❌" -ForegroundColor Red
        $script:testsFailed++
    }
}

# ========================================================
# 配置 API
# ========================================================
Write-Host "`n[2] 配置 API 测试" -ForegroundColor Yellow
Run-Test -Desc "获取完整配置" -Path "/api/config"
Run-Test -Desc "配置摘要" -Path "/api/config/summary"
Run-Test -Desc "配置验证(有效)" -Method POST -Path "/api/config/validate" -Body '{"model":"test/test"}'
Run-Test -Desc "配置验证(无效logLevel)" -Method POST -Path "/api/config/validate" -Body '{"logLevel":"INVALID"}'
Run-Test -Desc "导出配置" -Path "/api/config/export"

# ========================================================
# 提供商 API
# ========================================================
Write-Host "`n[3] 提供商 API 测试" -ForegroundColor Yellow
Run-Test -Desc "列出提供商" -Path "/api/providers"
Run-Test -Desc "智能探测(OpenAI)" -Method POST -Path "/api/providers/detect" -Body '{"baseURL":"https://api.openai.com"}'
Run-Test -Desc "智能探测(DeepSeek)" -Method POST -Path "/api/providers/detect" -Body '{"baseURL":"https://api.deepseek.com"}'
Run-Test -Desc "智能探测(自定义URL)" -Method POST -Path "/api/providers/detect" -Body '{"baseURL":"https://my-custom-llm.example.com"}'

# ========================================================
# 工具 API
# ========================================================
Write-Host "`n[4] 工具 API 测试" -ForegroundColor Yellow
Run-Test -Desc "列出工具" -Path "/api/tools"
Run-Test -Desc "更新主代理工具" -Method PUT -Path "/api/tools/primary" -Body '{"primaryTools":["read","edit","bash"]}'

# ========================================================
# 代理 API
# ========================================================
Write-Host "`n[5] 代理 API 测试" -ForegroundColor Yellow
Run-Test -Desc "列出代理" -Path "/api/agents"

# ========================================================
# 技能 API
# ========================================================
Write-Host "`n[6] 技能 API 测试" -ForegroundColor Yellow
Run-Test -Desc "扫描技能" -Path "/api/skills"

# ========================================================
# MCP API
# ========================================================
Write-Host "`n[7] MCP API 测试" -ForegroundColor Yellow
Run-Test -Desc "列出 MCP" -Path "/api/mcp"

# ========================================================
# 钩子 API
# ========================================================
Write-Host "`n[8] 钩子 API 测试" -ForegroundColor Yellow
Run-Test -Desc "获取钩子" -Path "/api/hooks"

# ========================================================
# 错误处理
# ========================================================
Write-Host "`n[9] 错误处理测试" -ForegroundColor Yellow
Run-Test -Desc "404 未找到" -Path "/api/nonexistent"

# ========================================================
# 备份 API
# ========================================================
Write-Host "`n[10] 备份 API 测试" -ForegroundColor Yellow
Run-Test -Desc "创建备份" -Method POST -Path "/api/config/backup"
Run-Test -Desc "列出备份" -Path "/api/config/backups"
Run-Test -Desc "获取备份(兼容路径)" -Path "/api/backups"

# ========================================================
# 结果
# ========================================================
Write-Host "`n========================================" -ForegroundColor Cyan
$total = $testsPassed + $testsFailed
Write-Host "  总计: $total | 通过: $testsPassed | 失败: $testsFailed" -ForegroundColor $(if ($testsFailed -eq 0) { "Green" } else { "Red" })

# 关闭服务器
Stop-Job $serverJob -ErrorAction SilentlyContinue
Remove-Job $serverJob -ErrorAction SilentlyContinue
Write-Host "`n服务器已关闭" -ForegroundColor Yellow

if ($testsFailed -gt 0) { exit 1 } else { exit 0 }
