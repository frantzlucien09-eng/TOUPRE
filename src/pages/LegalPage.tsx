import { LEGAL_DOCS, LEGAL_NAV, type LegalDocKey } from '@/lib/legal';
import { ArrowLeft } from 'lucide-react';

export function LegalPage({ docKey }: { docKey: LegalDocKey }) {
  const doc = LEGAL_DOCS[docKey];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-16">
        <a href="#/" className="inline-flex items-center gap-2 text-sm text-emerald-700 font-semibold mb-4">
          <ArrowLeft size={16} /> Retounen
        </a>
        <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-8 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold mb-1">TOUPRE</p>
          <h1 className="text-2xl font-bold text-slate-900">{doc.title}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Vèsyon {doc.version} · Maj {doc.updatedAt}
          </p>
          <p className="text-sm text-slate-600 mt-3">{doc.summary}</p>

          <div className="mt-6 space-y-5">
            {doc.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="text-sm font-bold text-slate-900 mb-1.5">{s.heading}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold text-slate-500 mb-2">Lòt dokiman legal</p>
          <div className="flex flex-wrap gap-2">
            {LEGAL_NAV.filter((n) => n.key !== docKey).map((n) => (
              <a
                key={n.key}
                href={n.path}
                className="text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-emerald-300"
              >
                {n.title}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
