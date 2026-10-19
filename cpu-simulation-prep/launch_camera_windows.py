"""Launch hidden foreground WSL clients; keep the WSL distribution alive."""
import argparse,subprocess,sys,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("--runtime-dir",required=True,type=Path);a=p.parse_args();a.runtime_dir.mkdir(parents=True,exist_ok=True)
base=["wsl","-d","Ubuntu-24.04","-u","root","--exec"]
check=subprocess.run(base+["python3","-c",'from pathlib import Path; import sys; files=[Path("/root/mechanic-camera/gazebo.pid"),Path("/root/mechanic-camera/bridge.pid")]; sys.exit(any(p.exists() and p.read_text().strip().isdigit() and Path("/proc/"+p.read_text().strip()+"/cmdline").exists() and b"/root/mechanic-camera/" in Path("/proc/"+p.read_text().strip()+"/cmdline").read_bytes() for p in files))'])
if check.returncode: raise SystemExit("Camera processes already running. Stop them first.")
env=["env","GZ_PARTITION=mechanic-camera","LIBGL_ALWAYS_SOFTWARE=1","MESA_LOADER_DRIVER_OVERRIDE=llvmpipe","GALLIUM_DRIVER=llvmpipe","EGL_PLATFORM=surfaceless","DISPLAY=","WAYLAND_DISPLAY=","QT_QPA_PLATFORM=offscreen"]
commands={"gazebo":[*env,"gz","sim","-v","3","-s","-r","--headless-rendering","/root/mechanic-camera/world.sdf"],"bridge":["env","GZ_PARTITION=mechanic-camera","python3","-u","/root/mechanic-camera/bridge.py","--config","/root/mechanic-camera/connection.json"]}
for name,command in commands.items():
    # Python in the guest writes its own PID and then execs the bounded process.
    code='import os,pathlib; pathlib.Path("/root/mechanic-camera/'+name+'.pid").write_text(str(os.getpid())); os.execvp("timeout",'+repr(["timeout","7200s",*command])+')'
    with (a.runtime_dir/(name+".log")).open("wb") as log:
        child=subprocess.Popen(base+["python3","-c",code],stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW|subprocess.CREATE_NEW_PROCESS_GROUP,close_fds=True)
        (a.runtime_dir/(name+"-windows.pid")).write_text(str(child.pid))
print("Hidden WSL camera processes started. Verify logs and website before treating as ready.")
