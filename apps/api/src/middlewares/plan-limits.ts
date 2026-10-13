import type { Request, Response, NextFunction } from 'express';
import { billingService } from '../modules/billing/billing.service.js';

export function enforcePlanLimit(
  resource: 'chatbots' | 'users' | 'conversations' | 'whatsapp_numbers' | 'feature_flag',
  flagKey?: 'whiteLabel' | 'apiAccess' | 'workflows' | 'voice',
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        next();
        return;
      }

      const overview = await billingService.getSubscriptionOverview(companyId);

      if (resource === 'chatbots') {
        if (overview.usage.chatbots.current >= overview.limits.chatbots) {
          res.status(403).json({
            error: {
              code: 'PLAN_LIMIT_EXCEEDED',
              message: `You have reached your plan limit for active chatbots (${overview.usage.chatbots.current}/${overview.limits.chatbots}). Upgrade your plan to create more chatbots.`,
              details: {
                resource: 'chatbots',
                current: overview.usage.chatbots.current,
                limit: overview.limits.chatbots,
                upgradeUrl: '/subscription',
              },
            },
          });
          return;
        }
      } else if (resource === 'users') {
        if (overview.usage.users.current >= overview.limits.users) {
          res.status(403).json({
            error: {
              code: 'PLAN_LIMIT_EXCEEDED',
              message: `You have reached your plan limit for team members (${overview.usage.users.current}/${overview.limits.users}). Upgrade your plan to invite more users.`,
              details: {
                resource: 'users',
                current: overview.usage.users.current,
                limit: overview.limits.users,
                upgradeUrl: '/subscription',
              },
            },
          });
          return;
        }
      } else if (resource === 'whatsapp_numbers') {
        if (overview.usage.whatsappNumbers.current >= overview.limits.whatsappNumbers) {
          res.status(403).json({
            error: {
              code: 'PLAN_LIMIT_EXCEEDED',
              message: `Your current plan allows up to ${overview.limits.whatsappNumbers} WhatsApp numbers. Upgrade your plan to connect additional numbers.`,
              details: {
                resource: 'whatsapp_numbers',
                current: overview.usage.whatsappNumbers.current,
                limit: overview.limits.whatsappNumbers,
                upgradeUrl: '/subscription',
              },
            },
          });
          return;
        }
      } else if (resource === 'feature_flag' && flagKey) {
        const hasFeature = overview.limits.features[flagKey];
        if (!hasFeature) {
          res.status(403).json({
            error: {
              code: 'FEATURE_NOT_IN_PLAN',
              message: `The '${flagKey}' feature is not available on your current ${overview.planName} plan. Upgrade to unlock this feature.`,
              details: {
                feature: flagKey,
                currentPlan: overview.plan,
                upgradeUrl: '/subscription',
              },
            },
          });
          return;
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
