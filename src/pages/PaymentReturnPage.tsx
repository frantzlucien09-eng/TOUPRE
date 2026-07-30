import { useEffect, useState } from 'react';
import { verifyMoncashPayment } from '@/lib/payments/moncash';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

/**
 * Hash route: #/payment/return?payment_id=...&transactionId=...&ok=1
 */
export function PaymentReturnPage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'pending' | 'error'>('loading');
  const [message, setMessage] = useState('Ap verifye peman MonCash…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? window.location.search);
    const paymentId = params.get('payment_id') || params.get('orderId') || '';
    const transactionId = params.get('transactionId') || params.get('transaction_id') || '';

    const run = async () => {
      if (!paymentId && !transactionId) {
        setStatus('error');
        setMessage('Pa gen enfòmasyon peman nan lyen an.');
        return;
      }
      try {
        const result = await verifyMoncashPayment({
          paymentId: paymentId || undefined,
          transactionId: transactionId || undefined,
        });
        if (result.success && result.settled) {
          setStatus('ok');
          setMessage('Peman konfime! Mèsi.');
        } else if (result.success) {
          setStatus('pending');
          setMessage(result.error || 'Peman ap trete — verifye ankò nan kèk minit.');
        } else {
          setStatus('error');
          setMessage(result.error || 'Verifikasyon echwe.');
        }
      } catch (e) {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Erè verifikasyon');
      }
    };
    void run();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <img src="/toupre_vande_logo.png" alt="TOUPRE" className="w-14 h-14 object-contain" />
      {status === 'loading' && <Loader2 className="animate-spin text-emerald-600" size={28} />}
      {status === 'ok' && <CheckCircle2 className="text-emerald-600" size={36} />}
      {status === 'error' && <XCircle className="text-rose-500" size={36} />}
      {status === 'pending' && <Loader2 className="animate-spin text-amber-500" size={28} />}
      <h1 className="text-lg font-bold text-slate-900">Retou MonCash</h1>
      <p className="text-sm text-slate-600 max-w-sm">{message}</p>
      <a
        href="#/"
        className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
      >
        Retounen nan TOUPRE
      </a>
    </div>
  );
}
