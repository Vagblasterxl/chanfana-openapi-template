# Rebuild symlink indexes from .meta.yml sidecars
# Usage: .\rebuild-indexes.ps1 [-MediaRoot "path\to\media"]
# Requires: Windows Developer Mode enabled (for symlinks without admin)

param(
    [string]$MediaRoot = (Join-Path $PSScriptRoot "..\..\media")
)

$ErrorActionPreference = "Stop"
$MediaRoot = Resolve-Path $MediaRoot
$IndexDir = Join-Path $MediaRoot "_index"

Write-Host "Rebuilding indexes from: $MediaRoot" -ForegroundColor Cyan

# Clean and recreate index directories
foreach ($status in @("draft", "review", "approved", "published", "archived")) {
    $dir = Join-Path $IndexDir "by_status\$status"
    if (Test-Path $dir) { Remove-Item "$dir\*" -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

foreach ($type in @("video", "image", "music", "speech", "composition")) {
    $dir = Join-Path $IndexDir "by_type\$type"
    if (Test-Path $dir) { Remove-Item "$dir\*" -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

$tagDir = Join-Path $IndexDir "by_tag"
if (Test-Path $tagDir) { Remove-Item "$tagDir\*" -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $tagDir -Force | Out-Null

# Find all .meta.yml files
$metaFiles = Get-ChildItem -Path $MediaRoot -Recurse -Filter "*.meta.yml" |
    Where-Object { $_.FullName -notlike "*\_index\*" -and $_.FullName -notlike "*\.meta\*" }

foreach ($meta in $metaFiles) {
    $assetPath = $meta.FullName -replace '\.meta\.yml$', ''
    $assetBasename = Split-Path $assetPath -Leaf

    if (-not (Test-Path $assetPath)) {
        Write-Host "  SKIP: $assetBasename (asset file missing)" -ForegroundColor Yellow
        continue
    }

    # Parse YAML (simple regex, no external dependency)
    $content = Get-Content $meta.FullName -Raw

    $assetId = if ($content -match 'id:\s*"?([^"\r\n]+)"?') { $matches[1].Trim() } else { $assetBasename }
    $status = if ($content -match 'status:\s*"?([^"\r\n]+)"?') { $matches[1].Trim() } else { $null }
    $assetType = if ($content -match 'type:\s*"?([^"\r\n]+)"?') { $matches[1].Trim() } else { $null }

    $linkName = $assetId

    # Symlink by status
    if ($status) {
        $targetDir = Join-Path $IndexDir "by_status\$status"
        if (Test-Path $targetDir) {
            try {
                New-Item -ItemType SymbolicLink -Path (Join-Path $targetDir $linkName) -Target $assetPath -Force | Out-Null
                Write-Host "  STATUS: $linkName -> $status" -ForegroundColor Green
            } catch {
                Write-Host "  WARN: Symlink failed for $linkName. Enable Developer Mode or run as Admin." -ForegroundColor Yellow
            }
        }
    }

    # Symlink by type
    if ($assetType) {
        $targetDir = Join-Path $IndexDir "by_type\$assetType"
        if (Test-Path $targetDir) {
            try {
                New-Item -ItemType SymbolicLink -Path (Join-Path $targetDir $linkName) -Target $assetPath -Force | Out-Null
                Write-Host "  TYPE: $linkName -> $assetType" -ForegroundColor Green
            } catch {
                Write-Host "  WARN: Symlink failed for $linkName" -ForegroundColor Yellow
            }
        }
    }

    # Symlink by tags
    if ($content -match 'tags:\s*\[([^\]]+)\]') {
        $tags = $matches[1] -split ',' | ForEach-Object { $_.Trim().Trim('"').Trim("'") } | Where-Object { $_ -ne '' }
        foreach ($tag in $tags) {
            $tagTargetDir = Join-Path $IndexDir "by_tag\$tag"
            New-Item -ItemType Directory -Path $tagTargetDir -Force | Out-Null
            try {
                New-Item -ItemType SymbolicLink -Path (Join-Path $tagTargetDir $linkName) -Target $assetPath -Force | Out-Null
                Write-Host "  TAG: $linkName -> $tag" -ForegroundColor Green
            } catch {
                Write-Host "  WARN: Symlink failed for tag $tag" -ForegroundColor Yellow
            }
        }
    }
}

Write-Host "Index rebuild complete." -ForegroundColor Cyan
