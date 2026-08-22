$ErrorActionPreference = "Stop"

$repoRoot = git rev-parse --show-toplevel
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
  throw "This command must be run inside the Git repository."
}

Set-Location $repoRoot

if (-not (Test-Path ".githooks/pre-commit")) {
  throw ".githooks/pre-commit was not found."
}

git config core.hooksPath .githooks

Write-Host "Git hooks installed for this repository."
Write-Host "Mobile app manifests will now be validated before commits, not auto-published from local version bumps."
