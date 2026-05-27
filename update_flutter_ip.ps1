$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match "Wi-Fi|Ethernet" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress
if (-not $ip) {
    Write-Host "Could not detect active Wi-Fi or Ethernet IP address. Defaulting to 127.0.0.1 for local use."
    $ip = "127.0.0.1"
} else {
    Write-Host "Detected active IP: $ip"
}

# 1. Update Mobile App
$file = "$PSScriptRoot\lib\core\constants\app_constants.dart"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace "(https://tk-clocking-api.onrender.com/api/v1|http://[^'""]+:3000/api/v1)", "http://${ip}:3000/api/v1"
    Set-Content -Path $file -Value $content
    Write-Host "Successfully updated app_constants.dart with new IP: $ip"
} else {
    Write-Host "Error: Could not find app_constants.dart at $file"
}

# 2. Update Dashboard
$dashEnv = "$PSScriptRoot\dashboard\.env.local"
if (Test-Path $dashEnv) {
    $content = Get-Content $dashEnv -Raw
    $content = $content -replace "NEXT_PUBLIC_API_URL=.*", "NEXT_PUBLIC_API_URL=http://${ip}:3000/api/v1"
    Set-Content -Path $dashEnv -Value $content
    Write-Host "Successfully updated dashboard\.env.local with new IP: $ip"
} else {
    Write-Host "Error: Could not find .env.local at $dashEnv"
}
