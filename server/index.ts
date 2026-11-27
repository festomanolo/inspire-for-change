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
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(`data: ${JSON.stringify({ type: "connected", ts: Date.now() })}\n\n`);
      sseClients.add(res);
      req.on("close", () => {
        sseClients.delete(res);
      });
      return;
    }

    if (!pathname.startsWith("/api/storage/")) {
      sendJson(res, 404, { message: `Not found: ${pathname}` });
      return;
    }

    const splat = pathname.slice("/api/storage/".length).replace(/\/+$/, "");

    if (method === "GET") {
      if (splat === "auth/session") {
        sendJson(res, 200, authHandlers.getSession());
      } else if (splat === "profiles") {
        const internal = new Set(["orderBy", "asc", "limit", "_joinGuest"]);
        const keys = Array.from(searchParams.keys()).filter((k) => !internal.has(k));
        const field = keys[0];
        if (!field) {
          sendJson(res, 200, dbHandlers.profiles.getAll());
        } else {
          sendJson(res, 200, dbHandlers.profiles.getByField(field, searchParams.get(field) || ""));
        }
      } else if (splat === "events") {
        const orderBy = searchParams.get("orderBy") || "year";
        const asc = searchParams.get("asc") !== "false";
        sendJson(res, 200, dbHandlers.events.getAll(orderBy, asc));
      } else if (splat === "guests") {
        const keys = Array.from(searchParams.keys()).filter(
          (k) => k !== "orderBy" && k !== "asc" && k !== "limit",
        );
        const field = keys[0];
        const orderBy = searchParams.get("orderBy") || undefined;
        const asc = searchParams.get("asc") !== "false";
        const guests = field
          ? dbHandlers.guests.getByField(field, searchParams.get(field) || "", orderBy, asc)
          : dbHandlers.guests.getAll();
        sendJson(res, 200, guests);
      } else if (/^guests\/[^/]+$/.test(splat)) {
        const id = decodeURIComponent(splat.slice("guests/".length));
        sendJson(res, 200, dbHandlers.guests.getById(id));
      } else if (splat === "guest-edits") {
        const internal = new Set(["orderBy", "asc", "limit", "_joinGuest"]);
        const keys = Array.from(searchParams.keys()).filter((k) => !internal.has(k));
        const field = keys[0];
        const orderBy = searchParams.get("orderBy") || "edited_at";
        const asc = searchParams.get("asc") !== "false";
        const edits = field
          ? dbHandlers.guestEdits.getByField(field, searchParams.get(field) || "", orderBy, asc)
          : dbHandlers.guestEdits.getAll(orderBy, asc);
        sendJson(res, 200, edits);
      } else if (splat === "export") {
        sendJson(res, 200, exportAllData());
      } else {
        sendJson(res, 404, { message: `Route not found: ${splat}` });
      }
    } else if (method === "POST") {
      const body = await readBody(req);
      if (splat === "auth/signup") {
        const result = authHandlers.signUp(body as Parameters<typeof authHandlers.signUp>[0]);
        broadcastChange("profiles", "INSERT");
        sendJson(res, 200, result);
      } else if (splat === "auth/signin") {
        const result = authHandlers.signIn(body as Parameters<typeof authHandlers.signIn>[0]);
        sendJson(res, 200, result);
      } else if (splat === "auth/signout") {
        authHandlers.signOut();
        sendJson(res, 200, { success: true });
      } else if (splat === "events") {
        const created = dbHandlers.events.create(
          body as Parameters<typeof dbHandlers.events.create>[0],
        );
        broadcastChange("events", "INSERT", created);
        sendJson(res, 200, created);
      } else if (splat === "guests/consolidate") {
        const result = dbHandlers.guests.consolidateDuplicates(
