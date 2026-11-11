import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { apiRequest } from '../services/api-client.js';

function fmt(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

type OrderItem = {
  id: string;
  title: string;
  amountMinor: number;
  currency: string;
  status: string;
  expiresAt: string | null;
  leadName: string | null;
};

export const SimulatedPayPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiRequest<OrderItem>(`/api/payments/orders/simulated/${id}/public`)
      .then(o => { setOrder(o); if (o.status === 'paid') setPaid(true); })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  async function handlePay() {
    if (!order) return;
    setPaying(true);
    try {
      // simulate-paid requires auth; we use the stored token if present
      const token = localStorage.getItem('propbot_access_token');
      const res = await fetch(`/api/payments/orders/${order.id}/simulate-paid`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Payment simulation failed');
      setPaid(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPaying(false);
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-8">
        <div className="max-w-md text-center">
          <p className="text-2xl font-bold text-text">Payment unavailable</p>
          <p className="mt-2 text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="bg-gradient-to-r from-accent to-indigo-700 px-6 py-4">
        <div className="mx-auto max-w-lg flex items-center gap-2 text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold tracking-wide">PropBot Pro</span>
          <span className="ml-auto text-xs text-white/60 rounded bg-white/10 px-2 py-0.5">TEST MODE</span>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-6 py-10">
        {paid ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
            <h1 className="text-2xl font-bold">Payment Successful</h1>
            <p className="text-text-muted">This was a simulated test payment.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-1">{order.title}</h1>
            {order.leadName && <p className="text-text-muted mb-6">For: {order.leadName}</p>}

            <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Amount</span>
                <span className="text-xl font-bold text-accent">{fmt(order.amountMinor)}</span>
              </div>
              {order.expiresAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Expires</span>
                  <span>{new Date(order.expiresAt).toLocaleDateString('en-IN')}</span>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-lg bg-warning/10 border border-warning/30 px-4 py-2 text-xs text-warning">
              This is a simulated payment link for development/testing. No real money will be charged.
            </div>

            <button
              onClick={handlePay}
              disabled={paying}
              className="mt-6 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {paying && <Loader2 className="h-4 w-4 animate-spin" />}
              {paying ? 'Processing…' : 'Pay Now (Test)'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SimulatedPayPage;
