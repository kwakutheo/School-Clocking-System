$ErrorActionPreference = "Stop"

$branch = git branch --show-current
if ([string]::IsNullOrWhiteSpace($branch)) {
  throw "Could not determine the current Git branch."
}

$status = git status --porcelain
if (-not [string]::IsNullOrWhiteSpace($status)) {
  Write-Host "Your local files have uncommitted changes."
  Write-Host "Commit or stash them before syncing with GitHub."
  git status --short
  exit 1
}

git fetch origin
git pull --ff-only origin $branch

Write-Host "Local $branch is now synced with origin/$branch."
