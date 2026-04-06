import { eq } from "drizzle-orm";
import { db } from "~/db";
import { ledgerProvider } from "~/db/schema";
import { decryptSettings } from "~/lib/crypto";
import type { LedgerProvider, ProviderCapabilities } from "./types";

const providerFactories = new Map<string, () => LedgerProvider>();

export function registerProviderType(
	type: string,
	factory: () => LedgerProvider,
) {
	providerFactories.set(type, factory);
}

/**
 * Get the currently active provider, initialized with its stored settings.
 */
export async function getActiveProvider(): Promise<LedgerProvider | null> {
	const [active] = await db
		.select()
		.from(ledgerProvider)
		.where(eq(ledgerProvider.active, true))
		.limit(1);

	if (!active) return null;

	const factory = providerFactories.get(active.type);
	if (!factory) return null;

	const provider = factory();
	const settings = active.settings ? decryptSettings(active.settings) : {};
	await provider.initialize(settings);
	return provider;
}

/**
 * Get the capabilities of the active provider, or null if none is active.
 */
export async function getActiveProviderCapabilities(): Promise<ProviderCapabilities | null> {
	const [active] = await db
		.select({ capabilities: ledgerProvider.capabilities })
		.from(ledgerProvider)
		.where(eq(ledgerProvider.active, true))
		.limit(1);

	return (active?.capabilities as ProviderCapabilities) ?? null;
}

/**
 * Create a provider instance by type (for validation, schema introspection).
 */
export function getProviderByType(type: string): LedgerProvider | null {
	const factory = providerFactories.get(type);
	return factory ? factory() : null;
}

/**
 * Get all registered provider type names.
 */
export function getRegisteredProviderTypes(): string[] {
	return [...providerFactories.keys()];
}

// Register built-in providers
import("./stripe").then((m) =>
	registerProviderType("stripe", () => new m.StripeProvider()),
);
import("./manual").then((m) =>
	registerProviderType("manual", () => new m.ManualProvider()),
);
import("./stub").then((m) =>
	registerProviderType("stub", () => new m.StubProvider()),
);
