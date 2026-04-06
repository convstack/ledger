import Stripe from "stripe";
import type {
	ChangeSubscriptionParams,
	CreateSubscriptionParams,
	InvoiceRecord,
	LedgerProvider,
	PaymentInitiation,
	ProviderCapabilities,
	SettingsField,
	WebhookResult,
} from "./types";

export class StripeProvider implements LedgerProvider {
	readonly type = "stripe";
	readonly capabilities: ProviderCapabilities = {
		invoices: true,
		subscriptions: true,
		checkout: true,
		refunds: true,
		recurringBilling: true,
	};

	private stripe: Stripe | null = null;
	private webhookSecret: string | null = null;

	async initialize(settings: Record<string, string>): Promise<void> {
		if (settings.secretKey) {
			this.stripe = new Stripe(settings.secretKey);
		}
		this.webhookSecret = settings.webhookSecret || null;
	}

	private getStripe(): Stripe {
		if (!this.stripe) {
			throw new Error("Stripe is not initialized — configure the secret key");
		}
		return this.stripe;
	}

	async createInvoice(
		_invoice: InvoiceRecord,
	): Promise<{ providerRef?: string }> {
		return {};
	}

	async initiatePayment(invoice: InvoiceRecord): Promise<PaymentInitiation> {
		const stripe = this.getStripe();
		const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:4000";

		const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
			invoice.items.map((item) => ({
				price_data: {
					currency: invoice.currency.toLowerCase(),
					product_data: { name: item.description },
					unit_amount: item.unitPrice,
				},
				quantity: item.quantity,
			}));

		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			line_items: lineItems,
			success_url: `${dashboardUrl}/ledger/my/invoices/${invoice.id}?status=success`,
			cancel_url: `${dashboardUrl}/ledger/my/invoices/${invoice.id}?status=cancelled`,
			metadata: {
				invoiceId: invoice.id,
				userId: invoice.userId,
			},
		});

		return {
			type: "redirect",
			redirectUrl: session.url || undefined,
			providerRef: session.id,
		};
	}

	async markPaid(): Promise<void> {}

	async refundPayment(invoice: InvoiceRecord): Promise<void> {
		if (!invoice.providerRef) return;
		const stripe = this.getStripe();

		const session = await stripe.checkout.sessions.retrieve(
			invoice.providerRef,
		);
		if (session.payment_intent) {
			const piId =
				typeof session.payment_intent === "string"
					? session.payment_intent
					: session.payment_intent.id;
			await stripe.refunds.create({ payment_intent: piId });
		}
	}

	async syncProduct(product: {
		id: string;
		name: string;
		description?: string | null;
		price: number;
		currency: string;
		type: string;
		interval?: string | null;
	}): Promise<{ productId?: string; priceId?: string }> {
		const stripe = this.getStripe();

		// Create or update Stripe product
		const stripeProduct = await stripe.products.create({
			name: product.name,
			description: product.description || undefined,
			metadata: { ledgerProductId: product.id },
		});

		// Create price
		const priceData: Stripe.PriceCreateParams = {
			product: stripeProduct.id,
			unit_amount: product.price,
			currency: product.currency.toLowerCase(),
		};

		if (product.type === "recurring" && product.interval) {
			priceData.recurring = {
				interval: product.interval as "month" | "year",
			};
		}

		const stripePrice = await stripe.prices.create(priceData);

		return {
			productId: stripeProduct.id,
			priceId: stripePrice.id,
		};
	}

	async createSubscription(
		params: CreateSubscriptionParams,
	): Promise<{ providerRef: string; currentPeriodEnd: Date }> {
		const stripe = this.getStripe();
		const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:4000";

		if (!params.priceId) {
			throw new Error("Stripe price ID is required for subscriptions");
		}

		// Create or retrieve Stripe customer
		const customers = await stripe.customers.search({
			query: `metadata["userId"]:"${params.userId}"`,
			limit: 1,
		});

		let customerId: string;
		if (customers.data.length > 0) {
			customerId = customers.data[0].id;
		} else {
			const customer = await stripe.customers.create({
				metadata: { userId: params.userId },
			});
			customerId = customer.id;
		}

		// Use Checkout for subscription creation (handles payment method collection)
		const session = await stripe.checkout.sessions.create({
			mode: "subscription",
			customer: customerId,
			line_items: [{ price: params.priceId, quantity: 1 }],
			subscription_data: {
				metadata: {
					userId: params.userId,
					productId: params.productId,
					prorateOnChange: params.prorateOnChange ? "true" : "false",
				},
				proration_behavior: params.prorateOnChange
					? "create_prorations"
					: "none",
			},
			success_url: `${dashboardUrl}/ledger/my/subscriptions?status=success`,
			cancel_url: `${dashboardUrl}/ledger/my/subscriptions?status=cancelled`,
		});

		return {
			providerRef: session.id,
			currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		};
	}

	async changeSubscription(
		params: ChangeSubscriptionParams,
	): Promise<{ currentPeriodEnd: Date }> {
		const stripe = this.getStripe();

		const sub = await stripe.subscriptions.retrieve(params.subscriptionRef);
		const itemId = sub.items.data[0]?.id;
		if (!itemId) throw new Error("No subscription item found");

		await stripe.subscriptions.update(params.subscriptionRef, {
			items: [{ id: itemId, price: params.newPriceId }],
			proration_behavior: params.prorate ? "create_prorations" : "none",
		});

		return {
			currentPeriodEnd: new Date(sub.current_period_end * 1000),
		};
	}

	async cancelSubscription(providerRef: string): Promise<void> {
		const stripe = this.getStripe();
		await stripe.subscriptions.update(providerRef, {
			cancel_at_period_end: true,
		});
	}

	async handleWebhook(request: Request): Promise<WebhookResult> {
		const stripe = this.getStripe();
		const body = await request.text();
		const sig = request.headers.get("stripe-signature");

		if (!sig || !this.webhookSecret) {
			return { handled: false };
		}

		let event: Stripe.Event;
		try {
			event = stripe.webhooks.constructEvent(body, sig, this.webhookSecret);
		} catch {
			return { handled: false };
		}

		switch (event.type) {
			case "checkout.session.completed": {
				const session = event.data.object as Stripe.Checkout.Session;
				const invoiceId = session.metadata?.invoiceId;
				if (invoiceId) {
					return {
						handled: true,
						invoiceId,
						action: "mark_paid",
					};
				}
				// Subscription checkout — webhook for subscription.created handles it
				if (session.mode === "subscription" && session.subscription) {
					const subId =
						typeof session.subscription === "string"
							? session.subscription
							: session.subscription.id;
					return {
						handled: true,
						subscriptionId: subId,
						action: "subscription_created",
						data: session.metadata as Record<string, unknown>,
					};
				}
				break;
			}
			case "payment_intent.payment_failed": {
				const pi = event.data.object as Stripe.PaymentIntent;
				const invoiceId = pi.metadata?.invoiceId;
				if (invoiceId) {
					return {
						handled: true,
						invoiceId,
						action: "mark_failed",
					};
				}
				break;
			}
			case "customer.subscription.updated": {
				const sub = event.data.object as Stripe.Subscription;
				return {
					handled: true,
					subscriptionId: sub.id,
					action: "subscription_updated",
					data: {
						status: sub.status,
						currentPeriodEnd: sub.current_period_end,
						cancelAtPeriodEnd: sub.cancel_at_period_end,
					},
				};
			}
			case "customer.subscription.deleted": {
				const sub = event.data.object as Stripe.Subscription;
				return {
					handled: true,
					subscriptionId: sub.id,
					action: "subscription_deleted",
				};
			}
			case "invoice.payment_succeeded": {
				const inv = event.data.object as Stripe.Invoice;
				if (inv.subscription) {
					return {
						handled: true,
						action: "subscription_invoice_paid",
						data: {
							subscriptionId:
								typeof inv.subscription === "string"
									? inv.subscription
									: inv.subscription.id,
							amountPaid: inv.amount_paid,
							currency: inv.currency,
						},
					};
				}
				break;
			}
		}

		return { handled: false };
	}

	validateSettings(settings: Record<string, string>): {
		valid: boolean;
		errors?: string[];
	} {
		const errors: string[] = [];
		if (!settings.secretKey) {
			errors.push("Secret key is required");
		} else if (
			!settings.secretKey.startsWith("sk_test_") &&
			!settings.secretKey.startsWith("sk_live_")
		) {
			errors.push("Secret key must start with sk_test_ or sk_live_");
		}
		return { valid: errors.length === 0, errors };
	}

	getSettingsSchema(): SettingsField[] {
		return [
			{
				key: "secretKey",
				label: "Secret Key",
				type: "password",
				required: true,
				placeholder: "sk_test_...",
			},
			{
				key: "publicKey",
				label: "Publishable Key",
				type: "text",
				placeholder: "pk_test_...",
			},
			{
				key: "webhookSecret",
				label: "Webhook Signing Secret",
				type: "password",
				placeholder: "whsec_...",
			},
		];
	}
}
