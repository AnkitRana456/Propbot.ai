import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { autoTopupSchema, billingProfileSchema, createPaymentLinkSchema, CREDIT_PACKS, refundOrderSchema, topupSchema } from '@propbot/shared';
import { authenticate } from '../middlewares/authenticate.js';
import { tenantGuard } from '../middlewares/tenant-guard.js';
import { requirePermission } from '../middlewares/rbac.js';
import { paymentsService } from '../modules/payments/payments.service.js';
import { accessLogsService } from '../modules/controls/controls.service.js';

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
const company = (req: Request) => req.tenant!.companyId;
const user = (req: Request) => req.tenant!.userId ?? null;
const param = (req: Request, name = 'id') => z.string().uuid().parse(req.params[name]);
const send = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
const billing = requirePermission('manage_billing');
const sales = requirePermission('edit_leads');

export const paymentsRouter: Router = Router();
paymentsRouter.use(authenticate, tenantGuard);

paymentsRouter.get('/profile', billing, h(async (req, res) => send(res, await paymentsService.getProfile(company(req)))));
paymentsRouter.put('/profile', billing, h(async (req, res) => send(res, await paymentsService.setProfile(company(req), billingProfileSchema.parse(req.body)))));

paymentsRouter.get('/orders', sales, h(async (req, res) => send(res, await paymentsService.list(company(req), typeof req.query.kind === 'string' ? req.query.kind : undefined))));
paymentsRouter.post('/orders', sales, h(async (req, res) => send(res, await paymentsService.createPaymentLink(company(req), user(req), createPaymentLinkSchema.parse(req.body)), 201)));
paymentsRouter.get('/orders/:id', sales, h(async (req, res) => send(res, await paymentsService.get(company(req), param(req)))));
paymentsRouter.post('/orders/:id/cancel', sales, h(async (req, res) => send(res, await paymentsService.cancel(company(req), param(req)))));
paymentsRouter.post('/orders/:id/refund', billing, h(async (req, res) => send(res, await paymentsService.refund(company(req), user(req), param(req), refundOrderSchema.parse(req.body)))));
paymentsRouter.post('/orders/:id/simulate-paid', billing, h(async (req, res) => send(res, await paymentsService.simulatePaid(company(req), param(req)))));
paymentsRouter.get(
  '/orders/:id/receipt',
  sales,
  h(async (req, res) => {
    const html = await paymentsService.receiptHtml(company(req), param(req));
    accessLogsService.record({ companyId: company(req), userId: user(req), action: 'download', resourceType: 'payment_receipt', resourceId: param(req), ip: req.ip, userAgent: req.headers['user-agent'] });
    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'").send(html);
  }),
);

paymentsRouter.get('/credits', billing, h(async (req, res) => send(res, { ...(await paymentsService.getCredits(company(req))), packs: CREDIT_PACKS })));
paymentsRouter.get('/credits/history', billing, h(async (req, res) => send(res, await paymentsService.creditHistory(company(req)))));
paymentsRouter.post('/credits/topup', billing, h(async (req, res) => send(res, await paymentsService.createTopup(company(req), topupSchema.parse(req.body).packId), 201)));
paymentsRouter.put('/credits/auto-topup', billing, h(async (req, res) => send(res, await paymentsService.setAutoTopup(company(req), autoTopupSchema.parse(req.body)))));
