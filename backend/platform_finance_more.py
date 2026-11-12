"""Orison platform admin: more of the Accounts desk.

* expense claims that salespeople submit with a bill photo, reviewed by Accounts,
* credit notes and refunds,
* reminders (email digest, and click-to-send WhatsApp messages) for payment promises,
* a one-call overview for the Owner's dashboard.

Routes are added to the same router as platform_finance.py.
"""
import asyncio
import io
import os
import re
import smtplib
import ssl
import uuid
from datetime import datetime, timedelta
from email.message import EmailMessage
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from fastapi import Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from platform_admin import (MAX_PHOTO_BYTES, PHOTO_DIR, ROLE_PERMISSIONS, _iso, _now, _stamp, audit, clean, client_ip, current_user, get_settings, pdb, process_photo, require_perm, require_staff,
                            today_ist, valid_date, with_balance)
from platform_finance import (EXPENSE_CATEGORIES, apply_payment, collections_data, days_between, finance_router, is_owner, money, month_range, this_month, travel_sheet)

CLAIM_DIR = PHOTO_DIR.parent / 'expenses'
MAX_CLAIM_PHOTOS = 4


# ---------------------------------------------------------------- expense claims with a bill photo
def claim_view(row: dict) -> dict:
    row = clean(dict(row))
    row['photos'] = [{'id': p['id']} for p in row.get('photos', [])]
    return row


@finance_router.get('/my-claims')
async def my_claims(user: dict = Depends(require_staff('expenses:own', 'Only salespeople claim expenses.'))):
    rows = await pdb.platform_expenses.find({'owner_id': user['id']}).sort([('date', -1), ('at', -1)]).to_list(500)
    items = [claim_view(r) for r in rows]
    total = {s: money(sum(r['amount'] for r in items if r.get('status', 'Approved') == s)) for s in ('Submitted', 'Approved', 'Paid', 'Rejected')}
    return {'items': items, 'totals': total, 'categories': EXPENSE_CATEGORIES, 'max_photos': MAX_CLAIM_PHOTOS}


@finance_router.post('/my-claims')
async def submit_claim(request: Request, date: str = Form(''), category: str = Form('Other'), amount: float = Form(...), note: str = Form(''),
                       files: List[UploadFile] = File(...), user: dict = Depends(require_staff('expenses:own', 'Only salespeople claim expenses.'))):
    """A salesperson claims an expense. The bill photo is required and is kept privately."""
    if category not in EXPENSE_CATEGORIES:
        raise HTTPException(422, 'Choose a category from the list.')
    if not 0 < amount <= 1000000:
        raise HTTPException(422, 'Enter the amount you spent.')
    day = valid_date(date, 'Date') or today_ist()
    if day > today_ist():
        raise HTTPException(422, 'The date cannot be in the future.')
    if len(note.strip()) < 3:
        raise HTTPException(422, 'Write what the expense was for.')
    if not files or len(files) > MAX_CLAIM_PHOTOS:
        raise HTTPException(422, f'Attach 1 to {MAX_CLAIM_PHOTOS} photos of the bill.')
    claim_id = f'EXP-{uuid.uuid4().hex[:8].upper()}'
    folder = CLAIM_DIR / claim_id
    photos = []
    try:
        for upload in files:
            data = await upload.read(MAX_PHOTO_BYTES + 1)
            if not data or len(data) > MAX_PHOTO_BYTES:
                raise HTTPException(422, 'Each bill photo must be a picture smaller than 10 MB.')
            try:
                done = await asyncio.to_thread(process_photo, data)
            except Exception:
                raise HTTPException(422, 'That file is not a photo we can read. Use a JPG, PNG or WebP picture.')
            pid = f'BIL-{uuid.uuid4().hex[:8].upper()}'
            folder.mkdir(parents=True, exist_ok=True)
            (folder / f'{pid}.jpg').write_bytes(done['full'])
            (folder / f'{pid}_t.jpg').write_bytes(done['thumb'])
            photos.append({'id': pid})
    except HTTPException:
        import shutil
        shutil.rmtree(folder, ignore_errors=True)
        raise
    doc = {'id': claim_id, 'owner_id': user['id'], 'owner_name': user['name'], 'date': day, 'category': category, 'amount': money(amount), 'claimed_amount': money(amount), 'note': note.strip()[:200],
           'by': user['name'], 'at': _stamp(), 'status': 'Submitted', 'source': 'claim', 'photos': photos}
    await pdb.platform_expenses.insert_one(doc.copy())
    await audit(user, 'claim_submitted', claim_id, {'amount': doc['amount'], 'category': category}, client_ip(request))
    return claim_view(doc)


@finance_router.delete('/my-claims/{claim_id}')
async def withdraw_claim(claim_id: str, request: Request, user: dict = Depends(require_staff('expenses:own', 'Only salespeople claim expenses.'))):
    row = await pdb.platform_expenses.find_one({'id': claim_id, 'owner_id': user['id'], 'source': 'claim'})
    if not row:
        raise HTTPException(404, 'Claim not found.')
    if row['status'] != 'Submitted':
        raise HTTPException(403, 'Accounts has already reviewed this claim.')
    await pdb.platform_expenses.delete_one({'id': claim_id})
    import shutil
    shutil.rmtree(CLAIM_DIR / claim_id, ignore_errors=True)
    await audit(user, 'claim_withdrawn', claim_id, {}, client_ip(request))
    return {'ok': True}


@finance_router.get('/claims')
async def review_claims(status: str = '', month: str = '', user: dict = Depends(require_perm('finance:read'))):
    query: Dict[str, Any] = {'source': 'claim'}
    if status:
        query['status'] = status
    if month:
        start, end = month_range(month)
        query['date'] = {'$gte': start, '$lte': end}
    rows = await pdb.platform_expenses.find(query).sort([('date', -1), ('at', -1)]).to_list(1000)
    pending = await pdb.platform_expenses.count_documents({'source': 'claim', 'status': 'Submitted'})
    return {'items': [claim_view(r) for r in rows], 'pending': pending}


@finance_router.get('/claims/{claim_id}/photos/{photo_id}')
async def claim_photo(claim_id: str, photo_id: str, size: str = 'full', user: dict = Depends(current_user)):
    row = await pdb.platform_expenses.find_one({'id': claim_id})
    perms = ROLE_PERMISSIONS.get(user['role'], set())
    if not row or not ('*' in perms or 'finance:read' in perms or row['owner_id'] == user['id']):
        raise HTTPException(404, 'Photo not found.')
    if not any(p['id'] == photo_id for p in row.get('photos', [])):
        raise HTTPException(404, 'Photo not found.')
    path = CLAIM_DIR / claim_id / (f'{photo_id}_t.jpg' if size == 'thumb' else f'{photo_id}.jpg')
    if not path.is_file():
        raise HTTPException(404, 'Photo not found.')
    return FileResponse(path, media_type='image/jpeg', headers={'Cache-Control': 'private, max-age=3600'})


class DecisionBody(BaseModel):
    decision: str
    note: str = ''
    amount: Optional[float] = Field(default=None, gt=0)


class ClaimPaidBody(BaseModel):
    paid_on: str = ''
    reference: str = ''


@finance_router.post('/claims/{claim_id}/decision')
async def decide_claim(claim_id: str, body: DecisionBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    row = await pdb.platform_expenses.find_one({'id': claim_id, 'source': 'claim'})
    if not row:
        raise HTTPException(404, 'Claim not found.')
    if row['status'] != 'Submitted':
        raise HTTPException(409, f"This claim is already {row['status'].lower()}.")
    if body.decision not in ('Approved', 'Rejected'):
        raise HTTPException(422, 'Choose Approved or Rejected.')
    note = body.note.strip()
    if body.decision == 'Rejected' and len(note) < 3:
        raise HTTPException(422, 'Tell the salesperson why it was rejected.')
    changes: Dict[str, Any] = {'status': body.decision, 'decided_by': user['name'], 'decided_at': _iso(), 'decision_note': note[:300]}
    if body.decision == 'Approved' and body.amount is not None:
        if body.amount > row['claimed_amount'] + 0.005:
            raise HTTPException(422, 'The approved amount cannot be more than what was claimed.')
        changes['amount'] = money(body.amount)
    await pdb.platform_expenses.update_one({'id': claim_id}, {'$set': changes})
    await audit(user, 'claim_decided', claim_id, {'decision': body.decision, 'who': row['owner_name'], 'amount': changes.get('amount', row['amount'])}, client_ip(request))
    return claim_view(await pdb.platform_expenses.find_one({'id': claim_id}))


@finance_router.post('/claims/{claim_id}/paid')
async def pay_claim(claim_id: str, body: ClaimPaidBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    row = await pdb.platform_expenses.find_one({'id': claim_id, 'source': 'claim'})
    if not row or row['status'] != 'Approved':
        raise HTTPException(422, 'Approve the claim first.')
    await pdb.platform_expenses.update_one({'id': claim_id}, {'$set': {'status': 'Paid', 'paid_on': valid_date(body.paid_on, 'Paid on') or today_ist(), 'reference': body.reference.strip()[:100]}})
    await audit(user, 'claim_paid', claim_id, {'who': row['owner_name'], 'amount': row['amount']}, client_ip(request))
    return claim_view(await pdb.platform_expenses.find_one({'id': claim_id}))


# ---------------------------------------------------------------- credit notes and refunds
class CreditBody(BaseModel):
    amount: float = Field(gt=0, le=1000000000)
    reason: str
    date: str = ''


class RefundBody(BaseModel):
    amount: float = Field(gt=0, le=1000000000)
    date: str = ''
    method: str = ''
    reference: str = ''
    reason: str = ''


@finance_router.post('/invoices/{invoice_id}/credit-notes')
async def issue_credit_note(invoice_id: str, body: CreditBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    """Reduce what a school owes (a discount agreed later, fewer students, a billing mistake). If the school already paid, the extra becomes a refund due."""
    inv = await pdb.platform_invoices.find_one({'id': invoice_id})
    if not inv:
        raise HTTPException(404, 'Invoice not found.')
    if inv['status'] == 'Cancelled':
        raise HTTPException(409, 'This invoice is cancelled.')
    reason = body.reason.strip()
    if len(reason) < 3:
        raise HTTPException(422, 'Write the reason for the credit note.')
    view = with_balance(clean(dict(inv)))
    amount = money(body.amount)
    if amount > view['net_total'] + 0.005:
        raise HTTPException(422, f"The credit cannot be more than the invoice balance of ₹{view['net_total']:,.2f} after earlier credits.")
    date = valid_date(body.date, 'Date') or today_ist()
    if date > today_ist():
        raise HTTPException(422, 'The date cannot be in the future.')
    settings = await get_settings()
    year = _now().year
    agg = await pdb.platform_invoices.aggregate([{'$group': {'_id': None, 'n': {'$sum': {'$size': {'$ifNull': ['$credit_notes', []]}}}}}]).to_list(1)
    seq = (agg[0]['n'] if agg else 0) + 1
    note = {'id': f'CRN-{uuid.uuid4().hex[:8].upper()}', 'number': f"CN-{settings['invoice_prefix']}-{year}-{seq:04d}", 'amount': amount, 'reason': reason[:300], 'date': date, 'by': user['name'], 'at': _stamp()}
    await pdb.platform_invoices.update_one({'id': invoice_id}, {'$push': {'credit_notes': note}, '$set': {'updated': _iso()}})
    after = with_balance(clean(await pdb.platform_invoices.find_one({'id': invoice_id})))
    if after['status'] == 'Unpaid' and after['outstanding'] <= 0.005:  # nothing left to collect
        changes: Dict[str, Any] = {'status': 'Paid', 'paid_on': date}
        if not after['paid_amount']:
            changes['closed_by_credit'] = True
        await pdb.platform_invoices.update_one({'id': invoice_id}, {'$set': changes})
        await pdb.platform_promises.update_many({'invoice_id': invoice_id, 'status': 'Pending'}, {'$set': {'status': 'Cancelled', 'closed_on': date},
                                                '$push': {'history': {'at': _stamp(), 'by': user['name'], 'text': f"Cleared by credit note {note['number']}"}}})
        after = with_balance(clean(await pdb.platform_invoices.find_one({'id': invoice_id})))
    await audit(user, 'credit_note_issued', note['number'], {'invoice': inv['number'], 'amount': amount, 'reason': reason}, client_ip(request))
    return {**after, 'credit_note': note}


@finance_router.post('/invoices/{invoice_id}/refunds')
async def record_refund(invoice_id: str, body: RefundBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    inv = await pdb.platform_invoices.find_one({'id': invoice_id})
    if not inv:
        raise HTTPException(404, 'Invoice not found.')
    view = with_balance(clean(dict(inv)))
    amount = money(body.amount)
    if view['refund_due'] <= 0:
        raise HTTPException(409, 'No refund is due on this invoice.')
    if amount > view['refund_due'] + 0.005:
        raise HTTPException(422, f"Only ₹{view['refund_due']:,.2f} is due back to the school.")
    date = valid_date(body.date, 'Date') or today_ist()
    if date > today_ist():
        raise HTTPException(422, 'The date cannot be in the future.')
    refund = {'id': f'REF-{uuid.uuid4().hex[:8].upper()}', 'amount': amount, 'date': date, 'method': body.method.strip()[:60], 'reference': body.reference.strip()[:100], 'reason': body.reason.strip()[:200], 'by': user['name'], 'at': _stamp()}
    await pdb.platform_invoices.update_one({'id': invoice_id}, {'$push': {'refunds': refund}, '$set': {'updated': _iso()}})
    await audit(user, 'refund_recorded', inv['number'], {'amount': amount, 'reference': body.reference}, client_ip(request))
    return with_balance(clean(await pdb.platform_invoices.find_one({'id': invoice_id})))


@finance_router.get('/credit-notes')
async def list_credit_notes(user: dict = Depends(require_perm('finance:read'))):
    rows = await pdb.platform_invoices.find({'$or': [{'credit_notes.0': {'$exists': True}}, {'refunds.0': {'$exists': True}}]}).to_list(2000)
    out: List[dict] = []
    for r in rows:
        v = with_balance(clean(r))
        for c in v.get('credit_notes', []):
            out.append({'kind': 'Credit note', 'number': c['number'], 'date': c['date'], 'amount': c['amount'], 'reason': c['reason'], 'by': c['by'], 'invoice_id': v['id'], 'invoice': v['number'], 'school_name': v['school_name'], 'refund_due': v['refund_due']})
        for x in v.get('refunds', []):
            out.append({'kind': 'Refund', 'number': x['id'], 'date': x['date'], 'amount': x['amount'], 'reason': x.get('reason') or x.get('reference', ''), 'by': x['by'], 'invoice_id': v['id'], 'invoice': v['number'], 'school_name': v['school_name'], 'refund_due': v['refund_due']})
    out.sort(key=lambda x: x['date'], reverse=True)
    return out


# ---------------------------------------------------------------- reminders for payment promises
def digits(v: str) -> str:
    return re.sub(r'\D', '', v or '')


def whatsapp_link(p: dict, company: str) -> str:
    phone = digits(p.get('promised_by_phone', ''))
    if len(phone) < 10:
        return ''
    phone = '91' + phone if len(phone) == 10 else phone
    text = (f"Dear {p['promised_by_name']}, this is a gentle reminder from {company} about invoice {p['invoice_number']} of ₹{p['amount']:,.0f} for {p['school_name']}. "
            f"You had kindly said the payment would be made by {datetime.strptime(p['promised_on'], '%Y-%m-%d').strftime('%d %b %Y')}. Please let us know the status. Thank you.")
    return f'https://wa.me/{phone}?text={quote(text)}'


def smtp_settings() -> Optional[dict]:
    host = os.environ.get('SMTP_HOST', '').strip()
    if not host:
        return None
    return {'host': host, 'port': int(os.environ.get('SMTP_PORT', '587') or 587), 'user': os.environ.get('SMTP_USER', ''), 'password': os.environ.get('SMTP_PASSWORD', ''),
            'sender': os.environ.get('SMTP_FROM', '') or os.environ.get('SMTP_USER', '') or 'accounts@localhost', 'tls': os.environ.get('SMTP_TLS', 'true').lower() != 'false',
            'ssl': os.environ.get('SMTP_SSL', 'false').lower() == 'true'}


def send_mail_sync(cfg: dict, recipients: List[str], subject: str, text: str):
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = cfg['sender']
    msg['To'] = ', '.join(recipients)
    msg.set_content(text)
    if cfg['ssl']:
        server = smtplib.SMTP_SSL(cfg['host'], cfg['port'], timeout=20, context=ssl.create_default_context())
    else:
        server = smtplib.SMTP(cfg['host'], cfg['port'], timeout=20)
    try:
        if cfg['tls'] and not cfg['ssl']:
            server.starttls(context=ssl.create_default_context())
        if cfg['user']:
            server.login(cfg['user'], cfg['password'])
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except Exception:
            pass


async def reminder_digest(today: str) -> Dict[str, Any]:
    settings = await get_settings()
    coll = await collections_data(today)
    company = settings.get('company_name') or 'Orison Services'
    seen, items = set(), []
    for p in coll['chase']:
        seen.add(p['id'])
        items.append({**p, 'whatsapp_url': whatsapp_link(p, company), 'days_late': max(0, days_between(today, p['promised_on']))})
    items.sort(key=lambda x: x['promised_on'])
    no_promise = [i for i in coll['items'] if i['no_promise']]
    claims = await pdb.platform_expenses.count_documents({'source': 'claim', 'status': 'Submitted'})
    return {'date': today, 'items': items, 'no_promise': [{k: i[k] for k in ('id', 'number', 'school_name', 'product', 'outstanding', 'days_overdue')} for i in no_promise[:15]],
            'counts': {'chase': len(items), 'due_today': len([p for p in items if p['due_today']]), 'missed': len([p for p in items if p['overdue']]), 'no_promise': len(no_promise), 'claims': claims}}


def digest_text(d: Dict[str, Any]) -> str:
    c = d['counts']
    lines = [f"Payment follow-ups for {d['date']}", '', f"{c['due_today']} promise(s) due today, {c['missed']} where the date has passed, {c['no_promise']} overdue invoice(s) with no promise noted.", '']
    for p in d['items']:
        late = f" (date passed {p['days_late']} day(s) ago)" if p['days_late'] else ' (due today)'
        lines.append(f"- {p['school_name']}: Rs {p['amount']:,.0f} promised by {p['promised_by_name']}{' (' + p['promised_by_role'] + ')' if p['promised_by_role'] else ''} for {p['promised_on']}{late}. Invoice {p['invoice_number']}.")
    if d['no_promise']:
        lines += ['', 'Overdue, no promise yet:'] + [f"- {i['school_name']}: Rs {i['outstanding']:,.0f}, {i['days_overdue']} days late ({i['number']})" for i in d['no_promise']]
    if c['claims']:
        lines += ['', f"Also waiting: {c['claims']} expense claim(s) to review."]
    lines += ['', 'Open the Accounts desk to follow up.']
    return '\n'.join(lines)


async def send_digest(force: bool = False, sender: str = 'automatic') -> Dict[str, Any]:
    today = today_ist()
    cfg = smtp_settings()
    if not cfg:
        return {'sent': 0, 'configured': False, 'reason': 'Email is not set up on the server (SMTP_HOST is empty).'}
    if not force and await pdb.platform_reminder_log.find_one({'date': today, 'status': 'sent'}):
        return {'sent': 0, 'configured': True, 'reason': 'Already sent today.'}
    d = await reminder_digest(today)
    if not d['items'] and not d['no_promise']:
        return {'sent': 0, 'configured': True, 'reason': 'Nothing to remind about today.'}
    people = await pdb.platform_users.find({'active': True, 'role': {'$in': ['accounts', 'owner']}}).to_list(50)
    recipients = sorted({u['email'] for u in people if u.get('email')})
    if not recipients:
        return {'sent': 0, 'configured': True, 'reason': 'No accounts or owner logins with an email address.'}
    try:
        await asyncio.to_thread(send_mail_sync, cfg, recipients, f"Orison: {d['counts']['chase']} payment follow-up(s) for {today}", digest_text(d))
        status, error = 'sent', ''
    except Exception as err:  # the server must not fall over because the mail server is down
        status, error = 'failed', str(err)[:200]
    await pdb.platform_reminder_log.insert_one({'id': f'RMD-{uuid.uuid4().hex[:6].upper()}', 'date': today, 'at': _iso(), 'recipients': recipients, 'count': d['counts']['chase'], 'status': status, 'error': error, 'by': sender})
    return {'sent': len(recipients) if status == 'sent' else 0, 'configured': True, 'recipients': recipients, 'count': d['counts']['chase'], 'reason': error if status == 'failed' else ''}


@finance_router.get('/reminders')
async def get_reminders(user: dict = Depends(require_perm('finance:read'))):
    d = await reminder_digest(today_ist())
    last = await pdb.platform_reminder_log.find_one({}, sort=[('at', -1)])
    return {**d, 'email_configured': smtp_settings() is not None, 'last_email': clean(last) if last else None}


@finance_router.post('/reminders/send')
async def send_reminders_now(request: Request, user: dict = Depends(require_staff('finance:write'))):
    result = await send_digest(force=True, sender=user['name'])
    await audit(user, 'reminders_sent', 'email', {k: result.get(k) for k in ('sent', 'count', 'reason')}, client_ip(request))
    return result


async def reminder_loop():
    """Once a day, from 9 in the morning Indian time, email the follow-up list to Accounts and the Owner (only when email is set up)."""
    while True:
        try:
            if smtp_settings() and (_now() + timedelta(hours=5, minutes=30)).hour >= 9:
                await send_digest(force=False)
        except Exception:
            pass
        await asyncio.sleep(600)


_task = None


async def start_background():
    global _task
    if _task is None:
        _task = asyncio.create_task(reminder_loop())


# ---------------------------------------------------------------- the Owner's dashboard
@finance_router.get('/overview')
async def finance_overview(user: dict = Depends(require_perm('finance:read'))):
    today = today_ist()
    coll = await collections_data(today)
    sheet = await travel_sheet(this_month())
    pending_ta = [p for p in sheet['people'] if p['status'] != 'Paid' and p['km'] > 0]
    reports = await pdb.platform_reports.count_documents({'seen': {'$ne': True}}) if is_owner(user) else 0
    salaries = await pdb.platform_salaries.find({'month': this_month()}).to_list(2000)
    sal_live = [r for r in salaries if r['status'] != 'Draft']
    sal_balance = money(sum(r['net'] - sum(p['amount'] for p in r.get('payments', [])) for r in sal_live))
    company = money(sum(e['amount'] for e in await pdb.platform_company_expenses.find({'date': {'$gte': this_month() + '-01'}}).to_list(5000)))
    return {'month': this_month(), 'collections': coll['summary'], 'chase': len(coll['chase']), 'refunds_due': coll['summary']['refund_due'],
            'travel': {'km': sheet['totals']['km'], 'amount': sheet['totals']['amount'], 'to_pay': money(sum(p['amount'] for p in pending_ta)), 'missing': sheet['totals']['missing'] + sheet['totals']['flags'] + sheet['totals']['away'], 'rate': sheet['rate']},
            'claims_pending': await pdb.platform_expenses.count_documents({'source': 'claim', 'status': 'Submitted'}),
            'reports_unseen': reports, 'payroll': {'to_pay': sal_balance, 'drafts': len(salaries) - len(sal_live), 'people': len(salaries)}, 'company_expenses': company, 'top_overdue': sorted([i for i in coll['items'] if i['days_overdue'] > 0], key=lambda i: -i['outstanding'])[:4]}
