<!-- GENERATED FILE — DO NOT HAND-EDIT. -->
<!-- Regenerate: python scripts/gen_architecture_snapshot.py -->
<!-- Staleness is enforced by backend/tests/guardrails/test_snapshot.py. -->

# Architecture snapshot


## Database schema

Source: `Base.metadata` (no DB connection).

### `activity_logs`

| Column | Type | Nullable | PK | Unique | Default | Foreign key |
|---|---|---|---|---|---|---|
| action | VARCHAR(100) | no | no | no |  |  |
| actor_id | CHAR(32) | yes | no | no |  | users.id |
| actor_name | VARCHAR(255) | yes | no | no |  |  |
| created_at | DATETIME | no | no | no | now() |  |
| detail | TEXT | yes | no | no |  |  |
| entity_id | VARCHAR(100) | yes | no | no |  |  |
| entity_type | VARCHAR(100) | yes | no | no |  |  |
| id | CHAR(32) | no | yes | no | uuid.uuid4 |  |
| organization_id | VARCHAR(100) | no | no | no |  |  |

### `evaluation_audit_logs`

| Column | Type | Nullable | PK | Unique | Default | Foreign key |
|---|---|---|---|---|---|---|
| competency | VARCHAR(100) | no | no | no |  |  |
| created_at | DATETIME | no | no | no | now() |  |
| employee_id | CHAR(32) | no | no | no |  | probationary_employees.id |
| evaluator_id | CHAR(32) | no | no | no |  | users.id |
| id | CHAR(32) | no | yes | no | uuid.uuid4 |  |
| new_score | FLOAT | no | no | no |  |  |
| organization_id | VARCHAR(100) | no | no | no |  |  |
| prev_hash | VARCHAR(64) | yes | no | no |  |  |
| prior_score | FLOAT | yes | no | no |  |  |
| record_hash | VARCHAR(64) | yes | no | no |  |  |

### `kpi_rubrics`

| Column | Type | Nullable | PK | Unique | Default | Foreign key |
|---|---|---|---|---|---|---|
| competency | VARCHAR(27) | no | no | no |  |  |
| id | CHAR(32) | no | yes | no | uuid.uuid4 |  |
| organization_id | VARCHAR(100) | no | no | no |  |  |
| target_score | FLOAT | no | no | no | 4.0 |  |
| weight | FLOAT | no | no | no | 0.2 |  |

Unique constraints: (competency, organization_id)

### `monthly_summaries`

| Column | Type | Nullable | PK | Unique | Default | Foreign key |
|---|---|---|---|---|---|---|
| acknowledged_at | DATETIME | yes | no | no |  |  |
| avg_attendance | FLOAT | no | no | no |  |  |
| avg_communication | FLOAT | no | no | no |  |  |
| avg_initiative | FLOAT | no | no | no |  |  |
| avg_quality | FLOAT | no | no | no |  |  |
| avg_task_completion | FLOAT | no | no | no |  |  |
| created_at | DATETIME | no | no | no | now() |  |
| dispatched_at | DATETIME | yes | no | no |  |  |
| employee_id | CHAR(32) | no | no | no |  | probationary_employees.id |
| id | CHAR(32) | no | yes | no | uuid.uuid4 |  |
| month_number | INTEGER | no | no | no |  |  |
| overall_average | FLOAT | no | no | no |  |  |
| performance_summary | TEXT | yes | no | no |  |  |
| status_classification | VARCHAR(18) | no | no | no |  |  |

Unique constraints: (employee_id, month_number)

### `notifications`

| Column | Type | Nullable | PK | Unique | Default | Foreign key |
|---|---|---|---|---|---|---|
| body | TEXT | yes | no | no |  |  |
| category | VARCHAR(50) | no | no | no | general |  |
| created_at | DATETIME | no | no | no | now() |  |
| id | CHAR(32) | no | yes | no | uuid.uuid4 |  |
| is_read | BOOLEAN | no | no | no | False |  |
| organization_id | VARCHAR(100) | no | no | no |  |  |
| title | VARCHAR(255) | no | no | no |  |  |
| user_id | CHAR(32) | no | no | no |  | users.id |

### `organizations`

| Column | Type | Nullable | PK | Unique | Default | Foreign key |
|---|---|---|---|---|---|---|
| created_at | DATETIME | no | no | no | now() |  |
| id | CHAR(32) | no | yes | no | uuid.uuid4 |  |
| name | VARCHAR(255) | no | no | yes |  |  |
| slug | VARCHAR(100) | no | no | yes |  |  |

Unique constraints: (name)

### `password_reset_tokens`

| Column | Type | Nullable | PK | Unique | Default | Foreign key |
|---|---|---|---|---|---|---|
| created_at | DATETIME | no | no | no | now() |  |
| expires_at | DATETIME | no | no | no |  |  |
| id | CHAR(32) | no | yes | no | uuid.uuid4 |  |
| token_hash | VARCHAR(64) | no | no | yes |  |  |
| used_at | DATETIME | yes | no | no |  |  |
| user_id | CHAR(32) | no | no | no |  | users.id |

### `probationary_employees`

| Column | Type | Nullable | PK | Unique | Default | Foreign key |
|---|---|---|---|---|---|---|
| day_180_date | DATE | no | no | no |  |  |
| department | VARCHAR(255) | no | no | no |  |  |
| employer_id | CHAR(32) | no | no | no |  | users.id |
| id | CHAR(32) | no | yes | no | uuid.uuid4 |  |
| job_title | VARCHAR(255) | no | no | no |  |  |
| milestone_150_alerted | BOOLEAN | no | no | no | False |  |
| milestone_165_alerted | BOOLEAN | no | no | no | False |  |
| milestone_178_alerted | BOOLEAN | no | no | no | False |  |
| organization_id | VARCHAR(100) | no | no | no |  |  |
| standards_acknowledged_at | DATETIME | yes | no | no |  |  |
| start_date | DATE | no | no | no |  |  |
| status | VARCHAR(11) | no | no | no | ProbationStatus.ACTIVE |  |
| status_reason | TEXT | yes | no | no |  |  |
| supervisor_id | CHAR(32) | yes | no | no |  | users.id |
| updated_at | DATETIME | no | no | no | now() |  |
| user_id | CHAR(32) | no | no | yes |  | users.id |

Unique constraints: (user_id)

### `regularization_recommendations`

| Column | Type | Nullable | PK | Unique | Default | Foreign key |
|---|---|---|---|---|---|---|
| created_at | DATETIME | no | no | no | now() |  |
| employee_id | CHAR(32) | no | no | no |  | probationary_employees.id |
| id | CHAR(32) | no | yes | no | uuid.uuid4 |  |
| month_number | INTEGER | no | no | no | 5 |  |
| organization_id | VARCHAR(100) | no | no | no |  |  |
| overall_average | FLOAT | no | no | no |  |  |
| rationale | TEXT | yes | no | no |  |  |
| recommendation | VARCHAR(50) | no | no | no |  |  |
| status_classification | VARCHAR(18) | no | no | no |  |  |

### `reports`

| Column | Type | Nullable | PK | Unique | Default | Foreign key |
|---|---|---|---|---|---|---|
| created_at | DATETIME | no | no | no | now() |  |
| employee_id | CHAR(32) | no | no | no |  | probationary_employees.id |
| generated_by_id | CHAR(32) | yes | no | no |  | users.id |
| id | CHAR(32) | no | yes | no | uuid.uuid4 |  |
| organization_id | VARCHAR(100) | no | no | no |  |  |
| report_type | VARCHAR(50) | no | no | no | performance |  |
| size_bytes | INTEGER | no | no | no | 0 |  |
| title | VARCHAR(255) | no | no | no |  |  |

### `training_plans`

| Column | Type | Nullable | PK | Unique | Default | Foreign key |
|---|---|---|---|---|---|---|
| catalog_id | VARCHAR(100) | no | no | no |  |  |
| competency | VARCHAR(100) | no | no | no |  |  |
| completed_at | DATETIME | yes | no | no |  |  |
| created_at | DATETIME | no | no | no | now() |  |
| default_timeline | VARCHAR(100) | no | no | no |  |  |
| employee_id | CHAR(32) | no | no | no |  | probationary_employees.id |
| employer_approved_at | DATETIME | yes | no | no |  |  |
| id | CHAR(32) | no | yes | no | uuid.uuid4 |  |
| intervention_title | VARCHAR(255) | no | no | no |  |  |
| intervention_type | VARCHAR(100) | no | no | no |  |  |
| monthly_summary_id | CHAR(32) | yes | no | no |  | monthly_summaries.id |
| rationale | TEXT | yes | no | no |  |  |
| status | VARCHAR(16) | no | no | no | TrainingStatusEnum.PENDING_APPROVAL |  |

### `users`

| Column | Type | Nullable | PK | Unique | Default | Foreign key |
|---|---|---|---|---|---|---|
| created_at | DATETIME | no | no | no | now() |  |
| email | VARCHAR(255) | no | no | yes |  |  |
| full_name | VARCHAR(255) | no | no | no |  |  |
| hashed_password | VARCHAR(255) | no | no | no |  |  |
| id | CHAR(32) | no | yes | no | uuid.uuid4 |  |
| is_active | BOOLEAN | no | no | no | True |  |
| organization_id | VARCHAR(100) | no | no | no |  | organizations.slug |
| role | VARCHAR(21) | no | no | no |  |  |

### `weekly_evaluations`

| Column | Type | Nullable | PK | Unique | Default | Foreign key |
|---|---|---|---|---|---|---|
| attendance_and_punctuality | FLOAT | no | no | no |  |  |
| communication_and_teamwork | FLOAT | no | no | no |  |  |
| created_at | DATETIME | no | no | no | now() |  |
| employee_id | CHAR(32) | no | no | no |  | probationary_employees.id |
| evaluation_date | DATE | no | no | no | backend.timeutils.manila_today |  |
| evaluator_id | CHAR(32) | no | no | no |  | users.id |
| id | CHAR(32) | no | yes | no | uuid.uuid4 |  |
| initiative_and_adaptability | FLOAT | no | no | no |  |  |
| organization_id | VARCHAR(100) | no | no | no |  |  |
| overall_score | FLOAT | no | no | no |  |  |
| quality_of_work | FLOAT | no | no | no |  |  |
| remarks | VARCHAR(500) | yes | no | no |  |  |
| task_completion | FLOAT | no | no | no |  |  |
| week_number | INTEGER | yes | no | no |  |  |

## Routes

Auth column is read from the FastAPI dependency graph.

| Method | Path | Auth / role dependency | Endpoint |
|---|---|---|---|
| GET | `/` | not detected | root |
| GET | `/api/admin/activity` | roles: admin | list_activity |
| GET | `/api/admin/organizations` | roles: admin | list_organizations |
| GET | `/api/admin/reports/overview` | roles: admin | reports_overview |
| GET | `/api/admin/settings` | roles: admin | get_system_settings |
| GET | `/api/admin/users` | roles: admin | list_users |
| POST | `/api/admin/users` | roles: admin | create_user |
| POST | `/api/admin/users/{user_id}/reset-password` | roles: admin | reset_user_password |
| PATCH | `/api/admin/users/{user_id}/status` | roles: admin | update_user_status |
| POST | `/api/auth/change-password` | authenticated (any role) | change_password |
| POST | `/api/auth/forgot-password` | not detected | forgot_password |
| POST | `/api/auth/login` | not detected | login |
| POST | `/api/auth/logout` | not detected | logout |
| GET | `/api/auth/me` | authenticated (any role) | read_current_user |
| PATCH | `/api/auth/me` | authenticated (any role) | update_current_user |
| POST | `/api/auth/register` | not detected | register |
| POST | `/api/auth/reset-password` | not detected | reset_password |
| GET | `/api/employees/` | authenticated (any role) | list_employees |
| POST | `/api/employees/` | roles: employer | create_employee |
| GET | `/api/employees/milestones` | roles: employer, supervisor | list_milestones |
| POST | `/api/employees/milestones/scan` | roles: employer | scan_milestone_alerts |
| GET | `/api/employees/supervisors` | roles: employer | list_supervisors |
| GET | `/api/employees/{employee_id}` | authenticated (any role) | get_employee |
| POST | `/api/employees/{employee_id}/acknowledge-standards` | authenticated (any role) | acknowledge_standards |
| PATCH | `/api/employees/{employee_id}/status` | roles: employer | update_status |
| GET | `/api/evaluations/audit-trail` | roles: employer | get_tenant_audit_trail |
| GET | `/api/evaluations/audit-trail.csv` | roles: employer | export_tenant_audit_trail_csv |
| GET | `/api/evaluations/{employee_id}/audit-trail` | authenticated (any role) | get_audit_trail |
| GET | `/api/evaluations/{employee_id}/audit-trail/verify` | authenticated (any role) | verify_audit_chain |
| GET | `/api/evaluations/{employee_id}/regularization-recommendation` | authenticated (any role) | get_regularization_recommendation |
| POST | `/api/evaluations/{employee_id}/regularization-recommendation` | roles: employer | create_regularization_recommendation |
| GET | `/api/evaluations/{employee_id}/report` | authenticated (any role) | get_employee_report |
| GET | `/api/evaluations/{employee_id}/report.pdf` | authenticated (any role) | get_employee_report_pdf |
| GET | `/api/evaluations/{employee_id}/risk-explanation` | authenticated (any role) | get_risk_explanation |
| GET | `/api/evaluations/{employee_id}/scorecard` | authenticated (any role) | get_scorecard |
| GET | `/api/evaluations/{employee_id}/trend` | authenticated (any role) | get_kpi_trend |
| GET | `/api/evaluations/{employee_id}/weekly` | authenticated (any role) | list_weekly_evaluations |
| POST | `/api/evaluations/{employee_id}/weekly` | roles: employer, supervisor | submit_weekly_rating |
| GET | `/api/interventions/mine` | authenticated (any role) | list_my_interventions |
| GET | `/api/interventions/pending` | roles: employer, supervisor | list_pending_interventions |
| GET | `/api/interventions/summaries` | roles: employer | list_monthly_summaries |
| GET | `/api/interventions/summaries/mine` | authenticated (any role) | list_my_summaries |
| POST | `/api/interventions/summaries/{summary_id}/acknowledge` | authenticated (any role) | acknowledge_monthly_summary |
| POST | `/api/interventions/summaries/{summary_id}/dispatch` | roles: employer | dispatch_monthly_summary |
| POST | `/api/interventions/{employee_id}/monthly-rollup` | roles: employer | monthly_rollup |
| POST | `/api/interventions/{plan_id}/complete` | roles: probationary_employee | complete_my_intervention |
| POST | `/api/interventions/{plan_id}/sign-off` | roles: employer | sign_off_intervention |
| GET | `/api/kpi-rubrics` | roles: employer, supervisor | list_rubrics |
| PUT | `/api/kpi-rubrics` | roles: employer | bulk_upsert_rubrics |
| GET | `/api/kpi-rubrics/history` | roles: employer | rubric_history |
| POST | `/api/kpi-rubrics/reset` | roles: employer | reset_rubrics |
| GET | `/api/kpi-rubrics/templates` | authenticated (any role) | list_templates |
| PUT | `/api/kpi-rubrics/{competency}` | roles: employer | upsert_rubric |
| GET | `/api/notifications` | authenticated (any role) | list_notifications |
| POST | `/api/notifications/read-all` | authenticated (any role) | mark_all_read |
| POST | `/api/notifications/{notification_id}/read` | authenticated (any role) | mark_notification_read |
| PATCH | `/api/organization` | roles: admin, employer | update_organization |
| GET | `/api/reports` | roles: employer | list_reports |
| POST | `/api/reports` | roles: employer | generate_report |
| GET | `/api/reports/{report_id}/pdf` | roles: employer | download_report_pdf |
| GET | `/health` | not detected | health |

## Environment variables

| Variable | Default |
|---|---|
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` |
| `ALGORITHM` | `HS256` |
| `APP_BASE_URL` | `—` |
| `COOKIE_SECURE` | `False` |
| `CORS_ORIGINS` | `` |
| `DATABASE_URL` | `sqlite+aiosqlite:///./performa.db` |
| `EMAIL_FROM` | `—` |
| `EMAIL_PROVIDER` | `—` |
| `GEMINI_API_KEY` | `—` |
| `LOG_LEVEL` | `INFO` |
| `PASSWORD_RESET_TTL_MINUTES` | `30` |
| `PERFORMA_TODAY` | `—` |
| `RESEND_API_KEY` | `—` |
| `SECRET_KEY` | `performa-dev-secret-key-32charsmin` |
| `SENDGRID_API_KEY` | `—` |
| `SMTP_FROM` | `—` |
| `SMTP_HOST` | `—` |
| `SMTP_PASSWORD` | `—` |
| `SMTP_PORT` | `587` |
| `SMTP_SSL` | `False` |
| `SMTP_STARTTLS` | `True` |
| `SMTP_USER` | `—` |
| `SQL_ECHO` | `False` |
| `TRAINING_DATASET` | `—` |

## Key file paths

| Purpose | Path | Exists |
|---|---|---|
| Models | `backend/models.py` | yes |
| Schemas | `backend/schemas.py` | yes |
| Routers | `backend/routers/` | yes |
| Timezone helpers | `backend/timeutils.py` | yes |
| Gemini client | `backend/gemini.py` | yes |
| ML predictor | `backend/ml/predictor.py` | yes |
| ML training | `backend/ml/train.py` | yes |
| ML feature order / catalog access | `backend/ml/catalog.py` | yes |
| Training catalog | `backend/ml/training_catalog.json` | yes |
| RF artifact | `backend/ml/models/rf_model.joblib` | yes |
| Config | `backend/config.py` | yes |
| Database engine | `backend/database.py` | yes |
| Auth / RBAC | `backend/auth.py` | yes |
| Audit log writer | `backend/audit.py` | yes |
| App entrypoint | `backend/main.py` | yes |
| Alembic migrations | `backend/migrations/versions/` | yes |
