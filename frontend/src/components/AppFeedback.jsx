import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { t } from '../i18n';

// Promise-based replacements for window.alert / confirm / prompt.
// Usage: notify('Saved'), await askConfirm('Delete this?'), await askText('Reason?', '')
const listeners = new Set();
const emit = (event) => listeners.forEach((fn) => fn(event));
let seq = 0;

export const notify = (message, type = 'info') => {
  const text = String(message ?? '');
  const inferred = type !== 'info' ? type
    : /could not|cannot|failed|invalid|error|must|enter a|complete every|overlap|no fee/i.test(text) ? 'error'
    : /recorded|saved|success|updated|removed|approved|published|created/i.test(text) ? 'success' : 'info';
  emit({ kind: 'toast', id: ++seq, text, type: inferred });
};

export const askConfirm = (message, options = {}) => new Promise((resolve) => {
  emit({ kind: 'dialog', id: ++seq, mode: 'confirm', message, resolve, ...options });
});

export const askText = (message, defaultValue = '', options = {}) => new Promise((resolve) => {
  emit({ kind: 'dialog', id: ++seq, mode: 'prompt', message, defaultValue: defaultValue ?? '', resolve, ...options });
});

const toastStyle = {
  success: ['border-emerald-200 bg-emerald-50 text-emerald-900', CheckCircle2, 'text-emerald-600'],
  error: ['border-red-200 bg-red-50 text-red-900', XCircle, 'text-red-600'],
  info: ['border-indigo-200 bg-white text-slate-800', Info, 'text-indigo-600'],
};

export const FeedbackHost = () => {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const onEvent = (event) => {
      if (event.kind === 'toast') {
        setToasts((items) => [...items.slice(-3), event]);
        setTimeout(() => setToasts((items) => items.filter((t) => t.id !== event.id)), 4500);
      } else {
        setValue(event.defaultValue || '');
        setDialog(event);
      }
    };
    listeners.add(onEvent);
    return () => listeners.delete(onEvent);
  }, []);

  useEffect(() => { if (dialog?.mode === 'prompt') setTimeout(() => inputRef.current?.focus(), 30); }, [dialog]);

  const close = (result) => { dialog?.resolve(result); setDialog(null); };
  const danger = dialog && (dialog.danger ?? /remove|delete|revers|suspend|reject|cancel|check out/i.test(dialog.message || ''));

  return (
    <>
      <div className="fixed bottom-5 right-5 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const [cls, Icon, iconCls] = toastStyle[t.type] || toastStyle.info;
          return (
            <div key={t.id} role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[14px] shadow-lg ${cls}`}>
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconCls}`} />
              <p className="flex-1 leading-5">{t.text}</p>
              <button aria-label="Dismiss" onClick={() => setToasts((items) => items.filter((x) => x.id !== t.id))}><X className="h-4 w-4 opacity-60" /></button>
            </div>
          );
        })}
      </div>
      {dialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) close(dialog.mode === 'prompt' ? null : false); }}>
          <form role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onSubmit={(e) => { e.preventDefault(); close(dialog.mode === 'prompt' ? value : true); }}
            onKeyDown={(e) => { if (e.key === 'Escape') close(dialog.mode === 'prompt' ? null : false); }}>
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {danger ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
              </span>
              <div className="flex-1">
                <h2 className="font-poppins text-[17px] font-bold text-slate-900">{dialog.title || (dialog.mode === 'prompt' ? t('Please add details') : t('Please confirm'))}</h2>
                <p className="mt-1.5 text-[14px] leading-6 text-slate-600">{dialog.message}</p>
              </div>
            </div>
            {dialog.mode === 'prompt' && (
              <textarea ref={inputRef} rows={3} value={value} onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); close(value); } }}
                className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => close(dialog.mode === 'prompt' ? null : false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-slate-600 hover:bg-slate-50">{t('Cancel')}</button>
              <button type="submit" className={`rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#4F46E5] hover:bg-[#4338CA]'}`}>{dialog.confirmLabel || (dialog.mode === 'prompt' ? t('Continue') : t('Confirm'))}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
