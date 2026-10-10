# Rater Brief — Performa Kappa Study

Thank you for participating. This is a short, independent judgment task. It takes
**about 20–30 minutes**.

## What you are doing

You will look at **20 employee profiles**. Each profile is five performance
ratings on a 1.0–5.0 scale. For each profile you assign **one overall label**:

- **Meets Expectations** — performance satisfies the standard.
- **Needs Improvement** — performance is below standard but not critical.
- **Critical Gap** — performance is critically deficient.

Your labels will be compared with the system's, to measure how closely the system
agrees with human judgment. **There are no right answers and nothing is graded.**

## The five competencies (rating columns)

1. `task_completion` — completing assigned work on schedule
2. `attendance_and_punctuality` — on-time, dependable attendance
3. `communication_and_teamwork` — collaboration and clear status reporting
4. `initiative_and_adaptability` — self-driven problem solving, agility
5. `quality_of_work` — accuracy, attention to detail, standards compliance

Each score runs from **1.0 (poor)** to **5.0 (excellent)**. The regularizing target
used in the study is **4.0 / 5.0** across all five.

## How to label (guidance, not a formula)

- **Meets Expectations** — all five around or above target; nothing notably weak.
- **Needs Improvement** — one or more clearly below target, or uneven performance,
  but no competency in critical territory.
- **Critical Gap** — overall low, or a core competency (task completion / quality of
  work) severely deficient.

Use your professional judgment. If a profile is borderline, pick the label you would
defend to a manager.

## How to record

1. Copy `human_labels_template.csv` to `human_labels.csv`.
2. Open `profiles.csv` to read the scores (do not open any file containing the
   system's labels).
3. For each `profile_id`, type exactly one of:
   `Meets Expectations`, `Needs Improvement`, or `Critical Gap`.
4. Leave no rows blank. Do not discuss profiles with other raters until all have
   finished (independence matters).

Example `human_labels.csv`:

```
profile_id,label
P01,Meets Expectations
P02,Needs Improvement
P03,Critical Gap
```

## Confidentiality

Profiles are synthetic and contain no real people. Your individual labels are used
only to compute an agreement statistic (Cohen's κ) and are reported in aggregate.
