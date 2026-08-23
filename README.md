# Business Operations Platform (WWE OS)

Modular, multi-tenant enterprise operations platform. Integrates business modules (HR, Attendance, Biometric Face-AI, DMS, Inventory, Purchase Orders) with a shared Django platform kernel, Next.js 15 Web Application, and FastAPI Biometric Service.

---

## 🏗️ Architecture Topology

| Component           | Stack                                      | Default Port / Endpoint | Role                                        |
| :------------------ | :----------------------------------------- | :---------------------- | :------------------------------------------ |
| **Web Portal**      | Next.js 15 / React / Tailwind / TypeScript | `http://localhost:3000` | Edge Application & Dashboard                |
| **Platform Kernel** | Django 6 / DRF / PostgreSQL                | `http://localhost:8000` | Core API, Auth, RBAC, Business Logic        |
| **Face-AI Engine**  | FastAPI / InsightFace / ArcFace / MTCNN    | `http://localhost:9000` | Biometric Embedding & Liveness Verification |
| **Database**        | Managed PostgreSQL (Supabase)              | Cloud (Port 5432/6543)  | Multi-tenant Data & Vector Fingerprints     |
| **Storage Bucket**  | Cloudflare R2 (S3 Compatible)              | Cloud Object Storage    | Secure Document & Face Photo Vault          |

---

## 🚀 Single-Command Installation (New Compute / GitHub Clone)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/wwe-os.git
cd "wwe OS"
```

### 2. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### 3. Install All Python Dependencies (Master Requirements)

The root [`requirements.txt`](file:///e:/w/wwe%20OS/requirements.txt) includes all Python packages for the Django backend, FastAPI, PyTorch ML models, and helper scripts:

```bash
# Create Virtual Environment
python -m venv .venv

# Activate Virtual Environment
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# On Linux / macOS:
source .venv/bin/activate

# Install all backend & ML dependencies (including torch, insightface, opencv, django)
pip install -r requirements.txt
```

### 4. Install Frontend Web Dependencies

```bash
pnpm install
# (or npm install --legacy-peer-deps if using npm)
```

---

## ⚡ 1-Command Startup (Run Everything Concurrently)

Once dependencies are installed, you can start **ALL** services (Django Backend, Face AI Microservice, Next.js Web App) with **a single command**:

```bash
pnpm dev
```

_(or `npm run dev`)_

This single command automatically:

1. **Syncs Django database migrations** (`python manage.py migrate`)
2. **Spawns Web Application UI** (`http://localhost:3000`)
3. **Spawns Django Platform API** (`http://localhost:8000`)
4. **Spawns Face-AI Microservice** (`http://localhost:9000`)

---

### Alternative: Running Services Manually in Separate Terminals

If you prefer running individual services in separate terminals:

#### Terminal 1: Django Platform Backend (Port 8000)

```bash
cd platform
python manage.py migrate
python manage.py runserver 8000
```

#### Terminal 2: Biometric Face-AI Service (Port 9000)

```bash
cd services/face-ai
uvicorn app.main:app --host 0.0.0.0 --port 9000
```

#### Terminal 3: Next.js Web Application (Port 3000)

```bash
pnpm --filter web dev
```

---

## 🔒 Verification & Health Probes

Once all services are running:

- **Web Portal**: Open `http://localhost:3000`
- **Django Backend Health**: `http://localhost:8000/api/v1/health/`
- **Face-AI Engine Health**: `http://localhost:9000/health`

---

## 🌐 Cloudflare Tunnel Setup (Optional for Remote Access)

To securely expose your local Face-AI (`9000`) and Backend (`8000`) to remote callers or Cloudflare failover without open router ports:

```powershell
cloudflared tunnel run 6463b7de-f1e3-4a1b-9eac-16385913fa39
```

See [c:\Users\rithv\.cloudflared\config.yml](file:///c:/Users/rithv/.cloudflared/config.yml) for ingress rules.
