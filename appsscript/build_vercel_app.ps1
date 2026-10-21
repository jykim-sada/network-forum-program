# Vercel 용 화면 빌드 (v3.12): Apps Script 템플릿 태그를 채워 deploy_vercel\app\ 에 정적 HTML 을 만든다.
#   - 화면은 Vercel 에서 열리고, 자료 읽기·쓰기·분석은 Apps Script JSON API(fetch) 로 간다 (CFG.api = 'remote').
#   - 짧은 주소(/admin /screen /recorder /phone /print /app)는 deploy_vercel\vercel.json 의 rewrites 가 app\*.html 로 연결한다.
# 사용: .\build_vercel_app.ps1   (배포.ps1 이 자동으로 부른다)
param([string]$DeployId = 'AKfycbzcLVeO9jF-hoaF8JtvSraJ_OO6SjOjV-oxClweNJ0erCuPtBTQfc_AXugG9oVo770', [string]$Site = 'https://gg-forum-screen.vercel.app')   # 배포.ps1 이 넘겨 준다 (v3.12.1)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$proj = Split-Path -Parent $root
$out = Join-Path $proj 'deploy_vercel\app'
New-Item -ItemType Directory -Force $out | Out-Null
New-Item -ItemType Directory -Force (Join-Path $out 'logo') | Out-Null
Copy-Item (Join-Path $proj 'logo\gyeonggi_symbol.png') (Join-Path $out 'logo\gyeonggi_symbol.png') -Force
Copy-Item (Join-Path $proj 'logo\happycampus_symbol.png') (Join-Path $out 'logo\happycampus_symbol.png') -Force
$utf8 = New-Object System.Text.UTF8Encoding($false)
$common = [System.IO.File]::ReadAllText((Join-Path $root 'Common.html'), $utf8)
$execUrl = 'https://script.google.com/macros/s/' + $DeployId + '/exec'
$site = $Site.TrimEnd('/')
$event = '{"name":"경기도 중장년 네트워크 포럼","date":"2026. 10. 28.(수)","time":"12:30~16:00","place":"고양 한양문고 (데미안홀·한강홀)"}'
$titles = @{ Start = '안내'; Phone = '오늘의 한줄'; Screen = '스크린'; Recorder = '기록자'; Admin = '운영진 콘솔'; Print = '테이블 QR 인쇄' }
foreach ($name in @('Start', 'Phone', 'Screen', 'Recorder', 'Admin', 'Print')) {
  $src = Join-Path $root ($name + '.html')
  if (-not (Test-Path -LiteralPath $src)) { continue }
  $html = [System.IO.File]::ReadAllText($src, $utf8)
  $cfg = '{"page":"' + $name.ToLower() + '","no":0,"table":0,"url":"' + $execUrl + '","api":"remote","site":"' + $site + '","event":' + $event + ',"prompt":"오늘 여기서 얻어 가고 싶은 것, 하나","logoGG":"/app/logo/gyeonggi_symbol.png","logoHC":"/app/logo/happycampus_symbol.png"}'
  $html = $html.Replace("<?!= include('Common') ?>", $common)
  $html = $html.Replace('<?!= CFG ?>', $cfg)
  # 템플릿에 charset·viewport·title 이 이미 있으므로 그대로 둔다
  $dst = Join-Path $out ($name.ToLower() + '.html')
  [System.IO.File]::WriteAllText($dst, $html, $utf8)
  Write-Output ("vercel app: " + $name.ToLower() + '.html')
}
