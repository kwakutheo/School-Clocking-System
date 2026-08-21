param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Version
)

$ErrorActionPreference = "Stop"

if ($Version -notmatch '^\d+\.\d+\.\d+\+\d+$') {
  throw "Invalid version '$Version'. Use a value like 1.0.1+8."
}

$pubspecPath = Join-Path (Get-Location) "pubspec.yaml"
if (-not (Test-Path $pubspecPath)) {
  throw "pubspec.yaml was not found. Run this command from the project root."
}

$pubspec = Get-Content -Raw -Path $pubspecPath
if ($pubspec -notmatch '(?m)^version:\s*[^\r\n]+') {
  throw "pubspec.yaml does not contain a version line."
}

$updated = $pubspec -replace '(?m)^version:\s*[^\r\n]+', "version: $Version"
Set-Content -Path $pubspecPath -Value $updated -NoNewline

node scripts/sync-mobile-app-version.mjs

Write-Host "Mobile version bumped and synced to $Version."
