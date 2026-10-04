# Manuscript ↔ Code Sync (change list)

**Purpose.** The capstone manuscript
(`Capstone1_FinalManuscript_Summer2026_...docx`) and the implemented system have
drifted in several places. This is the exact change list to bring the paper and
the code back into 1:1 alignment. Line numbers refer to the `.docx.txt`
extraction (`Documents\manuscript lol\...docx.txt`).

> This document is a **change list**, not an edit. The manuscript is a binary
> `.docx`; the author updates it.

---

## 1. Tech stack — manuscript is outdated (P0)

The manuscript describes a PHP/Firebase stack that is **not** what is deployed.

| Manuscript says | Code actually is |
|---|---|
| "PHP, JavaScript, and CSS for the front end" (L267, L347, L401) | **React 18 + Vite + Tailwind CSS** (`frontend/`) |
| "Firebase (Authentication, Firestore, and Hosting)" (L267, L353, L401, L845) | **FastAPI + SQLAlchemy 2.0 (async)**, SQLite (dev) / **PostgreSQL** (prod) via `DATABASE_URL` |
| "Firebase Authentication … Firestore Security Rules … AES-256 at rest" (L351) | **JWT bearer tokens**, server-side RBAC + tenant scoping (`backend/auth.py`), TLS at the host |

**Action:** replace every PHP/Firebase reference with the actual stack
(`ARCHITECTURE.md` §1 is the source of truth). Re-check the System Architecture
diagram (L345-353), the Scope section (L267), and the Construction phase (L845).

---

## 2. Explainability — add SHAP + permutation (P0)

The manuscript promises **Gini impurity** (L738) and **"Gini Impurity and
Permutation Feature Importance"** (L829). The code now implements both **plus
exact Shapley values** for local, per-employee attribution
(`backend/ml/explain.py`).

**Action:** insert the ready-to-paste paragraph in
`docs/XAI_METHODOLOGY.md` §4 into the Explainability / Chapter 3 section, and add
`backend/ml/explain.py` to the algorithm-selection discussion (L301, L636-756).

---

## 3. Feature set — claim vs model (P1)

The manuscript says the model handles "continuous KPI scores, ordinal ratings,
**categorical job role identifiers**" (L301) and "industry identifiers" (L718).
The trained model uses **exactly the five competency scores** as features
(`backend/ml/catalog.py` `COMPETENCIES`; `predictor.py`).

**Action:** either
(a) correct the claim to "the five statutory competency scores", or
(b) keep it as **future work** and mark the job-role/industry features as not yet
in the deployed model. Do not describe features the model does not use.

---

## 4. Evaluation — report honest held-out metrics (P0)

The manuscript specifies a **70% / 15% / 15%** train / validation / test split
(L397). The code now implements it (`backend/ml/train.py`, `split_dataset`) and
reports accuracy, macro precision/recall/F1, weighted F1, confusion matrix, and a
classification report for **validation and test**.

**Important, honest finding to report** — on the current (synthetic) data the
class distribution is heavily imbalanced and the model **cannot predict the
minority class**:

```
Label distribution: Critical Gap=290, Meets Expectations=16, Needs Improvement=294
Test  — accuracy=0.9667  f1(macro)=0.6517  f1(weighted)=0.9558
        Meets Expectations  precision=0.00  recall=0.00  f1=0.00  (support=2)
```

**Action:** report **macro** F1 and the **confusion matrix**, not accuracy alone
(accuracy is misleading under this imbalance), and state the limitation plainly.
Options for the manuscript to note: collect more "Meets Expectations" records,
or add `class_weight="balanced"` to the classifier (a code change — do not apply
unasked). Regenerate metrics with `python -m backend.ml.train`.

---

## 5. Security section (P1)

Manuscript L351 claims Firebase Security Rules + Firestore AES-256 at rest.
Actual controls: JWT auth, server-side role/tenant checks, parameterized ORM
queries, TLS in transit, and the immutable `EvaluationAuditLog`. **Action:**
rewrite the Security and Authentication Layer paragraph to match
`ARCHITECTURE.md` §3 and `AGENTS.md` §2.

---

## 6. What is already aligned (no change)

- 180-day cap; Day 150 / 165 / 178 milestones (`ARCHITECTURE.md` §2).
- Exactly five competencies; 4.0 / 5.0 standard.
- Random Forest classification → Meets / Needs Improvement / Critical Gap.
- Gemini generates **only** summaries + rationales; catalog mapping is
  deterministic; human-in-the-loop employer sign-off (`ARCHITECTURE.md` §4-5).
- Dual audit separation; print-first DOLE evidence.
