# Downloads documentation only. Does not install or execute any downloaded material.
$ErrorActionPreference='Stop'
$researchRoot=$PSScriptRoot
$downloadRoot=Join-Path $researchRoot 'materials'
New-Item -ItemType Directory -Force -Path $downloadRoot | Out-Null
$items=@(
 @{name='gazebo8-headless.html';url='https://gazebosim.org/api/sim/8/headless_rendering.html';purpose='Gazebo CPU software rendering and EGL constraints'},
 @{name='nav2-jazzy-smac-hybrid.html';url='https://docs.nav2.org/jazzy/configuration_and_development/configuration_guide/planners_plugins/smac/smac_hybrid/configuring_smac_hybrid/';purpose='Forward Dubins path and minimum turning radius'},
 @{name='unity-webrtc-video.html';url='https://docs.unity.cn/Packages/com.unity.webrtc%403.0/manual/videostreaming.html';purpose='Unity camera track streaming; version compatibility must be checked'},
 @{name='carla-retrieve-data.html';url='https://carla.readthedocs.io/en/latest/tuto_G_retrieve_data/';purpose='Camera sensor data; no-rendering returns empty GPU sensor data'},
 @{name='mdn-pointer-capture.html';url='https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture';purpose='Reliable pointer drag ownership across boundaries'},
 @{name='mdn-web-workers.html';url='https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers';purpose='Move path validation away from UI main thread'},
 @{name='mdn-canvas-capture.html';url='https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream';purpose='Canvas composite video stream for camera inset and broadcast'},
 @{name='rmf-lift-adapter-README.md';url='https://raw.githubusercontent.com/open-rmf/lift_adapter_template/main/README.md';purpose='Lift API adapter integration boundary; Apache-2.0 repository'}
)
$handler=[System.Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect=$true
$client=[System.Net.Http.HttpClient]::new($handler)
$client.Timeout=[TimeSpan]::FromSeconds(45)
$client.DefaultRequestHeaders.UserAgent.ParseAdd('MechanicResearch/1.0')
$manifest=@();$researchTotal=0L
foreach($item in $items){
 $headCode=$null;$declaredSize=$null;$headError=$null
 try{$headReq=[System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Head,$item.url);$head=$client.SendAsync($headReq).GetAwaiter().GetResult();$headCode=[int]$head.StatusCode;$declaredSize=$head.Content.Headers.ContentLength;$head.Dispose();$headReq.Dispose()}catch{$headError=$_.Exception.Message}
 if($declaredSize -and $declaredSize -gt 2MB){throw "Document exceeds 2MB per-file budget: $($item.name)"}
 $get=$client.GetAsync($item.url,[System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
 $get.EnsureSuccessStatusCode() | Out-Null
 $inputStream=$get.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
 $buffer=[byte[]]::new(65536);$memory=[System.IO.MemoryStream]::new()
 while(($count=$inputStream.Read($buffer,0,$buffer.Length)) -gt 0){if(($memory.Length+$count) -gt 2MB){throw 'Bounded document download exceeded 2MB'};$memory.Write($buffer,0,$count)}
 if(($researchTotal+$memory.Length) -gt 20MB){throw 'Total research budget exceeded'}
 $target=Join-Path $downloadRoot $item.name
 [System.IO.File]::WriteAllBytes($target,$memory.ToArray())
 $hash=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
 $manifest+=@{file='materials/'+$item.name;url=$item.url;finalUrl=$get.RequestMessage.RequestUri.AbsoluteUri;bytes=$memory.Length;sha256=$hash;purpose=$item.purpose;headStatus=$headCode;headContentLength=$declaredSize;headError=$headError;contentType=$get.Content.Headers.ContentType.ToString();downloadedAtUtc=[DateTime]::UtcNow.ToString('o');executed=$false}
 $researchTotal+=$memory.Length
 $inputStream.Dispose();$memory.Dispose();$get.Dispose()
}
$client.Dispose();$handler.Dispose()
@{schemaVersion=1;scope='documentation only; no engine packages or executable examples';totalBytes=$researchTotal;items=$manifest} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $researchRoot 'manifest.json') -Encoding utf8
$bad=@($manifest | Where-Object{(Get-FileHash -LiteralPath (Join-Path $researchRoot $_.file) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $_.sha256})
if($bad.Count){throw 'Post-write SHA256 verification failed'}
[pscustomobject]@{documents=$manifest.Count;totalBytes=$researchTotal;sha256Verified=$true} | ConvertTo-Json
