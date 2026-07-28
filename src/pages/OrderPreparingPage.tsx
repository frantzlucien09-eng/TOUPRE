import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { formatHTG, formatDateTime } from '@/lib/format';
import type { Order } from '@/lib/types';
import { StatusPill } from './HomePage';
import {
  ArrowLeft, MapPin, MessageCircle, Check, Truck, Package, Loader2,
  CheckCircle2, Camera, Navigation, Phone,
} from 'lucide-react';

type Props = {
  order: Order;
  onBack: () => void;
  onDelivering: () => void;
  onMessage: (customerId: string) => void;
  onStatusChange?: (newStatus: string) => void;
};

type StepButton = {
  key: string;
  label: string;
  icon: React.ReactNode;
  targetStatus: string;
  successMsg: string;
};

export function OrderPreparingPage({ order, onBack, onDelivering, onMessage, onStatusChange }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(order.status);
  const isPickup = order.delivery_type === 'pickup';

  const shortId = `#TP-${order.id.slice(0, 4).toUpperCase()}`;
  const customerName = order.customer?.full_name ?? 'Kliyan';

  const deliverySteps: StepButton[] = [
    { key: 'accept', label: 'Aksepte Kòmand', icon: <CheckCircle2 size={16} />, targetStatus: 'accepted', successMsg: 'Kòmand aksepte' },
    { key: 'prepare', label: 'Kòmanse Prepare l', icon: <Package size={16} />, targetStatus: 'preparing', successMsg: 'Kòmand ap prepare' },
    { key: 'delivering', label: 'Mwen Deplase, M ap Pote l', icon: <Navigation size={16} />, targetStatus: 'delivering', successMsg: 'Kòmand ap livre' },
    { key: 'arrived', label: 'Mwen Rive — Make kòm Livre', icon: <Camera size={16} />, targetStatus: 'delivered', successMsg: 'Kòmand livre' },
  ];

  const pickupSteps: StepButton[] = [
    { key: 'accept', label: 'Aksepte Kòmand', icon: <CheckCircle2 size={16} />, targetStatus: 'accepted', successMsg: 'Kòmand aksepte' },
    { key: 'prepare', label: 'Kòmanse Prepare l', icon: <Package size={16} />, targetStatus: 'preparing', successMsg: 'Kòmand ap prepare' },
    { key: 'ready', label: 'Make kòm Pare pou Retire', icon: <Package size={16} />, targetStatus: 'ready_pickup', successMsg: 'Kòmand pare pou retire' },
    { key: 'picked', label: 'Make kòm Kliyan Retire l', icon: <Check size={16} />, targetStatus: 'picked_up', successMsg: 'Kòmand retire' },
  ];

  const steps = isPickup ? pickupSteps : deliverySteps;

  const statusProgression = isPickup
    ? ['pending', 'accepted', 'preparing', 'ready_pickup', 'picked_up']
    : ['pending', 'accepted', 'preparing', 'delivering', 'delivered'];

  const currentIndex = statusProgression.indexOf(currentStatus);

  const advance = async (step: StepButton, after?: () => void) => {
    setLoadingStep(step.key);
    setLoading(true);
    const { error } = await supabase.rpc('update_order_status', {
      p_order_id: order.id,
      p_new_status: step.targetStatus,
    });
    setLoading(false);
    setLoadingStep(null);
    if (error) {
      toast('Erè, eseye ankò', 'error');
      return;
    }
    setCurrentStatus(step.targetStatus);
    onStatusChange?.(step.targetStatus);
    toast(step.successMsg);
    after?.();
  };

  const handleStepClick = (step: StepButton, stepIndex: number) => {
    if (stepIndex !== currentIndex + 1) return;
    if (step.key === 'delivering' || step.key === 'ready') {
      advance(step, onDelivering);
    } else if (step.key === 'arrived' || step.key === 'picked') {
      onDelivering();
    } else {
      advance(step);
    }
  };

  const timelineSteps = [
    { key: 'pending', label: 'Kòmand Kreye', time: formatDateTime(order.created_at) },
    { key: 'accepted', label: 'Kòmand Aksepte', time: ['accepted', 'preparing', 'ready_pickup', 'delivering', 'delivered', 'picked_up'].includes(currentStatus) ? formatDateTime(order.updated_at) : '' },
    { key: 'preparing', label: 'An Preparasyon', time: ['preparing', 'ready_pickup', 'delivering', 'delivered', 'picked_up'].includes(currentStatus) ? formatDateTime(order.updated_at) : '' },
    { key: isPickup ? 'ready_pickup' : 'delivering', label: isPickup ? 'Pare pou Retire' : 'Ap Livre', time: [isPickup ? 'ready_pickup' : 'delivering', 'delivered', 'picked_up'].includes(currentStatus) ? formatDateTime(order.updated_at) : '' },
  ];

  const timelineProgression = isPickup
    ? ['pending', 'accepted', 'preparing', 'ready_pickup']
    : ['pending', 'accepted', 'preparing', 'delivering'];
  const currentTimelineIndex = Math.max(0, timelineProgression.indexOf(currentStatus));

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="p-1 -ml-1 active:scale-90 transition">
            <ArrowLeft size={22} className="text-slate-700" />
          </button>
          <h1 className="font-bold text-slate-900 text-base">Detay Kòmand</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Customer + status header */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-slate-900 text-sm">{customerName}</p>
              <p className="text-xs text-slate-400 mt-0.5">{shortId}</p>
            </div>
            <StatusPill status={currentStatus} />
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-3">Atik yo</p>
          <div className="space-y-2">
            {(order.items ?? []).map((it, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-700">{it.qty}× {it.name}</span>
                <span className="font-medium text-slate-900">{formatHTG(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 pt-3 border-t border-slate-100">
            <span className="font-semibold text-slate-900">Total jeneral</span>
            <span className="font-bold text-slate-900">{formatHTG(order.total)}</span>
          </div>
        </div>

        {/* Delivery type */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPickup ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'}`}>
              {isPickup ? <Package size={16} /> : <Truck size={16} />}
            </div>
            <p className="font-semibold text-slate-900 text-sm">
              {isPickup ? 'Kliyan ap vin pran l' : 'Vandè a ap Livre'}
            </p>
          </div>
          {order.customer?.address && (
            <p className="text-xs text-slate-600 flex items-start gap-1.5 mt-2">
              <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
              <span>{order.customer.address}{order.customer.city ? `, ${order.customer.city}` : ''}</span>
            </p>
          )}
          {order.delivery_note && (
            <div className="mt-3 bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Deskripsyon kay/kote kliyan an</p>
              <p className="text-sm text-slate-700">{order.delivery_note}</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-4">Timeline</p>
          <div className="relative">
            {timelineSteps.map((step, i) => {
              const done = i < currentTimelineIndex;
              const current = i === currentTimelineIndex;
              const last = i === timelineSteps.length - 1;
              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition ${
                      done ? 'bg-emerald-500 text-white' :
                      current ? 'bg-emerald-50 text-emerald-600 ring-2 ring-emerald-500' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {done ? <Check size={14} /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                    </div>
                    {!last && (
                      <div className={`w-0.5 h-8 ${done ? 'bg-emerald-500' : 'bg-slate-100'}`} />
                    )}
                  </div>
                  <div className={`pb-6 ${last ? 'pb-0' : ''}`}>
                    <p className={`text-sm font-semibold ${current ? 'text-emerald-600' : done ? 'text-slate-800' : 'text-slate-400'}`}>
                      {step.label}
                    </p>
                    {step.time && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{step.time}</p>
                    )}
                    {current && !step.time && (
                      <p className="text-[11px] text-slate-400 mt-0.5">An atant...</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step buttons — all visible, stacked, matching mockup */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-3">Aksyon yo</p>
          <div className="flex flex-col gap-2">
            {steps.map((step, i) => {
              const isDone = i < currentIndex + 1;
              const isNext = i === currentIndex + 1;
              const isFuture = i > currentIndex + 1;
              const isLoadingThis = loadingStep === step.key;

              if (isDone) {
                return (
                  <div
                    key={step.key}
                    className="w-full py-3 px-4 rounded-xl bg-slate-100 text-slate-400 font-semibold text-sm flex items-center gap-2"
                  >
                    <span className="text-slate-300">{step.icon}</span>
                    {step.label}
                    <Check size={14} className="ml-auto text-emerald-400" />
                  </div>
                );
              }

              if (isNext) {
                return (
                  <button
                    key={step.key}
                    onClick={() => handleStepClick(step, i)}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white font-semibold text-sm flex items-center gap-2 active:scale-[0.98] transition disabled:opacity-60"
                  >
                    {isLoadingThis ? <Loader2 size={16} className="animate-spin" /> : step.icon}
                    {step.label}
                  </button>
                );
              }

              return (
                <div
                  key={step.key}
                  className="w-full py-3 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-300 font-semibold text-sm flex items-center gap-2"
                >
                  {step.icon}
                  {step.label}
                </div>
              );
            })}
          </div>

          {/* Photo proof teaser for delivery — shown when preparing or delivering */}
          {!isPickup && (currentStatus === 'preparing' || currentStatus === 'delivering') && (
            <div className="mt-3 border border-dashed border-emerald-300 rounded-xl p-3.5 bg-emerald-50 text-center">
              <Camera size={24} className="mx-auto text-emerald-500" />
              <p className="text-xs text-emerald-700 font-semibold mt-1.5">Pran yon foto kòm prèv livrezon</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">Obligatwa anvan w konfime kòmand lan livre</p>
            </div>
          )}
        </div>
      </div>

      {/* Contact buttons */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 py-3 bg-white border-t border-slate-100 z-10 flex gap-2">
        {order.customer?.phone && (
          <a
            href={`tel:${order.customer.phone}`}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <Phone size={16} /> Rele
          </a>
        )}
        <button
          onClick={() => order.customer_id && onMessage(order.customer_id)}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <MessageCircle size={16} /> Mesaj
        </button>
      </div>
    </div>
  );
}
