# Compila y verifica un APK o AAB con las herramientas de scripts\android-tools.ps1.
param(
    [string]$Root = 'D:\AstreaAndroid',
    [ValidateSet('Debug', 'Release')][string]$Variant = 'Debug',
    [switch]$Bundle,
    [string]$OutputDirectory = ''
)
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent; Set-Location $project
$jdk = Get-ChildItem (Join-Path $Root 'jdk') -Directory -Filter 'jdk-21*' | Select-Object -First 1
if (-not $jdk) { throw 'Falta Java 21. Ejecute primero scripts\android-tools.ps1' }
$sdk = Join-Path $Root 'sdk'
$env:JAVA_HOME = $jdk.FullName; $env:Path = "$($jdk.FullName)\bin;$sdk\platform-tools;$env:Path"
$env:ANDROID_HOME = $sdk; $env:ANDROID_SDK_ROOT = $sdk
# La caché de Gradle va a la misma carpeta para no llenar el disco del sistema.
$env:GRADLE_USER_HOME = Join-Path $Root 'gradle'
if ($Bundle -and $Variant -ne 'Release') { throw 'Use -Variant Release para generar un AAB.' }
if ($Variant -eq 'Release' -and -not (Test-Path -LiteralPath 'android\keystore.properties')) {
    & (Join-Path $PSScriptRoot 'android-signing.ps1') -Root $Root
}
if (-not $OutputDirectory) { $OutputDirectory = $project }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

Write-Output 'Compilando la web y sincronizando con Android...'
& npm.cmd run build:android; if ($LASTEXITCODE -ne 0) { throw 'Falló npm run build:android' }
Set-Content -Path 'android\local.properties' -Value ('sdk.dir=' + ($sdk -replace '\\', '\\')) -Encoding ASCII

Write-Output 'Compilando el APK (la primera vez descarga Gradle y tarda varios minutos)...'
Push-Location android
try {
    $task = if ($Bundle) { 'bundleRelease' } else { "assemble$Variant" }
    & .\gradlew.bat $task --no-daemon --console=plain --max-workers=2
    $code = $LASTEXITCODE
} finally { Pop-Location }
if ($code -ne 0) { throw "Gradle terminó con código $code" }
if ($Bundle) {
    $source = 'android\app\build\outputs\bundle\release\app-release.aab'
    $name = 'Astrea-Suite-release.aab'
    $verification = & (Join-Path $jdk.FullName 'bin\jarsigner.exe') '-J-Duser.language=en' '-J-Duser.country=US' -verify $source
    $verification | Select-Object -First 8 | Write-Output
    if ($LASTEXITCODE -ne 0 -or ($verification -join "`n") -notmatch 'jar verified\.') { throw 'La firma del AAB no es válida.' }
} else {
    $kind = $Variant.ToLowerInvariant()
    $source = "android\app\build\outputs\apk\$kind\app-$kind.apk"
    $name = "Astrea-Suite-$kind.apk"
    $buildTools = Get-ChildItem (Join-Path $sdk 'build-tools') -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
    & (Join-Path $buildTools.FullName 'apksigner.bat') verify --verbose --print-certs $source
    if ($LASTEXITCODE -ne 0) { throw 'La firma del APK no es válida.' }
    & (Join-Path $buildTools.FullName 'zipalign.exe') -c -P 16 -v 4 $source | Select-Object -Last 1
    if ($LASTEXITCODE -ne 0) { throw 'La alineación del APK no es válida.' }
}
$output = Join-Path $OutputDirectory $name
Copy-Item -LiteralPath $source -Destination $output -Force
$hash = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash
Set-Content -LiteralPath "$output.sha256" -Value "$hash  $name" -Encoding ASCII
Write-Output ("PAQUETE_LISTO: {0} ({1:N1} MB)" -f $output, ((Get-Item -LiteralPath $output).Length / 1MB))
