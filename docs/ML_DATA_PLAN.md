# Performa — ML / Data Plan (archived backlog)

**Status:** open — deferred. Parked here on purpose so the frontend/optimization
work can proceed without losing the ML/data thread. Pick this up before the
capstone defense.

> **Update:** the surrogate framing from Option A is now **adopted** and
> documented as the canonical position in `ARCHITECTURE.md` §2/§4 and
> `docs/XAI_METHODOLOGY.md` §1/§3: the deterministic Article 296 cascade is the
> authoritative classifier, and the Random Forest is a learned surrogate that
> carries the Shapley / permutation explanations. Regenerating the generator and
> securing a real dataset (§5–6) remain open.
>
> **Also landed:** `docs/MODEL_CARD.md` (intended use + limitations) and the
> κ-study scaffolding (`docs/ML_KAPPA_STUDY.md`, `data/kappa/`, `scripts/kappa_study.py`).
> Open: recruit raters (Option B); supply a real dataset (Option C).

**Context that triggered it:** the Random Forest is trained on **synthetic** data
and there is **no real dataset** available; the source is undecided.

---

## 1. Where the system actually stands (verified in code)

- `backend/ml/train.py:build_dataset` draws **600 rows uniformly in [1.0, 5.0]**
  across the 5 competencies, then labels each row with the deterministic
  **priority cascade** (`_label_row`: `overall_mean` / `min` / `std` thresholds).
- The RF (`RandomForestClassifier`, `class_weight="balanced"`) is then trained to
  reproduce that same rule. `backend/ml/models/metrics.json` reports
  **test accuracy 0.9778 / macro-F1 0.8776** (val 0.9667 / 0.9143).
- The real dataset adapter already exists: set `TRAINING_DATASET` to a CSV with
  one column per competency (values 1.0–5.0), then `python -m backend.ml.train`.
  Covered by `backend/tests/test_ml_train.py`.
- Docs already state the caveat: `docs/XAI_METHODOLOGY.md:72` and
  `docs/MANUSCRIPT_SYNC.md:82` say the model trains on a synthetic distribution
  until the partner dataset is collected.
- Production partner named in `docs/DECISIONS.md` J4: **Small Steps Learning
  Center** (provisions its own `Organization` row).

## 2. The real risk (not "no data")

The current evaluation is **circular**: the labels *are* the rule the model
learns, on uniformly random inputs. A sharp panel can say *"you are testing
whether a forest can memorize your own if-statement."* The ~0.97 accuracy is
inflated by construction — it measures **fidelity to the cascade**, not
real-world predictive skill.

So there are three separable problems: **(1)** where labels come from, **(2)**
how the model is evaluated honestly, **(3)** what the manuscript claims.

## 3. Options

**A. Improve the synthetic simulation + reframe honestly (no external dependency).**
Sample from realistic, correlated rating distributions (mass ~3.5–4.5, a small
struggling cluster, occasional single-competency outliers) instead of uniform;
optionally add label noise. Reframe the RF as a **learned surrogate of the
deterministic Art. 296 cascade** (a decision-support prototype), and report
macro-F1 + confusion matrix + a Threats-to-Validity section. Fully in our control.

**B. Small expert-labeling study (injects real human judgment).**
~5–10 HR practitioners/supervisors label a sample of profiles (Meets / Needs
Improvement / Critical Gap). Report agreement between the cascade and the human
majority (**Cohen's κ**). This is the only non-circular number obtainable without
a full dataset. Needs recruitment + a short form.

**C. Partner data (strongest, needs access).**
A formal, anonymized data request to Small Steps Learning Center (5 scores per
employee, no PII). Even 30–80 historical evaluations gives a genuine held-out
set → `TRAINING_DATASET=… python -m backend.ml.train`.

**D. Public proxy dataset (weak — avoid).**
Kaggle/IBM HR sets do not map to the 5 competencies or the 180-day timeline;
numbers would be out-of-domain and hard to defend.

## 4. Decisions already made (owner)

- **Panel expects a working prototype with stated limitations** — real-world
  accuracy is *not* required.
- **~1 month** to the defense.
- **Partner access:** unsure.
- **Expert-labeling survey:** maybe (depends on time/recruitment).

→ Because the panel accepts a prototype, real data is **not a blocker**. The
priority is honest framing + a non-circular evaluation statement.

## 5. Ordered next steps (when resumed)

1. **Core (no dependency):** make the generator realistic and the framing honest.
   - `backend/ml/train.py:build_dataset` — latent-quality + per-competency noise,
     correlated, clipped to [1,5]; optional `label_noise`; keep the same signature
     and seed so `test_ml_train.py` / `test_ml_order.py` stay valid.
   - `backend/ml/models/metrics.json` — add `data_source: "synthetic"`,
     `label_source: "cascade"`, and the generator assumptions.
   - `docs/XAI_METHODOLOGY.md:72` and `docs/MANUSCRIPT_SYNC.md` §4 — describe the
     synthetic design; reframe evaluation as a surrogate/fidelity task.
   - New **`docs/ML_LIMITATIONS.md`** — Threats to Validity (circular labels,
     synthetic distribution, no external validation) + the mitigation path.
2. **Optional B:** draft ~15–20 realistic profiles + a scoring sheet; recruit
   5–10 practitioners; compute κ; record in `docs/`.
3. **Optional C:** if a partner contact lands, wire the CSV and re-report.

## 6. Verification when resumed

- `python -m backend.ml.train` → regenerate `metrics.json` (report macro-F1 +
  confusion matrix, not accuracy alone).
- `python -m pytest backend/tests/test_ml_train.py backend/tests/guardrails/test_ml_order.py -q`.

## 7. Invariants to respect (AGENTS.md §1)

- Exactly the 5 statutory competencies; 4.0/5.0 floor; 180-day cap; milestones
  150/165/178.
- Gemini generates summaries/rationales only; catalog mapping is deterministic;
  human-in-the-loop employer sign-off.
- Do not change the Gemini temperature unasked (`ARCHITECTURE.md` §6a.8).
