$f = 'd:\source_codes\school_clocking_system\dashboard\src\app\(protected)\employees\page.tsx'
$lines = [System.IO.File]::ReadAllLines($f)
$keep = $lines[0..392] + $lines[953..($lines.Length - 1)]
[System.IO.File]::WriteAllLines($f, $keep)
Write-Host "Done. New line count: $($keep.Length)"
