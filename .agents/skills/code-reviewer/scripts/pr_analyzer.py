#!/usr/bin/env python3
"""
PR / branch analyzer for Mezon Ta'lim.

Scopes the diff (default: current branch vs `main`, plus working-tree changes),
flags which risk areas it touches, and runs the static antipattern checker on
just the changed files.

Usage:
  python3 pr_analyzer.py                 # branch vs main + working tree
  python3 pr_analyzer.py --base develop  # diff against a different base
"""
import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# (label, why it's sensitive) keyed by path substring.
RISK_AREAS = [
    ("lib/payments/", "payments — verify signatures, idempotency, integer tiyin"),
    ("app/api/webhooks/", "payment webhooks — never trust client; verify + idempotent"),
    ("lib/auth/", "auth — role guards, session handling, no secret logging"),
    ("lib/db/schema/", "schema — needs a committed Drizzle migration"),
    ("lib/db/", "data layer — repository boundary, server-only, no fan-out"),
    ("actions.ts", '"use server" — every export must be an async action'),
    ("lib/certificates/", "certificates — PII; archive in-country (MinIO)"),
    ("lib/notifications/", "notifications — best-effort, PII off-shore check"),
    ("messages/", "i18n — keys must exist in BOTH uz.json and ru.json"),
    ("lib/db/client.ts", "DB client — explicit SSL + prepare:false"),
]


def changed_files(base: str):
    files = set()
    for cmd in (
        ["git", "diff", "--name-only", f"{base}...HEAD"],
        ["git", "diff", "--name-only"],
        ["git", "diff", "--name-only", "--cached"],
    ):
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
            files.update(l for l in out.stdout.split("\n") if l.strip())
        except Exception:
            pass
    return sorted(files)


def main():
    ap = argparse.ArgumentParser(description="Scope a PR/branch diff and flag risk areas")
    ap.add_argument("--base", default="main", help="base branch to diff against (default: main)")
    args = ap.parse_args()

    files = changed_files(args.base)
    if not files:
        print("No changed files detected vs", args.base)
        return

    print(f"Changed files ({len(files)}) vs {args.base}:")
    for f in files:
        print(f"  • {f}")

    hits = []
    for label, why in RISK_AREAS:
        if any(label in f for f in files):
            hits.append((label, why))
    print("\nRisk areas touched:")
    if hits:
        for label, why in hits:
            print(f"  ⚠️  {label:<22} {why}")
    else:
        print("  (none of the high-risk areas)")

    print("\n--- static antipattern scan (changed files) ---")
    rc = subprocess.run(
        [sys.executable, str(HERE / "code_quality_checker.py"), ".", "--changed"]
    ).returncode

    print("\nNext: run `npm run typecheck && npm run lint && npm run build`, then")
    print("apply references/code_review_checklist.md to the risk areas above.")
    sys.exit(rc)


if __name__ == "__main__":
    main()
