#!/usr/bin/env node
import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const PREFERRED_BACKEND_PORT = Number(process.env.BACKEND_PORT || 8081);
const FRONTEND_PORT = process.env.PORT || "8080";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  backend: "\x1b[36m",
  frontend: "\x1b[32m",
  warn: "\x1b[33m",
};

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);

function prefixStream(stream, label, color) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim().length > 0) {
        process.stdout.write(`${color}${COLORS.bold}[${label}]${COLORS.reset} ${line}\n`);
      }
    }
  });
  stream.on("end", () => {
    if (buffer.trim().length > 0) {
      process.stdout.write(`${color}${COLORS.bold}[${label}]${COLORS.reset} ${buffer}\n`);
    }
  });
}

async function waitForBackend(url, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // retry until ready
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

console.log(
  `${COLORS.bold}Starting Multi-Event Sanctuary Stack (Backend API :${BACKEND_PORT} + Frontend UI :${FRONTEND_PORT})...${COLORS.reset}`,
);

const children = [];
let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(exitCode), 250);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// 1. Start Backend API Server
const backend = spawn(process.execPath, ["--watch", "server/index.ts"], {
  env: { ...process.env, BACKEND_PORT },
  stdio: ["ignore", "pipe", "pipe"],
});
children.push(backend);
prefixStream(backend.stdout, "backend", COLORS.backend);
prefixStream(backend.stderr, "backend", COLORS.backend);

backend.on("exit", (code) => {
  if (!shuttingDown) {
    console.error(
      `${COLORS.warn}[backend] exited unexpectedly (code ${code ?? 0}). Stopping stack.${COLORS.reset}`,
    );
    shutdown(code ?? 1);
  }
});

await waitForBackend(`http://127.0.0.1:${BACKEND_PORT}/api/health`);

// 2. Start Vite Frontend Server
const npmCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const frontend = spawn(npmCmd, ["vite", "dev", "--port", FRONTEND_PORT], {
  env: { ...process.env, BACKEND_PORT },
  stdio: ["ignore", "pipe", "pipe"],
});
children.push(frontend);
prefixStream(frontend.stdout, "frontend", COLORS.frontend);
prefixStream(frontend.stderr, "frontend", COLORS.frontend);

frontend.on("exit", (code) => {
  if (!shuttingDown) {
    console.error(
      `${COLORS.warn}[frontend] exited (code ${code ?? 0}). Stopping stack.${COLORS.reset}`,
    );
    shutdown(code ?? 1);
  }
});
