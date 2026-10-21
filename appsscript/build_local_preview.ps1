# 로컬 미리보기 빌드: Apps Script 템플릿 태그를 채워 브라우저에서 바로 열 수 있는 HTML을 local_preview\ 에 만든다.
# (서버 없이 같은 브라우저의 localStorage MOCK 으로 동작. 실제 배포에는 이 스크립트가 필요 없다.)
# 예시 데이터는 브라우저 콘솔에서 API.call('mockFillDemo', [], function (r) { console.log(r); }) 로 채운다(빌드 스크립트는 주입하지 않음).
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $root 'local_preview'
New-Item -ItemType Directory -Force $out | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
$common = [System.IO.File]::ReadAllText((Join-Path $root 'Common.html'), $utf8)
$event = '{"name":"경기도 중장년 네트워크 포럼","date":"2026. 10. 28.(수)","time":"12:30~16:00","place":"고양 한양문고 (데미안홀·한강홀)"}'
foreach ($name in @('Start', 'Phone', 'Screen', 'Recorder', 'Admin', 'Print')) {
  $src = Join-Path $root ($name + '.html')
  if (-not (Test-Path -LiteralPath $src)) { continue }
  $html = [System.IO.File]::ReadAllText($src, $utf8)
  $cfg = '{"page":"' + $name.ToLower() + '","no":0,"table":0,"url":"","event":' + $event + ',"prompt":"오늘 여기서 얻어 가고 싶은 것, 하나","logoGG":"../../logo/gyeonggi_symbol.png","logoHC":"../../logo/happycampus_symbol.png","local":true}'
  $html = $html.Replace("<?!= include('Common') ?>", $common)
  $html = $html.Replace('<?!= CFG ?>', $cfg)
  [System.IO.File]::WriteAllText((Join-Path $out ($name + '.html')), $html, $utf8)
  Write-Output ("built " + $name + '.html')
}
