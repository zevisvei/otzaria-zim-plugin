# Resolve the plugin's js/ folder relative to this script (tools/ -> ../js),
# so the build works from any checkout location.
$dir = (Resolve-Path (Join-Path $PSScriptRoot '..\js')).Path

$jsText = [System.IO.File]::ReadAllText("$dir\libzim-wasm.js")
$escaped = $jsText.Replace('\','\\').Replace('`','\`').Replace('${','\${')
$wrap = 'self.__libzimWasmSource = ' + [char]96 + $escaped + [char]96 + ';'
[System.IO.File]::WriteAllText("$dir\libzim-wasm-source.js", $wrap, [System.Text.UTF8Encoding]::new($false))

$wasmBytes = [System.IO.File]::ReadAllBytes("$dir\libzim-wasm.wasm")
$b64 = [System.Convert]::ToBase64String($wasmBytes)
$wasmJs = 'self.__libzimWasmBase64 = "' + $b64 + '";'
[System.IO.File]::WriteAllText("$dir\libzim-wasm-data.js", $wasmJs, [System.Text.UTF8Encoding]::new($false))

Get-ChildItem $dir | Select-Object Name,Length | Format-Table -AutoSize
