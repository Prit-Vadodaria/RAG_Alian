import psutil
from pathlib import Path
import sys

if len(sys.argv) < 2:
    print("Usage: find_handles.py <path>")
    sys.exit(2)

target = Path(sys.argv[1]).resolve()
print(f"Scanning for open files under: {target}")
found = False
for proc in psutil.process_iter(['pid','name']):
    try:
        ofiles = proc.open_files()
    except Exception:
        continue
    for of in ofiles:
        try:
            p = Path(of.path).resolve()
        except Exception:
            continue
        if target in p.parents or p == target:
            found = True
            print(f"PID={proc.pid} NAME={proc.name()} FILE={of.path}")

if not found:
    print("No open files found under the target path.")
