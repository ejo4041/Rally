#!/usr/bin/env python3
"""Explicit provisioning only; worker inference never uses the network."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-directory", type=Path, default=Path("/srv/hackathon/models/meta-fastspeech2"))
    args = parser.parse_args()
    manifest = json.loads((Path(__file__).parent / "model-manifest.json").read_text())
    if sum(item["size"] for item in manifest["files"]) >= 1_000_000_000:
        raise ValueError("download exceeds authorized limit")
    args.model_directory.mkdir(parents=True, exist_ok=True)
    for item in manifest["files"]:
        target = args.model_directory / item["file"]
        if not target.exists():
            partial = target.with_suffix(target.suffix + ".partial")
            with urllib.request.urlopen(item["url"], timeout=60) as source, partial.open("wb") as output:
                received = 0
                while chunk := source.read(1024 * 1024):
                    received += len(chunk)
                    if received > item["size"]:
                        raise ValueError("artifact exceeds pinned size")
                    output.write(chunk)
            partial.replace(target)
        with target.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if target.stat().st_size != item["size"] or digest != item["sha256"]:
            raise ValueError(f"artifact verification failed: {target.name}")
        print(target.name, digest)
    (args.model_directory / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
