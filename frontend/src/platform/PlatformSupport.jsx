import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Copy, Search } from 'lucide-react';
import pApi, { errText } from './platformApi';
import useFetch from './useFetch';
import { usePlatform } from './platformContext';
import { notify } from '../components/AppFeedback';
import { Btn, Card, Empty, ErrorBox, Field, Loading, PageHead, Pill, TableWrap, Td, THead, fmtDate, fmtDateTime, inputCls, num, selectCls } from './ui';

const STATUSES = ['New', 'In progress', 'Waiting for school', 'Resolved', 'Closed'];
const PRIORITIES = ['Low', 'Normal', 'Urgent'];
const TYPES = ['Help needed', 'Error / bug', 'Suggestion'];
const statusTone = { New: 'indigo', 'In progress': 'amber', 'Waiting for school': 'gray', Resolved: 'green', Closed: 'gray' };
const priorityTone = { Urgent: 'red', Normal: 'gray', Low: 'green' };
const typeTone = { 'Error / bug': 'red', 'Help needed': 'indigo', Suggestion: 'green' };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const PERIODS = [['', 'Any time'], ['0', 'Today'], ['6', 'Last 7 days'], ['29', 'Last 30 days'], ['89', 'Last 90 days']];
const PAGE = 25;

export const SupportList = () => {
  const [status, setStatus] = useState('');
  const [f, setF] = useState({ q: '', school_id: '', source: '', type: '', feature: '', priority: '', period: '' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  useEffect(() => { const t = setTimeout(() => setQuery(f.q), 300); return () => clearTimeout(t); }, [f.q]);
  useEffect(() => { setPage(0); }, [status, query, f.school_id, f.source, f.type, f.feature, f.priority, f.period]);
  const params = {
    status, q: query, school_id: f.school_id, source: f.source, type: f.type, feature: f.feature, priority: f.priority, skip: page * PAGE, limit: PAGE,
    ...(f.period !== '' ? { from: daysAgo(Number(f.period)), to: daysAgo(0) } : {}),
  };
  const { data, loading, error, reload } = useFetch('/tickets', params);
  const set = (key) => (e) => setF((s) => ({ ...s, [key]: e.target.value }));
  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;
  const pages = Math.max(1, Math.ceil((data?.total || 0) / PAGE));

  return (
    <>
      <PageHead title="Support tickets" subtitle="Help requests and error reports from schools and parents." />
      <div className="mb-4 flex flex-wrap gap-2">
        {[['', 'All', total], ...STATUSES.map((s) => [s, s, data?.counts[s] ?? 0])].map(([key, label, count]) => (
          <button key={key || 'all'} type="button" onClick={() => setStatus(key)} aria-pressed={status === key}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${status === key ? 'border-[#2E2A6E] bg-[#2E2A6E] text-white' : 'border-[#DAD6CC] bg-white text-[#2B3040] hover:bg-[#F4F1EA]'}`}>
            {label} <span className={status === key ? 'text-white/70' : 'text-[#6B7080]'}>{num(count)}</span>
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2.5">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8F9C]" /><input value={f.q} onChange={set('q')} placeholder="Search ticket, school, person or error text" className={`${inputCls} pl-9`} /></div>
        <select value={f.school_id} onChange={set('school_id')} aria-label="School" className={`${selectCls} w-44`}><option value="">All schools</option>{data?.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select value={f.source} onChange={set('source')} aria-label="Where from" className={`${selectCls} w-40`}><option value="">Web and apps</option>{data?.sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        <select value={f.type} onChange={set('type')} aria-label="Type" className={`${selectCls} w-40`}><option value="">All types</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <select value={f.feature} onChange={set('feature')} aria-label="Feature" className={`${selectCls} w-44`}><option value="">All features</option>{data?.features.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
        <select value={f.priority} onChange={set('priority')} aria-label="Priority" className={`${selectCls} w-36`}><option value="">Any priority</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
        <select value={f.period} onChange={set('period')} aria-label="Period" className={`${selectCls} w-36`}>{PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>

      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : data.items.length === 0 ? <Card><Empty>No tickets match these filters.</Empty></Card> : (<>
        <TableWrap>
          <THead cols={['Ticket', 'School', 'Reported by', 'Feature', 'Priority', 'Status', 'Opened', 'Assigned to']} />
          <tbody>
            {data.items.map((t) => (
              <tr key={t.id} onClick={() => navigate(`/platform/support/${t.id}`)} className="cursor-pointer hover:bg-[#FAF8F3]">
                <Td className="min-w-[240px]"><Link to={`/platform/support/${t.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-[#2E2A6E] hover:underline">{t.subject}</Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#6B7080]">{t.id}<Pill tone={typeTone[t.type]}>{t.type}</Pill></div></Td>
                <Td className="whitespace-nowrap">{t.school_name}</Td>
                <Td className="whitespace-nowrap"><span className="font-medium">{t.reporter.name}</span><div className="text-[12px] text-[#6B7080]">{t.reporter.kind === 'parent' ? 'Parent' : t.reporter.role_label} · {t.source_label}</div></Td>
                <Td>{t.feature_label || <span className="text-[#8A8F9C]">{t.category}</span>}</Td>
                <Td><Pill tone={priorityTone[t.priority]}>{t.priority}</Pill></Td>
                <Td><Pill tone={statusTone[t.status]}>{t.status}</Pill></Td>
                <Td className="whitespace-nowrap">{fmtDateTime(t.created_at)}</Td>
                <Td className="whitespace-nowrap">{t.assigned_name || <span className="text-[#8A8F9C]">Unassigned</span>}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <div className="mt-3 flex items-center justify-between text-[13px] text-[#5B6070]">
          <span>{num(data.total)} tickets · page {page + 1} of {pages}</span>
          <span className="flex gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[#DAD6CC] bg-white px-3 py-1.5 font-medium disabled:opacity-40">Previous</button>
            <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[#DAD6CC] bg-white px-3 py-1.5 font-medium disabled:opacity-40">Next</button>
          </span>
        </div>
      </>)}
    </>
  );
};

const Fact = ({ label, children }) => (
  <div className="flex justify-between gap-4 border-b border-[#F0ECE2] py-2 text-[13.5px] last:border-0"><span className="text-[#6B7080]">{label}</span><span className="text-right font-medium text-[#1F2433]">{children || '—'}</span></div>
);

export const SupportTicket = () => {
  const { id } = useParams();
  const { can } = usePlatform();
  const editable = can('tickets:write');
  const { data, loading, error, reload } = useFetch(`/tickets/${id}`);
  const people = useFetch('/tickets/assignees');
  const rel = useFetch('/dev/overview');
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const change = async (body, okText) => {
    try { await pApi.put(`/tickets/${id}`, body); notify(okText, 'success'); reload(); } catch (err) { notify(errText(err), 'error'); }
  };
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try { await pApi.post(`/tickets/${id}/messages`, { text: text.trim(), internal, status: newStatus || undefined }); setText(''); setNewStatus(''); notify(internal ? 'Internal note saved' : 'Reply sent to the school', 'success'); reload(); }
    catch (err) { notify(errText(err), 'error'); } finally { setBusy(false); }
  };
  const copyError = async () => { try { await navigator.clipboard.writeText(data.error_details); notify('Error text copied', 'success'); } catch { notify('Could not copy. Select the text and copy it.', 'error'); } };
  const env = data.environment || {};
  const reporter = data.reporter;

  return (
    <>
      <p className="mb-2 text-[13px]"><Link to="/platform/support" className="text-[#3F3A8C] hover:underline">← All tickets</Link></p>
      <PageHead title={data.subject} subtitle={`${data.id} · ${data.school_name} · opened ${fmtDateTime(data.created_at)}`}
        actions={<><Pill tone={typeTone[data.type]}>{data.type}</Pill><Pill tone={priorityTone[data.priority]}>{data.priority}</Pill><Pill tone={statusTone[data.status]}>{data.status}</Pill></>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="What was reported">
            <div className="mb-3 flex flex-wrap gap-2"><Pill>{data.category}</Pill>{data.feature_label && <Pill tone="indigo">Feature: {data.feature_label}</Pill>}{data.page && <Pill>Screen: {data.page}</Pill>}</div>
            <p className="whitespace-pre-wrap text-[14.5px] leading-7 text-[#1F2433]">{data.description}</p>
            {data.error_details && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between"><p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7080]">Error message</p><button type="button" onClick={copyError} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#3F3A8C] hover:underline"><Copy className="h-3.5 w-3.5" />Copy</button></div>
                <pre className="overflow-x-auto rounded-xl bg-[#1F2433] p-4 text-[12.5px] leading-6 text-[#E8E6F5]">{data.error_details}</pre>
              </div>
            )}
          </Card>

          <Card title="Conversation" subtitle={editable ? 'Replies are shown to the school. Internal notes are only for the Orison team.' : 'Read only.'}>
            {data.thread.length === 0 ? <Empty>No messages yet.</Empty> : (
              <ul className="space-y-3">
                {data.thread.map((m) => m.from === 'system' ? (
                  <li key={m.id} className="text-center text-[12.5px] text-[#6B7080]">{m.text} · {m.author} · {fmtDateTime(m.at)}</li>
                ) : (
                  <li key={m.id} className={`rounded-xl border px-4 py-3 text-[14px] leading-6 ${m.from === 'note' ? 'border-amber-200 bg-amber-50' : m.from === 'orison' ? 'border-[#D9D3F0] bg-[#F6F4FC]' : 'border-[#E2DDD1] bg-white'}`}>
                    <p className="mb-1 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-[#6B7080]">
                      {m.from === 'school' ? `${reporter.name} (${reporter.kind === 'parent' ? 'parent' : 'school'})` : m.author}
                      {m.from === 'note' && <Pill tone="amber">Internal note · only Orison</Pill>}{m.from === 'orison' && <Pill tone="indigo">Reply to school</Pill>}
                      <span className="font-normal">{fmtDateTime(m.at)}</span>
                    </p>
                    <p className="whitespace-pre-wrap text-[#1F2433]">{m.text}</p>
                  </li>
                ))}
              </ul>
            )}
            {editable && (
              <div className="mt-5 border-t border-[#EEEAE0] pt-5">
                <div className="mb-3 inline-flex rounded-lg bg-[#F4F1EA] p-1" role="group" aria-label="Message type">
                  {[[false, 'Reply to school'], [true, 'Internal note']].map(([val, label]) => (
                    <button key={label} type="button" onClick={() => setInternal(val)} aria-pressed={internal === val} className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium ${internal === val ? 'bg-white text-[#2E2A6E] shadow-sm' : 'text-[#5B6070]'}`}>{label}</button>
                  ))}
                </div>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={internal ? 'Only the Orison team can see this…' : `Write to ${reporter.name}…`} className={`${inputCls} h-auto py-2.5`} />
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="w-52"><Field label="Also set status"><select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={inputCls}><option value="">Keep as it is</option>{STATUSES.filter((s) => s !== data.status).map((s) => <option key={s}>{s}</option>)}</select></Field></div>
                  <Btn onClick={send} busy={busy} disabled={!text.trim()}>{internal ? 'Save note' : 'Send reply'}</Btn>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Handling">
            <div className="space-y-4">
              <Field label="Status"><select disabled={!editable} value={data.status} onChange={(e) => change({ status: e.target.value }, 'Status updated')} className={inputCls}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Priority"><select disabled={!editable} value={data.priority} onChange={(e) => change({ priority: e.target.value }, 'Priority updated')} className={inputCls}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
              <Field label="Assigned to"><select disabled={!editable} value={data.assigned_to} onChange={(e) => change({ assigned_to: e.target.value }, 'Assignment updated')} className={inputCls}><option value="">Unassigned</option>{(people.data || []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}</select></Field>
              <Field label="Fixed in release"><select disabled={!editable} value={data.fixed_in_id || ''} onChange={(e) => change({ fixed_in: e.target.value }, 'Release saved')} className={inputCls}><option value="">Not fixed yet</option>{(rel.data?.releases || []).filter((r) => r.kind !== 'Known issue').map((r) => <option key={r.id} value={r.id}>{r.version}: {r.title}</option>)}</select></Field>
            </div>
          </Card>
          <Card title="Reported by">
            <Fact label="School">{data.school_name}{data.school_code ? ` (${data.school_code})` : ''}</Fact>
            <Fact label="Name">{reporter.name}</Fact>
            <Fact label="Login type">{reporter.kind === 'parent' ? 'Parent' : reporter.role_label}</Fact>
            {reporter.kind === 'parent' && <Fact label="Student's class">{reporter.student_class}</Fact>}
            {reporter.kind === 'parent' && <Fact label="Mobile">{reporter.mobile_masked}</Fact>}
            <Fact label="Raised from">{data.source_label}</Fact>
            <Fact label="Opened">{fmtDateTime(data.created_at)}</Fact>
            <Fact label="Last update">{fmtDateTime(data.updated_at)}</Fact>
            {data.resolved_at && <Fact label="Resolved">{fmtDate(data.resolved_at)}</Fact>}
          </Card>
          <Card title="Technical details">
            <Fact label="App">{env.client === 'web' ? 'Web' : env.client}</Fact>
            <Fact label="App version">{env.app_version}</Fact>
            <Fact label="Screen">{data.page}</Fact>
            <p className="mt-2 break-words text-[12px] leading-5 text-[#6B7080]">{env.user_agent || 'No device information was sent.'}</p>
          </Card>
        </div>
      </div>
    </>
  );
};
