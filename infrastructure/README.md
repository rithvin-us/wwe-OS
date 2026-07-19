# Infrastructure

Everything required to run the platform: containers, orchestration, routing,
CI/CD, IaC, monitoring, logging, security, and per-provider deployment configs.

| Folder            | Responsibility                                                  |
| ----------------- | --------------------------------------------------------------- |
| `docker/`         | Dockerfiles and compose overrides beyond the root dev compose   |
| `kubernetes/`     | K8s manifests/helm for when the platform outgrows PaaS          |
| `nginx/`          | Reverse proxy / gateway configuration                           |
| `github-actions/` | Reusable workflow templates and composite actions               |
| `terraform/`      | Infrastructure as code for cloud resources                      |
| `monitoring/`     | Metrics, dashboards, alerting configuration                     |
| `logging/`        | Log aggregation and retention configuration                     |
| `security/`       | Security policies, scanning config, secrets strategy            |
| `cloudflare/`     | Cloudflare Tunnel + DNS/WAF configuration (AI engine initially) |
| `render/`         | Render deployment configuration (backend, services, workers)    |
| `vercel/`         | Vercel deployment configuration (frontend apps)                 |

**Deployment topology**

- Frontend apps → Vercel
- Backend API → Render
- Database → managed PostgreSQL
- AI engine → Cloudflare Tunnel initially, independent later
- Workers / bots / email → independent Render background services
