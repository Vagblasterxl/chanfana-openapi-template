# ============================================================================
# Symphony Pipeline — Windows Master Setup Script
# Run in PowerShell as Administrator on your Lenovo Yoga 7 or HP nvx360
# ============================================================================
#
# This script installs and configures:
#   1. NotebookLM MCP (Pantheon Security) — Claude ↔ NotebookLM bridge
#   2. Google Drive MCP — Claude ↔ Drive bridge
#   3. open-notebook (Docker) — local NotebookLM fallback
#   4. nblm CLI — NotebookLM Enterprise API client
#   5. AHK Multi-Clipboard — 5-slot clipboard for 5 Symphony categories
#   6. Symphony AHK script — Advanced Paste → category → Drive chain
#   7. Ollama — local AI for Advanced Paste
#
# PREREQUISITES: Git, Node.js 18+, Docker Desktop, Python 3.11+
# USER INPUT NEEDED: 3 values (Gemini API key, Google OAuth ID+Secret)
# ============================================================================

param(
    [string]$GeminiApiKey = "",
    [string]$GoogleClientId = "",
    [string]$GoogleClientSecret = "",
    [string]$InstallDir = "$env:USERPROFILE\Symphony"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Symphony Pipeline — Full Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# STEP 0: Collect credentials if not passed as params
# ============================================================================

if (-not $GeminiApiKey) {
    Write-Host "[INPUT NEEDED] Gemini API Key" -ForegroundColor Yellow
    Write-Host "  Get it from: https://aistudio.google.com/apikey" -ForegroundColor Gray
    $GeminiApiKey = Read-Host "  Paste your Gemini API key"
}

if (-not $GoogleClientId) {
    Write-Host ""
    Write-Host "[INPUT NEEDED] Google OAuth Client ID + Secret" -ForegroundColor Yellow
    Write-Host "  Get them from: https://console.cloud.google.com" -ForegroundColor Gray
    Write-Host "  → New Project → Enable Google Drive API" -ForegroundColor Gray
    Write-Host "  → Credentials → Create OAuth 2.0 Client ID → Desktop app" -ForegroundColor Gray
    Write-Host "  → Redirect URI: http://localhost:3000" -ForegroundColor Gray
    Write-Host ""
    $GoogleClientId = Read-Host "  Paste Client ID"
    $GoogleClientSecret = Read-Host "  Paste Client Secret"
}

Write-Host ""
Write-Host "Got all 3 credentials. Starting automated setup..." -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 1: Create install directory
# ============================================================================

Write-Host "[1/7] Creating install directory: $InstallDir" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Set-Location $InstallDir

# ============================================================================
# STEP 2: NotebookLM MCP — one command
# ============================================================================

Write-Host "[2/7] Installing NotebookLM MCP (Pantheon Security)..." -ForegroundColor Cyan

$AuthToken = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

try {
    & claude mcp add notebooklm `
        --env "NLMCP_AUTH_ENABLED=true" `
        --env "NLMCP_AUTH_TOKEN=$AuthToken" `
        --env "GEMINI_API_KEY=$GeminiApiKey" `
        -- npx @pan-sec/notebooklm-mcp@latest
    Write-Host "  NotebookLM MCP installed. Say 'Log me in to NotebookLM' in Claude." -ForegroundColor Green
} catch {
    Write-Host "  WARNING: claude CLI not found. Install Claude Code first, then re-run." -ForegroundColor Yellow
    Write-Host "  Manual command saved to: $InstallDir\manual-notebooklm-mcp.txt" -ForegroundColor Yellow
    @"
claude mcp add notebooklm --env NLMCP_AUTH_ENABLED=true --env NLMCP_AUTH_TOKEN=$AuthToken --env GEMINI_API_KEY=$GeminiApiKey -- npx @pan-sec/notebooklm-mcp@latest
"@ | Set-Content "$InstallDir\manual-notebooklm-mcp.txt"
}

# ============================================================================
# STEP 3: Google Drive MCP — clone, configure, build, generate token
# ============================================================================

Write-Host "[3/7] Setting up Google Drive MCP..." -ForegroundColor Cyan

if (-not (Test-Path "$InstallDir\googleDriveMCP")) {
    git clone https://github.com/michaelpine25/googleDriveMCP.git "$InstallDir\googleDriveMCP"
}

Set-Location "$InstallDir\googleDriveMCP"

# Write .env
@"
CLIENT_ID=$GoogleClientId
CLIENT_SECRET=$GoogleClientSecret
REDIRECT_URI=http://localhost:3000
"@ | Set-Content ".env"

npm install
Write-Host "  Opening browser for Google OAuth sign-in..." -ForegroundColor Yellow
npm run tokenGenerator
npm run build

$DriveMcpPath = "$InstallDir\googleDriveMCP\build\index.js" -replace '\\', '/'

Write-Host "  Google Drive MCP built. Path: $DriveMcpPath" -ForegroundColor Green

# ============================================================================
# STEP 4: Claude Desktop config — write both MCPs
# ============================================================================

Write-Host "[4/7] Configuring Claude Desktop MCP servers..." -ForegroundColor Cyan

$ClaudeConfigDir = "$env:APPDATA\Claude"
$ClaudeConfigPath = "$ClaudeConfigDir\claude_desktop_config.json"

New-Item -ItemType Directory -Path $ClaudeConfigDir -Force | Out-Null

$config = @{
    mcpServers = @{
        notebooklm = @{
            command = "npx"
            args = @("@pan-sec/notebooklm-mcp@latest")
            env = @{
                NLMCP_AUTH_ENABLED = "true"
                NLMCP_AUTH_TOKEN = $AuthToken
                GEMINI_API_KEY = $GeminiApiKey
            }
        }
        googleDrive = @{
            command = "node"
            args = @($DriveMcpPath)
            env = @{
                CLIENT_ID = $GoogleClientId
                CLIENT_SECRET = $GoogleClientSecret
                REDIRECT_URI = "http://localhost:3000"
            }
        }
    }
}

$config | ConvertTo-Json -Depth 5 | Set-Content $ClaudeConfigPath -Encoding UTF8
Write-Host "  Wrote: $ClaudeConfigPath" -ForegroundColor Green

# ============================================================================
# STEP 5: open-notebook (Docker) — local NotebookLM fallback
# ============================================================================

Write-Host "[5/7] Starting open-notebook (Docker)..." -ForegroundColor Cyan

try {
    docker version | Out-Null

    if (-not (Test-Path "$InstallDir\open-notebook")) {
        git clone --depth 1 https://github.com/lfnovo/open-notebook.git "$InstallDir\open-notebook"
    }

    Set-Location "$InstallDir\open-notebook"

    # Generate random encryption key
    $EncKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

    # Patch docker-compose with encryption key
    (Get-Content docker-compose.yml) -replace 'change-me-to-a-secret-string', $EncKey | Set-Content docker-compose.yml

    docker compose up -d
    Write-Host "  open-notebook running at http://localhost:8502" -ForegroundColor Green
    Write-Host "  Configure AI providers in the web UI (Settings > API Keys)" -ForegroundColor Gray
} catch {
    Write-Host "  WARNING: Docker not available. Skipping open-notebook." -ForegroundColor Yellow
    Write-Host "  Install Docker Desktop, then run: docker compose up -d in $InstallDir\open-notebook" -ForegroundColor Yellow
}

# ============================================================================
# STEP 6: Ollama — local AI for Advanced Paste
# ============================================================================

Write-Host "[6/7] Setting up Ollama (local AI)..." -ForegroundColor Cyan

try {
    $ollamaCheck = Get-Command ollama -ErrorAction SilentlyContinue
    if ($ollamaCheck) {
        Write-Host "  Ollama already installed." -ForegroundColor Green
    } else {
        Write-Host "  Installing Ollama via winget..." -ForegroundColor Yellow
        winget install Ollama.Ollama --accept-source-agreements --accept-package-agreements
    }

    # Pull a lightweight model for Advanced Paste transforms
    Write-Host "  Pulling mistral:7b (good balance for GTX 1080)..." -ForegroundColor Yellow
    ollama pull mistral:7b

    Write-Host "  Ollama ready. Configure in PowerToys:" -ForegroundColor Green
    Write-Host "    Settings > Advanced Paste > Model Providers > Add > Ollama" -ForegroundColor Gray
    Write-Host "    URL: http://localhost:11434" -ForegroundColor Gray
    Write-Host "    Model: mistral:7b" -ForegroundColor Gray
} catch {
    Write-Host "  WARNING: Could not install Ollama automatically." -ForegroundColor Yellow
    Write-Host "  Download from: https://ollama.com/download/windows" -ForegroundColor Yellow
}

# ============================================================================
# STEP 7: AHK scripts — Multi-Clipboard + Symphony integration
# ============================================================================

Write-Host "[7/7] Installing AHK scripts..." -ForegroundColor Cyan

$AhkDir = "$InstallDir\ahk-scripts"
New-Item -ItemType Directory -Path $AhkDir -Force | Out-Null

# Copy Multi-Clipboard
if (-not (Test-Path "$InstallDir\AHK_Multi_Clipboard")) {
    git clone --depth 1 https://github.com/GroggyOtter/AHK_Multi_Clipboard.git "$InstallDir\AHK_Multi_Clipboard"
}
Copy-Item "$InstallDir\AHK_Multi_Clipboard\src\multi_clipboard.v2.ahk" "$AhkDir\multi_clipboard.v2.ahk"

# Copy Symphony script (from this repo's setup/scripts)
$RepoScriptsDir = Split-Path -Parent $PSScriptRoot
$SymphonyAhk = Join-Path $RepoScriptsDir "scripts\symphony-advanced-paste.ahk"
if (Test-Path $SymphonyAhk) {
    Copy-Item $SymphonyAhk "$AhkDir\symphony-advanced-paste.ahk"
} else {
    Write-Host "  Symphony AHK script not found in repo. Copy manually from setup/scripts/" -ForegroundColor Yellow
}

# Add to Windows startup
$StartupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$ShortcutPath = "$StartupDir\Symphony-AHK.lnk"
try {
    $WScriptShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = "$AhkDir\symphony-advanced-paste.ahk"
    $Shortcut.WorkingDirectory = $AhkDir
    $Shortcut.Description = "Symphony Advanced Paste Integration"
    $Shortcut.Save()
    Write-Host "  Added to Windows Startup: $ShortcutPath" -ForegroundColor Green
} catch {
    Write-Host "  Could not add to Startup automatically. Add manually." -ForegroundColor Yellow
}

Write-Host "  AHK scripts in: $AhkDir" -ForegroundColor Green

# ============================================================================
# DONE
# ============================================================================

Set-Location $InstallDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installed to: $InstallDir" -ForegroundColor White
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Restart Claude Desktop" -ForegroundColor White
Write-Host "  2. Say: 'Log me in to NotebookLM'" -ForegroundColor White
Write-Host "  3. Say: 'List files in my Google Drive'" -ForegroundColor White
Write-Host "  4. Open PowerToys > Advanced Paste > Add Ollama provider" -ForegroundColor White
Write-Host "     URL: http://localhost:11434  Model: mistral:7b" -ForegroundColor Gray
Write-Host "  5. Edit Apps Script URL in: $AhkDir\symphony-advanced-paste.ahk" -ForegroundColor White
Write-Host "  6. Double-click symphony-advanced-paste.ahk to start" -ForegroundColor White
Write-Host "  7. open-notebook UI: http://localhost:8502" -ForegroundColor White
Write-Host ""
Write-Host "HOTKEYS:" -ForegroundColor Yellow
Write-Host "  Win+Shift+V     = Advanced Paste (PowerToys)" -ForegroundColor White
Write-Host "  Ctrl+Win+S      = Symphony capture (category picker)" -ForegroundColor White
Write-Host "  Ctrl+Win+1-5    = Direct capture to category" -ForegroundColor White
Write-Host "  Ctrl+Win+A      = Advanced Paste -> auto-capture chain" -ForegroundColor White
Write-Host "  Ctrl+Numpad1-9  = Multi-Clipboard slots" -ForegroundColor White
Write-Host ""
