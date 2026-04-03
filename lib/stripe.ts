import Stripe from "stripe";
import { PRICING, STAGE_LABELS } from "@/lib/constants";

let _stripe: Stripe | null = null;

export function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return _stripe;
}

// For backward compat
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

interface CheckoutOptions {
  caseId: string;
  caseNumber: string;
  stage: number;
  includeWhiteGlove: boolean;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

const STAGE_PRICES: Record<number, number> = {
  1: PRICING.stage1,
  2: PRICING.stage2,
  3: PRICING.stage3,
};

export async function createCheckoutSession(options: CheckoutOptions) {
  const stagePrice = STAGE_PRICES[options.stage];
  if (!stagePrice) {
    throw new Error(`Invalid stage: ${options.stage}`);
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: `${STAGE_LABELS[options.stage]} — Stage ${options.stage}`,
          description: `Get More Hours advocacy service for ${options.caseNumber}`,
        },
        unit_amount: stagePrice,
      },
      quantity: 1,
    },
  ];

  if (options.includeWhiteGlove) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "White Glove Service Add-on",
          description:
            "Document submission, case manager communication, dedicated advocate",
        },
        unit_amount: PRICING.whiteGlove,
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: options.customerEmail,
    line_items: lineItems,
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata: {
      caseId: options.caseId,
      stage: String(options.stage),
      includeWhiteGlove: String(options.includeWhiteGlove),
    },
  });

  return session;
}
