param([string]$AndroidSdk = "$env:LOCALAPPDATA\Android\Sdk")
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Test-Path -LiteralPath (Join-Path $AndroidSdk 'platforms\android-36\android.jar'))) {
    throw 'Install Android SDK platform 36 and build tools using Android Studio or sdkmanager first.'
}
$sdkForward = $AndroidSdk.Replace('\', '/').Replace(':', '\:')
Set-Content -LiteralPath (Join-Path $projectRoot 'local.properties') -Value ('sdk.dir=' + $sdkForward)
& (Join-Path $projectRoot 'gradlew.bat') --no-daemon :app:assembleDebug
if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
Write-Output (Join-Path $projectRoot 'app\build\outputs\apk\debug\app-debug.apk')
