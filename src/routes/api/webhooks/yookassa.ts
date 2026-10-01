import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/yookassa")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { ingestYookassaWebhook } = await import("@/lib/payments.server");
        const result = await ingestYookassaWebhook(raw);
        if (!result.ok) {
          return new Response(JSON.stringify({ ok: false }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, duplicate: result.duplicate ?? false }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
