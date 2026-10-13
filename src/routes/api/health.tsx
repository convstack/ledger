import { createHandler } from "@convstack/service-sdk/handlers";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: createHandler({
				skipAuth: true,
				handler: async () => ({ ok: true, service: "ledger" }),
			}),
		},
	},
});
