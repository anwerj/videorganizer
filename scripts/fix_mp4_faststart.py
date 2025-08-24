#!/usr/bin/env python3
"""
fix_mp4_faststart.py

Recursively process .mp4 files and rewrite them with moov atom at front using:
    ffmpeg -i in.mp4 -c copy -movflags faststart out.mp4

Requirements: ffmpeg in PATH, Python 3.7+
"""
import argparse
import concurrent.futures
import os
import subprocess
import sys
from pathlib import Path

def run_ffmpeg(input_path: Path, tmp_path: Path) -> int:
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-y", "-i", str(input_path),
        "-c", "copy", "-movflags", "faststart",
        str(tmp_path)
    ]
    return subprocess.run(cmd).returncode

def process_file(path: Path, root: Path, backup_dir: Path, dry_run: bool) -> bool:
    print(f"[+] Processing: {path}")
    tmp = path.with_suffix(path.suffix + ".tmp-fixed")
    try:
        if dry_run:
            print(f"    dry-run: would run ffmpeg on {path}")
            return True
        rc = run_ffmpeg(path, tmp)
        if rc != 0:
            print(f"    ffmpeg failed for {path} (code {rc})", file=sys.stderr)
            if tmp.exists(): tmp.unlink()
            return False
        # create backup and replace
        if backup_dir:
            rel = path.relative_to(root)
            dest_backup = backup_dir.joinpath(rel)
            dest_backup.parent.mkdir(parents=True, exist_ok=True)
            path.replace(dest_backup)  # move original to backup
            tmp.replace(path)          # move tmp into original path
            print(f"    replaced: {path} (backup at {dest_backup})")
        else:
            path.unlink()   # remove original
            tmp.replace(path)
            print(f"    replaced: {path}")
        return True
    except Exception as e:
        print(f"    error processing {path}: {e}", file=sys.stderr)
        if tmp.exists(): tmp.unlink()
        return False

def find_files(root: Path, exts):
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in exts:
            yield p

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--root", "-r", default=".", help="Root folder to scan")
    p.add_argument("--backup", "-b", default=None, help="Backup folder (if omitted, originals replaced without backup)")
    p.add_argument("--jobs", "-j", type=int, default=2, help="Parallel jobs")
    p.add_argument("--exts", "-e", default=".mp4,.m4v,.mov", help="Comma-separated extensions")
    p.add_argument("--dry-run", action="store_true", help="Do not run ffmpeg; just list files")
    args = p.parse_args()

    root = Path(args.root).resolve()
    backup = Path(args.backup).resolve() if args.backup else None
    if backup:
        backup.mkdir(parents=True, exist_ok=True)
    exts = {ext.strip().lower() if ext.strip().startswith('.') else '.'+ext.strip().lower() for ext in args.exts.split(",")}

    files = list(find_files(root, exts))
    if not files:
        print("No files found.")
        return

    print(f"Found {len(files)} files under {root}")
    if args.dry_run:
        for f in files:
            print("DRY:", f)
        return

    ok = 0
    fail = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as ex:
        futures = {ex.submit(process_file, f, root, backup, args.dry_run): f for f in files}
        for fut in concurrent.futures.as_completed(futures):
            fpath = futures[fut]
            try:
                res = fut.result()
                if res: ok += 1
                else: fail += 1
            except Exception as e:
                print("Exception for", fpath, e, file=sys.stderr)
                fail += 1

    print(f"Done. success={ok} fail={fail}")

if __name__ == "__main__":
    main()
