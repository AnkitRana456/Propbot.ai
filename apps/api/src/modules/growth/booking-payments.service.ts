import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { bookingTransactions, leads, domainEvents } from '../../db/schema/index.js';
import { guardedActionsService } from '../ai/guarded-actions.service.js';
import type { CreateBookingPaymentLinkRequest } from '@propbot/shared';
import { pino } from 'pino';

const logger = pino({ name: 'booking-payments', level: process.env.LOG_LEVEL ?? 'info' });

export class BookingPaymentsService {
  /**
   * Proposes/creates a token booking payment link.
   * Enforced as a T2 Guarded Action (requires human manager approval if initiated by AI/copilot).
   */
  async createPaymentLink(
    companyId: string,
    userId: string | undefined,
    data: CreateBookingPaymentLinkRequest,
    isManualAdmin = false,
  ) {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, data.leadId), eq(leads.companyId, companyId)))
      .limit(1);

    if (!lead) {
      throw new Error(`Lead not found: ${data.leadId}`);
    }

    const paymentLinkId = `plink_${data.provider}_${Date.now()}`;
    const paymentLinkUrl = data.provider === 'stripe'
      ? `https://checkout.stripe.com/pay/${paymentLinkId}`
      : `https://rzp.io/i/${paymentLinkId}`;

    // If manual admin, directly execute and create transaction
    if (isManualAdmin) {
      const [tx] = await db
        .insert(bookingTransactions)
        .values({
          companyId,
          leadId: data.leadId,
          unitId: data.unitId,
          projectId: data.projectId,
          amount: String(data.amount),
          currency: data.currency || 'INR',
          provider: data.provider || 'razorpay',
          paymentLinkId,
          paymentLinkUrl,
          status: 'pending',
          metadata: { notes: data.notes, createdBy: userId },
        })
        .returning();

      return {
        status: 'created',
        transaction: tx,
        paymentLinkUrl,
      };
    }

    // Otherwise, route through T2 Guarded Actions
    const result = await guardedActionsService.executeAgentAction({
      companyId,
      agentName: 'booking_payments_copilot',
      actionType: 'send_payment_link',
      tier: 'T2',
      leadId: data.leadId,
      args: {
        lead_id: data.leadId,
        unit_id: data.unitId,
        amount: data.amount,
        currency: data.currency || 'INR',
        provider: data.provider || 'razorpay',
      },
      executorFn: async () => {
        const [tx] = await db
          .insert(bookingTransactions)
          .values({
            companyId,
            leadId: data.leadId,
            unitId: data.unitId,
            projectId: data.projectId,
            amount: String(data.amount),
            currency: data.currency || 'INR',
            provider: data.provider || 'razorpay',
            paymentLinkId,
            paymentLinkUrl,
            status: 'pending',
            metadata: { notes: data.notes, approvedBy: userId },
          })
          .returning();

        return {
          transactionId: tx?.id,
          paymentLinkUrl,
          status: 'pending',
        };
      },
    });

    return result;
  }

  /**
   * Handles payment confirmation from gateway webhooks or test mode triggers.
   * Updates booking_transactions -> 'paid', moves lead to 'booked', and emits 'payment_received' event.
   */
  async processPaymentConfirmation(
    companyId: string,
    paymentLinkId: string,
    paymentDetails: {
      orderId?: string;
      paymentId?: string;
      amount?: number;
      receiptUrl?: string;
    } = {},
  ) {
    const [tx] = await db
      .select()
      .from(bookingTransactions)
      .where(and(eq(bookingTransactions.paymentLinkId, paymentLinkId), eq(bookingTransactions.companyId, companyId)))
      .limit(1);

    if (!tx) {
      throw new Error(`Booking transaction not found for payment link: ${paymentLinkId}`);
    }

    if (tx.status === 'paid') {
      return { alreadyProcessed: true, transaction: tx };
    }

    await db.transaction(async (databaseTx) => {
      // 1. Update transaction record
      await databaseTx
        .update(bookingTransactions)
        .set({
          status: 'paid',
          orderId: paymentDetails.orderId,
          paymentId: paymentDetails.paymentId,
          receiptUrl: paymentDetails.receiptUrl || `https://propbot.io/receipts/${tx.id}`,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookingTransactions.id, tx.id));

      // 2. Advance Lead Stage to 'booked' (PDF: "stage moves to Booked only after confirmed payment or admin action")
      await databaseTx
        .update(leads)
        .set({
          status: 'booked',
          updatedAt: new Date(),
        })
        .where(eq(leads.id, tx.leadId));

      // 3. Emit payment_received to domain_events outbox (PDF: "Emit payment_received")
      await databaseTx.insert(domainEvents).values({
        companyId,
        type: 'payment_received',
        payload: {
          lead_id: tx.leadId,
          unit_id: tx.unitId,
          payment_id: paymentDetails.paymentId || paymentLinkId,
          amount: Number(tx.amount),
          currency: tx.currency,
          receipt_url: paymentDetails.receiptUrl,
        },
      });
    });

    logger.info({ companyId, leadId: tx.leadId, amount: tx.amount }, 'Token booking payment confirmed, lead moved to booked');

    return {
      success: true,
      transactionId: tx.id,
      leadId: tx.leadId,
      status: 'paid',
    };
  }

  async listTransactions(companyId: string, leadId?: string) {
    const conditions = [eq(bookingTransactions.companyId, companyId)];
    if (leadId) {
      conditions.push(eq(bookingTransactions.leadId, leadId));
    }

    return await db
      .select()
      .from(bookingTransactions)
      .where(and(...conditions))
      .orderBy(eq(bookingTransactions.createdAt, new Date()));
  }
}

export const bookingPaymentsService = new BookingPaymentsService();
