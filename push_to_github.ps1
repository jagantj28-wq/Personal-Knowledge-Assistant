<#
.SYNOPSIS
    Pushes all project files to GitHub using the REST API (no Git required).
.DESCRIPTION
    Reads all files from the project folder and creates/updates them
    in the specified GitHub repository via the GitHub Contents API.

.HOW TO USE
    1. Create a GitHub Personal Access Token (PAT):
       - Go to https://github.com/settings/tokens/new
       - Check "repo" scope
       - Click "Generate token" and copy it

    2. Paste your token below where it says YOUR_TOKEN_HERE
    3. Right-click this file → Run with PowerShell
#>

# ── CONFIGURE THESE ────────────────────────────────────────────────────────────
$GITHUB_TOKEN  = "YOUR_TOKEN_HERE"       # <-- paste your GitHub PAT here
$REPO_OWNER    = "jagantj28-wq"
$REPO_NAME     = "Personal-Knowledge-Assistant"
$BRANCH        = "main"
$PROJECT_DIR   = $PSScriptRoot           # folder where this script lives
# ───────────────────────────────────────────────────────────────────────────────

if ($GITHUB_TOKEN -eq "YOUR_TOKEN_HERE") {
    Write-Host "❌ Please edit this script and set your GitHub token." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$headers = @{
    Authorization  = "Bearer $GITHUB_TOKEN"
    Accept         = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "User-Agent"   = "PowerShell-GitHub-Pusher"
}

$baseUrl = "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME"

# ── 1. Ensure the repo exists and get default branch SHA ───────────────────────
Write-Host "🔍 Checking repository..." -ForegroundColor Cyan
try {
    $repoInfo = Invoke-RestMethod -Uri $baseUrl -Headers $headers -Method GET
    Write-Host "✅ Repo found: $($repoInfo.full_name)" -ForegroundColor Green
} catch {
    Write-Host "❌ Cannot access repo. Check token and repo name." -ForegroundColor Red
    Write-Host $_.Exception.Message
    Read-Host "Press Enter to exit"
    exit 1
}

# ── 2. Get the list of files to push ──────────────────────────────────────────
$ignoreDirs  = @(".git", "node_modules", "__pycache__", ".venv", "venv", "faiss_index", "dist")
$ignoreFiles = @("*.db", "*.pyc", "push_to_github.ps1")

$allFiles = Get-ChildItem -Path $PROJECT_DIR -Recurse -File | Where-Object {
    $relativePath = $_.FullName.Substring($PROJECT_DIR.Length + 1).Replace("\", "/")
    $inIgnoredDir = $false
    foreach ($dir in $ignoreDirs) {
        if ($relativePath -match "^$dir/" -or $relativePath -match "/$dir/") {
            $inIgnoredDir = $true
            break
        }
    }
    if ($inIgnoredDir) { return $false }
    foreach ($pattern in $ignoreFiles) {
        if ($_.Name -like $pattern) { return $false }
    }
    return $true
}

Write-Host "`n📁 Found $($allFiles.Count) files to push`n" -ForegroundColor Cyan

# ── 3. Push each file via GitHub Contents API ──────────────────────────────────
$successCount = 0
$failCount = 0

foreach ($file in $allFiles) {
    $relativePath = $file.FullName.Substring($PROJECT_DIR.Length + 1).Replace("\", "/")
    $apiUrl = "$baseUrl/contents/$relativePath"

    # Read file as base64
    $bytes   = [System.IO.File]::ReadAllBytes($file.FullName)
    $content = [System.Convert]::ToBase64String($bytes)

    # Check if file already exists (to get its SHA for update)
    $sha = $null
    try {
        $existing = Invoke-RestMethod -Uri $apiUrl -Headers $headers -Method GET -ErrorAction Stop
        $sha = $existing.sha
    } catch { }

    # Build request body
    $body = @{
        message = "chore: add $relativePath"
        content = $content
        branch  = $BRANCH
    }
    if ($sha) { $body.sha = $sha }

    try {
        $null = Invoke-RestMethod -Uri $apiUrl -Headers $headers -Method PUT `
            -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 5)
        Write-Host "  ✅ $relativePath" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "  ❌ $relativePath — $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
    }

    # Small delay to avoid rate-limiting
    Start-Sleep -Milliseconds 300
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Pushed:  $successCount files" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "❌ Failed:  $failCount files" -ForegroundColor Red
}
Write-Host "`n🎉 Done! View your repo at:" -ForegroundColor Cyan
Write-Host "   https://github.com/$REPO_OWNER/$REPO_NAME" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n"
Read-Host "Press Enter to close"
