# ScribeFlow — Windows Explorer context-menu integration (per-user, no admin)
# Right-click any media file -> "ScribeFlow" -> subtitles UI opens with the file queued.
#
# Usage:  powershell -ExecutionPolicy Bypass -File install-context-menu.ps1 [-ExePath "C:\path\to\ScribeFlow.exe"]
# Remove: powershell -ExecutionPolicy Bypass -File install-context-menu.ps1 -Remove

param(
  [string]$ExePath = "",
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'

# Default: use the portable exe next to this repo if present
if (-not $ExePath) {
  $candidate = Join-Path $PSScriptRoot '..\release'
  $exe = Get-ChildItem $candidate -Filter 'ScribeFlow*.exe' -ErrorAction SilentlyContinue |
         Where-Object { $_.Name -notlike '*unpacked*' } | Select-Object -First 1
  if ($exe) { $ExePath = $exe.FullName }
}
if (-not $ExePath -and -not $Remove) {
  Write-Error "No exe found. Pass -ExePath to your ScribeFlow.exe"
  exit 1
}

$exts = @('mp3','wav','m4a','flac','ogg','opus','aac','wma','mp4','mkv','mov','webm','avi','m4v','mpg','mpeg','wmv','flv','ts','m2ts')
$verbKey = 'Software\Classes\SystemFileAssociations\%s\shell\ScribeFlow\command'

foreach ($ext in $exts) {
  $key = "HKCU:\$($verbKey -f ".$ext")"
  if ($Remove) {
    Remove-Item $key -Recurse -Force -ErrorAction SilentlyContinue
  } else {
    New-Item -Path $key -Force | Out-Null
    Set-ItemProperty -Path $key -Name '(Default)' -Value "`"$ExePath`" `"%1`""
  }
}

# Friendly verb label
foreach ($ext in $exts) {
  $labelKey = "HKCU:\Software\Classes\SystemFileAssociations\.$ext\shell\ScribeFlow"
  if ($Remove) {
    Remove-Item $labelKey -Recurse -Force -ErrorAction SilentlyContinue
  } else {
    New-Item -Path $labelKey -Force | Out-Null
    Set-ItemProperty -Path $labelKey -Name 'MUIVerb' -Value '&ScribeFlow'
    New-ItemProperty -Path $labelKey -Name 'Icon' -Value $ExePath -PropertyType String -Force | Out-Null
  }
}

if ($Remove) { Write-Host "ScribeFlow context menu removed." }
else { Write-Host "Done — right-click any media file -> ScribeFlow (uses $ExePath)" }
