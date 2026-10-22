# 한 번에 배포: Apps Script(clasp) → Vercel(정적 자료) → GitHub(커밋 · 푸시)
# 사용:  .\배포.ps1 -Message "바꾼 내용 한 줄"   (옵션: -SkipApps  -SkipVercel  -SkipGit)
# Vercel 프로젝트가 GitHub 저장소와 연결되어 있어 deploy_vercel 이 바뀐 푸시는 Vercel 이 자동 배포한다. 여기서 이미 배포한 커밋은 [skip ci] 를 붙여 두 번 배포하지 않는다 (v3.14)
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
  $msg = $Message; if (-not $SkipVercel) { $msg = "$Message [skip ci]" }   # Vercel 을 여기서 배포했으면 Actions 자동 배포는 건너뛴다 (v3.14)
  git commit -m $msg -q 2>$null
  git push -q 2>&1 | ForEach-Object { "$_" }
  git log -1 --oneline
  if (-not $SkipVercel) {   # 저장소 페이지 Deployments 에 이번 Vercel 배포를 기록 (gh CLI 로그인 필요, 실패해도 배포 결과에는 영향 없음, v3.14)
    $gh = Join-Path (Join-Path $env:ProgramFiles "GitHub CLI") "gh.exe"; $repo = "jykim-sada/network-forum-program"
    if (Test-Path $gh) {
      $sha = (git rev-parse HEAD).Trim()
      $body = @{ ref = $sha; environment = "Production"; auto_merge = $false; required_contexts = @(); description = "배포.ps1: $Message" } | ConvertTo-Json -Compress
      $tmp = [IO.Path]::GetTempFileName(); [IO.File]::WriteAllText($tmp, $body, (New-Object Text.UTF8Encoding $false))   # stdin 파이프는 PS 5.1 에서 한글이 깨짐 → UTF-8 파일로
      $dep = & $gh api "repos/$repo/deployments" --input $tmp --jq .id 2>$null; Remove-Item $tmp -ErrorAction SilentlyContinue
      if ($dep -match '^[0-9]+$') {   # gh 가 오류 본문을 돌려줘도 숫자 id 일 때만 진행
        $st = @{ state = "success"; environment = "Production"; environment_url = "https://gg-forum-screen.vercel.app"; auto_inactive = $true } | ConvertTo-Json -Compress
        [IO.File]::WriteAllText($tmp, $st, (New-Object Text.UTF8Encoding $false))
        & $gh api "repos/$repo/deployments/$dep/statuses" --input $tmp --jq .state 2>$null | ForEach-Object { "Deployments 기록: $_ ($($sha.Substring(0,7)))" }; Remove-Item $tmp -ErrorAction SilentlyContinue
      } else { Write-Host "Deployments 기록 실패(gh 로그인 확인) - 배포 자체는 끝났습니다" -ForegroundColor Yellow }
    }
  }
  Pop-Location
}
Write-Host "done" -ForegroundColor Green
