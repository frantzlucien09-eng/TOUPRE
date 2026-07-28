import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type ConfirmContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue>({
  confirm: async () => false,
});

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ opts, resolve });
    });
  }, []);

  const close = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-modal-in">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  state.opts.danger ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-base">
                  {state.opts.title ?? 'Konfime'}
                </h3>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  {state.opts.message}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => close(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:scale-95 transition"
              >
                {state.opts.cancelText ?? 'Anile'}
              </button>
              <button
                onClick={() => close(true)}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm text-white active:scale-95 transition ${
                  state.opts.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {state.opts.confirmText ?? 'Konfime'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
