import React, { useEffect, useState } from 'react';
import { CalendarDays, Info } from 'lucide-react';
import useFetch from './useFetch';
import { Card, Empty, ErrorBox, Loading, Pill, TableWrap, Td, THead, fmtDate, fmtDateTime, inputCls, num, serif, selectCls } from './ui';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const PRESETS = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['custom', 'Custom dates']];
const CLIENTS = [['', 'All apps and web'], ['web', 'Web'], ['parent-app', 'Parent app'], ['teacher-app', 'Teacher app'], ['director-app', 'Director app']];
const ROLES = [['', 'All logins'], ['admin', 'Admin'], ['academic_coordinator', 'Academic Coordinator'], ['teacher', 'Class Teacher'], ['fee_manager', 'Fee Manager'],
  ['director', 'Director'], ['stock_manager', 'Stock Manager'], ['librarian', 'Librarian'], ['parent', 'Parent']];
const PAGE = 12;

const Mini = ({ label, value, hint }) => (
  <div className="rounded-xl border border-[#E2DDD1] bg-white px-4 py-3.5">
    <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7080]">{label}</p>
    <p style={serif} className="mt-1 text-[28px] font-medium leading-none text-[#1F2433]">{value}</p>
    {hint && <p className="mt-1.5 text-[12.5px] text-[#6B7080]">{hint}</p>}
  </div>
);

// Usage and activity for one school: who signed in, which features are used, how many people activated each app.
const ActivityPanel = ({ school }) => {
  const [preset, setPreset] = useState('30');
  const [custom, setCustom] = useState({ from: daysAgo(29), to: daysAgo(0) });
  const [client, setClient] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(0);

  const range = preset === 'custom' ? custom : { from: daysAgo(Number(preset) - 1), to: daysAgo(0) };
  const params = { from: range.from, to: range.to, client, role };
  const { data, loading, error, reload } = useFetch(`/schools/${school.id}/activity`, params);
  const list = useFetch(`/schools/${school.id}/logins`, { ...params, skip: page * PAGE, limit: PAGE });
  useEffect(() => { setPage(0); }, [preset, custom.from, custom.to, client, role]);

  const maxDay = Math.max(1, ...(data?.logins.by_day || []).map((d) => d.count));
  const maxUse = Math.max(1, ...(data?.features || []).map((f) => f.count));
  const pages = Math.max(1, Math.ceil((list.data?.total || 0) / PAGE));

  return (
    <section aria-label="Usage and activity">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 style={serif} className="text-[24px] font-medium text-[#1F2433]">Usage & activity</h2>
          <p className="text-[13.5px] text-[#5B6070]">Who signed in, which features this school uses, and how many people use each app.</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#E2DDD1] bg-white p-3">
        <CalendarDays className="ml-1 h-4 w-4 text-[#6B7080]" />
        <div className="flex flex-wrap gap-1 rounded-lg bg-[#F4F1EA] p-1" role="group" aria-label="Period">
          {PRESETS.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setPreset(key)} aria-pressed={preset === key}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${preset === key ? 'bg-white text-[#2E2A6E] shadow-sm' : 'text-[#5B6070] hover:text-[#1F2433]'}`}>{label}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" aria-label="From date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} className={`${selectCls} w-40`} />
            <span className="text-[13px] text-[#6B7080]">to</span>
            <input type="date" aria-label="To date" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} className={`${selectCls} w-40`} />
          </div>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <select value={client} onChange={(e) => setClient(e.target.value)} aria-label="App or web" className={`${selectCls} w-44`}>{CLIENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Login type" className={`${selectCls} w-48`}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
      </div>

      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : (<div className="space-y-5">
        {!data.tracking.this_school && (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>This school's app is not sending activity to the platform yet, so everything below stays at zero. To connect it, the server needs the setting <code className="rounded bg-amber-100 px-1">PLATFORM_SCHOOL_CODE={school.code}</code>, and the mobile apps should send an <code className="rounded bg-amber-100 px-1">X-Client</code> header (see DEVELOPER_ROADMAP.md).</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Mini label="Sign-ins" value={num(data.logins.total)} hint={`${fmtDate(data.range.from)} to ${fmtDate(data.range.to)}`} />
          <Mini label="People signed in" value={num(data.logins.people)} hint="Different people, in this period" />
          <Mini label="Features used" value={num(data.features.length)} hint={`of ${num(school.features.length)} in the plan`} />
          <Mini label="Last sign-in" value={data.last_login_at ? fmtDate(data.last_login_at) : '—'} hint={data.last_login_at ? fmtDateTime(data.last_login_at) : 'No sign-in recorded yet'} />
        </div>

        <Card title="Mobile apps" subtitle="Activated = people who signed in on the app at least once.">
          <div className="grid gap-4 md:grid-cols-3">
            {data.apps.map((app) => (
              <div key={app.client} className="rounded-xl border border-[#E2DDD1] p-4">
                <div className="flex items-center justify-between"><p className="text-[14px] font-semibold text-[#1F2433]">{app.label}</p>{app.activated_in_range > 0 && <Pill tone="green">+{num(app.activated_in_range)} new</Pill>}</div>
                <p style={serif} className="mt-2 text-[34px] font-medium leading-none text-[#2E2A6E]">{num(app.activated_total)}</p>
                <p className="mt-1 text-[12.5px] text-[#6B7080]">people have activated it</p>
                <p className="mt-3 border-t border-[#F0ECE2] pt-3 text-[13px] text-[#2B3040]"><b>{num(app.active_in_range)}</b> active in this period</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12.5px] text-[#6B7080]">The number of downloads in the App Store and Google Play is only known to Apple and Google, so it cannot be shown here. Activations are the figure that matters: people who really use the app.</p>
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Sign-ins per day" className="lg:col-span-2">
            {data.logins.total === 0 ? <Empty>No sign-in in this period.</Empty> : (<>
              <div className="flex h-40 items-end gap-[3px]">
                {data.logins.by_day.map((d) => (
                  <div key={d.date} title={`${fmtDate(d.date)}: ${d.count} sign-in${d.count === 1 ? '' : 's'}`} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                    <div className="w-full rounded-t bg-[#3F3A8C]" style={{ height: `${(d.count * 100) / maxDay}%`, minHeight: d.count ? 3 : 1, opacity: d.count ? 1 : 0.2 }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[12px] text-[#6B7080]"><span>{fmtDate(data.range.from)}</span><span>Busiest day: {maxDay}</span><span>{fmtDate(data.range.to)}</span></div>
            </>)}
          </Card>
          <Card title="Where and who">
            {data.logins.total === 0 ? <Empty>Nothing to show.</Empty> : (<div className="space-y-4 text-[13.5px]">
              <div><p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#6B7080]">By app</p>{data.logins.by_client.map((c) => <div key={c.client} className="flex justify-between py-0.5"><span>{c.label}</span><b>{num(c.count)}</b></div>)}</div>
              <div><p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#6B7080]">By login</p>{data.logins.by_role.map((r) => <div key={r.role} className="flex justify-between py-0.5"><span>{r.label}</span><b>{num(r.count)}</b></div>)}</div>
            </div>)}
          </Card>
        </div>

        <Card title="Features used" subtitle="How often each feature was used in this period, and by which logins.">
          {data.features.length === 0 ? <Empty>No feature use recorded in this period.</Empty> : (
            <TableWrap>
              <THead cols={['Feature', 'Times used', 'Used by', 'Days used', 'Last used']} />
              <tbody>
                {data.features.map((f) => (
                  <tr key={f.feature}>
                    <Td className="min-w-[230px] font-medium">{f.label}</Td>
                    <Td className="w-56"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-[#EEEAE0]"><div className="h-2 rounded-full bg-[#3F3A8C]" style={{ width: `${(f.count * 100) / maxUse}%` }} /></div><span className="w-12 text-right text-[13px]">{num(f.count)}</span></div></Td>
                    <Td><span className="flex flex-wrap gap-1.5">{f.roles.slice(0, 3).map((r) => <Pill key={r.role}>{r.label} · {num(r.count)}</Pill>)}{f.roles.length > 3 && <span className="text-[12px] text-[#6B7080]">+{f.roles.length - 3} more</span>}</span></Td>
                    <Td>{f.days_used}</Td>
                    <Td className="whitespace-nowrap">{fmtDateTime(f.last_used)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
          {data.unused_features.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[13px] font-medium text-[#2B3040]">In the plan, but not used in this period</p>
              <div className="flex flex-wrap gap-1.5">{data.unused_features.map((u) => <Pill key={u.feature} tone="amber">{u.label}</Pill>)}</div>
            </div>
          )}
        </Card>

        <Card title="Who signed in, and when" subtitle="Newest first. School staff logins are shown by role until each person has their own account.">
          {list.loading && !list.data ? <Loading /> : list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : list.data.items.length === 0 ? <Empty>No sign-in recorded in this period.</Empty> : (<>
            <TableWrap>
              <THead cols={['When', 'Who', 'Login type', 'Signed in on', 'IP address']} />
              <tbody>
                {list.data.items.map((row) => (
                  <tr key={row.id}>
                    <Td className="whitespace-nowrap">{fmtDateTime(row.at)}</Td>
                    <Td className="font-medium">{row.user_label || row.role_label}</Td>
                    <Td>{row.role_label}</Td>
                    <Td><Pill tone={row.client === 'web' ? 'gray' : 'indigo'}>{row.client_label}</Pill></Td>
                    <Td className="text-[12.5px] text-[#6B7080]">{row.ip || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <div className="mt-3 flex items-center justify-between text-[13px] text-[#5B6070]">
              <span>{num(list.data.total)} sign-ins · page {page + 1} of {pages}</span>
              <span className="flex gap-2">
                <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[#DAD6CC] bg-white px-3 py-1.5 font-medium disabled:opacity-40">Previous</button>
                <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[#DAD6CC] bg-white px-3 py-1.5 font-medium disabled:opacity-40">Next</button>
              </span>
            </div>
          </>)}
        </Card>
      </div>)}
    </section>
  );
};

export default ActivityPanel;
