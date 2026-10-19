param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference = 'Stop'
$ConfigPath = (Resolve-Path -LiteralPath $ConfigPath).Path
$worldFile = Join-Path $PSScriptRoot 'mechanic-camera.sdf'
$bridgeFile = Join-Path $PSScriptRoot 'gazebo_camera_bridge.py'
function LinuxPath([string]$path) { $value = & wsl -d Ubuntu-24.04 -u root --exec wslpath -u ($path.Replace('\','/')); if ($LASTEXITCODE -ne 0) { throw 'WSL path conversion failed' }; return ($value.Trim()) }
& wsl -d Ubuntu-24.04 -u root --exec mkdir -p /root/mechanic-camera
& wsl -d Ubuntu-24.04 -u root --exec chmod 700 /root/mechanic-camera
& wsl -d Ubuntu-24.04 -u root --exec install -m 600 (LinuxPath $ConfigPath) /root/mechanic-camera/connection.json
& wsl -d Ubuntu-24.04 -u root --exec cp (LinuxPath $worldFile) /root/mechanic-camera/world.sdf
& wsl -d Ubuntu-24.04 -u root --exec cp (LinuxPath $bridgeFile) /root/mechanic-camera/bridge.py
$runtimeDir = Join-Path $env:LOCALAPPDATA 'MechanicGazeboCamera'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$launcher = Join-Path $PSScriptRoot 'launch_camera_windows.py'
& python $launcher --runtime-dir $runtimeDir
if ($LASTEXITCODE -ne 0) { throw 'Camera start failed' }
