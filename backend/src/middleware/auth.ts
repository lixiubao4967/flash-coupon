import { Request, Response, NextFunction } from 'express';
import { getMerchantByApiKey, MerchantRecord } from '../services/merchant';

// Extend Express Request to carry the authenticated merchant
declare global {
  namespace Express {
    interface Request {
      merchant?: MerchantRecord;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) {
    res.status(401).json({ error: 'Missing X-API-Key header' });
    return;
  }

  const merchant = await getMerchantByApiKey(apiKey);
  if (!merchant) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  req.merchant = merchant;
  next();
}
