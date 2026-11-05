import { requireAuth } from './auth.js';
import { canonicalizeProduct, hasProductAccess } from '../services/product-membership.service.js';

/**
 * Middleware that enforces explicit workspace/product membership from the database.
 * If user is not yet authenticated, it runs requireAuth first.
 * If user lacks DB membership for the product, returns 403 PRODUCT_ACCESS_DENIED.
 *
 * Example:
 * router.get('/ledger/dashboard', requireProductAccess('ledger'), handler);
 */
export function requireProductAccess(requiredProduct) {
  const canonical = canonicalizeProduct(requiredProduct);

  const checkAccess = async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Please authenticate to access this resource.',
        });
      }

      if (!canonical) {
        return res.status(500).json({ error: `Invalid product configured: ${requiredProduct}` });
      }

      const hasAccess = await hasProductAccess(req.userId, canonical);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'PRODUCT_ACCESS_DENIED',
          code: 'PRODUCT_ACCESS_DENIED',
          message: `Access denied. You do not have an active membership for the ${canonical} workspace.`,
          requiredProduct: canonical,
        });
      }

      req.authorizedProduct = canonical;
      next();
    } catch (err) {
      console.error(`[product-auth] Error validating access for ${canonical}:`, err.message);
      return res.status(500).json({ error: 'Internal workspace authorization error' });
    }
  };

  return (req, res, next) => {
    if (!req.userId) {
      return requireAuth(req, res, () => checkAccess(req, res, next));
    }
    return checkAccess(req, res, next);
  };
}

export function requireAnyProductAccess(requiredProducts) {
  const canonicalProducts = requiredProducts.map(canonicalizeProduct).filter(Boolean);

  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return requireAuth(req, res, () => requireAnyProductAccess(canonicalProducts)(req, res, next));
      }

      const memberships = await Promise.all(canonicalProducts.map((product) => hasProductAccess(req.userId, product)));
      const authorizedProduct = canonicalProducts.find((_, index) => memberships[index]);
      if (!authorizedProduct) {
        return res.status(403).json({
          error: 'PRODUCT_ACCESS_DENIED',
          code: 'PRODUCT_ACCESS_DENIED',
          message: 'Access denied. An active IndexPilot or Quant workspace membership is required.',
          requiredProducts: canonicalProducts,
        });
      }

      req.authorizedProduct = authorizedProduct;
      return next();
    } catch (err) {
      console.error(`[product-auth] Error validating products ${canonicalProducts.join(', ')}:`, err.message);
      return res.status(500).json({ error: 'Internal workspace authorization error' });
    }
  };
}

