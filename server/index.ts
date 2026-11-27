import http from "node:http";
import process from "node:process";
import { authHandlers, dbHandlers, exportAllData } from "../src/lib/storage-api.ts";

const PORT = Number(process.env.BACKEND_PORT || process.env.API_PORT || 3001);
const HOST = process.env.BACKEND_HOST || "0.0.0.0";

const sseClients = new Set<http.ServerResponse>();

function broadcastChange(table: string, eventType: "INSERT" | "UPDATE" | "DELETE", row?: unknown) {
  const payload = JSON.stringify({
    table,
    eventType,
    new: eventType === "DELETE" ? null : (row ?? {}),
    old: eventType === "DELETE" ? (row ?? {}) : null,
    ts: Date.now(),
  });
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(json);
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const startedAt = Date.now();
  const method = req.method || "GET";
  const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${PORT}`}`);
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  try {
    if (method === "GET" && pathname === "/api/health") {
      const events = dbHandlers.events.getAll("year", false);
      sendJson(res, 200, {
        status: "ok",
        service: "ifc-backend",
        port: PORT,
        uptimeSeconds: Math.round(process.uptime()),
        eventsCount: events.length,
      });
      return;
    }

    if (method === "GET" && pathname === "/api/storage/stream") {
