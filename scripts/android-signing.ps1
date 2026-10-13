# Crea o reutiliza la firma de Astrea. La clave y su contraseña quedan fuera del repositorio.
param([string]$Root = 'D:\AstreaAndroid')
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$jdk = Get-ChildItem (Join-Path $Root 'jdk') -Directory -Filter 'jdk-21*' | Select-Object -First 1
if (-not $jdk) { throw 'Falta Java 21. Ejecute scripts\android-tools.ps1.' }
$signingDirectory = Join-Path $Root 'signing'
New-Item -ItemType Directory -Path $signingDirectory -Force | Out-Null

function Protect-LocalPath([string]$Path, [bool]$Directory = $false) {
    $acl = Get-Acl -LiteralPath $Path
    $acl.SetAccessRuleProtection($true, $false)
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $inheritance = if ($Directory) { [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' } else { [System.Security.AccessControl.InheritanceFlags]::None }
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', $inheritance, 'None', 'Allow')
    $acl.SetAccessRule($rule)
    Set-Acl -LiteralPath $Path -AclObject $acl
}
Protect-LocalPath $signingDirectory $true
$keystore = Join-Path $signingDirectory 'astrea-release.jks'
$credentialFile = Join-Path $signingDirectory 'astrea-release.credentials.xml'
$alias = 'astrea-release'
if ((Test-Path -LiteralPath $keystore) -and -not (Test-Path -LiteralPath $credentialFile)) {
    throw 'Existe la clave de firma pero falta su contraseña protegida. Recupere el respaldo; no se reemplazará la firma.'
}
if (Test-Path -LiteralPath $credentialFile) {
    if (-not (Test-Path -LiteralPath $keystore)) { throw 'Falta la clave de firma. Recupere el respaldo; no se generará otra con la misma configuración.' }
    $credential = Import-Clixml -LiteralPath $credentialFile
} else {
    $bytes = New-Object byte[] 48
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    $securePassword = ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential($alias, $securePassword)
    $env:ASTREA_STORE_PASSWORD = $credential.GetNetworkCredential().Password
    try {
        & (Join-Path $jdk.FullName 'bin\keytool.exe') -genkeypair -keystore $keystore -storetype JKS -alias $alias -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Astrea Suite, OU=Aplicaciones, O=Proyectos con Energia, C=CO' -storepass:env ASTREA_STORE_PASSWORD -keypass:env ASTREA_STORE_PASSWORD -noprompt
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la clave de firma.' }
        $credential | Export-Clixml -LiteralPath $credentialFile
    } finally { Remove-Item Env:ASTREA_STORE_PASSWORD -ErrorAction SilentlyContinue }
}
Protect-LocalPath $keystore
Protect-LocalPath $credentialFile
$propertiesFile = Join-Path $project 'android\keystore.properties'
$password = $credential.GetNetworkCredential().Password
$properties = @(
    'storeFile=' + ($keystore -replace '\\', '/')
    'storePassword=' + $password
    'keyAlias=' + $alias
    'keyPassword=' + $password
)
[System.IO.File]::WriteAllLines($propertiesFile, $properties, (New-Object System.Text.UTF8Encoding($false)))
Protect-LocalPath $propertiesFile
$env:ASTREA_STORE_PASSWORD = $password
try {
    & (Join-Path $jdk.FullName 'bin\keytool.exe') -exportcert -rfc -keystore $keystore -alias $alias -storepass:env ASTREA_STORE_PASSWORD -file (Join-Path $signingDirectory 'astrea-release-certificate.pem')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar la clave de firma.' }
} finally { Remove-Item Env:ASTREA_STORE_PASSWORD -ErrorAction SilentlyContinue; $password = $null }
Write-Output "Firma de Astrea disponible en $signingDirectory. Conserve un respaldo privado de esta carpeta."
Write-Output 'La contraseña de credentials.xml está protegida para esta cuenta de Windows; android/keystore.properties permite recuperar la firma en otro equipo y debe respaldarse de forma privada.'
