# Performa — Deployment Notes

## Database migrations (Alembic)

Schema migrations are managed with Alembic. The application's startup
`Base.metadata.create_all` remains for local convenience, but managed
environments should apply migrations explicitly.

```bash
# apply all migrations
DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/performa_db" \
  python -m alembic upgrade head

# create a new revision after changing models
DATABASE_URL="..." python -m alembic revision -m "describe change"

# roll back one revision
DATABASE_URL="..." python -m alembic downgrade -1
```

The initial revision `0001_baseline` materializes the full schema. Add explicit
revisions for every subsequent schema change; do not rely on `create_all` in
production.

## TLS / transport security

Performa must be served over HTTPS in any non-local environment. The API itself
does not terminate TLS; put it behind a reverse proxy.

- **Reverse proxy (recommended):** run Uvicorn behind Nginx/Caddy/Traefik and
  terminate TLS there. Example Nginx location:

  ```nginx
  location / {
      proxy_pass http://127.0.0.1:8000;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
  }
  ```

- **Managed platforms:** most PaaS providers terminate TLS automatically; only
  ensure the app is reachable over the provider's HTTPS endpoint.

- Set `CORS_ORIGINS` to the exact production origins (comma-separated); the
  development localhost defaults should not be used in production.

## Required environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL async URL (`postgresql+asyncpg://...`) |
| `SECRET_KEY` | JWT signing key — **must** be set to a strong random value |
| `GEMINI_API_KEY` | Google Gemini API key (optional; pipeline degrades gracefully) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime (default 480) |
| `LOG_LEVEL` | Logging level (default INFO) |
