import { db } from "~/db";
import { webhookSubscriber } from "~/db/schema";

interface WebhookPayload {
	event: string;
	data: Record<string, unknown>;
	timestamp: string;
}

/**
 * Fire-and-forget webhook dispatch to all active subscribers
 * that are subscribed to this event type.
 */
export function dispatchWebhook(
	event: string,
	data: Record<string, unknown>,
): void {
	doDispatch(event, data).catch((err) =>
		console.warn(`[webhook] Failed to dispatch ${event}:`, err),
	);
}

async function doDispatch(
	event: string,
	data: Record<string, unknown>,
): Promise<void> {
	const { eq } = await import("drizzle-orm");

	const subscribers = await db
		.select()
		.from(webhookSubscriber)
		.where(eq(webhookSubscriber.active, true));

	if (subscribers.length === 0) return;

	const payload: WebhookPayload = {
		event,
		data,
		timestamp: new Date().toISOString(),
	};

	const body = JSON.stringify(payload);

	// Fan out to all subscribers that listen to this event
	const tasks = subscribers
		.filter((sub) => {
			const events = sub.events as string[];
			return events.includes(event) || events.includes("*");
		})
		.map((sub) => deliverToSubscriber(sub, event, body));

	await Promise.allSettled(tasks);
}

async function deliverToSubscriber(
	sub: { id: string; name: string; url: string; secret: string },
	event: string,
	body: string,
): Promise<void> {
	try {
		const res = await fetch(sub.url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Webhook-Secret": sub.secret,
				"X-Webhook-Event": event,
			},
			body,
			signal: AbortSignal.timeout(5000),
		});

		if (!res.ok) {
			console.warn(
				`[webhook] ${sub.name} (${event}): ${res.status} ${res.statusText}`,
			);
		}
	} catch (err) {
		console.warn(`[webhook] ${sub.name} (${event}): delivery failed`, err);
	}
}
