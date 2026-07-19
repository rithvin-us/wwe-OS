# Apps

Deployable frontend applications. Apps compose platform capabilities and module
frontends into a product — they contain **no business logic** of their own.

| App         | Audience                            | Target     |
| ----------- | ----------------------------------- | ---------- |
| `web/`      | General staff portal                | Vercel     |
| `admin/`    | System administrators / back office | Vercel     |
| `employee/` | Employee self-service               | Vercel     |
| `mobile/`   | Mobile clients                      | App stores |

Apps consume `packages/*` (UI, SDK, shared types) and module frontends from
`modules/*/frontend`. Each app is a pnpm workspace member once initialized.
