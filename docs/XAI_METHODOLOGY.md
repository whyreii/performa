# Explainable AI (XAI) Methodology — Performa

**Purpose.** Document the explainability methods behind the "ML Risk Explanation"
panel so the thesis defense can state exactly what is computed, why it is
defensible, and what it does *not* claim. Implementation: `backend/ml/explain.py`.

---

## 1. Three layers

| Layer | Scope | Method | Where |
|---|---|---|---|
| Gini importance | Global | `RandomForest.feature_importances_` (mean decrease in impurity) | `backend/ml/predictor.py` |
| Permutation importance | Global | `sklearn.inspection.permutation_importance` (score drop when a competency is shuffled) | `backend/ml/explain.py` |
| **SHAP (exact Shapley)** | **Local (per employee)** | Exact Shapley values over the 5 competencies | `backend/ml/explain.py` |

Global methods answer *"which competencies matter across the model."* SHAP answers
*"why did **this** employee receive **this** classification"* — the question a labor
arbiter actually asks. This is the manuscript's Chapter 3 explainability
requirement (Gini + permutation) extended with local attribution.

---

## 2. Exact Shapley values

The Shapley value (Shapley, 1953) assigns each feature a fair contribution by
averaging its marginal effect over every possible coalition of features:

```
φ_i(v) = Σ_{S ⊆ N\{i}}  [ |S|! (n − |S| − 1)! / n! ] · ( v(S ∪ {i}) − v(S) )
```

- `n = 5` competencies → exactly `2**5 = 32` coalitions, so the computation is
  **exact** (no sampling approximation) and needs no external dependency.
- The value function is the **interventional expectation** over a fixed background
  sample drawn from the training distribution:

  ```
  v(S) = E_background[ model.predict_proba(target)[ x_S , X_background,¬S ] ]
  ```

  i.e. features in `S` are fixed to the employee's scores, the rest are drawn from
  the background. Background: deterministic (seed 42), size 128, cached.

- **Target class** = the model's predicted tier, so the attribution explains the
  classification actually shown to the user.
- **Polarity** (`shap_risk_polarity`). The backend also classifies the meaning of a
  positive contribution: `"risk"` when the predicted tier is a competency gap
  (Needs Improvement / Critical Gap), so positive values push the employee *toward*
  the gap; `"safe"` for Meets Expectations. The UI consumes this single server-side
  mapping to color contribution segments red/risk (`--bad`) vs green/safe
  (`--good`); the Base-value and Predicted bounding bars stay neutral. Keeping the
  mapping server-side means the presentation layer stays "dumb" and the polarity is
  unit-tested alongside the Shapley math.

### Correctness: the efficiency axiom

Shapley values must sum to the prediction minus the background expectation:

```
Σ_i φ_i = f(x) − E[f]        (verified in backend/tests/test_explain.py)
```

On the seeded Ana Urgent record the endpoint returns contributions summing to
`0.496` against a base of `0.4603` → `0.9563`, matching the reported confidence.

---

## 3. What this does **not** claim (defense framing)

- These values explain the **model's output**, not the employee's true performance.
- The current model is trained on a **synthetic** distribution until the partner
  dataset (Small Steps Learning Center) is collected. The background and
  permutation importances are drawn from the same distribution, so they track the
  deployed model automatically once a real dataset is supplied via
  `TRAINING_DATASET`.
- The system remains **decision-support, not decision-making** (human-in-the-loop):
  the Employer makes every regularization/termination decision.

---

## 4. Suggested manuscript wording (Explainability / Chapter 3)

> To satisfy the interpretability and legal-defensibility requirement, Performa
> reports three complementary feature-attribution measures. Global **Gini impurity**
> and **permutation feature importance** rank the five competency categories by
> their overall contribution to the classifier. In addition, the system computes
> **exact Shapley values** (Shapley, 1953) over the five competencies for each
> individual prediction — a local, per-employee attribution that decomposes the
> classification probability into a background baseline plus one signed
> contribution per competency. With only five features the Shapley computation is
> exact (2⁵ coalitions) and dependency-free. These measures are presented to the
> user as decision support; they explain the model's output and do not by
> themselves constitute an employment decision.

---

## 5. Files

| File | Role |
|---|---|
| `backend/ml/explain.py` | Exact Shapley + permutation importance |
| `backend/schemas.py` | `RiskExplanationResponse` (additive fields) |
| `backend/routers/evaluations.py` | `GET /{id}/risk-explanation` merges explanations |
| `backend/tests/test_explain.py` | Efficiency axiom, determinism, validation |
| `frontend/src/pages/employees/EmployeeDetail.jsx` | SHAP waterfall + global importance table |
