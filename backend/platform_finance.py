"""Orison platform admin: the Accounts desk.

Used by the Accounts login (and the Owner): travel allowance for the sales team (km x rate per km),
other expenses, invoices and payments from schools for the ERP and for other Orison products,
the promises school leaders make about when they will pay, and the monthly report sent to the Owner.
It lives in its own file so platform_admin.py does not grow further; it reuses that file's database,
login, permissions, audit log and route builder.
"""
import csv
import io
import re
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from platform_admin import (OTHER_PRODUCTS, ROLE_PERMISSIONS, _iso, _now, _stamp, audit, build_routes, clean, client_ip, get_settings, lead_owner_names,
                            load_school, pdb, require_perm, require_staff, today_ist, valid_date, with_balance)

finance_router = APIRouter(prefix='/api/platform/finance')

EXPENSE_CATEGORIES = ['Stay', 'Toll and parking', 'Fuel', 'Phone', 'Courier', 'Other']
PROMISE_STATUSES = ['Pending', 'Kept', 'Cancelled']


# ---------------------------------------------------------------- helpers
def month_range(month: str) -> tuple:
    if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', month or ''):
        raise HTTPException(422, 'Month must look like 2026-11.')
    first = datetime.strptime(month + '-01', '%Y-%m-%d')
    last = (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    return first.strftime('%Y-%m-%d'), last.strftime('%Y-%m-%d')


def this_month() -> str:
    return today_ist()[:7]


def is_owner(user: dict) -> bool:
    return '*' in ROLE_PERMISSIONS.get(user['role'], set())


def money(value) -> float:
    return round(float(value or 0), 2)


async def sales_people() -> List[dict]:
    return [{'id': u['id'], 'name': u['name'], 'role': u['role'], 'active': u.get('active', True)}
            for u in await pdb.platform_users.find({'role': {'$in': ['sales', 'owner']}}).sort('name', 1).to_list(200)]


# ---------------------------------------------------------------- travel allowance
async def travel_sheet(month: str) -> Dict[str, Any]:
    start, end = month_range(month)
    settings = await get_settings()
    rate = float(settings.get('km_rate') or 0)
    food_rate = float(settings.get('food_per_day') or 0)
    rows = await pdb.platform_leads.find({}).to_list(20000)
    returns = await pdb.platform_returns.find({'date': {'$gte': start, '$lte': end}}).to_list(5000)
    owners = await lead_owner_names()
    days = build_routes(rows, start, end, '', owners, returns)
    statements = {s['owner_id']: s for s in await pdb.platform_ta.find({'month': month}).to_list(500)}
    people: Dict[str, dict] = {}
    for d in days:
        p = people.setdefault(d['owner_id'], {'owner_id': d['owner_id'], 'name': d['owner_name'], 'km': 0.0, 'days': [], 'schools': 0, 'missing': 0, 'flags': 0, 'away': 0})
        visit_km = round(sum(s['km'] for s in d['stops'] if s['km'] is not None), 1)
        back = d['return_trip']['km'] if d.get('return_trip') else 0.0
        notes = [f"{s['school_name']}: {s['flag']}" for s in d['stops'] if s['flag']]
        for s in d['stops']:
            pr = s.get('proof') or {}
            if pr.get('status') == 'Away from the school':
                m = min(x for x in (pr.get('phone_m'), pr.get('photo_m')) if x is not None)
                notes.append(f"{s['school_name']}: visit was logged {m / 1000:.1f} km away from the school's pin" if m >= 1000 else f"{s['school_name']}: visit was logged {m} m away from the school's pin")
        p['days'].append({'date': d['date'], 'schools': [s['school_name'] for s in d['stops']], 'stops': len(d['stops']), 'visit_km': visit_km, 'return_km': back,
                          'food': food_rate, 'km': d['total_km'], 'missing': d['unknown_legs'], 'flags': d['flags'], 'away': d['away'], 'notes': notes,
                          'legs': [{'school': s['school_name'], 'km': s['km'], 'estimate_km': s['estimate_km'], 'flag': s['flag']} for s in d['stops']]})
        p['km'] = round(p['km'] + d['total_km'], 1)
        p['schools'] += len(d['stops'])
        p['missing'] += d['unknown_legs']
        p['flags'] += d['flags']
        p['away'] += d['away']
    for owner_id, st in statements.items():  # an approved month stays visible even if its data later changes
        people.setdefault(owner_id, {'owner_id': owner_id, 'name': st.get('owner_name', owners.get(owner_id, '')), 'km': 0.0, 'days': [], 'schools': 0, 'missing': 0, 'flags': 0, 'away': 0})
    out = []
    for p in people.values():
        st = statements.get(p['owner_id'])
        p['days'].sort(key=lambda x: x['date'])
        p['km_amount'] = money(p['km'] * rate)
        p['food_days'] = len(p['days'])
        p['food_amount'] = money(p['food_days'] * food_rate)
        p['amount'] = money(p['km_amount'] + p['food_amount'])
        p['status'] = st['status'] if st else 'Draft'
        p['statement'] = {k: st.get(k) for k in ('km', 'rate', 'km_amount', 'food_days', 'food_rate', 'food_amount', 'amount', 'status', 'approved_by', 'approved_at', 'note', 'paid_on', 'reference', 'paid_by')} if st else None
        p['changed_since_approval'] = bool(st and abs(float(st['km']) - p['km']) > 0.05)
        out.append(p)
    out.sort(key=lambda x: -x['km'])
    return {'month': month, 'range': {'from': start, 'to': end}, 'rate': rate, 'food_rate': food_rate, 'people': out,
            'totals': {'km': round(sum(p['km'] for p in out), 1), 'km_amount': round(sum(p['km_amount'] for p in out), 2), 'food_amount': round(sum(p['food_amount'] for p in out), 2), 'amount': round(sum(p['amount'] for p in out), 2), 'missing': sum(p['missing'] for p in out), 'flags': sum(p['flags'] for p in out), 'away': sum(p['away'] for p in out)}}


class ApproveBody(BaseModel):
    month: str
    owner_id: str
    note: str = ''


class PaidBody(BaseModel):
    month: str
    owner_id: str
    paid_on: str = ''
    reference: str = ''


@finance_router.get('/travel')
async def get_travel(month: str = '', user: dict = Depends(require_perm('finance:read'))):
    return await travel_sheet(month or this_month())


@finance_router.get('/travel.csv')
async def get_travel_csv(month: str = '', user: dict = Depends(require_perm('finance:read'))):
    """The travel sheet as a spreadsheet file (opens in Excel or Google Sheets)."""
    sheet = await travel_sheet(month or this_month())
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([f"Travel and food allowance {sheet['month']}", f"Rate per km: {sheet['rate']}", f"Food per day: {sheet['food_rate']}"])
    w.writerow(['Salesperson', 'Date', 'Schools visited', 'Km between schools', 'Km trip home', 'Total km', 'Rate per km', 'Km amount', 'Food', 'Day total', 'To check'])
    for p in sheet['people']:
        for d in p['days']:
            w.writerow([p['name'], d['date'], ' > '.join(d['schools']), d['visit_km'], d['return_km'], d['km'], sheet['rate'], money(d['km'] * sheet['rate']), d['food'], money(d['km'] * sheet['rate'] + d['food']),
                        '; '.join(d['notes'] + ([f"{d['missing']} distance missing"] if d['missing'] else []))])
        w.writerow([p['name'], 'TOTAL', '', '', '', p['km'], sheet['rate'], p['km_amount'], p['food_amount'], p['amount'], p['status']])
        w.writerow([])
    w.writerow(['ALL', 'TOTAL', '', '', '', sheet['totals']['km'], sheet['rate'], sheet['totals']['km_amount'], sheet['totals']['food_amount'], sheet['totals']['amount'], ''])
    return Response(buf.getvalue(), media_type='text/csv', headers={'Content-Disposition': f'attachment; filename="travel-allowance-{sheet["month"]}.csv"'})


@finance_router.post('/travel/approve')
async def approve_travel(body: ApproveBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    sheet = await travel_sheet(body.month)
    person = next((p for p in sheet['people'] if p['owner_id'] == body.owner_id), None)
    if not person or not person['days']:
        raise HTTPException(404, 'No travel recorded for this person in that month.')
    existing = await pdb.platform_ta.find_one({'month': body.month, 'owner_id': body.owner_id})
    if existing and existing['status'] == 'Paid':
        raise HTTPException(409, 'This month is already paid.')
    if person['missing']:
        raise HTTPException(422, f"{person['missing']} distance(s) are missing. Ask the salesperson to add them, or ask the owner to fix them, before approving.")
    doc = {'month': body.month, 'owner_id': body.owner_id, 'owner_name': person['name'], 'km': person['km'], 'rate': sheet['rate'], 'km_amount': person['km_amount'], 'food_days': person['food_days'], 'food_rate': sheet['food_rate'], 'food_amount': person['food_amount'], 'amount': person['amount'], 'days': len(person['days']),
           'status': 'Approved', 'approved_by': user['name'], 'approved_at': _iso(), 'note': body.note.strip()[:300], 'paid_on': '', 'reference': ''}
    await pdb.platform_ta.replace_one({'month': body.month, 'owner_id': body.owner_id}, doc, upsert=True)
    await audit(user, 'ta_approved', f"{body.month}:{body.owner_id}", {'km': doc['km'], 'amount': doc['amount']}, client_ip(request))
    return doc


@finance_router.post('/travel/paid')
async def pay_travel(body: PaidBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    existing = await pdb.platform_ta.find_one({'month': body.month, 'owner_id': body.owner_id})
    if not existing or existing['status'] != 'Approved':
        raise HTTPException(422, 'Approve the month first.')
    paid_on = valid_date(body.paid_on, 'Paid on') or today_ist()
    await pdb.platform_ta.update_one({'_id': existing['_id']}, {'$set': {'status': 'Paid', 'paid_on': paid_on, 'reference': body.reference.strip()[:100], 'paid_by': user['name']}})
    await audit(user, 'ta_paid', f"{body.month}:{body.owner_id}", {'amount': existing['amount'], 'reference': body.reference}, client_ip(request))
    return clean(await pdb.platform_ta.find_one({'_id': existing['_id']}))


# ---------------------------------------------------------------- other expenses of the sales team
class ExpenseBody(BaseModel):
    owner_id: str
    date: str = ''
    category: str = 'Other'
    amount: float = Field(gt=0, le=10000000)
    note: str = ''


@finance_router.get('/expenses')
async def list_expenses(month: str = '', owner_id: str = '', user: dict = Depends(require_perm('finance:read'))):
    start, end = month_range(month or this_month())
    query: Dict[str, Any] = {'date': {'$gte': start, '$lte': end}, 'status': {'$nin': ['Submitted', 'Rejected']}}
    if owner_id:
        query['owner_id'] = owner_id
    rows = [clean(r) for r in await pdb.platform_expenses.find(query).sort([('date', -1), ('at', -1)]).to_list(2000)]
    by_cat: Dict[str, float] = {}
    for r in rows:
        by_cat[r['category']] = money(by_cat.get(r['category'], 0) + r['amount'])
    return {'month': month or this_month(), 'items': rows, 'total': money(sum(r['amount'] for r in rows)), 'by_category': by_cat, 'categories': EXPENSE_CATEGORIES}


@finance_router.post('/expenses')
async def add_expense(body: ExpenseBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    person = next((p for p in await sales_people() if p['id'] == body.owner_id), None)
    if not person:
        raise HTTPException(422, 'Choose a salesperson.')
    if body.category not in EXPENSE_CATEGORIES:
        raise HTTPException(422, 'Choose a category from the list.')
    date = valid_date(body.date, 'Date') or today_ist()
    if date > today_ist():
        raise HTTPException(422, 'The date cannot be in the future.')
    doc = {'id': f'EXP-{uuid.uuid4().hex[:8].upper()}', 'owner_id': person['id'], 'owner_name': person['name'], 'date': date, 'category': body.category, 'amount': money(body.amount),
           'note': body.note.strip()[:200], 'by': user['name'], 'at': _stamp(), 'status': 'Approved', 'source': 'accounts', 'photos': []}
    await pdb.platform_expenses.insert_one(doc.copy())
    await audit(user, 'expense_added', doc['id'], {'who': person['name'], 'amount': doc['amount'], 'category': doc['category']}, client_ip(request))
    return doc


@finance_router.delete('/expenses/{expense_id}')
async def delete_expense(expense_id: str, request: Request, user: dict = Depends(require_staff('finance:write'))):
    row = await pdb.platform_expenses.find_one({'id': expense_id})
    if not row:
        raise HTTPException(404, 'Expense not found.')
    await pdb.platform_expenses.delete_one({'id': expense_id})
    await audit(user, 'expense_deleted', expense_id, {'who': row['owner_name'], 'amount': row['amount']}, client_ip(request))
    return {'ok': True}


# ---------------------------------------------------------------- invoices for other products, and part-payments
class ProductInvoiceBody(BaseModel):
    school_id: str
    product: str
    description: str = ''
    quantity: float = Field(gt=0, le=100000)
    rate: float = Field(gt=0, le=100000000)
    discount_percent: float = Field(default=0, ge=0, le=100)
    gst_percent: Optional[float] = Field(default=None, ge=0, le=100)
    academic_year: str = ''
    note: str = ''


class PaymentBody(BaseModel):
    amount: float = Field(gt=0, le=1000000000)
    date: str = ''
    method: str = ''
    reference: str = ''


@finance_router.get('/meta')
async def finance_meta(user: dict = Depends(require_perm('finance:read'))):
    settings = await get_settings()
    schools = [{'id': s['id'], 'name': s['name'], 'plan': s.get('plan', ''), 'students': int(s.get('student_count') or 0)} for s in await pdb.schools.find({}).sort('name', 1).to_list(2000)]
    return {'km_rate': float(settings.get('km_rate') or 0), 'gst_percent': settings['gst_percent'], 'payment_terms_days': settings['payment_terms_days'], 'categories': EXPENSE_CATEGORIES,
            'products': [{'id': k, 'label': v} for k, v in OTHER_PRODUCTS.items()], 'salespeople': await sales_people(), 'schools': schools, 'today': today_ist(), 'can_edit_rate': is_owner(user)}


@finance_router.post('/product-invoices')
async def create_product_invoice(body: ProductInvoiceBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    """An invoice for Robotics, VR, IFB, Kreedo or a custom item (quantity x price), so those payments are tracked like the ERP."""
    if body.product not in OTHER_PRODUCTS:
        raise HTTPException(422, 'Choose Robotics, VR, IFB, Kreedo or Custom.')
    school = await load_school(body.school_id)
    settings = await get_settings()
    gst_percent = float(settings['gst_percent'] if body.gst_percent is None else body.gst_percent)
    gross = money(body.quantity * body.rate)
    discount = money(gross * body.discount_percent / 100)
    taxable = money(gross - discount)
    gst = money(taxable * gst_percent / 100)
    year = _now().year
    sequence = await pdb.platform_invoices.count_documents({'number': {'$regex': f"^{re.escape(settings['invoice_prefix'])}-{year}-"}}) + 1
    for _ in range(5):
        number = f"{settings['invoice_prefix']}-{year}-{sequence:04d}"
        if not await pdb.platform_invoices.find_one({'number': number}):
            break
        sequence += 1
    due = _now() + timedelta(days=int(settings['payment_terms_days']))
    doc = {'id': f'INV-{uuid.uuid4().hex[:10].upper()}', 'number': number, 'kind': 'product', 'school_id': body.school_id, 'school_name': school['name'], 'plan': '',
           'product': body.product, 'product_label': OTHER_PRODUCTS[body.product], 'description': body.description.strip()[:200], 'quantity': body.quantity, 'rate': money(body.rate),
           'academic_year': body.academic_year.strip(), 'note': body.note.strip(), 'students': 0, 'rate_per_student': 0, 'discount_percent': body.discount_percent, 'discount_amount': discount,
           'minimum_fee': 0, 'minimum_applied': False, 'subscription': gross, 'setup_fee': 0, 'taxable': taxable, 'gst_percent': gst_percent, 'gst': gst, 'total': money(taxable + gst),
           'status': 'Unpaid', 'issued_on': today_ist(), 'due_on': due.strftime('%Y-%m-%d'), 'created': _iso(), 'created_by': user['email'], 'payments': []}
    await pdb.platform_invoices.insert_one(doc.copy())
    await audit(user, 'invoice_created', doc['number'], {'school': school['name'], 'product': body.product, 'total': doc['total']}, client_ip(request))
    return with_balance(doc)


async def apply_payment(inv: dict, amount: float, date: str, method: str, reference: str, user: dict, source: str = '') -> dict:
    """Money received against an invoice. A part-payment keeps the invoice open for the balance; the last payment closes it."""
    view = with_balance(clean(dict(inv)))
    if inv['status'] != 'Unpaid':
        raise HTTPException(409, f"This invoice is {inv['status'].lower()}.")
    amount = money(amount)
    if amount > view['outstanding'] + 0.005:
        raise HTTPException(422, f"The balance is only ₹{view['outstanding']:,.2f}.")
    date = valid_date(date, 'Date') or today_ist()
    if date > today_ist():
        raise HTTPException(422, 'The date cannot be in the future.')
    payment = {'id': f'PAY-{uuid.uuid4().hex[:8].upper()}', 'amount': amount, 'date': date, 'method': method.strip()[:60], 'reference': reference.strip()[:100], 'by': user['name'], 'at': _stamp()}
    if source:
        payment['source'] = source
    changes: Dict[str, Any] = {'updated': _iso()}
    closed = money(view['outstanding'] - amount) <= 0.005
    if closed:
        changes.update({'status': 'Paid', 'paid_on': date, 'payment_method': payment['method'], 'payment_reference': payment['reference']})
    await pdb.platform_invoices.update_one({'id': inv['id']}, {'$push': {'payments': payment}, '$set': changes})
    if closed:  # the school kept its word
        await pdb.platform_promises.update_many({'invoice_id': inv['id'], 'status': 'Pending'}, {'$set': {'status': 'Kept', 'closed_on': date}, '$push': {'history': {'at': _stamp(), 'by': user['name'], 'text': 'Invoice paid in full'}}})
    return payment


@finance_router.post('/invoices/{invoice_id}/payments')
async def record_payment(invoice_id: str, body: PaymentBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    inv = await pdb.platform_invoices.find_one({'id': invoice_id})
    if not inv:
        raise HTTPException(404, 'Invoice not found.')
    payment = await apply_payment(inv, body.amount, body.date, body.method, body.reference, user)
    after = with_balance(clean(await pdb.platform_invoices.find_one({'id': invoice_id})))
    await audit(user, 'payment_recorded', inv['number'], {'amount': payment['amount'], 'closed': after['status'] == 'Paid', 'reference': body.reference}, client_ip(request))
    return after


# ---------------------------------------------------------------- what schools still owe, and what they promised
class PromiseBody(BaseModel):
    invoice_id: str
    promised_by_name: str
    promised_by_role: str = ''
    promised_by_phone: str = ''
    promised_on: str
    amount: Optional[float] = Field(default=None, gt=0)
    follow_up_on: str = ''
    note: str = ''


class PromiseUpdate(BaseModel):
    status: Optional[str] = None
    promised_on: Optional[str] = None
    follow_up_on: Optional[str] = None
    note: str = ''


class FollowupBody(BaseModel):
    note: str
    outcome: str = ''  # e.g. Spoke to the principal, No answer, Cheque ready
    follow_up_on: str = ''


def promise_view(p: dict, today: str) -> dict:
    p = clean(dict(p))
    pending = p['status'] == 'Pending'
    p['overdue'] = pending and p['promised_on'] < today
    p['due_today'] = pending and p['promised_on'] == today
    p['chase'] = pending and (p.get('follow_up_on') or p['promised_on']) <= today
    p['month'] = p['promised_on'][:7]
    return p


@finance_router.post('/promises')
async def add_promise(body: PromiseBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    inv = await pdb.platform_invoices.find_one({'id': body.invoice_id})
    if not inv or inv['status'] != 'Unpaid':
        raise HTTPException(422, 'Choose an invoice that still has a balance.')
    name = body.promised_by_name.strip()
    if len(name) < 2:
        raise HTTPException(422, 'Who gave the promise? Write their name.')
    promised_on = valid_date(body.promised_on, 'Promised date')
    if not promised_on:
        raise HTTPException(422, 'On which date did they promise to pay?')
    today = today_ist()
    if promised_on < today:
        raise HTTPException(422, 'The promised date cannot be in the past.')
    follow = valid_date(body.follow_up_on, 'Follow-up date') or promised_on
    if follow > promised_on:
        raise HTTPException(422, 'Follow up on or before the promised date.')
    view = with_balance(clean(dict(inv)))
    amount = money(body.amount if body.amount is not None else view['outstanding'])
    if amount > view['outstanding'] + 0.005:
        raise HTTPException(422, f"The balance is only ₹{view['outstanding']:,.2f}.")
    doc = {'id': f'PRM-{uuid.uuid4().hex[:8].upper()}', 'invoice_id': inv['id'], 'invoice_number': inv['number'], 'school_id': inv['school_id'], 'school_name': inv['school_name'],
           'product': inv.get('product_label') or 'ERP', 'promised_by_name': name[:80], 'promised_by_role': body.promised_by_role.strip()[:60], 'promised_by_phone': body.promised_by_phone.strip()[:20],
           'promised_on': promised_on, 'follow_up_on': follow, 'amount': amount, 'note': body.note.strip()[:300], 'status': 'Pending',
           'created_by': user['name'], 'created_at': _stamp(), 'followups': [], 'history': [{'at': _stamp(), 'by': user['name'], 'text': f'Promise noted: pay ₹{amount:,.0f} by {promised_on}'}]}
    await pdb.platform_promises.insert_one(doc.copy())
    await audit(user, 'promise_added', doc['id'], {'school': doc['school_name'], 'invoice': doc['invoice_number'], 'on': promised_on, 'amount': amount}, client_ip(request))
    return promise_view(doc, today)


@finance_router.put('/promises/{promise_id}')
async def update_promise(promise_id: str, body: PromiseUpdate, request: Request, user: dict = Depends(require_staff('finance:write'))):
    p = await pdb.platform_promises.find_one({'id': promise_id})
    if not p:
        raise HTTPException(404, 'Promise not found.')
    today = today_ist()
    changes: Dict[str, Any] = {}
    lines: List[str] = []
    if body.promised_on:
        new_date = valid_date(body.promised_on, 'New promised date')
        if new_date < today:
            raise HTTPException(422, 'The new date cannot be in the past.')
        if new_date != p['promised_on']:
            lines.append(f"New promise: {new_date} (was {p['promised_on']})" + (f". {body.note.strip()}" if body.note.strip() else ''))
            changes['promised_on'] = new_date
            changes['reschedules'] = int(p.get('reschedules', 0)) + 1
            if not body.follow_up_on:
                changes['follow_up_on'] = new_date
    if body.follow_up_on:
        changes['follow_up_on'] = valid_date(body.follow_up_on, 'Follow-up date')
    if body.status:
        if body.status not in PROMISE_STATUSES:
            raise HTTPException(422, 'Choose Pending, Kept or Cancelled.')
        if body.status != p['status']:
            changes['status'] = body.status
            lines.append(f"Marked {body.status.lower()}" + (f". {body.note.strip()}" if body.note.strip() else ''))
    if not changes:
        raise HTTPException(422, 'Nothing to change.')
    update: Dict[str, Any] = {'$set': changes, '$push': {'history': {'$each': [{'at': _stamp(), 'by': user['name'], 'text': t} for t in lines]}}} if lines else {'$set': changes}
    await pdb.platform_promises.update_one({'id': promise_id}, update)
    await audit(user, 'promise_updated', promise_id, {k: v for k, v in changes.items()}, client_ip(request))
    return promise_view(await pdb.platform_promises.find_one({'id': promise_id}), today)


@finance_router.post('/promises/{promise_id}/followups')
async def add_followup(promise_id: str, body: FollowupBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    p = await pdb.platform_promises.find_one({'id': promise_id})
    if not p:
        raise HTTPException(404, 'Promise not found.')
    note = body.note.strip()
    if len(note) < 3:
        raise HTTPException(422, 'Write what was said.')
    entry = {'id': f'FUP-{uuid.uuid4().hex[:6].upper()}', 'at': _stamp(), 'by': user['name'], 'note': note[:500], 'outcome': body.outcome.strip()[:60]}
    changes: Dict[str, Any] = {}
    if body.follow_up_on:
        changes['follow_up_on'] = valid_date(body.follow_up_on, 'Next follow-up')
    update: Dict[str, Any] = {'$push': {'followups': entry}}
    if changes:
        update['$set'] = changes
    await pdb.platform_promises.update_one({'id': promise_id}, update)
    await audit(user, 'promise_followup', promise_id, {'school': p['school_name']}, client_ip(request))
    return promise_view(await pdb.platform_promises.find_one({'id': promise_id}), today_ist())


def days_between(later: str, earlier: str) -> int:
    return (datetime.strptime(later, '%Y-%m-%d') - datetime.strptime(earlier, '%Y-%m-%d')).days


async def collections_data(today: str) -> Dict[str, Any]:
    invoices = [with_balance(clean(r)) for r in await pdb.platform_invoices.find({'status': 'Unpaid'}).sort('due_on', 1).to_list(5000)]
    promises = [promise_view(p, today) for p in await pdb.platform_promises.find({}).sort('promised_on', 1).to_list(5000)]
    pending_by_invoice: Dict[str, List[dict]] = {}
    for p in promises:
        if p['status'] == 'Pending':
            pending_by_invoice.setdefault(p['invoice_id'], []).append(p)
    items = []
    buckets = {'not_due': 0.0, 'd1_30': 0.0, 'd31_60': 0.0, 'd61_90': 0.0, 'd90_plus': 0.0}
    by_kind = {'erp': 0.0, 'other': 0.0}
    for inv in invoices:
        late = max(0, days_between(today, inv['due_on']))
        if late == 0:
            buckets['not_due'] += inv['outstanding']
        elif late <= 30:
            buckets['d1_30'] += inv['outstanding']
        elif late <= 60:
            buckets['d31_60'] += inv['outstanding']
        elif late <= 90:
            buckets['d61_90'] += inv['outstanding']
        else:
            buckets['d90_plus'] += inv['outstanding']
        kind = 'other' if inv.get('kind') == 'product' else 'erp'
        by_kind[kind] += inv['outstanding']
        mine = pending_by_invoice.get(inv['id'], [])
        nxt = min(mine, key=lambda x: x['promised_on']) if mine else None
        items.append({'id': inv['id'], 'number': inv['number'], 'school_id': inv['school_id'], 'school_name': inv['school_name'], 'kind': kind, 'product': inv.get('product_label') or 'ERP ' + (inv.get('plan') or '').title(),
                      'total': inv['total'], 'paid_amount': inv['paid_amount'], 'outstanding': inv['outstanding'], 'issued_on': inv['issued_on'], 'due_on': inv['due_on'], 'days_overdue': late,
                      'next_promise': {k: nxt[k] for k in ('id', 'promised_on', 'amount', 'promised_by_name', 'promised_by_role', 'overdue', 'follow_up_on')} if nxt else None,
                      'no_promise': late > 0 and not nxt})
    month_start = today[:7] + '-01'
    received = 0.0
    for r in await pdb.platform_invoices.find({}).to_list(10000):
        if r.get('payments'):
            received += sum(float(p['amount']) for p in r['payments'] if p['date'] >= month_start)
        elif r.get('status') == 'Paid' and not r.get('closed_by_credit') and (r.get('paid_on') or '') >= month_start:
            received += float(r['total'])
        received -= sum(float(x['amount']) for x in r.get('refunds', []) if x['date'] >= month_start)
    refunds_due = []
    for r in await pdb.platform_invoices.find({'credit_notes.0': {'$exists': True}, 'status': {'$ne': 'Cancelled'}}).to_list(2000):
        v = with_balance(clean(r))
        if v['refund_due'] > 0:
            refunds_due.append({'id': v['id'], 'number': v['number'], 'school_name': v['school_name'], 'refund_due': v['refund_due'], 'credit_amount': v['credit_amount'], 'paid_amount': v['paid_amount']})
    pending = [p for p in promises if p['status'] == 'Pending']
    return {'today': today, 'items': items, 'refunds_due': refunds_due, 'promises': promises[-400:] if len(promises) > 400 else promises,
            'chase': [p for p in pending if p['chase']], 'upcoming': [p for p in pending if not p['chase'] and days_between(p['promised_on'], today) <= 14],
            'summary': {'outstanding': money(sum(i['outstanding'] for i in items)), 'overdue': money(sum(i['outstanding'] for i in items if i['days_overdue'] > 0)), 'invoices': len(items),
                        'erp': money(by_kind['erp']), 'other': money(by_kind['other']), 'received_this_month': money(received), 'refund_due': money(sum(r['refund_due'] for r in refunds_due)), 'no_promise': len([i for i in items if i['no_promise']]),
                        'promises_overdue': len([p for p in pending if p['overdue']]), 'promises_today': len([p for p in pending if p['due_today']]),
                        'aging': {k: money(v) for k, v in buckets.items()}}}


@finance_router.get('/collections')
async def collections(user: dict = Depends(require_perm('finance:read'))):
    return await collections_data(today_ist())


# ---------------------------------------------------------------- the monthly report for the Owner
async def build_report(month: str) -> Dict[str, Any]:
    start, end = month_range(month)
    sheet = await travel_sheet(month)
    expenses = await pdb.platform_expenses.find({'date': {'$gte': start, '$lte': end}, 'status': {'$nin': ['Submitted', 'Rejected']}}).to_list(5000)
    exp_by_person: Dict[str, float] = {}
    exp_by_cat: Dict[str, float] = {}
    for e in expenses:
        exp_by_person[e['owner_name']] = money(exp_by_person.get(e['owner_name'], 0) + e['amount'])
        exp_by_cat[e['category']] = money(exp_by_cat.get(e['category'], 0) + e['amount'])
    invoices = await pdb.platform_invoices.find({}).to_list(10000)
    invoiced = {'erp': 0.0, 'other': 0.0}
    received = {'erp': 0.0, 'other': 0.0}
    credited = {'erp': 0.0, 'other': 0.0}
    for r in invoices:
        kind = 'other' if r.get('kind') == 'product' else 'erp'
        if r.get('status') != 'Cancelled' and start <= (r.get('issued_on') or '') <= end:
            invoiced[kind] += float(r['total'])
        if r.get('payments'):
            received[kind] += sum(float(p['amount']) for p in r['payments'] if start <= p['date'] <= end)
        elif r.get('status') == 'Paid' and not r.get('closed_by_credit') and start <= (r.get('paid_on') or '') <= end:
            received[kind] += float(r['total'])
        received[kind] -= sum(float(x['amount']) for x in r.get('refunds', []) if start <= x['date'] <= end)
        credited[kind] += sum(float(x['amount']) for x in r.get('credit_notes', []) if start <= x['date'] <= end)
    today = today_ist()
    coll = await collections_data(today)
    promises = await pdb.platform_promises.find({}).to_list(5000)
    top = sorted([i for i in coll['items'] if i['days_overdue'] > 0], key=lambda i: -i['outstanding'])[:8]
    salaries = await pdb.platform_salaries.find({'month': month}).to_list(2000)
    sal_net = money(sum(r['net'] for r in salaries if r['status'] != 'Draft'))
    sal_paid = money(sum(p['amount'] for r in salaries for p in r.get('payments', [])))
    company = await pdb.platform_company_expenses.find({'date': {'$gte': start, '$lte': end}}).to_list(5000)
    company_by_cat: Dict[str, float] = {}
    for e in company:
        company_by_cat[e['category']] = money(company_by_cat.get(e['category'], 0) + e['amount'])
    company_total = money(sum(e['amount'] for e in company))
    return {'month': month, 'generated_on': today,
            'travel': {'rate': sheet['rate'], 'food_rate': sheet['food_rate'], 'km': sheet['totals']['km'], 'km_amount': sheet['totals']['km_amount'], 'food_amount': sheet['totals']['food_amount'], 'amount': sheet['totals']['amount'], 'missing': sheet['totals']['missing'], 'flags': sheet['totals']['flags'], 'away': sheet['totals']['away'],
                       'people': [{'name': p['name'], 'km': p['km'], 'days': len(p['days']), 'km_amount': p['km_amount'], 'food_amount': p['food_amount'], 'amount': p['amount'], 'status': p['status']} for p in sheet['people']]},
            'expenses': {'total': money(sum(e['amount'] for e in expenses)), 'by_person': exp_by_person, 'by_category': exp_by_cat},
            'sales_cost': money(sheet['totals']['amount'] + sum(e['amount'] for e in expenses)),
            'payroll': {'people': len(salaries), 'approved': sal_net, 'paid': sal_paid, 'balance': money(sal_net - sal_paid), 'drafts': len([r for r in salaries if r['status'] == 'Draft']),
                        'lines': [{'name': r['employee_name'], 'designation': r.get('designation', ''), 'net': r['net'], 'paid': money(sum(p['amount'] for p in r.get('payments', []))), 'status': r['status']} for r in salaries]},
            'company_expenses': {'total': company_total, 'by_category': company_by_cat},
            'running_cost': money(sheet['totals']['amount'] + sum(e['amount'] for e in expenses) + sal_net + company_total),
            'money': {'invoiced_erp': money(invoiced['erp']), 'invoiced_other': money(invoiced['other']), 'received_erp': money(received['erp']), 'received_other': money(received['other']),
                      'received_total': money(received['erp'] + received['other']), 'credit_notes': money(credited['erp'] + credited['other'])},
            'receivables': {**{k: coll['summary'][k] for k in ('outstanding', 'overdue', 'erp', 'other', 'aging')}, 'top_overdue': [{'school': i['school_name'], 'invoice': i['number'], 'product': i['product'],
                            'outstanding': i['outstanding'], 'days_overdue': i['days_overdue'], 'promise_on': i['next_promise']['promised_on'] if i['next_promise'] else ''} for i in top]},
            'promises': {'made': len([p for p in promises if start <= p['created_at'][:10] <= end]), 'kept': len([p for p in promises if p['status'] == 'Kept' and start <= (p.get('closed_on') or '') <= end]),
                         'pending': len([p for p in promises if p['status'] == 'Pending']), 'missed': len([p for p in promises if p['status'] == 'Pending' and p['promised_on'] < today]),
                         'rescheduled': len([p for p in promises if p.get('reschedules')])}}


class ReportBody(BaseModel):
    month: str
    note: str = ''


@finance_router.get('/report')
async def get_report(month: str = '', user: dict = Depends(require_perm('finance:read'))):
    return await build_report(month or this_month())


@finance_router.post('/reports')
async def submit_report(body: ReportBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    """Send the month's report to the Owner. It is a snapshot: the figures are kept as they were on that day."""
    data = await build_report(body.month)
    doc = {'id': f'REP-{uuid.uuid4().hex[:8].upper()}', 'month': body.month, 'note': body.note.strip()[:1000], 'data': data, 'submitted_by': user['name'], 'submitted_by_id': user['id'], 'at': _stamp(), 'seen': False}
    await pdb.platform_reports.insert_one(doc.copy())
    await audit(user, 'report_submitted', doc['id'], {'month': body.month}, client_ip(request))
    return {k: doc[k] for k in ('id', 'month', 'note', 'submitted_by', 'at', 'seen')}


def report_row(r: dict) -> dict:
    d = r['data']
    return {'id': r['id'], 'month': r['month'], 'note': r.get('note', ''), 'submitted_by': r['submitted_by'], 'at': r['at'], 'seen': r.get('seen', False),
            'headline': {'sales_cost': d['sales_cost'], 'km': d['travel']['km'], 'received': d['money']['received_total'], 'outstanding': d['receivables']['outstanding'], 'overdue': d['receivables']['overdue']}}


@finance_router.get('/reports')
async def list_reports(user: dict = Depends(require_perm('finance:read'))):
    rows = await pdb.platform_reports.find({}).sort('at', -1).to_list(200)
    return {'items': [report_row(r) for r in rows], 'unseen': len([r for r in rows if not r.get('seen')]), 'owner_view': is_owner(user)}


@finance_router.get('/reports/{report_id}')
async def get_saved_report(report_id: str, user: dict = Depends(require_perm('finance:read'))):
    r = await pdb.platform_reports.find_one({'id': report_id})
    if not r:
        raise HTTPException(404, 'Report not found.')
    if is_owner(user) and not r.get('seen'):
        await pdb.platform_reports.update_one({'id': report_id}, {'$set': {'seen': True, 'seen_at': _iso()}})
        r['seen'] = True
    return {**report_row(r), 'data': r['data']}
