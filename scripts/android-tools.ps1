# Instala en una carpeta propia (sin permisos de administrador) Java 21 y el SDK de Android para compilar Astrea.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\android-tools.ps1 [-Root D:\AstreaAndroid]
param([string]$Root = 'D:\AstreaAndroid')
$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$jdkRoot = Join-Path $Root 'jdk'; $sdk = Join-Path $Root 'sdk'; $tmp = Join-Path $Root 'tmp'
New-Item -ItemType Directory -Force $jdkRoot, $sdk, $tmp | Out-Null

# 1. Java 21 (Eclipse Temurin)
$jdk = Get-ChildItem $jdkRoot -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $jdk) {
  Write-Output 'Descargando Java 21...'
  Invoke-WebRequest 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk' -OutFile "$tmp\jdk21.zip" -UseBasicParsing
  Expand-Archive "$tmp\jdk21.zip" $jdkRoot -Force; Remove-Item "$tmp\jdk21.zip"
  $jdk = Get-ChildItem $jdkRoot -Directory -Filter 'jdk-21*' | Select-Object -First 1
}
$env:JAVA_HOME = $jdk.FullName; $env:Path = "$($jdk.FullName)\bin;$env:Path"
Write-Output "Java: $($jdk.FullName)"

# 2. Herramientas de línea de comandos del SDK de Android
$sdkmanager = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
if (-not (Test-Path $sdkmanager)) {
  Write-Output 'Descargando herramientas del SDK de Android...'
  $page = (Invoke-WebRequest 'https://developer.android.com/studio' -UseBasicParsing).Content
  $name = [regex]::Match($page, 'commandlinetools-win-\d+_latest\.zip').Value
  if (-not $name) { throw 'No se encontró la versión vigente de las herramientas del SDK.' }
  Invoke-WebRequest "https://dl.google.com/android/repository/$name" -OutFile "$tmp\cmdline.zip" -UseBasicParsing
  Expand-Archive "$tmp\cmdline.zip" "$tmp\cmdline" -Force; Remove-Item "$tmp\cmdline.zip"
  New-Item -ItemType Directory -Force (Join-Path $sdk 'cmdline-tools') | Out-Null
  Move-Item "$tmp\cmdline\cmdline-tools" (Join-Path $sdk 'cmdline-tools\latest')
}
$env:ANDROID_HOME = $sdk; $env:ANDROID_SDK_ROOT = $sdk

# 3. Licencias del SDK y componentes para compilar (Android 16 / API 36)
Write-Output 'Aceptando licencias del SDK de Android e instalando componentes...'
(('y' + [Environment]::NewLine) * 40) | & $sdkmanager "--sdk_root=$sdk" --licenses | Out-Null
& $sdkmanager "--sdk_root=$sdk" 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0' | Select-String -Pattern 'Installed|done|Warning|Error' | ForEach-Object { $_.Line }
if ($LASTEXITCODE -ne 0) { throw "sdkmanager terminó con código $LASTEXITCODE" }
Write-Output "ANDROID_HOME=$sdk"
Write-Output 'HERRAMIENTAS_LISTAS'
