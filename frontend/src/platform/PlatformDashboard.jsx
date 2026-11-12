import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BellRing, Building2, CalendarClock, CheckCircle2, CircleDollarSign, FileWarning, Handshake, LifeBuoy, MessageCircle, Plus, Receipt, Users, Wallet,
} from 'lucide-react';
import useFetch from './useFetch';
import { Empty, ErrorBox, Loading, Pill, fmtDate, fmtDateTime, inr, num, serif, shortInr } from './ui';

const PLAN_LABEL = { essential: 'Essential', pro: 'Pro', premium: 'Premium' };
const PLAN_COLOR = { essential: '#A39E8F', pro: '#6E69C9', premium: '#059669' };
const STAGES = ['New lead', 'Visited', 'Demo done', 'Proposal sent', 'Negotiation', 'Won', 'Lost'];
const STAGE_COLOR = { 'New lead': '#6B7080', Visited: '#3157C8', 'Demo done': '#6D3FA8', 'Proposal sent': '#B45309', Negotiation: '#C2410C', Won: '#047857', Lost: '#B91C1C' };
const TONE = {
  red: { bar: '#DC2626', bg: '#FDF2F2', icon: '#B91C1C' },
  amber: { bar: '#F59E0B', bg: '#FEF7E8', icon: '#B45309' },
  blue: { bar: '#3F3A8C', bg: '#F6F4FC', icon: '#3F3A8C' },
};
const monthName = (key) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' });

const Tile = ({ icon: Icon, label, value, hint, accent, to }) => {
  const body = (
    <div className="relative h-full overflow-hidden rounded-2xl border border-[#E2DDD1] bg-white px-5 py-4 transition hover:shadow-md">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      <div className="flex items-center justify-between"><p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7080]">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${accent}18`, color: accent }}><Icon className="h-[18px] w-[18px]" /></span></div>
      <p style={serif} className="mt-2 text-[30px] font-medium leading-none text-[#1F2433]">{value}</p>
      <p className="mt-2 text-[12.5px] leading-5 text-[#6B7080]">{hint}</p>
    </div>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
};

const Panel = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`rounded-2xl border border-[#E2DDD1] bg-white ${className}`}>
    <header className="flex items-start justify-between gap-3 px-5 pt-4">
      <div><h2 style={serif} className="text-[19px] font-medium text-[#1F2433]">{title}</h2>{subtitle && <p className="text-[12.5px] text-[#6B7080]">{subtitle}</p>}</div>
      {action}
    </header>
    <div className="p-5 pt-4">{children}</div>
  </section>
);
const More = ({ to, children }) => <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-[#3F3A8C] hover:underline">{children}<ArrowRight className="h-3.5 w-3.5" /></Link>;
const Soft = ({ loading, error, children }) => (loading ? <p className="py-6 text-center text-[13px] text-[#8A8F9C]">Loading…</p> : error ? <p className="py-6 text-center text-[13px] text-[#8A8F9C]">Not available right now.</p> : children);

const Donut = ({ segments, total, label }) => {
  const r = 46; const c = 2 * Math.PI * r; let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0" role="img" aria-label={`${total} ${label}`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#EEEAE0" strokeWidth="14" />
      {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
        const len = (s.value / total) * c; const el = (
          <circle key={s.key} cx="60" cy="60" r={r} fill="none" stroke={s.color} strokeWidth="14" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />
        ); offset += len; return el;
      })}
      <text x="60" y="58" textAnchor="middle" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fill: '#1F2433' }}>{total}</text>
      <text x="60" y="76" textAnchor="middle" style={{ fontSize: 10, fill: '#6B7080' }}>{label}</text>
    </svg>
  );
};

const PlatformDashboard = () => {
  const dash = useFetch('/dashboard');
  const leads = useFetch('/leads', { limit: 1 });
  const tickets = useFetch('/tickets', { limit: 6 });
  const urgent = useFetch('/tickets', { priority: 'Urgent', limit: 5 });
  const usage = useFetch('/usage');
  const fin = useFetch('/finance/overview');
  const since = useFetch('/changes');
  if (dash.loading && !dash.data) return <Loading />;
  if (dash.error) return <ErrorBox message={dash.error} onRetry={dash.reload} />;
  const d = dash.data;
  const sales = leads.data?.summary;
  const tc = tickets.data?.counts || {};
  const openTickets = (tc.New || 0) + (tc['In progress'] || 0) + (tc['Waiting for school'] || 0);
  const urgentOpen = (urgent.data?.items || []).filter((t) => !['Resolved', 'Closed'].includes(t.status));

  // everything that needs a decision, most serious first
  const attention = [];
  d.overdue_invoices.forEach((i) => attention.push({ sev: 3, icon: FileWarning, tone: 'red', title: `Invoice ${i.number} is ${i.days_overdue} ${i.days_overdue === 1 ? 'day' : 'days'} overdue`, detail: `${i.school_name} · ${inr(i.total)}`, to: '/platform/invoices' }));
  d.renewals_due.forEach((r) => attention.push({ sev: r.days < 0 ? 3 : 2, icon: CalendarClock, tone: r.days < 0 ? 'red' : 'amber', title: r.days < 0 ? `${r.name}'s contract ended ${-r.days} days ago` : r.days === 0 ? `${r.name}'s contract ends today` : `${r.name}'s contract ends in ${r.days} days`, detail: `Contract end date: ${fmtDate(r.contract_end)}`, to: `/platform/schools/${r.id}` }));
  d.at_risk.forEach((s) => s.reasons.filter((x) => x !== 'Invoice overdue').forEach((x) => attention.push({ sev: 1, icon: Building2, tone: 'amber', title: `${s.name}: ${x.toLowerCase()}`, detail: 'The school may be slipping away. Give them a call.', to: `/platform/schools/${s.id}` })));
  urgentOpen.forEach((t) => attention.push({ sev: 3, icon: LifeBuoy, tone: 'red', title: `Urgent: ${t.subject}`, detail: `${t.school_name} · ${t.reporter.name} · ${t.status}`, to: `/platform/support/${t.id}` }));
  const newOthers = (tc.New || 0) - urgentOpen.filter((t) => t.status === 'New').length; // urgent ones are already listed above
  if (newOthers > 0) attention.push({ sev: 2, icon: LifeBuoy, tone: 'amber', title: `${newOthers} new support ${newOthers === 1 ? 'ticket is' : 'tickets are'} waiting`, detail: 'Nobody has picked them up yet.', to: '/platform/support' });
  if (sales?.follow_ups.overdue > 0) attention.push({ sev: 2, icon: Handshake, tone: 'amber', title: `${sales.follow_ups.overdue} sales ${sales.follow_ups.overdue === 1 ? 'follow-up is' : 'follow-ups are'} overdue`, detail: (leads.data.due || []).filter((r) => r.follow_up_overdue).slice(0, 3).map((r) => `${r.school_name} (${r.owner_name})`).join(', '), to: '/platform/sales' });
  (usage.data?.schools || []).filter((u) => u.whatsapp_level !== 'ok').forEach((u) => attention.push({ sev: u.whatsapp_level === 'over' ? 3 : 2, icon: MessageCircle, tone: u.whatsapp_level === 'over' ? 'red' : 'amber', title: `${u.name} has used ${Math.round(u.whatsapp_percent)}% of its WhatsApp messages`, detail: `${num(u.whatsapp_used)} of ${num(u.whatsapp_limit)} this month`, to: `/platform/schools/${u.id}` }));
  attention.sort((a, b) => b.sev - a.sev);

  const planSegments = Object.entries(d.by_plan).map(([key, value]) => ({ key, value, color: PLAN_COLOR[key] }));
  const livePlans = planSegments.reduce((a, s) => a + s.value, 0);
  const maxNew = Math.max(1, ...d.new_schools_by_month.map((m) => m.count));
  const maxStage = Math.max(1, ...(sales ? STAGES.map((s) => sales.by_stage[s]) : [1]));
  const maxArr = Math.max(1, ...Object.values(d.arr_by_plan));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 style={serif} className="text-[30px] font-medium leading-tight text-[#1F2433]">Dashboard</h1>
          <p className="mt-1 text-[14px] text-[#5B6070]">How Orison is doing across schools, money, sales and support.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[['/platform/schools', Plus, 'Add a school', true], ['/platform/sales', Handshake, 'Sales pipeline'], ['/platform/invoices', Receipt, 'Invoices']].map(([to, Icon, label, primary]) => (
            <Link key={to} to={to} className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[14px] font-medium transition ${primary ? 'bg-[#2E2A6E] text-white hover:bg-[#24205A]' : 'border border-[#DAD6CC] bg-white text-[#2B3040] hover:bg-[#F4F1EA]'}`}><Icon className="h-4 w-4" />{label}</Link>
          ))}
        </div>
      </div>

      {since.data && (
        <section className="mb-6 rounded-2xl border border-[#E2DDD1] bg-white p-5" aria-label="Since yesterday">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#6B7080]">Yesterday, {fmtDate(since.data.date)}</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {since.data.items.map((i) => (
              <li key={i.key}><Link to={i.to} className="block rounded-xl bg-[#FAF8F3] px-3.5 py-2.5 transition hover:bg-[#F4F1EA]">
                <p style={serif} className={`text-[22px] font-medium leading-none ${i.warn && i.value > 0 ? 'text-[#B91C1C]' : 'text-[#1F2433]'}`}>{i.money === true ? shortInr(i.value) : num(i.value)}</p>
                <p className="mt-1.5 text-[12px] text-[#6B7080]">{i.label}{i.money && i.money !== true && i.value > 0 ? ` · ${shortInr(i.money)}` : ''}</p>
              </Link></li>))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Tile icon={Building2} label="Schools" value={num(d.schools_total)} accent="#3F3A8C" to="/platform/schools"
          hint={`${d.by_status.Active} active · ${d.by_status.Trial} on trial${d.by_status.Suspended + d.by_status.Expired ? ` · ${d.by_status.Suspended + d.by_status.Expired} stopped` : ''}`} />
        <Tile icon={Users} label="Students" value={num(d.students_total)} accent="#0E7490" hint="In active and trial schools" />
        <Tile icon={Wallet} label="Yearly revenue" value={shortInr(d.annual_recurring_revenue)} accent="#059669" to="/platform/invoices" hint={`${inr(d.monthly_recurring_revenue)} a month · before GST`} />
        <Tile icon={Receipt} label="Unpaid invoices" value={shortInr(d.unpaid_amount)} to="/platform/invoices" accent={d.overdue_invoices.length ? '#DC2626' : d.unpaid_invoices ? '#F59E0B' : '#10B981'}
          hint={d.unpaid_invoices ? `${d.unpaid_invoices} unpaid${d.overdue_invoices.length ? `, ${d.overdue_invoices.length} overdue (${shortInr(d.overdue_amount)})` : ''}` : 'Nothing unpaid'} />
        <Tile icon={CircleDollarSign} label="Sales pipeline" value={sales ? shortInr(sales.pipeline_value) : '—'} accent="#C2410C" to="/platform/sales"
          hint={sales ? `${sales.open} open schools · ${sales.follow_ups.overdue + sales.follow_ups.today} follow-ups due` : 'Loading…'} />
        <Tile icon={LifeBuoy} label="Open tickets" value={tickets.data ? num(openTickets) : '—'} accent={urgentOpen.length ? '#DC2626' : openTickets ? '#F59E0B' : '#10B981'} to="/platform/support"
          hint={tickets.data ? (urgentOpen.length ? `${urgentOpen.length} urgent` : openTickets ? 'None urgent' : 'All answered') : 'Loading…'} />
      </div>

      <div className="mt-6">
        <Panel title="Accounts" subtitle="Money to collect, the sales team's travel, and what your accounts team is waiting on" action={<More to="/platform/finance">Open the Accounts desk</More>}>
          <Soft loading={fin.loading} error={fin.error}>
            {fin.data && (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  {[
                    ['Still to collect', shortInr(fin.data.collections.outstanding), `${shortInr(fin.data.collections.overdue)} overdue`, '/platform/finance/collections', fin.data.collections.overdue ? 'text-[#B91C1C]' : ''],
                    ['Received this month', shortInr(fin.data.collections.received_this_month), 'ERP and other products', '/platform/finance/collections', ''],
                    ['To chase today', num(fin.data.chase), `${fin.data.collections.promises_overdue} promises missed`, '/platform/finance', fin.data.collections.promises_overdue ? 'text-[#B91C1C]' : ''],
                    ['Travel this month', `${num(fin.data.travel.km)} km`, `${inr(fin.data.travel.to_pay)} still to pay at ₹${fin.data.travel.rate}/km`, '/platform/finance/travel', ''],
                    ['Salaries to pay', shortInr(fin.data.payroll.to_pay), `Company expenses this month ${shortInr(fin.data.company_expenses)}`, '/platform/finance/payroll', fin.data.payroll.to_pay ? 'text-[#B45309]' : ''],
                  ].map(([k, v, h, to, tone]) => (
                    <Link key={k} to={to} className="rounded-xl border border-[#E2DDD1] bg-[#FAF8F3] px-4 py-3 transition hover:bg-white">
                      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[#6B7080]">{k}</p>
                      <p style={serif} className={`mt-1 text-[24px] font-medium leading-none ${tone || 'text-[#1F2433]'}`}>{v}</p>
                      <p className="mt-1.5 text-[12px] text-[#6B7080]">{h}</p>
                    </Link>
                  ))}
                </div>
                {(fin.data.claims_pending > 0 || fin.data.payroll.drafts > 0 || fin.data.reports_unseen > 0 || fin.data.travel.missing > 0) && (
                  <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[#4A4F5C]">
                    {fin.data.reports_unseen > 0 && <Link to="/platform/finance/reports" className="font-medium text-[#2E2A6E] hover:underline">{fin.data.reports_unseen} new report from Accounts</Link>}
                    {fin.data.claims_pending > 0 && <Link to="/platform/finance/travel" className="hover:underline">{fin.data.claims_pending} expense claim{fin.data.claims_pending === 1 ? '' : 's'} waiting for review</Link>}
                    {fin.data.payroll.drafts > 0 && <Link to="/platform/finance/payroll" className="hover:underline">{fin.data.payroll.drafts} salar{fin.data.payroll.drafts === 1 ? 'y' : 'ies'} waiting for approval</Link>}
                    {fin.data.travel.missing > 0 && <Link to="/platform/finance/travel" className="text-[#B45309] hover:underline">{fin.data.travel.missing} travel distance{fin.data.travel.missing === 1 ? '' : 's'} to check</Link>}
                  </p>
                )}
                {fin.data.top_overdue.length > 0 && (
                  <ul className="mt-3 divide-y divide-[#F0ECE2] text-[13.5px]">
                    {fin.data.top_overdue.map((i) => <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><b className="text-[#1F2433]">{i.school_name}</b> <span className="text-[#6B7080]">· {i.product} · {i.days_overdue} days late</span></span><span className="font-medium">{inr(i.outstanding)}{i.next_promise ? <span className="ml-2 text-[12px] font-normal text-[#6B7080]">promised {fmtDate(i.next_promise.promised_on)}</span> : <span className="ml-2 text-[12px] font-normal text-[#B91C1C]">no promise</span>}</span></li>)}
                  </ul>
                )}
              </>
            )}
          </Soft>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Needs your attention" subtitle={attention.length ? `${attention.length} ${attention.length === 1 ? 'thing' : 'things'}, most serious first` : undefined}>
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-4 text-emerald-900"><CheckCircle2 className="h-6 w-6 shrink-0" /><div><p className="text-[15px] font-semibold">All clear</p><p className="text-[13.5px]">No overdue invoices, renewals, urgent tickets or late follow-ups right now.</p></div></div>
          ) : (
            <ul className="grid gap-2.5 lg:grid-cols-2">
              {attention.slice(0, 8).map((a, i) => { const t = TONE[a.tone]; const Icon = a.icon; return (
                <li key={`${a.title}${i}`}>
                  <Link to={a.to} className="flex items-start gap-3 rounded-xl border border-transparent px-3.5 py-3 transition hover:border-[#E2DDD1]" style={{ background: t.bg, borderLeft: `4px solid ${t.bar}` }}>
                    <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" style={{ color: t.icon }} />
                    <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold leading-5 text-[#1F2433]">{a.title}</span>{a.detail && <span className="block truncate text-[12.5px] text-[#5B6070]">{a.detail}</span>}</span>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#8A8F9C]" />
                  </Link>
                </li>
              ); })}
            </ul>
          )}
          {attention.length > 8 && <p className="mt-3 text-[12.5px] text-[#6B7080]">And {attention.length - 8} more. Fix the ones above first.</p>}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Schools and revenue" subtitle="Active and trial schools by plan, and the yearly subscription each plan brings">
          <div className="flex flex-wrap items-center gap-6">
            <Donut segments={planSegments} total={livePlans} label="schools" />
            <ul className="min-w-[200px] flex-1 space-y-3.5">
              {Object.keys(PLAN_LABEL).map((k) => (
                <li key={k}>
                  <div className="flex items-baseline justify-between text-[13.5px]"><span className="flex items-center gap-2 font-medium text-[#1F2433]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAN_COLOR[k] }} />{PLAN_LABEL[k]}<span className="font-normal text-[#6B7080]">{d.by_plan[k]} {d.by_plan[k] === 1 ? 'school' : 'schools'}</span></span><b>{shortInr(d.arr_by_plan[k])}</b></div>
                  <div className="mt-1 h-2 rounded-full bg-[#EEEAE0]"><div className="h-2 rounded-full" style={{ width: `${(d.arr_by_plan[k] * 100) / maxArr}%`, background: PLAN_COLOR[k] }} /></div>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6 border-t border-[#F0ECE2] pt-5">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#6B7080]">New schools, last 6 months</p>
            <div className="flex h-28 items-end gap-3">
              {d.new_schools_by_month.map((m) => (
                <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${m.count} new in ${monthName(m.month)}`}>
                  <span className="text-[12px] font-medium text-[#1F2433]">{m.count}</span>
                  <div className="w-full rounded-t-md bg-[#3F3A8C]" style={{ height: `${(m.count * 100) / maxNew}%`, minHeight: m.count ? 5 : 2, opacity: m.count ? 1 : 0.2 }} />
                  <span className="text-[11.5px] text-[#6B7080]">{monthName(m.month)}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Sales pipeline" subtitle={sales ? `${shortInr(sales.pipeline_value)} quoted across ${sales.open} open schools` : undefined} action={<More to="/platform/sales">Open pipeline</More>}>
          <Soft loading={leads.loading && !leads.data} error={leads.error}>
            {sales && (<>
              <ul className="space-y-2.5">
                {STAGES.map((st) => (
                  <li key={st} className="flex items-center gap-3 text-[13px]">
                    <span className="w-28 shrink-0 text-[#4A4F5C]">{st}</span>
                    <div className="h-5 flex-1 rounded-md bg-[#F4F1EA]"><div className="h-5 rounded-md" style={{ width: `${(sales.by_stage[st] * 100) / maxStage}%`, minWidth: sales.by_stage[st] ? 22 : 0, background: STAGE_COLOR[st] }} /></div>
                    <b className="w-6 text-right text-[#1F2433]">{sales.by_stage[st]}</b>
                  </li>
                ))}
              </ul>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                {[['Won in 30 days', sales.won_30d], ['Visits in 30 days', sales.visits_30d], ['Follow-ups due', sales.follow_ups.overdue + sales.follow_ups.today]].map(([k, v]) => <div key={k} className="rounded-xl bg-[#F8F5EE] px-2 py-3"><p style={serif} className="text-[22px] leading-none text-[#1F2433]">{v}</p><p className="mt-1.5 text-[11.5px] text-[#6B7080]">{k}</p></div>)}
              </div>
              {leads.data.due.length > 0 && (
                <div className="mt-5 border-t border-[#F0ECE2] pt-4"><p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#6B7080]">To follow up</p>
                  <ul className="space-y-2">{leads.data.due.slice(0, 3).map((r) => <li key={r.id} className="flex items-center justify-between gap-3 text-[13.5px]"><Link to={`/platform/sales/${r.id}`} className="min-w-0 truncate font-medium text-[#2E2A6E] hover:underline">{r.school_name}</Link><span className="flex shrink-0 items-center gap-2 text-[12.5px] text-[#6B7080]">{r.owner_name}<Pill tone={r.follow_up_overdue ? 'red' : 'amber'}>{r.follow_up_overdue ? 'Overdue' : 'Today'}</Pill></span></li>)}</ul></div>
              )}
            </>)}
          </Soft>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Support tickets" subtitle="Help requests and error reports from schools and parents" action={<More to="/platform/support">All tickets</More>}>
          <Soft loading={tickets.loading && !tickets.data} error={tickets.error}>
            <div className="mb-4 flex flex-wrap gap-2">
              {['New', 'In progress', 'Waiting for school', 'Resolved'].map((s) => <span key={s} className="rounded-full border border-[#E2DDD1] bg-[#FAF8F3] px-3 py-1 text-[12.5px] text-[#4A4F5C]">{s} <b className="text-[#1F2433]">{tc[s] || 0}</b></span>)}
            </div>
            {tickets.data && tickets.data.items.length === 0 ? <Empty>No tickets yet.</Empty> : (
              <ul className="divide-y divide-[#F0ECE2]">
                {(tickets.data?.items || []).slice(0, 5).map((t) => (
                  <li key={t.id}><Link to={`/platform/support/${t.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-[#FAF8F3]">
                    <span className="min-w-0"><span className="block truncate text-[14px] font-medium text-[#1F2433]">{t.subject}</span><span className="block truncate text-[12.5px] text-[#6B7080]">{t.school_name} · {t.reporter.name} · {fmtDateTime(t.created_at)}</span></span>
                    <span className="flex shrink-0 items-center gap-1.5"><Pill tone={t.priority === 'Urgent' ? 'red' : 'gray'}>{t.priority}</Pill><Pill tone={t.status === 'New' ? 'indigo' : t.status === 'Resolved' || t.status === 'Closed' ? 'green' : 'amber'}>{t.status}</Pill></span>
                  </Link></li>
                ))}
              </ul>
            )}
          </Soft>
        </Panel>

        <Panel title="Latest from the sales team" subtitle="Visits, calls and demos" action={<More to="/platform/sales">Sales pipeline</More>}>
          <Soft loading={leads.loading && !leads.data} error={leads.error}>
            {leads.data && leads.data.recent.length === 0 ? <Empty>No visits logged yet.</Empty> : (
              <ul className="space-y-3.5">
                {(leads.data?.recent || []).slice(0, 5).map((a, i) => (
                  <li key={`${a.lead_id}${i}`} className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEEAF8] text-[13px] font-semibold text-[#3F3A8C]">{(a.by || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                    <div className="min-w-0 text-[13.5px] leading-5"><p><b>{a.by}</b> · {a.type.toLowerCase()} · <Link to={`/platform/sales/${a.lead_id}`} className="font-medium text-[#2E2A6E] hover:underline">{a.school_name}</Link></p>
                      <p className="truncate text-[#5B6070]">{a.summary}</p><p className="text-[12px] text-[#8A8F9C]">{fmtDate(a.date)}</p></div></li>
                ))}
              </ul>
            )}
          </Soft>
        </Panel>
      </div>
    </>
  );
};

export default PlatformDashboard;
