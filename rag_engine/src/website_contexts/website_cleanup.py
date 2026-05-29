"""Website cleanup utilities.

Attempts to gracefully shut down ChromaDB resources and any Python processes
holding files under the website sandbox before removing files.
"""

from __future__ import annotations

import shutil
import time
from pathlib import Path
import traceback

from src.website_contexts.website_manager import website_path, update_metadata


def _attempt_chroma_shutdown(chroma_dir: Path, logp: Path) -> None:
    try:
        try:
            import chromadb
        except Exception:
            logp.write_text("chromadb not available, skipping chroma shutdown\n", encoding="utf-8")
            return

        # Try to instantiate a PersistentClient and call common shutdown methods if present.
        try:
            client = chromadb.PersistentClient(path=str(chroma_dir))
        except Exception:
            # If we cannot instantiate, just skip
            logp.write_text("failed to create PersistentClient instance\n", encoding="utf-8")
            return

        for name in ("shutdown", "close", "persist"):
            fn = getattr(client, name, None)
            if callable(fn):
                try:
                    fn()
                    logp.write_text(f"Called client.{name}()\n", encoding="utf-8")
                except Exception:
                    logp.write_text(f"client.{name}() raised\n", encoding="utf-8")
        # best-effort: delete reference
        try:
            del client
        except Exception:
            pass
    except Exception:
        try:
            logp.write_text("unexpected error during chroma shutdown\n" + traceback.format_exc(), encoding="utf-8")
        except Exception:
            pass


def _terminate_processes_with_open_files(target_path: Path, logp: Path, timeout: float = 5.0) -> None:
    try:
        import psutil
    except Exception:
        try:
            logp.write_text("psutil not available, skipping process scan\n", encoding="utf-8")
        except Exception:
            pass
        return

    target_str = str(target_path.resolve())
    killed = []
    for proc in psutil.process_iter(["pid", "name"]):
        try:
            for of in proc.open_files():
                try:
                    if target_str in str(of.path):
                        # attempt graceful terminate
                        proc.terminate()
                        try:
                            proc.wait(timeout=timeout)
                            killed.append((proc.pid, proc.name()))
                        except Exception:
                            proc.kill()
                            killed.append((proc.pid, proc.name()))
                        break
                except Exception:
                    continue
        except Exception:
            continue
    if killed:
        try:
            logp.write_text("terminated processes: " + ", ".join(f"{pid}/{name}" for pid, name in killed) + "\n", encoding="utf-8")
        except Exception:
            pass


def delete_website(context_id: str) -> None:
    path = website_path(context_id)
    # mark as deleting
    try:
        update_metadata(context_id, {"status": "deleting"})
    except Exception:
        pass

    if path.exists() and path.is_dir():
        # attempt to write a cleanup log before deletion
        try:
            logp = path / "logs" / "cleanup.log"
            logp.parent.mkdir(parents=True, exist_ok=True)
            logp.write_text("cleanup started\n", encoding="utf-8")
        except Exception:
            logp = None

        # Best-effort: try to shutdown chroma client resources for this sandbox
        try:
            if logp:
                _attempt_chroma_shutdown(path / "chroma", logp)
        except Exception:
            pass

        # Try to find and terminate processes that have open files under the sandbox (platform-specific, best-effort)
        try:
            if logp:
                _terminate_processes_with_open_files(path, logp)
        except Exception:
            pass

        # Attempt removal with a few retries to tolerate transient locks
        attempts = 3
        for attempt in range(1, attempts + 1):
            try:
                shutil.rmtree(path)
                if logp:
                    try:
                        logp.write_text(f"deleted (attempt {attempt})\n", encoding="utf-8")
                    except Exception:
                        pass
                break
            except Exception as e:
                if logp:
                    try:
                        logp.write_text(f"rmtree failed (attempt {attempt}): {e}\n", encoding="utf-8")
                    except Exception:
                        pass
                if attempt < attempts:
                    time.sleep(1.0 * attempt)
                    continue
                # final attempt failed; re-raise to surface error
                raise
