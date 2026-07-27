# 🌐 Cloudflare Tunnel Setup Guide for Local Services

This guide explains how to expose your desktop services (**Face-AI** on port 9000 & **Telegram Bot** on port 9001) securely to the web using Cloudflare Tunnels once you register your domain.

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
cloudflared tunnel create wwe-desktop-tunnel
```

---

## 🛠️ Step 4: Configure Tunnel (`config.yml`)

Save the following configuration as `~/.cloudflared/config.yml` (replace `<TUNNEL-ID>` and `yourdomain.com` with your actual domain):

```yaml
tunnel: <TUNNEL-ID>
credentials-file: C:\Users\<Username>\.cloudflared\<TUNNEL-ID>.json

ingress:
  # 1. Face-AI Microservice Subdomain
  - hostname: face-ai.yourdomain.com
    service: http://localhost:9000

  # 2. Telegram Bot Webhook / Health Subdomain
  - hostname: bot.yourdomain.com
    service: http://localhost:9001

  # Catch-all
  - service: http_status:404
```

---

## 🛠️ Step 5: Route Subdomains & Start Tunnel

```bash
# Route DNS entries in Cloudflare
cloudflared tunnel route dns wwe-desktop-tunnel face-ai.yourdomain.com
cloudflared tunnel route dns wwe-desktop-tunnel bot.yourdomain.com

# Start the tunnel as a Windows Service (auto-starts on boot)
cloudflared service install
```

---

## 🛠️ Step 6: Configure `.env`

Once your Cloudflare domain is routed:

1. Update `WEBHOOK_URL=https://bot.yourdomain.com` in `.env` so Telegram Bot automatically switches to Webhook mode.
2. Update `FACE_AI_URL=https://face-ai.yourdomain.com` in your cloud app settings.
