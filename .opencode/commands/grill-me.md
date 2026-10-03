---
description: Interrogate the user with 3-5 multiple-choice questions before planning any complex feature, to resolve edge cases upfront.
---

Before planning or implementing anything, interrogate me to remove ambiguity.
Do NOT write code yet.

1. Read the request and identify the riskiest unknowns - scope, data model, RBAC, statutory/timezone impact, UX, and performance.
2. Use the `question` tool to ask 3-5 multiple-choice questions. Each question must offer 2-4 concrete options plus the automatic custom answer.
3. Put the recommended option first and label it "(Recommended)".
4. After my answers, summarize the resolved decisions in a short list, and only then propose a plan.

Check every decision against AGENTS.md invariants: Asia/Manila (UTC+8) datetime,
Article 296 milestones (Day 150 / 165 / 178, 180-day cap), the strict 4.0/5.0
benchmark, RBAC boundaries, dual-audit separation, and token-only styling.
