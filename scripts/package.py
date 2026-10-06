"""Package source and verification evidence with Python 3 standard library."""
from pathlib import Path
from datetime import date
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

root = Path(__file__).resolve().parent.parent
output = root / "delivery"
output.mkdir(exist_ok=True)
name = f"Jenny-Stormbreakers-源码-{date.today().isoformat()}.zip"
archive = output / name
files = []
for folder in ("src", "shared", "server", "public", "tests", "scripts", "docs"):
    files.extend(p for p in (root / folder).rglob("*") if p.is_file() and "__pycache__" not in p.parts)
files.extend(p for p in root.iterdir() if p.is_file() and (p.suffix in (".json", ".html", ".yaml", ".md") or p.name == ".gitignore" or p.name.startswith("vite.config")))
for p in (root / "artifacts").iterdir():
    if p.name != "touch-debug.png" and p.name.startswith(("six-", "audio-", "touch-", "ipad-", "multiplayer-verification", "polished-", "performance-")) and p.suffix in (".json", ".png"):
        files.append(p)
manifest = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(set(files))}
with ZipFile(archive, "w", ZIP_DEFLATED, compresslevel=9) as zipfile:
    for p in sorted(set(files)):
        zipfile.write(p, Path("jenny-stormbreakers") / p.relative_to(root))
    zipfile.writestr("jenny-stormbreakers/SOURCE-MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=2))
with ZipFile(archive) as zipfile:
    assert zipfile.testzip() is None
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
(output / (name + ".sha256")).write_text(f"{checksum}  {name}\n")
print(f"Created {archive} ({archive.stat().st_size:,} bytes, {len(manifest)} files)")
print(f"SHA256 {checksum}")
