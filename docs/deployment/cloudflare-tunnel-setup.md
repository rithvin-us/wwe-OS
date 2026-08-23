# 🌐 Cloudflare Tunnel Setup Guide for Local Services

This guide explains how to expose your desktop services (**Face-AI** on port 9000 & **Telegram Bot** on port 9001) securely to the web using Cloudflare Tunnels once you register your domain.

> **Required on every machine that hosts these services**, not optional: the
> production backend on Render calls `https://ai.water-works.in` and
> `https://bot.water-works.in` directly and has no fallback path if the
> tunnel is down (HR face check-in/enrollment fails outright). Step 5 below
> must end with the tunnel installed as a **Windows service** — running it
> as a foreground process in a terminal (`start-tunnel.ps1`) is fine for a
> one-off test, but it dies the moment that terminal or session closes,
> which silently breaks production. `start-all-services-and-tunnel.ps1` at
> the repo root does NOT install the service either — it only launches the
> foreground process, same caveat applies.

---

## 📌 Ports Summary

| Service          | Port   | Local Health URL               | Description                           |
| :--------------- | :----- | :----------------------------- | :------------------------------------ |
| **Face-AI**      | `9000` | `http://localhost:9000/health` | InsightFace Biometrics & Verification |
| **Telegram Bot** | `9001` | `http://localhost:9001/health` | Purchase OCR & Telegram Webhook       |

---

## 🛠️ Step 1: Install Cloudflared CLI

Download & install Cloudflare Tunnel CLI on Windows:

```bash
winget install Cloudflare.cloudflared
```

Or download from: https://github.com/cloudflare/cloudflared/releases

---

## 🛠️ Step 2: Authenticate Cloudflare

```bash
cloudflared tunnel login
```

---

## 🛠️ Step 3: Create Cloudflare Tunnel

```bash
cloudflared tunnel create wwe-tunnel
```

---

## 🛠️ Step 4: Configure Tunnel (`config.yml`)

Save the following configuration as `~/.cloudflared/config.yml` (replace `<TUNNEL-ID>` with the ID printed by Step 3 — the hostnames below already match the registered `water-works.in` domain, no need to change them unless you're pointing at a different domain):

```yaml
tunnel: <TUNNEL-ID>
credentials-file: C:\Users\<Username>\.cloudflared\<TUNNEL-ID>.json

ingress:
  # 1. Face-AI Microservice Subdomain
  - hostname: ai.water-works.in
    service: http://localhost:9000

  # 2. Telegram Bot Webhook / Health Subdomain
  - hostname: bot.water-works.in
    service: http://localhost:9001

  # Catch-all
  - service: http_status:404
```

---

## 🛠️ Step 5: Route Subdomains & Install as a Windows Service

```bash
# Route DNS entries in Cloudflare
cloudflared tunnel route dns wwe-tunnel ai.water-works.in
cloudflared tunnel route dns wwe-tunnel bot.water-works.in
```

Then, from an **elevated** ("Run as Administrator") PowerShell, run:

```powershell
.\services\face-ai\cloudflare\install-tunnel-service.ps1
```

This installs `cloudflared` as an actual Windows service (`Get-Service
cloudflared`) set to auto-start on boot — the required end state, not a
manual `cloudflared tunnel run` in a terminal window (see the callout at the
top of this doc for why). It self-elevates if you forgot the "Run as
Administrator" step.

---

## 🛠️ Step 6: Configure `.env`

Once your Cloudflare domain is routed:

1. Update `WEBHOOK_URL=https://bot.water-works.in` in `.env` so Telegram Bot automatically switches to Webhook mode.
2. Update `HR_FACE_AI_URL=https://ai.water-works.in` — locally in `.env`, and in the
   `wwe-os-backend` Render service's environment (Render is what actually depends on
   this being reachable in production; `localhost:9000` only works when the backend
   runs on the same machine as the tunnel).
