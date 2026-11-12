"""Orison platform admin: extras that make each login stronger.

* Sales: monthly targets and progress, and a daily follow-up email.
* Owner: a "since yesterday" summary and a weekly email.
* Accounts: GST sheet, salary register, payslips, invoice emails.
* Developer: a health and tickets overview, release notes and known issues.
"""
import asyncio
import csv
import io
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from platform_admin import (PHYSICAL, ROLE_PERMISSIONS, _iso, _now, _stamp, audit, clean, client_ip, get_settings, ist_date, ist_range_to_utc, pdb, platform_router, require_owner, require_perm,
                            require_staff, today_ist, valid_date, with_balance)
from platform_finance import finance_router, month_range, money, this_month, travel_sheet, build_report, collections_data
from platform_finance_more import send_mail_sync, smtp_settings


# ---------------------------------------------------------------- sales targets
class TargetBody(BaseModel):
    owner_id: str
    month: str = ''
    visits: int = Field(default=0, ge=0, le=1000)
    won_value: float = Field(default=0, ge=0, le=1000000000)


async def target_progress(month: str, only_owner: str = '') -> List[dict]:
    start, end = month_range(month)
    users = [u for u in await pdb.platform_users.find({'role': 'sales', 'active': True}).sort('name', 1).to_list(200) if not only_owner or u['id'] == only_owner]
    rows = await pdb.platform_leads.find({}).to_list(20000)
    targets = {t['owner_id']: t for t in await pdb.platform_targets.find({'month': month}).to_list(500)}
    out = []
    for u in users:
        visits = days = 0
        seen_days = set()
        won = 0.0
        new_schools = 0
        for lead in rows:
            if lead['owner_id'] == u['id']:
                if start <= ist_date(lead.get('created_at', '')) <= end:
                    new_schools += 1
                if lead['stage'] == 'Won' and start <= ist_date(lead.get('won_at') or lead.get('updated_at', '')) <= end:
                    won += float(lead.get('quoted_total') or 0)
            for a in lead.get('activities', []):
                if a['by_id'] == u['id'] and a['type'] in PHYSICAL and start <= a['date'] <= end:
                    visits += 1
                    seen_days.add(a['date'])
        t = targets.get(u['id'], {})
        out.append({'owner_id': u['id'], 'name': u['name'], 'visits': visits, 'days_on_road': len(seen_days), 'new_schools': new_schools, 'won_value': money(won),
                    'target_visits': t.get('visits', 0), 'target_won_value': t.get('won_value', 0),
                    'visits_percent': round(visits / t['visits'] * 100) if t.get('visits') else None, 'won_percent': round(won / t['won_value'] * 100) if t.get('won_value') else None})
    return out


@platform_router.get('/targets')
async def get_targets(month: str = '', user: dict = Depends(require_perm('leads:own'))):
    month = month or this_month()
    owner_view = '*' in ROLE_PERMISSIONS.get(user['role'], set())
    return {'month': month, 'owner_view': owner_view, 'items': await target_progress(month, '' if owner_view else user['id'])}


@platform_router.put('/targets')
async def set_target(body: TargetBody, request: Request, user: dict = Depends(require_owner)):
    month = body.month or this_month()
    month_range(month)
    person = await pdb.platform_users.find_one({'id': body.owner_id, 'role': 'sales'})
    if not person:
        raise HTTPException(422, 'Choose a salesperson.')
    await pdb.platform_targets.replace_one({'owner_id': body.owner_id, 'month': month}, {'owner_id': body.owner_id, 'month': month, 'visits': body.visits, 'won_value': money(body.won_value), 'set_by': user['name'], 'at': _stamp()}, upsert=True)
    await audit(user, 'target_set', f'{month}:{body.owner_id}', {'who': person['name'], 'month': month, 'visits': body.visits, 'won_value': body.won_value}, client_ip(request))
    return (await target_progress(month, body.owner_id))[0]


# ---------------------------------------------------------------- the owner's "since yesterday"
@platform_router.get('/changes')
async def changes_since_yesterday(user: dict = Depends(require_perm('dashboard:read'))):
    today = today_ist()
    yday = (datetime.strptime(today, '%Y-%m-%d') - timedelta(days=1)).strftime('%Y-%m-%d')
    lo, hi = ist_range_to_utc(yday, yday)
    rng = {'$gte': lo, '$lte': hi}
    leads = await pdb.platform_leads.find({}).to_list(20000)
    visits = sum(1 for l in leads for a in l.get('activities', []) if a['type'] in PHYSICAL and a['date'] == yday)
    new_leads = sum(1 for l in leads if ist_date(l.get('created_at', '')) == yday)
    won = [l for l in leads if l['stage'] == 'Won' and ist_date(l.get('won_at') or '') == yday]
    paid = 0.0
    invoiced = 0.0
    for inv in await pdb.platform_invoices.find({}).to_list(10000):
        paid += sum(float(p['amount']) for p in inv.get('payments', []) if p['date'] == yday)
        if inv.get('issued_on') == yday and inv.get('status') != 'Cancelled':
            invoiced += float(inv['total'])
    items = [
        {'key': 'visits', 'label': 'Schools visited', 'value': visits, 'to': '/platform/sales'},
        {'key': 'new_leads', 'label': 'New schools added by Sales', 'value': new_leads, 'to': '/platform/sales'},
        {'key': 'won', 'label': 'Schools won', 'value': len(won), 'to': '/platform/sales', 'money': money(sum(float(l.get('quoted_total') or 0) for l in won))},
        {'key': 'received', 'label': 'Money received', 'value': money(paid), 'money': True, 'to': '/platform/finance/collections'},
        {'key': 'invoiced', 'label': 'Invoices raised', 'value': money(invoiced), 'money': True, 'to': '/platform/invoices'},
        {'key': 'claims', 'label': 'Expense claims sent', 'value': await pdb.platform_expenses.count_documents({'source': 'claim', 'at': rng}), 'to': '/platform/finance/travel'},
        {'key': 'tickets', 'label': 'Support tickets opened', 'value': await pdb.platform_tickets.count_documents({'created_at': rng}), 'to': '/platform/support'},
        {'key': 'failed', 'label': 'Failed sign-in attempts', 'value': await pdb.platform_audit.count_documents({'action': {'$in': ['login_failed', 'login_blocked']}, 'at': rng}), 'to': '/platform/audit', 'warn': True},
    ]
    return {'date': yday, 'items': items}


# ---------------------------------------------------------------- GST sheet, salary register, payslip
@finance_router.get('/gst.csv')
async def gst_sheet(month: str = '', user: dict = Depends(require_perm('finance:read'))):
    """What was billed in the month and the GST on it, for the accountant or the GST return. Credit notes come out as negative lines."""
    month = month or this_month()
    start, end = month_range(month)
    settings = await get_settings()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([f"GST sheet {month}", settings.get('company_name', ''), f"GSTIN: {settings.get('gstin', '') or 'not added'}"])
    w.writerow(['Date', 'Document', 'Type', 'School', 'Invoice', 'Taxable value', 'GST %', 'GST', 'Total'])
    tt = tg = tn = 0.0
    for inv in sorted(await pdb.platform_invoices.find({'status': {'$ne': 'Cancelled'}}).to_list(10000), key=lambda r: r.get('issued_on', '')):
        if start <= inv.get('issued_on', '') <= end:
            w.writerow([inv['issued_on'], inv['number'], 'Tax invoice', inv['school_name'], inv['number'], inv['taxable'], inv['gst_percent'], inv['gst'], inv['total']])
            tt += inv['taxable']; tg += inv['gst']; tn += inv['total']
        for c in inv.get('credit_notes', []):
            if start <= c['date'] <= end:
                pct = float(inv.get('gst_percent') or 0)
                taxable = money(c['amount'] / (1 + pct / 100)) if pct else money(c['amount'])
                gst = money(c['amount'] - taxable)
                w.writerow([c['date'], c['number'], 'Credit note', inv['school_name'], inv['number'], -taxable, pct, -gst, -c['amount']])
                tt -= taxable; tg -= gst; tn -= c['amount']
    w.writerow([])
    w.writerow(['', '', '', '', 'TOTAL', money(tt), '', money(tg), money(tn)])
    return Response(buf.getvalue(), media_type='text/csv', headers={'Content-Disposition': f'attachment; filename="gst-{month}.csv"'})


@finance_router.get('/payroll.csv')
async def salary_register(month: str = '', user: dict = Depends(require_perm('finance:read'))):
    month = month or this_month()
    month_range(month)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([f'Salary register {month}'])
    w.writerow(['Employee', 'Role', 'Salary', 'Additions', 'Deductions', 'Reason', 'Net', 'Paid', 'Balance', 'Status', 'Payments (date, mode, reference, amount)'])
    total = paid_total = 0.0
    for r in await pdb.platform_salaries.find({'month': month}).sort('employee_name', 1).to_list(1000):
        paid = money(sum(p['amount'] for p in r.get('payments', [])))
        w.writerow([r['employee_name'], r.get('designation', ''), r['base'], r['additions'], r['deductions'], r.get('note', ''), r['net'], paid, money(r['net'] - paid), r['status'],
                    '; '.join(f"{p['date']} {p['mode']} {p.get('reference', '')} {p['amount']}" for p in r.get('payments', []))])
        total += r['net']; paid_total += paid
    w.writerow([]); w.writerow(['TOTAL', '', '', '', '', '', money(total), money(paid_total), money(total - paid_total)])
    return Response(buf.getvalue(), media_type='text/csv', headers={'Content-Disposition': f'attachment; filename="salary-register-{month}.csv"'})


@finance_router.get('/payroll/{salary_id}/payslip')
async def payslip(salary_id: str, user: dict = Depends(require_perm('finance:read'))):
    row = await pdb.platform_salaries.find_one({'id': salary_id})
    if not row:
        raise HTTPException(404, 'Salary line not found.')
    emp = await pdb.platform_employees.find_one({'id': row['employee_id']}) or {}
    settings = await get_settings()
    paid = money(sum(p['amount'] for p in row.get('payments', [])))
    return {'company': {'name': settings.get('company_name', ''), 'address': settings.get('address', ''), 'gstin': settings.get('gstin', '')}, 'month': row['month'],
            'employee': {'name': row['employee_name'], 'designation': row.get('designation', ''), 'joined_on': emp.get('joined_on', ''), 'pay_note': emp.get('pay_note', '')},
            'base': row['base'], 'additions': row['additions'], 'deductions': row['deductions'], 'note': row.get('note', ''), 'net': row['net'], 'paid': paid, 'balance': money(row['net'] - paid),
            'status': row['status'], 'payments': [{k: p.get(k, '') for k in ('date', 'mode', 'reference', 'amount')} for p in row.get('payments', [])]}


# ---------------------------------------------------------------- email an invoice to the school
@finance_router.post('/invoices/{invoice_id}/email')
async def email_invoice(invoice_id: str, request: Request, user: dict = Depends(require_staff('finance:write'))):
    cfg = smtp_settings()
    if not cfg:
        raise HTTPException(422, 'Email is not set up on the server yet (SMTP settings). You can print the invoice and send it yourself.')
    inv = await pdb.platform_invoices.find_one({'id': invoice_id})
    if not inv:
        raise HTTPException(404, 'Invoice not found.')
    school = await pdb.schools.find_one({'id': inv['school_id']}) or {}
    to = (school.get('contact_email') or '').strip()
    if not to:
        raise HTTPException(422, "This school has no contact email. Add one on the school's page first.")
    settings = await get_settings()
    v = with_balance(clean(dict(inv)))
    lines = [f"Dear {school.get('contact_name') or 'Sir or Madam'},", '', f"Please find the details of invoice {inv['number']} from {settings.get('company_name', 'Orison Services')}.", '',
             f"School: {inv['school_name']}", f"Invoice date: {inv['issued_on']}    Due date: {inv['due_on']}"]
    if inv.get('kind') == 'product':
        lines.append(f"{inv.get('product_label')}: {inv.get('description', '')} ({inv.get('quantity')} x Rs {inv.get('rate'):,.2f})")
    else:
        lines.append(f"ERP {str(inv.get('plan', '')).title()} plan: {inv['students']} students x Rs {inv['rate_per_student']:,.2f}")
    lines += [f"Taxable value: Rs {inv['taxable']:,.2f}", f"GST {inv['gst_percent']}%: Rs {inv['gst']:,.2f}", f"Total: Rs {inv['total']:,.2f}"]
    if v['paid_amount']:
        lines.append(f"Received so far: Rs {v['paid_amount']:,.2f}    Balance: Rs {v['outstanding']:,.2f}")
    lines += ['', 'Please reply to this email with the payment reference once paid.', '', f"Regards,\n{settings.get('company_name', 'Orison Services')}"]
    try:
        await asyncio.to_thread(send_mail_sync, cfg, [to], f"Invoice {inv['number']} from {settings.get('company_name', 'Orison Services')}", '\n'.join(lines))
    except Exception as err:
        raise HTTPException(502, f'The email could not be sent: {str(err)[:120]}')
    await pdb.platform_invoices.update_one({'id': invoice_id}, {'$push': {'emails': {'to': to, 'at': _stamp(), 'by': user['name']}}})
    await audit(user, 'invoice_emailed', inv['number'], {'to': to}, client_ip(request))
    return {'sent_to': to}


# ---------------------------------------------------------------- developer: health and release notes
class ReleaseBody(BaseModel):
    kind: str = 'Release'
    version: str
    title: str
    notes: str = ''


RELEASE_KINDS = ['Release', 'Fix', 'Known issue']


@platform_router.get('/dev/overview')
async def dev_overview(user: dict = Depends(require_perm('tickets:read'))):
    now = _now()
    since = (now - timedelta(days=30)).isoformat(timespec='seconds')
    tickets = await pdb.platform_tickets.find({}).to_list(20000)
    open_t = [t for t in tickets if t['status'] not in ('Resolved', 'Closed')]
    def age(t): return max(0, (now - datetime.fromisoformat(t['created_at'][:19])).days)
    by_feature: Dict[str, dict] = {}
    by_school: Dict[str, dict] = {}
    for t in tickets:
        if t['created_at'] >= since:
            f = by_feature.setdefault(t.get('feature_label') or 'Not about a feature', {'feature': t.get('feature_label') or 'Not about a feature', 'tickets': 0, 'errors': 0})
            f['tickets'] += 1; f['errors'] += 1 if t.get('type') == 'Error / bug' else 0
            s = by_school.setdefault(t.get('school_name') or 'Unlinked school', {'school': t.get('school_name') or 'Unlinked school', 'tickets': 0, 'open': 0})
            s['tickets'] += 1; s['open'] += 1 if t['status'] not in ('Resolved', 'Closed') else 0
    resolved = [t for t in tickets if t.get('resolved_at')]
    hours = [(datetime.fromisoformat(t['resolved_at'][:19]) - datetime.fromisoformat(t['created_at'][:19])).total_seconds() / 3600 for t in resolved[-100:]]
    week_ago = (now - timedelta(days=7)).isoformat(timespec='seconds')
    health = []
    for s in await pdb.schools.find({'status': {'$in': ['Trial', 'Active']}}).sort('name', 1).to_list(500):
        logins = await pdb.platform_logins.count_documents({'school_id': s['id'], 'at': {'$gte': week_ago}})
        apps = await pdb.platform_app_users.count_documents({'school_id': s['id']})
        health.append({'school': s['name'], 'plan': s.get('plan', ''), 'last_login_at': s.get('last_login_at', ''), 'logins_7d': logins, 'app_users': apps, 'open_tickets': len([t for t in open_t if t.get('school_id') == s['id']]),
                       'quiet': logins == 0})
    releases = [clean(r) for r in await pdb.platform_releases.find({}).sort('at', -1).to_list(100)]
    return {'counts': {'open': len(open_t), 'urgent': len([t for t in open_t if t.get('priority') == 'Urgent']), 'new': len([t for t in open_t if t['status'] == 'New']), 'unassigned': len([t for t in open_t if not t.get('assigned_to')]),
                       'oldest_days': max([age(t) for t in open_t], default=0), 'opened_30d': len([t for t in tickets if t['created_at'] >= since]), 'resolved_30d': len([t for t in resolved if t['resolved_at'] >= since]),
                       'avg_hours_to_resolve': round(sum(hours) / len(hours), 1) if hours else None},
            'oldest': [{'id': t['id'], 'subject': t['subject'], 'school_name': t.get('school_name', ''), 'priority': t.get('priority'), 'status': t['status'], 'days': age(t)} for t in sorted(open_t, key=lambda t: -age(t))[:5]],
            'by_feature': sorted(by_feature.values(), key=lambda x: -x['tickets'])[:8], 'by_school': sorted(by_school.values(), key=lambda x: -x['tickets'])[:8], 'health': health, 'releases': releases}


@platform_router.post('/dev/releases')
async def add_release(body: ReleaseBody, request: Request, user: dict = Depends(require_perm('tickets:write'))):
    if body.kind not in RELEASE_KINDS:
        raise HTTPException(422, 'Choose Release, Fix or Known issue.')
    if len(body.version.strip()) < 1 or len(body.title.strip()) < 3:
        raise HTTPException(422, 'Write the version and a short title.')
    doc = {'id': f'REL-{uuid.uuid4().hex[:6].upper()}', 'kind': body.kind, 'version': body.version.strip()[:30], 'title': body.title.strip()[:120], 'notes': body.notes.strip()[:3000], 'by': user['name'], 'at': _stamp()}
    await pdb.platform_releases.insert_one(doc.copy())
    await audit(user, 'release_added', doc['id'], {'version': doc['version'], 'kind': doc['kind']}, client_ip(request))
    return doc


@platform_router.delete('/dev/releases/{release_id}')
async def delete_release(release_id: str, request: Request, user: dict = Depends(require_perm('tickets:write'))):
    row = await pdb.platform_releases.find_one({'id': release_id})
    if not row:
        raise HTTPException(404, 'Not found.')
    await pdb.platform_releases.delete_one({'id': release_id})
    await audit(user, 'release_deleted', release_id, {'version': row['version']}, client_ip(request))
    return {'ok': True}


# ---------------------------------------------------------------- daily emails to salespeople, weekly email to the owner
async def sales_digest_for(user: dict, today: str) -> Optional[str]:
    rows = await pdb.platform_leads.find({'owner_id': user['id'], 'stage': {'$nin': ['Won', 'Lost']}}).to_list(5000)
    due = sorted([r for r in rows if r.get('next_follow_up') and r['next_follow_up'] <= today], key=lambda r: r['next_follow_up'])
    if not due:
        return None
    lines = [f"Good morning {user['name'].split()[0]},", '', f"You have {len(due)} school follow-up(s) due today or overdue:", '']
    for r in due[:20]:
        c = (r.get('contacts') or [{}])[0]
        late = (datetime.strptime(today, '%Y-%m-%d') - datetime.strptime(r['next_follow_up'], '%Y-%m-%d')).days
        lines.append(f"- {r['school_name']}{' (' + r['city'] + ')' if r.get('city') else ''}: {r.get('follow_up_note') or 'follow up'}. {'Due today' if late == 0 else f'{late} day(s) overdue'}.{' Call ' + c.get('name', '') + ' ' + c.get('phone', '') if c.get('phone') else ''}")
    lines += ['', 'Open the Sales pipeline to log what happens.']
    return '\n'.join(lines)


async def send_sales_digests(force: bool = False) -> Dict[str, Any]:
    cfg = smtp_settings()
    if not cfg:
        return {'configured': False, 'sent': 0}
    today = today_ist()
    sent = 0
    for u in await pdb.platform_users.find({'role': 'sales', 'active': True}).to_list(200):
        if not u.get('email'):
            continue
        key = f"sales:{u['id']}"
        if not force and await pdb.platform_reminder_log.find_one({'date': today, 'kind': key, 'status': 'sent'}):
            continue
        text = await sales_digest_for(u, today)
        if not text:
            continue
        try:
            await asyncio.to_thread(send_mail_sync, cfg, [u['email']], f'Your school follow-ups for {today}', text)
            status = 'sent'; sent += 1
        except Exception:
            status = 'failed'
        await pdb.platform_reminder_log.insert_one({'id': f'RMD-{uuid.uuid4().hex[:6].upper()}', 'date': today, 'kind': key, 'at': _iso(), 'recipients': [u['email']], 'status': status})
    return {'configured': True, 'sent': sent}


async def weekly_text() -> str:
    today = today_ist()
    week = (datetime.strptime(today, '%Y-%m-%d') - timedelta(days=7)).strftime('%Y-%m-%d')
    month = today[:7]
    report = await build_report(month)
    coll = await collections_data(today)
    leads = await pdb.platform_leads.find({}).to_list(20000)
    visits = sum(1 for l in leads for a in l.get('activities', []) if a['type'] in PHYSICAL and week < a['date'] <= today)
    new_leads = sum(1 for l in leads if week < ist_date(l.get('created_at', '')) <= today)
    won = [l for l in leads if l['stage'] == 'Won' and week < ist_date(l.get('won_at') or '') <= today]
    tickets = await pdb.platform_tickets.find({}).to_list(20000)
    open_t = [t for t in tickets if t['status'] not in ('Resolved', 'Closed')]
    return '\n'.join([f'Orison weekly summary, week ending {today}', '', 'SALES', f'- {visits} school visits, {new_leads} new schools, {len(won)} won (Rs {sum(float(l.get("quoted_total") or 0) for l in won):,.0f})', '',
                      'MONEY', f"- Still to collect: Rs {coll['summary']['outstanding']:,.0f} (overdue Rs {coll['summary']['overdue']:,.0f})", f"- Received this month: Rs {coll['summary']['received_this_month']:,.0f}",
                      f"- Promises missed: {coll['summary']['promises_overdue']}, due today: {coll['summary']['promises_today']}", '',
                      f'COSTS THIS MONTH ({month})', f"- Sales team travel and food: Rs {report['travel']['amount']:,.0f}", f"- Salaries approved: Rs {report['payroll']['approved']:,.0f}", f"- Company expenses: Rs {report['company_expenses']['total']:,.0f}",
                      f"- Total running cost: Rs {report['running_cost']:,.0f}", '', 'SUPPORT', f"- {len(open_t)} open tickets, {len([t for t in open_t if t.get('priority') == 'Urgent'])} urgent"])


async def send_weekly(force: bool = False) -> Dict[str, Any]:
    cfg = smtp_settings()
    if not cfg:
        return {'configured': False, 'sent': 0}
    today = today_ist()
    if not force and await pdb.platform_reminder_log.find_one({'date': today, 'kind': 'weekly', 'status': 'sent'}):
        return {'configured': True, 'sent': 0, 'reason': 'Already sent today.'}
    owners = sorted({u['email'] for u in await pdb.platform_users.find({'role': 'owner', 'active': True}).to_list(20) if u.get('email')})
    if not owners:
        return {'configured': True, 'sent': 0}
    try:
        await asyncio.to_thread(send_mail_sync, cfg, owners, f'Orison weekly summary: {today}', await weekly_text())
        status = 'sent'
    except Exception:
        status = 'failed'
    await pdb.platform_reminder_log.insert_one({'id': f'RMD-{uuid.uuid4().hex[:6].upper()}', 'date': today, 'kind': 'weekly', 'at': _iso(), 'recipients': owners, 'status': status})
    return {'configured': True, 'sent': len(owners) if status == 'sent' else 0, 'recipients': owners}


class DigestBody(BaseModel):
    kind: str = 'sales'


@platform_router.post('/digests/send')
async def send_digests_now(body: DigestBody, request: Request, user: dict = Depends(require_owner)):
    """Send the emails now instead of waiting for morning: 'sales' = each salesperson's follow-ups, 'weekly' = the owner's weekly summary."""
    if body.kind not in ('sales', 'weekly'):
        raise HTTPException(422, 'Choose sales or weekly.')
    result = await (send_sales_digests(force=True) if body.kind == 'sales' else send_weekly(force=True))
    await audit(user, 'digest_sent', body.kind, {k: result.get(k) for k in ('sent', 'configured')}, client_ip(request))
    if not result.get('configured'):
        raise HTTPException(422, 'Email is not set up on the server yet (SMTP settings).')
    return result


async def digest_loop():
    """Every morning from 9 Indian time: follow-ups to each salesperson. On Mondays: the weekly summary to the owner. Only when email is set up."""
    while True:
        try:
            ist = _now() + timedelta(hours=5, minutes=30)
            if smtp_settings() and ist.hour >= 9:
                await send_sales_digests(force=False)
                if ist.weekday() == 0:
                    await send_weekly(force=False)
        except Exception:
            pass
        await asyncio.sleep(900)


_task = None


async def start_digests():
    global _task
    if _task is None:
        _task = asyncio.create_task(digest_loop())
