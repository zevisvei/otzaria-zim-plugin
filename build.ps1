# Build script — packages this folder into kiwix-zim-reader.otzplugin
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

# Refresh the wrapped JS/WASM assets every build so they stay in sync with
# the upstream libzim-wasm.{js,wasm} files in this folder.
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'tools\wrap-assets.ps1') | Out-Null

$out = Join-Path $root 'kiwix-zim-reader.otzplugin'
if (Test-Path $out) { Remove-Item $out -Force }

$zipTmp = Join-Path $root 'kiwix-zim-reader.zip'
if (Test-Path $zipTmp) { Remove-Item $zipTmp -Force }

# Stage only the files the plugin actually ships with (omit the raw libzim
# .js/.wasm — they are already inlined into js\libzim-wasm-{source,data}.js).
$staging = Join-Path $root '.build-stage'
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging 'js')   | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging 'css')  | Out-Null
if (Test-Path (Join-Path $root 'icon')) {
    New-Item -ItemType Directory -Path (Join-Path $staging 'icon') | Out-Null
    Copy-Item (Join-Path $root 'icon\*') (Join-Path $staging 'icon') -Recurse -Force
}

Copy-Item (Join-Path $root 'manifest.json')               (Join-Path $staging 'manifest.json')
Copy-Item (Join-Path $root 'index.html')                  (Join-Path $staging 'index.html')
Copy-Item (Join-Path $root 'README.md')                   (Join-Path $staging 'README.md')
Copy-Item (Join-Path $root 'css\style.css')               (Join-Path $staging 'css\style.css')
Copy-Item (Join-Path $root 'js\app.js')                   (Join-Path $staging 'js\app.js')
Copy-Item (Join-Path $root 'js\libzim-wasm-source.js')    (Join-Path $staging 'js\libzim-wasm-source.js')
Copy-Item (Join-Path $root 'js\libzim-wasm-data.js')      (Join-Path $staging 'js\libzim-wasm-data.js')

Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipTmp -Force
Rename-Item -Path $zipTmp -NewName 'kiwix-zim-reader.otzplugin'

Remove-Item $staging -Recurse -Force

Write-Host "Built: $out" -ForegroundColor Green
Get-Item $out | Format-List Name, Length, LastWriteTime
