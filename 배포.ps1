# 한 번에 배포: Apps Script(clasp) → Vercel(정적 자료) → GitHub(커밋 · 푸시)
# 사용:  .\배포.ps1 -Message "바꾼 내용 한 줄"   (옵션: -SkipApps  -SkipVercel  -SkipGit)
param([string]$Message = "update", [switch]$SkipApps, [switch]$SkipVercel, [switch]$SkipGit)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$app = Join-Path $root "appsscript"
$deployId = "AKfycbzcLVeO9jF-hoaF8JtvSraJ_OO6SjOjV-oxClweNJ0erCuPtBTQfc_AXugG9oVo770"
$clasp = Join-Path $env:APPDATA "npm\clasp.cmd"
$vercel = Join-Path $env:APPDATA "npm\vercel.cmd"

if (-not $SkipApps) {
  Write-Host "== Apps Script" -ForegroundColor Cyan
  Push-Location $app
  & $clasp push -f 2>&1 | Select-String -Pattern "Pushed|rror|permission" | ForEach-Object { $_.Line }
  & $clasp deploy -i $deployId -d $Message 2>&1 | ForEach-Object { "$_" }
  Pop-Location
}

# 로컬 미리보기(배포 파일 복사의 재료)
& (Join-Path $app "build_local_preview.ps1") | Out-Null

if (-not $SkipVercel) {
  Write-Host "== Vercel" -ForegroundColor Cyan
  $dv = Join-Path $root "deploy_vercel"
  & (Join-Path $app "build_vercel_app.ps1") -DeployId $deployId | Out-Null   # 콘솔·스크린·기록자·참가자·인쇄·안내 페이지 → deploy_vercel\app (v3.12)
  if (Test-Path (Join-Path $root "스크린_스토리보드.html")) { Copy-Item (Join-Path $root "스크린_스토리보드.html") (Join-Path $dv "storyboard.html") -Force }   # /storyboard (첫 화면 / 은 안내 페이지, v3.12.2)
  if (Test-Path (Join-Path $root "스크린_스토리보드.pdf")) { Copy-Item (Join-Path $root "스크린_스토리보드.pdf") (Join-Path $dv "storyboard.pdf") -Force }
  if (Test-Path (Join-Path $root "네트워크_포럼_운영프로그램_시뮬레이션.html")) { New-Item -ItemType Directory -Force (Join-Path $dv "sim") | Out-Null; Copy-Item (Join-Path $root "네트워크_포럼_운영프로그램_시뮬레이션.html") (Join-Path $dv "sim\index.html") -Force }
  Push-Location $dv
  & $vercel deploy --prod --yes --archive=tgz 2>&1 | Select-String -Pattern "Production|Aliased|rror" | ForEach-Object { $_.Line }
  Pop-Location
}

if (-not $SkipGit) {
  Write-Host "== GitHub" -ForegroundColor Cyan
  Push-Location $root
  git add -A
  git commit -m $Message -q 2>$null
  git push -q 2>&1 | ForEach-Object { "$_" }
  git log -1 --oneline
  Pop-Location
}
Write-Host "done" -ForegroundColor Green
