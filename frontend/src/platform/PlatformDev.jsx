import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import pApi, { errText } from './platformApi';
import useFetch from './useFetch';
import { usePlatform } from './platformContext';
import { askConfirm, notify } from '../components/AppFeedback';
import { Btn, Card, Empty, ErrorBox, Field, Loading, Modal, PageHead, Pill, Stat, TableWrap, Td, THead, fmtDate, fmtDateTime, inputCls, num, selectCls, serif } from './ui';

const kindTone = { Release: 'green', Fix: 'indigo', 'Known issue': 'amber' };
const priorityTone = { Urgent: 'red', Normal: 'gray', Low: 'green' };

const ReleaseModal = ({ onClose, onDone }) => {
  const [f, setF] = useState({ kind: 'Release', version: '', title: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await pApi.post('/dev/releases', f); notify('Saved', 'success'); onDone(); onClose(); } catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title="Add release notes or a known issue" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Type"><select value={f.kind} onChange={set('kind')} className={inputCls}>{['Release', 'Fix', 'Known issue'].map((k) => <option key={k}>{k}</option>)}</select></Field>
        <Field label="Version"><input autoFocus value={f.version} onChange={set('version')} placeholder="v1.4.0" className={inputCls} /></Field>
        <div className="sm:col-span-2"><Field label="Title"><input value={f.title} onChange={set('title')} placeholder="e.g. Fee receipts show the new balance" className={inputCls} /></Field></div>
        <div className="sm:col-span-2"><Field label="Details (optional)"><textarea rows={4} value={f.notes} onChange={set('notes')} className={`${inputCls} h-auto py-2`} /></Field></div>
        <div className="flex justify-end gap-2 sm:col-span-2"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Save</Btn></div>
      </form>
    </Modal>
  );
};

export const DevPage = () => {
  const { can } = usePlatform();
  const write = can('tickets:write');
  const { data, loading, error, reload } = useFetch('/dev/overview');
  const [adding, setAdding] = useState(false);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const c = data.counts;
  const maxF = Math.max(1, ...data.by_feature.map((f) => f.tickets));
  const remove = async (r) => { if (!(await askConfirm(`Delete ${r.version}: ${r.title}?`))) return; try { await pApi.delete(`/dev/releases/${r.id}`); notify('Deleted', 'success'); reload(); } catch (err) { notify(errText(err), 'error'); } };
  return (
    <>
      <PageHead title="Health and releases" subtitle="How the schools are using the app, where problems come from, and what you have shipped." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Open tickets" value={num(c.open)} hint={`${c.new} new · ${c.unassigned} unassigned`} tone={c.new ? 'warn' : 'ink'} />
        <Stat label="Urgent" value={num(c.urgent)} tone={c.urgent ? 'bad' : 'ink'} hint="Open and marked urgent" />
        <Stat label="Oldest open" value={`${c.oldest_days} ${c.oldest_days === 1 ? 'day' : 'days'}`} tone={c.oldest_days > 7 ? 'warn' : 'ink'} />
        <Stat label="Average time to fix" value={c.avg_hours_to_resolve === null ? '—' : c.avg_hours_to_resolve < 48 ? `${c.avg_hours_to_resolve} h` : `${Math.round(c.avg_hours_to_resolve / 24)} days`} hint={`${c.opened_30d} opened · ${c.resolved_30d} resolved in 30 days`} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title="Oldest open tickets">
          {data.oldest.length === 0 ? <Empty>No open tickets. Nice.</Empty> : (
            <ul className="divide-y divide-[#F0ECE2]">{data.oldest.map((t) => <li key={t.id} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><Link to={`/platform/support/${t.id}`} className="block truncate font-medium text-[#1F2433] hover:text-[#2E2A6E] hover:underline">{t.subject}</Link><span className="text-[12.5px] text-[#6B7080]">{t.school_name || 'Unlinked school'} · {t.status}</span></div><div className="flex shrink-0 items-center gap-2"><Pill tone={priorityTone[t.priority] || 'gray'}>{t.priority}</Pill><span className="text-[12.5px] text-[#6B7080]">{t.days} d</span></div></li>)}</ul>)}
        </Card>
        <Card title="Where problems come from (30 days)" subtitle="Features with the most tickets">
          {data.by_feature.length === 0 ? <Empty>No tickets in the last 30 days.</Empty> : (
            <ul className="space-y-3">{data.by_feature.map((f) => <li key={f.feature}><div className="mb-1 flex justify-between text-[13px]"><span className="truncate pr-3 text-[#2B3040]">{f.feature}</span><span className="text-[#6B7080]">{f.tickets}{f.errors ? ` · ${f.errors} errors` : ''}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#F0ECE2]"><div className="h-full rounded-full bg-[#3F3A8C]" style={{ width: `${(f.tickets / maxF) * 100}%` }} /></div></li>)}</ul>)}
          {data.by_school.length > 0 && <p className="mt-4 border-t border-[#F0ECE2] pt-3 text-[13px] text-[#5B6070]">Most tickets from: {data.by_school.slice(0, 4).map((s) => `${s.school} (${s.tickets})`).join(', ')}</p>}
        </Card>
      </div>

      <section className="mt-8">
        <h2 style={serif} className="mb-3 text-[20px] font-medium text-[#1F2433]">School health</h2>
        {data.health.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>No active or trial schools yet.</Empty></div> : (
          <TableWrap><THead cols={['School', 'Plan', 'Last sign-in', 'Sign-ins (7 days)', 'App users', 'Open tickets']} /><tbody>{data.health.map((h) => (
            <tr key={h.school}><Td className="font-medium">{h.school}{h.quiet && <span className="ml-2"><Pill tone="amber">Quiet this week</Pill></span>}</Td><Td className="capitalize">{h.plan}</Td><Td>{h.last_login_at ? fmtDateTime(h.last_login_at) : <span className="text-[#A5A08F]">Never</span>}</Td><Td>{num(h.logins_7d)}</Td><Td>{num(h.app_users)}</Td><Td>{h.open_tickets ? <b className="text-[#B45309]">{h.open_tickets}</b> : '0'}</Td></tr>))}</tbody></TableWrap>)}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3"><h2 style={serif} className="text-[20px] font-medium text-[#1F2433]">Release notes and known issues</h2>{write && <Btn onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add</Btn>}</div>
        {data.releases.length === 0 ? <div className="rounded-2xl border border-[#E2DDD1] bg-white"><Empty>Nothing posted yet. When you ship a fix, add it here and mark the tickets it fixes.</Empty></div> : (
          <ul className="space-y-2.5">{data.releases.map((r) => (
            <li key={r.id} className="rounded-xl border border-[#E2DDD1] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Pill tone={kindTone[r.kind]}>{r.kind}</Pill><b className="text-[#1F2433]">{r.version}</b><span className="text-[#1F2433]">{r.title}</span></div>
                <div className="flex items-center gap-2 text-[12.5px] text-[#8A8F9C]">{r.by} · {fmtDate(r.at)}{write && <button type="button" aria-label="Delete" onClick={() => remove(r)} className="rounded p-1 text-[#B91C1C] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}</div></div>
              {r.notes && <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-6 text-[#4A4F5C]">{r.notes}</p>}
            </li>))}</ul>)}
      </section>
      {adding && <ReleaseModal onClose={() => setAdding(false)} onDone={reload} />}
    </>
  );
};
