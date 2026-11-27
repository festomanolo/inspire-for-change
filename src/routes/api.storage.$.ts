import { createFileRoute } from "@tanstack/react-router";
import { authHandlers, dbHandlers, exportAllData } from "@/lib/storage-api";

interface HandlerArgs {
  request: Request;
  params: {
    _splat: string;
  };
}

export const Route = createFileRoute("/api/storage/$")({
  server: {
    handlers: {
      GET: async ({ request, params }: HandlerArgs) => {
        try {
          const splat = params._splat;
          const url = new URL(request.url);
          const searchParams = url.searchParams;

          if (splat === "auth/session") {
            const session = authHandlers.getSession();
            return new Response(JSON.stringify(session), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (splat === "profiles") {
            const INTERNAL = new Set(["orderBy", "asc", "limit", "_joinGuest"]);
            const keys = Array.from(searchParams.keys()).filter((k) => !INTERNAL.has(k));
            const field = keys[0];
            if (!field) {
              const allProfiles = dbHandlers.profiles.getAll();
              return new Response(JSON.stringify(allProfiles), {
                headers: { "Content-Type": "application/json" },
              });
            }
            const value = searchParams.get(field) || "";
            const profile = dbHandlers.profiles.getByField(field, value);
            return new Response(JSON.stringify(profile), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (splat === "events") {
            const orderBy = searchParams.get("orderBy") || "year";
            const asc = searchParams.get("asc") !== "false";
            const events = dbHandlers.events.getAll(orderBy, asc);
            return new Response(JSON.stringify(events), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (splat === "guests") {
            const keys = Array.from(searchParams.keys()).filter((k) => k !== "orderBy" && k !== "asc" && k !== "limit");
            const field = keys[0];
            const orderBy = searchParams.get("orderBy") || undefined;
            const asc = searchParams.get("asc") !== "false";

            const guests = field
              ? dbHandlers.guests.getByField(field, searchParams.get(field) || "", orderBy, asc)
              : dbHandlers.guests.getAll();
            return new Response(JSON.stringify(guests), {
              headers: { "Content-Type": "application/json" },
            });
          }

          const guestIdMatch = splat.match(/^guests\/([^/]+)$/);
          if (guestIdMatch) {
            const id = decodeURIComponent(guestIdMatch[1]);
            const guest = dbHandlers.guests.getById(id);
            return new Response(JSON.stringify(guest), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (splat === "guest-edits") {
            const INTERNAL = new Set(["orderBy", "asc", "limit", "_joinGuest"]);
            const keys = Array.from(searchParams.keys()).filter((k) => !INTERNAL.has(k));
            const field = keys[0];
            const orderBy = searchParams.get("orderBy") || "edited_at";
            const asc = searchParams.get("asc") !== "false";

            const edits = field
              ? dbHandlers.guestEdits.getByField(field, searchParams.get(field) || "", orderBy, asc)
              : dbHandlers.guestEdits.getAll(orderBy, asc);
            return new Response(JSON.stringify(edits), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (splat === "export") {
            const data = exportAllData();
            return new Response(JSON.stringify(data), {
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ message: `Route not found: ${splat}` }), { status: 404 });
        } catch (error: any) {
          console.error("[API GET Error]", error);
          return new Response(JSON.stringify({ message: error.message || "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      POST: async ({ request, params }: HandlerArgs) => {
        try {
          const splat = params._splat;
          const body = await request.json();

          if (splat === "auth/signup") {
            const result = authHandlers.signUp(body);
            return new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (splat === "auth/signin") {
            const result = authHandlers.signIn(body);
            return new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (splat === "auth/signout") {
            authHandlers.signOut();
            return new Response(JSON.stringify({ success: true }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (splat === "events") {
            const result = dbHandlers.events.create(body);
            return new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (splat === "guests/consolidate") {
            const result = dbHandlers.guests.consolidateDuplicates(body.event_id, body.actor_id);
            return new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (splat === "guests") {
            const result = dbHandlers.guests.create(body);
            return new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (splat === "guest-edits") {
            const result = dbHandlers.guestEdits.create(body);
            return new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ message: `Route not found: ${splat}` }), { status: 404 });
        } catch (error: any) {
          console.error("[API POST Error]", error);
          return new Response(JSON.stringify({ message: error.message || "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      PUT: async ({ request, params }: HandlerArgs) => {
        try {
          const splat = params._splat;
          const body = await request.json();

          const guestIdMatch = splat.match(/^guests\/([^/]+)$/);
          if (guestIdMatch) {
            const id = decodeURIComponent(guestIdMatch[1]);
            const result = dbHandlers.guests.update(id, body);
            return new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json" },
            });
          }

          const eventIdMatch = splat.match(/^events\/([^/]+)$/);
          if (eventIdMatch) {
            const id = decodeURIComponent(eventIdMatch[1]);
            const result = dbHandlers.events.update(id, body);
            return new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ message: `Route not found: ${splat}` }), { status: 404 });
        } catch (error: any) {
          console.error("[API PUT Error]", error);
          return new Response(JSON.stringify({ message: error.message || "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      DELETE: async ({ params }: { params: { _splat: string } }) => {
        try {
          const splat = params._splat;

          const guestIdMatch = splat.match(/^guests\/([^/]+)$/);
          if (guestIdMatch) {
            const id = decodeURIComponent(guestIdMatch[1]);
            dbHandlers.guests.delete(id);
            return new Response(JSON.stringify({ success: true }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          const eventIdMatch = splat.match(/^events\/([^/]+)$/);
          if (eventIdMatch) {
            const id = decodeURIComponent(eventIdMatch[1]);
            dbHandlers.events.delete(id);
            return new Response(JSON.stringify({ success: true }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ message: `Route not found: ${splat}` }), { status: 404 });
        } catch (error: any) {
          console.error("[API DELETE Error]", error);
          return new Response(JSON.stringify({ message: error.message || "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
