/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn, execSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

console.log("\n=======================================================");
console.log("🚀 Starting WWE OS Single-Command All-in-One Development Stack");
console.log("=======================================================\n");

// 1. Run Django Database Migrations first
console.log("📦 [1/2] Syncing Django database migrations...");
try {
  execSync("python manage.py migrate", { cwd: path.join(ROOT, "platform"), stdio: "inherit" });
  console.log("✅ Database migration complete.\n");
} catch {
  console.warn("⚠️ Database migration warning — proceeding to start services.\n");
}

// 2. Define processes to run concurrently
console.log("⚡ [2/2] Spawning services concurrently...");

const services = [
  {
    name: "Web Platform",
    cmd: "pnpm",
    args: ["--filter", "web", "dev"],
    cwd: ROOT,
    color: "\x1b[36m", // Cyan
  },
  {
    name: "Django Backend",
    cmd: "python",
    args: ["manage.py", "runserver", "8000"],
    cwd: path.join(ROOT, "platform"),
    color: "\x1b[32m", // Green
  },
  {
    name: "Face AI Microservice",
    cmd: "python",
    args: ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"],
    cwd: path.join(ROOT, "services", "face-ai"),
    color: "\x1b[35m", // Magenta
  },
];

const children = [];

services.forEach((svc) => {
  console.log(`▶️ Launching ${svc.name} (${svc.args.join(" ")})`);
  const child = spawn(svc.cmd, svc.args, {
    cwd: svc.cwd,
    shell: true,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });

  child.stdout?.on("data", (data) => {
    process.stdout.write(`${svc.color}[${svc.name}]\x1b[0m ${data}`);
  });

  child.stderr?.on("data", (data) => {
    process.stderr.write(`${svc.color}[${svc.name}]\x1b[0m ${data}`);
  });

  child.on("close", (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${svc.color}[${svc.name}]\x1b[0m process exited with code ${code}`);
    }
  });

  children.push(child);
});

console.log("\n✨ All services running! Access points:");
console.log("   • Web Application UI:     http://localhost:3000");
console.log("   • Django Platform API:    http://localhost:8000");
console.log("   • Face AI Microservice:   http://localhost:9000");
console.log("\n(Press Ctrl+C to stop all services)\n");

const cleanup = () => {
  console.log("\n🛑 Stopping all WWE OS services...");
  children.forEach((c) => {
    try {
      c.kill();
    } catch {}
  });
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
