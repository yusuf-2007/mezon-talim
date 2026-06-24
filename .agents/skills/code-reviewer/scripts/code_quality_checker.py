#!/usr/bin/env python3
"""
Mezon Ta'lim static code checker.

Scans the repo for project-specific antipatterns that the build/lint/typecheck
gates do NOT catch (see references/common_antipatterns.md). Heuristic and
deliberately low-false-positive; treat findings as "look here", not gospel.

Usage:
  python3 code_quality_checker.py <path>            # scan a dir/file (default: cwd)
  python3 code_quality_checker.py . --changed       # only files changed vs main + working tree
  python3 code_quality_checker.py . --verbose
Exit code is non-zero if any BLOCKING finding is reported.
"""
import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

BLOCK, WARN, NIT = "BLOCK", "WARN", "NIT"

SKIP_DIRS = {"node_modules", ".next", ".git", "dist", "build", ".turbo", "drizzle"}
CODE_EXT = {".ts", ".tsx", ".js", ".jsx"}


def rel(p: Path) -> str:
    try:
        return str(p.relative_to(Path.cwd()))
    except ValueError:
        return str(p)


def is_server_module(path: str) -> bool:
    """Unambiguously server-only modules. Deliberately narrow to avoid flagging
    barrels (index.ts), "use server" files (inherently server), and mixed modules
    that intentionally export client-safe helpers (e.g. lib/payments/index.ts)."""
    if path.endswith("/index.ts"):
        return False
    return "/lib/db/repositories/" in path or path.endswith("/service.ts")


def check_file(path: Path):
    """Yield (severity, lineno, message) findings for one file."""
    rp = rel(path)
    # Normalize with a leading slash so "/lib/x/" substring checks work whether
    # the path is "lib/x/f.ts" (cwd-relative) or "/abs/lib/x/f.ts".
    nrp = "/" + rp
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return
    lines = text.split("\n")
    under_lib_db = "/lib/db/" in nrp
    in_app_layer = any(
        rp.startswith(d) or f"/{d}" in rp for d in ("app/", "components/")
    )
    is_use_server = bool(re.search(r'^\s*["\']use server["\']', text, re.M))

    # File-level: missing server-only guard on server modules ("use server" files
    # are inherently server, so they don't need the explicit guard).
    if is_server_module(nrp) and not is_use_server and 'import "server-only"' not in text and "'server-only'" not in text:
        yield (WARN, 1, "server module missing `import \"server-only\";` guard")

    for i, line in enumerate(lines, 1):
        s = line.strip()
        if s.startswith("//") or s.startswith("*"):
            continue

        # 1. Raw db / drizzle access outside lib/db.
        if not under_lib_db:
            if re.search(r'from\s+["\']@/lib/db/client["\']', line) or re.search(
                r'import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*["\']@/lib/db', line
            ):
                yield (BLOCK, i, "raw `db` import outside lib/db — use a repository")
            if re.search(r'from\s+["\']drizzle-orm["\']', line):
                yield (BLOCK, i, "drizzle-orm imported outside lib/db — use a repository")

        # 2. Direct Auth.js usage outside lib/auth.
        if "/lib/auth/" not in nrp and re.search(r'from\s+["\']next-auth["\']', line):
            yield (WARN, i, "next-auth imported outside lib/auth — use getCurrentUser/requireRole")

        # 3. "use server" re-export of a non-action.
        if is_use_server and re.match(r'export\s+(\{|const\s|default\s|let\s|var\s)', s):
            if not s.startswith("export type"):
                yield (BLOCK, i, 'non-action export in a "use server" file — breaks the action registry')

        # 4. awaited redirect.
        if re.search(r'\bawait\s+redirect(Localized)?\s*\(', line):
            yield (WARN, i, "`await redirect…` — return it instead (Promise<never>)")

        # 5. Money as float.
        if re.search(r'\b\w*(price|amount|tiyin|som|sum)\w*\s*[:=]\s*\d+\.\d+', line, re.I):
            yield (BLOCK, i, "float literal assigned to a money field — money is integer tiyin")
        # parseFloat on money is a real risk; Number(...) of an integer aggregate
        # is fine, so it is intentionally NOT flagged here.
        if re.search(r'\bparseFloat\s*\([^)]*(tiyin|price|amount)', line, re.I):
            yield (WARN, i, "parseFloat on a money value — keep money as integer tiyin")

        # 6. Base UI Button misuse.
        if "asChild" in line and (rp.endswith(".tsx") or rp.endswith(".jsx")):
            yield (NIT, i, "`asChild` — this project's Button uses the `render` prop")

        # 7. Stray console.log in lib/app/components.
        if re.search(r'\bconsole\.log\s*\(', line) and (
            rp.startswith("lib/") or in_app_layer
        ):
            yield (NIT, i, "stray console.log — remove or use console.error/info")

        # 8. Hardcoded UZ/RU UI text in JSX (Cyrillic or Uzbek oʻ/gʻ) not via t().
        if rp.endswith(".tsx") and ">" in line:
            jsx_text = re.search(r'>\s*([^<>{}\n]*[А-Яа-яʻ][^<>{}\n]*?)\s*<', line)
            if jsx_text and "t(" not in line and not jsx_text.group(1).strip().startswith("{"):
                yield (WARN, i, "hardcoded UZ/RU text in JSX — move to messages/*.json via next-intl")

    # File-level: live route under a private folder.
    if "/api/" in rp and re.search(r"/_[A-Za-z]", rp):
        yield (WARN, 1, "API route under a private (_-prefixed) folder won't be routed")


def gather_files(target: Path, changed: bool):
    if changed:
        files = set()
        for cmd in (
            ["git", "diff", "--name-only", "main...HEAD"],
            ["git", "diff", "--name-only"],
            ["git", "diff", "--name-only", "--cached"],
        ):
            try:
                out = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
                files.update(l for l in out.stdout.split("\n") if l.strip())
            except Exception:
                pass
        return [Path(f) for f in sorted(files) if Path(f).suffix in CODE_EXT and Path(f).exists()]

    if target.is_file():
        return [target]
    out = []
    for root, dirs, names in os.walk(target):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for n in names:
            if Path(n).suffix in CODE_EXT:
                out.append(Path(root) / n)
    return out


def main():
    ap = argparse.ArgumentParser(description="Mezon Ta'lim static antipattern checker")
    ap.add_argument("path", nargs="?", default=".", help="dir or file to scan")
    ap.add_argument("--changed", action="store_true", help="only files changed vs main + working tree")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    files = gather_files(Path(args.path), args.changed)
    if args.verbose:
        print(f"Scanning {len(files)} file(s)...\n")

    buckets = {BLOCK: [], WARN: [], NIT: []}
    for f in files:
        for sev, ln, msg in check_file(f):
            buckets[sev].append((rel(f), ln, msg))

    icons = {BLOCK: "⛔", WARN: "⚠️ ", NIT: "💡"}
    total = sum(len(v) for v in buckets.values())
    for sev in (BLOCK, WARN, NIT):
        for path, ln, msg in sorted(buckets[sev]):
            print(f"{icons[sev]} {path}:{ln}  {msg}")

    print(
        f"\n{total} finding(s): "
        f"{len(buckets[BLOCK])} blocking, {len(buckets[WARN])} warn, {len(buckets[NIT])} nit."
    )
    if not total:
        print("✅ No project antipatterns detected. (Still apply the review checklist.)")
    sys.exit(1 if buckets[BLOCK] else 0)


if __name__ == "__main__":
    main()
