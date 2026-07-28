import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type Toast = {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
};

type ToastContextValue = {
  toast: (message: string, type?: Toast['type'], duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast['type'] = 'success', duration?: number) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, duration ?? 2800);
  }, []);

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90%] max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg animate-toast-in border ${
              t.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : t.type === 'error'
                ? 'bg-red-600 text-white border-red-500'
                : 'bg-slate-800 text-white border-slate-700'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 size={18} className="shrink-0" />}
            {t.type === 'error' && <XCircle size={18} className="shrink-0" />}
            {t.type === 'info' && <Info size={18} className="shrink-0" />}
            <span className="text-sm font-medium flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
