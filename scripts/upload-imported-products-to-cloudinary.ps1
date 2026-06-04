$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (-not $env:CLOUDINARY_FOLDER) {
  $env:CLOUDINARY_FOLDER = "gstore/productos"
}

$hasSeparateCredentials = $env:CLOUDINARY_CLOUD_NAME -and $env:CLOUDINARY_API_KEY -and $env:CLOUDINARY_API_SECRET
if (-not $env:CLOUDINARY_URL -and -not $hasSeparateCredentials) {
  Write-Host "Pega CLOUDINARY_URL con este formato: cloudinary://API_KEY:API_SECRET@CLOUD_NAME"
  Write-Host "No se guarda en archivos; solo vive en esta ejecucion."
  $secureValue = Read-Host "CLOUDINARY_URL" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try {
    $env:CLOUDINARY_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

npm run cloudinary:import
