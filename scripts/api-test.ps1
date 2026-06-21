$ErrorActionPreference = "Stop"
$testsPassed = 0; $testsFailed = 0
$ServerUrl = "http://127.0.0.1:3456"
Write-Host "=== API Full Test Suite ==="

Write-Host "[1] Starting server..."
$serverJob = Start-Job -ScriptBlock { param($d) Set-Location $d; npx tsx server/index.ts } -ArgumentList (Split-Path -Parent $PSScriptRoot)
Start-Sleep -Seconds 5
try { $r = Invoke-WebRequest -Uri "$ServerUrl/api/health" -UseBasicParsing -TimeoutSec 5; $d = $r.Content | ConvertFrom-Json; Write-Host "  OK" }
catch { Write-Host "  FAIL: $_"; exit 1 }

function T { param($m,$p,$b)
  try {
    $params = @{Uri="$ServerUrl$p";Method=$m;UseBasicParsing=$true;TimeoutSec=10;ContentType="application/json"}
    if ($b) { $params.Body = $b }
    $r = Invoke-WebRequest @params; $d = $r.Content | ConvertFrom-Json
    if (-not $d.success) { throw $d.error }
    Write-Host "  OK $m $p"; $script:testsPassed++
  } catch { Write-Host "  FAIL $m $p : $_"; $script:testsFailed++ }
}

Write-Host "[2] Config API"; T -m GET -p "/api/config"; T -m GET -p "/api/config/summary"
T -m POST -p "/api/config/validate" -b '{"model":"test/test"}'
T -m POST -p "/api/config/validate" -b '{"logLevel":"INVALID"}'
T -m GET -p "/api/config/export"

Write-Host "[3] Provider API"; T -m GET -p "/api/providers"
T -m POST -p "/api/providers/detect" -b '{"baseURL":"https://api.openai.com"}'
T -m POST -p "/api/providers/detect" -b '{"baseURL":"https://api.deepseek.com"}'

Write-Host "[4] Tool API"; T -m GET -p "/api/tools"
T -m PUT -p "/api/tools/primary" -b '{"primaryTools":["read","edit","bash"]}'

Write-Host "[5] Agent API"; T -m GET -p "/api/agents"
Write-Host "[6] Skill API"; T -m GET -p "/api/skills"
Write-Host "[7] MCP API"; T -m GET -p "/api/mcp"
Write-Host "[8] Hook API"; T -m GET -p "/api/hooks"
Write-Host "[9] Error"; T -m GET -p "/api/nonexistent"
Write-Host "[10] Backup API"; T -m POST -p "/api/config/backup"; T -m GET -p "/api/config/backups"

$total = $testsPassed + $testsFailed
Write-Host "Result: $total total, $testsPassed passed, $testsFailed failed"
Stop-Job $serverJob; Remove-Job $serverJob
if ($testsFailed -gt 0) { exit 1 }
