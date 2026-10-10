# ML Kappa Study — Non-Circular Evaluation Protocol

**Purpose.** Give the ML chapter one **non-circular** number. The Random Forest is
trained on labels produced by the deterministic Article 296 cascade
(`backend/ml/train.py:_label_row`), so held-out *accuracy* measures fidelity to
that rule, not field performance. This study measures agreement between the
cascade and **independent human raters** — Cohen's κ — which is the only
non-circular evaluation obtainable without a real historical dataset
(`docs/ML_DATA_PLAN.md`, Option B).

**Status:** scaffolding ready; awaiting rater recruitment. This is a protocol +
tooling, not a result. Do **not** report a κ until real raters have filled the
sheet.

---

## 1. What is being measured

- **Raters:** 5–10 HR practitioners / supervisors with evaluation experience.
- **Stimuli:** `data/kappa/profiles.csv` — 20 fixed competency profiles (five
  scores in [1.0, 5.0], canonical order), spanning all three tiers.
- **Task:** each rater independently assigns one label per profile — **Meets
  Expectations**, **Needs Improvement**, or **Critical Gap**.
- **Comparison:** each rater's labels and the rater **majority** are compared to
  the cascade label computed by the deployed rule.
- **Statistic:** Cohen's κ (chance-corrected agreement) plus raw agreement and a
  confusion matrix. For multiple raters the majority label is compared to the
  cascade; report inter-rater dispersion separately.

κ interpretation (Landis & Koch): <0.20 slight, 0.21–0.40 fair, 0.41–0.60
moderate, 0.61–0.80 substantial, 0.81–1.00 almost perfect.

## 2. Procedure

1. **Recruit** 5–10 raters (target ≥5; more is better for the majority vote).
2. **Provide only the profiles** — no cascade labels, no priors — plus the three
   tier definitions. Do not share scores between raters.
3. Each rater records labels in the long-format CSV
   (copy `data/kappa/human_labels_template.csv` → `data/kappa/human_labels.csv`):
   - single rater: `profile_id,label`
   - multiple raters: `profile_id,rater_id,label`
4. **Compute:** `python scripts/kappa_study.py --labels data/kappa/human_labels.csv`.
5. **Report** in the manuscript: n raters, κ per rater, majority κ, raw
   agreement, confusion matrix, and the interpretation band.

## 3. Decision rule

- **κ ≥ 0.61** (substantial/excellent): the cascade encodes expert judgment
  closely enough to defend the labels as a reasonable operationalization.
- **0.41 ≤ κ < 0.61** (moderate): defensible with a stated limitation and a
  documented mapping note where humans and the cascade disagree.
- **κ < 0.41**: the cascade is not aligned with practitioner judgment; report it
  honestly and treat the tiers as a system-defined rubric pending revision.

## 4. Threats to validity (state these)

- **Small n.** 20 profiles × 5–10 raters is a small sample; κ has wide CI.
- **Non-expert or coached raters.** Agreement is only as meaningful as rater
  independence and expertise.
- **Interface/anchoring.** Presenting numeric scores can anchor raters; this is
  the same input the system sees, so it is the correct comparison.
- **Label taxonomy.** Raters may not share an internal definition of the three
  tiers; the tier definitions must be supplied verbatim.

## 5. Files

| File | Role |
|---|---|
| `data/kappa/profiles.csv` | 20 fixed competency profiles (stimuli) |
| `data/kappa/human_labels_template.csv` | Rater label sheet (copy to `human_labels.csv`) |
| `scripts/kappa_study.py` | κ / agreement / confusion-matrix analysis |
| `backend/tests/test_kappa_study.py` | Guards that profiles stay valid and span all tiers |

## 6. What this does and does not fix

- **Does:** give a non-circular agreement number between the cascade and human
  judgment, replacing "accuracy" as the headline ML claim.
- **Does not:** turn the Random Forest into an empirically trained model. It
  remains a surrogate (`docs/XAI_METHODOLOGY.md` §1). A true held-out metric
  still requires the partner dataset (Option C).
