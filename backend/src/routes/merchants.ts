import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import {
  registerMerchant,
  loginMerchant,
  getMerchantProfile,
  getMerchantByStripeCustomerId,
  updateMerchantPlan,
} from '../services/merchant';
import { requireAuth } from '../middleware/auth';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(STRIPE_SECRET_KEY);
}

export function createMerchantRouter(): Router {
  const router = Router();

  // ─── POST /api/merchants/register ────────────────────────────────────────────
  router.post('/register', async (req: Request, res: Response) => {
    const { email, password, shopName } = req.body as {
      email?: string;
      password?: string;
      shopName?: string;
    };

    if (!email?.trim() || !password || !shopName?.trim()) {
      res.status(400).json({ error: 'email, password, shopName are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    try {
      const merchant = await registerMerchant(email.trim(), password, shopName.trim());
      res.status(201).json(merchant);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      res.status(409).json({ error: message });
    }
  });

  // ─── POST /api/merchants/login ────────────────────────────────────────────────
  router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email?.trim() || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    try {
      const merchant = await loginMerchant(email.trim(), password);
      res.json(merchant);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      res.status(401).json({ error: message });
    }
  });

  // ─── GET /api/merchants/me ────────────────────────────────────────────────────
  router.get('/me', requireAuth, async (req: Request, res: Response) => {
    const profile = await getMerchantProfile(req.merchant!.shopId);
    if (!profile) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }
    res.json(profile);
  });

  // ─── POST /api/merchants/checkout ─────────────────────────────────────────────
  // Creates a Stripe Checkout Session for the ¥980/month Pro plan
  router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
    if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
      res.status(503).json({ error: 'Stripe is not configured on this server' });
      return;
    }

    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
        success_url: `${FRONTEND_URL}/merchant?checkout=success`,
        cancel_url: `${FRONTEND_URL}/merchant?checkout=cancel`,
        metadata: { shopId: req.merchant!.shopId },
        // Pre-fill email if provided
        customer_email: req.merchant!.email,
      });
      res.json({ url: session.url });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout creation failed';
      res.status(500).json({ error: message });
    }
  });

  // ─── POST /api/merchants/portal ───────────────────────────────────────────────
  // Creates a Stripe Customer Portal Session (manage/cancel subscription)
  router.post('/portal', requireAuth, async (req: Request, res: Response) => {
    if (!STRIPE_SECRET_KEY) {
      res.status(503).json({ error: 'Stripe is not configured on this server' });
      return;
    }
    if (!req.merchant!.stripeCustomerId) {
      res.status(400).json({ error: 'No active subscription found' });
      return;
    }

    try {
      const stripe = getStripe();
      const session = await stripe.billingPortal.sessions.create({
        customer: req.merchant!.stripeCustomerId,
        return_url: `${FRONTEND_URL}/merchant`,
      });
      res.json({ url: session.url });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Portal creation failed';
      res.status(500).json({ error: message });
    }
  });

  return router;
}

// ─── Stripe Webhook Handler (exported separately, needs raw body) ──────────────
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: 'Stripe not configured' });
    return;
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook verification failed';
    console.error('[Stripe Webhook] Signature verification failed:', message);
    res.status(400).json({ error: message });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const shopId = session.metadata?.shopId;
        if (shopId && session.customer && session.subscription) {
          await updateMerchantPlan(
            shopId,
            'pro',
            session.customer as string,
            session.subscription as string
          );
          console.log(`[Stripe] Upgraded ${shopId} to Pro`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const merchant = await getMerchantByStripeCustomerId(subscription.customer as string);
        if (merchant) {
          await updateMerchantPlan(merchant.shopId, 'free', undefined, undefined);
          console.log(`[Stripe] Downgraded ${merchant.shopId} to Free (subscription cancelled)`);
        }
        break;
      }

      default:
        // Ignore other events
        break;
    }

    res.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    console.error('[Stripe Webhook] Processing error:', message);
    res.status(500).json({ error: message });
  }
}
