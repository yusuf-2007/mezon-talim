#!/usr/bin/env python3
"""
Review report generator for Mezon Ta'lim.

Runs the static antipattern checker (optionally scoped to the branch diff) and
emits a Markdown review report to stdout or a file. The report is a scaffold — a
human/agent reviewer still fills the checklist judgement; the script handles the
mechanical scan + structure.

Usage:
  python3 review_report_generator.py                 # whole repo
  python3 review_report_generator.py --changed       # branch vs main + working tree
  python3 review_report_generator.py --changed -o review.md
"""
import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def run_checker(changed: bool) -> str:
    cmd = [sys.executable, str(HERE / "code_quality_checker.py"), "."]
    if changed:
        cmd.append("--changed")
    out = subprocess.run(cmd, capture_output=True, text=True)
    return out.stdout.strip() or "(checker produced no output)"


def main():
    ap = argparse.ArgumentParser(description="Generate a Markdown code-review report")
    ap.add_argument("--changed", action="store_true", help="scope to branch diff vs main")
    ap.add_argument("-o", "--output", help="write report to this file instead of stdout")
    args = ap.parse_args()

    scan = run_checker(args.changed)
    scope = "branch diff vs `main`" if args.changed else "whole repository"

    report = f"""# Code Review Report — Mezon Ta'lim

**Scope:** {scope}

## 1. Gates
Run and record:
- [ ] `npm run typecheck`
- [ ] `npm run lint` (expect 0 warnings)
- [ ] `npm run build`

> Reminder: green gates are necessary, not sufficient — server-action
> registration, runtime SSL, and i18n key gaps all pass the build.

## 2. Static antipattern scan
```
{scan}
```

## 3. Checklist review
Apply `references/code_review_checklist.md`, prioritising touched risk areas
(payments, auth, db/schema, "use server" actions, PII/i18n). Cross-check
`references/common_antipatterns.md`.

## 4. Findings
| Severity | File:Line | Issue | Why | Fix |
|----------|-----------|-------|-----|-----|
| | | | | |

## 5. Verdict
- [ ] Blocking issues resolved (non-negotiables, security, money/PII)
- [ ] Behaviour verified beyond the build for logic-heavy changes
- [ ] Approve / Request changes
"""

    if args.output:
        Path(args.output).write_text(report, encoding="utf-8")
        print(f"Wrote report to {args.output}")
    else:
        print(report)


if __name__ == "__main__":
    main()
