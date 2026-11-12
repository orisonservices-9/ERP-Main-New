"""Orison platform admin: employee salaries and company expenses (Accounts desk).

Accounts keeps a staff list, prepares each month's salaries, approves them by hand, and records every
payment (how much, on what date, by which mode, with which reference). Company running costs (rent,
electricity, software and so on) are kept next to them. Routes are added to the finance router.
"""
import uuid
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field

from platform_admin import _iso, _stamp, audit, clean, client_ip, pdb, require_owner, require_perm, require_staff, today_ist, valid_date
from platform_finance import finance_router, month_range, money, this_month

PAY_MODES = ['Bank transfer', 'UPI', 'Cheque', 'Cash', 'Other']
COMPANY_CATEGORIES = ['Rent', 'Electricity and water', 'Internet and phone', 'Software and hosting', 'Office supplies', 'Marketing', 'Professional fees', 'Taxes and fees', 'Repairs', 'Other']


# ---------------------------------------------------------------- staff list
class EmployeeBody(BaseModel):
    name: str
    designation: str = ''
    monthly_salary: float = Field(ge=0, le=100000000)
    joined_on: str = ''
    phone: str = ''
    pay_note: str = ''  # how they are usually paid, e.g. "Bank transfer, HDFC ending 1234" (never the full account number)
    active: bool = True


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    monthly_salary: Optional[float] = Field(default=None, ge=0, le=100000000)
    joined_on: Optional[str] = None
    phone: Optional[str] = None
    pay_note: Optional[str] = None
    active: Optional[bool] = None


@finance_router.get('/employees')
async def list_employees(user: dict = Depends(require_perm('finance:read'))):
    rows = [clean(r) for r in await pdb.platform_employees.find({}).sort([('active', -1), ('name', 1)]).to_list(500)]
    return {'items': rows, 'monthly_total': money(sum(r['monthly_salary'] for r in rows if r.get('active', True)))}


@finance_router.post('/employees')
async def add_employee(body: EmployeeBody, request: Request, user: dict = Depends(require_owner)):
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(422, "Write the employee's name.")
    doc = {'id': f'EMP-{uuid.uuid4().hex[:8].upper()}', 'name': name[:80], 'designation': body.designation.strip()[:80], 'monthly_salary': money(body.monthly_salary),
           'joined_on': valid_date(body.joined_on, 'Joining date') or today_ist(), 'phone': body.phone.strip()[:20], 'pay_note': body.pay_note.strip()[:100], 'active': body.active, 'created_at': _stamp()}
    await pdb.platform_employees.insert_one(doc.copy())
    await audit(user, 'employee_added', doc['id'], {'name': name, 'salary': doc['monthly_salary']}, client_ip(request))
    return doc


@finance_router.put('/employees/{employee_id}')
async def update_employee(employee_id: str, body: EmployeeUpdate, request: Request, user: dict = Depends(require_owner)):
    emp = await pdb.platform_employees.find_one({'id': employee_id})
    if not emp:
        raise HTTPException(404, 'Employee not found.')
    changes: Dict[str, Any] = {}
    for key in ('designation', 'phone', 'pay_note'):
        value = getattr(body, key)
        if value is not None:
            changes[key] = value.strip()[:100]
    if body.name is not None:
        if len(body.name.strip()) < 2:
            raise HTTPException(422, "Write the employee's name.")
        changes['name'] = body.name.strip()[:80]
    if body.monthly_salary is not None:
        changes['monthly_salary'] = money(body.monthly_salary)
    if body.joined_on is not None:
        changes['joined_on'] = valid_date(body.joined_on, 'Joining date')
    if body.active is not None:
        changes['active'] = body.active
    if not changes:
        raise HTTPException(422, 'Nothing to change.')
    await pdb.platform_employees.update_one({'id': employee_id}, {'$set': changes})
    await audit(user, 'employee_updated', employee_id, {k: v for k, v in changes.items() if k != 'pay_note'}, client_ip(request))
    return clean(await pdb.platform_employees.find_one({'id': employee_id}))


# ---------------------------------------------------------------- the month's salaries
class GenerateBody(BaseModel):
    month: str


class SalaryEdit(BaseModel):
    additions: Optional[float] = Field(default=None, ge=0, le=100000000)
    deductions: Optional[float] = Field(default=None, ge=0, le=100000000)
    note: Optional[str] = None


class SalaryPayment(BaseModel):
    amount: float = Field(gt=0, le=1000000000)
    date: str = ''
    mode: str = 'Bank transfer'
    reference: str = ''


def salary_view(row: dict) -> dict:
    row = clean(dict(row))
    paid = money(sum(p['amount'] for p in row.get('payments', [])))
    row['paid_amount'] = paid
    row['balance'] = money(max(0.0, row['net'] - paid)) if row['status'] != 'Draft' else row['net']
    if row['status'] in ('Approved', 'Part paid', 'Paid'):
        row['status'] = 'Paid' if row['balance'] <= 0.005 and paid > 0 else ('Part paid' if paid > 0 else 'Approved')
    return row


def net_of(base: float, additions: float, deductions: float) -> float:
    return money(base + additions - deductions)


@finance_router.get('/payroll')
async def get_payroll(month: str = '', user: dict = Depends(require_perm('finance:read'))):
    month = month or this_month()
    start, end = month_range(month)
    rows = [salary_view(r) for r in await pdb.platform_salaries.find({'month': month}).sort('employee_name', 1).to_list(1000)]
    have = {r['employee_id'] for r in rows}
    waiting = [clean(e) for e in await pdb.platform_employees.find({'active': True, 'joined_on': {'$lte': end}}).sort('name', 1).to_list(500) if e['id'] not in have]
    live = [r for r in rows if r['status'] != 'Draft']
    return {'month': month, 'items': rows, 'not_prepared': [{'id': e['id'], 'name': e['name'], 'monthly_salary': e['monthly_salary']} for e in waiting], 'modes': PAY_MODES,
            'totals': {'net': money(sum(r['net'] for r in rows)), 'approved': money(sum(r['net'] for r in live)), 'paid': money(sum(r['paid_amount'] for r in rows)),
                       'balance': money(sum(r['balance'] for r in live)), 'draft': len([r for r in rows if r['status'] == 'Draft']), 'people': len(rows)}}


@finance_router.post('/payroll/generate')
async def generate_payroll(body: GenerateBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    """Prepare the month: one draft salary line for every active employee who has joined by then. Safe to press again."""
    start, end = month_range(body.month)
    added = 0
    for emp in await pdb.platform_employees.find({'active': True, 'joined_on': {'$lte': end}}).to_list(500):
        if await pdb.platform_salaries.find_one({'month': body.month, 'employee_id': emp['id']}):
            continue
        await pdb.platform_salaries.insert_one({'id': f'SAL-{uuid.uuid4().hex[:8].upper()}', 'month': body.month, 'employee_id': emp['id'], 'employee_name': emp['name'], 'designation': emp.get('designation', ''),
                                                'base': emp['monthly_salary'], 'additions': 0.0, 'deductions': 0.0, 'net': emp['monthly_salary'], 'note': '', 'status': 'Draft', 'payments': [], 'created_at': _stamp()})
        added += 1
    await audit(user, 'payroll_prepared', body.month, {'lines': added}, client_ip(request))
    return {'added': added}


async def load_salary(salary_id: str) -> dict:
    row = await pdb.platform_salaries.find_one({'id': salary_id})
    if not row:
        raise HTTPException(404, 'Salary line not found.')
    return row


@finance_router.put('/payroll/{salary_id}')
async def edit_salary(salary_id: str, body: SalaryEdit, request: Request, user: dict = Depends(require_staff('finance:write'))):
    row = await load_salary(salary_id)
    if row['status'] != 'Draft':
        raise HTTPException(409, 'Reopen the salary before changing it.')
    additions = row['additions'] if body.additions is None else money(body.additions)
    deductions = row['deductions'] if body.deductions is None else money(body.deductions)
    net = net_of(row['base'], additions, deductions)
    if net < 0:
        raise HTTPException(422, 'The deductions are more than the salary.')
    note = row.get('note', '') if body.note is None else body.note.strip()[:200]
    if (additions or deductions) and len(note) < 3:
        raise HTTPException(422, 'Write why there is an addition or a deduction (for example "Leave 2 days" or "Incentive").')
    await pdb.platform_salaries.update_one({'id': salary_id}, {'$set': {'additions': additions, 'deductions': deductions, 'net': net, 'note': note}})
    await audit(user, 'salary_edited', salary_id, {'who': row['employee_name'], 'month': row['month'], 'additions': additions, 'deductions': deductions, 'net': net}, client_ip(request))
    return salary_view(await pdb.platform_salaries.find_one({'id': salary_id}))


@finance_router.post('/payroll/{salary_id}/approve')
async def approve_salary(salary_id: str, request: Request, user: dict = Depends(require_staff('finance:write'))):
    row = await load_salary(salary_id)
    if row['status'] != 'Draft':
        raise HTTPException(409, 'This salary is already approved.')
    if row['net'] <= 0:
        raise HTTPException(422, 'The net salary is zero. Edit it or delete the line.')
    await pdb.platform_salaries.update_one({'id': salary_id}, {'$set': {'status': 'Approved', 'approved_by': user['name'], 'approved_at': _iso()}})
    await audit(user, 'salary_approved', salary_id, {'who': row['employee_name'], 'month': row['month'], 'net': row['net']}, client_ip(request))
    return salary_view(await pdb.platform_salaries.find_one({'id': salary_id}))


@finance_router.post('/payroll/{salary_id}/reopen')
async def reopen_salary(salary_id: str, request: Request, user: dict = Depends(require_staff('finance:write'))):
    row = await load_salary(salary_id)
    if row['status'] == 'Draft':
        raise HTTPException(409, 'This salary is not approved yet.')
    if row.get('payments'):
        raise HTTPException(409, 'A payment is already recorded, so it cannot be reopened.')
    await pdb.platform_salaries.update_one({'id': salary_id}, {'$set': {'status': 'Draft'}, '$unset': {'approved_by': '', 'approved_at': ''}})
    await audit(user, 'salary_reopened', salary_id, {'who': row['employee_name'], 'month': row['month']}, client_ip(request))
    return salary_view(await pdb.platform_salaries.find_one({'id': salary_id}))


@finance_router.post('/payroll/{salary_id}/payments')
async def pay_salary(salary_id: str, body: SalaryPayment, request: Request, user: dict = Depends(require_staff('finance:write'))):
    row = salary_view(await load_salary(salary_id))
    if row['status'] == 'Draft':
        raise HTTPException(422, 'Approve the salary before recording a payment.')
    if row['status'] == 'Paid':
        raise HTTPException(409, 'This salary is already paid in full.')
    amount = money(body.amount)
    if amount > row['balance'] + 0.005:
        raise HTTPException(422, f"Only ₹{row['balance']:,.2f} is left to pay.")
    if body.mode not in PAY_MODES:
        raise HTTPException(422, 'Choose how it was paid.')
    date = valid_date(body.date, 'Paid on') or today_ist()
    if date > today_ist():
        raise HTTPException(422, 'The date cannot be in the future.')
    payment = {'id': f'SPY-{uuid.uuid4().hex[:8].upper()}', 'amount': amount, 'date': date, 'mode': body.mode, 'reference': body.reference.strip()[:100], 'by': user['name'], 'at': _stamp()}
    await pdb.platform_salaries.update_one({'id': salary_id}, {'$push': {'payments': payment}})
    await audit(user, 'salary_paid', salary_id, {'who': row['employee_name'], 'month': row['month'], 'amount': amount, 'mode': body.mode, 'reference': body.reference}, client_ip(request))
    return salary_view(await pdb.platform_salaries.find_one({'id': salary_id}))


@finance_router.delete('/payroll/{salary_id}')
async def delete_salary(salary_id: str, request: Request, user: dict = Depends(require_staff('finance:write'))):
    row = await load_salary(salary_id)
    if row['status'] != 'Draft':
        raise HTTPException(409, 'Only a draft line can be removed.')
    await pdb.platform_salaries.delete_one({'id': salary_id})
    await audit(user, 'salary_deleted', salary_id, {'who': row['employee_name'], 'month': row['month']}, client_ip(request))
    return {'ok': True}


# ---------------------------------------------------------------- company expenses
class CompanyExpenseBody(BaseModel):
    date: str = ''
    category: str
    vendor: str = ''
    amount: float = Field(gt=0, le=1000000000)
    mode: str = 'Bank transfer'
    reference: str = ''
    note: str = ''


@finance_router.get('/company-expenses')
async def list_company_expenses(month: str = '', category: str = '', user: dict = Depends(require_perm('finance:read'))):
    month = month or this_month()
    start, end = month_range(month)
    query: Dict[str, Any] = {'date': {'$gte': start, '$lte': end}}
    if category:
        query['category'] = category
    rows = [clean(r) for r in await pdb.platform_company_expenses.find(query).sort([('date', -1), ('at', -1)]).to_list(2000)]
    by_cat: Dict[str, float] = {}
    for r in rows:
        by_cat[r['category']] = money(by_cat.get(r['category'], 0) + r['amount'])
    return {'month': month, 'items': rows, 'total': money(sum(r['amount'] for r in rows)), 'by_category': by_cat, 'categories': COMPANY_CATEGORIES, 'modes': PAY_MODES}


@finance_router.post('/company-expenses')
async def add_company_expense(body: CompanyExpenseBody, request: Request, user: dict = Depends(require_staff('finance:write'))):
    if body.category not in COMPANY_CATEGORIES:
        raise HTTPException(422, 'Choose a category from the list.')
    if body.mode not in PAY_MODES:
        raise HTTPException(422, 'Choose how it was paid.')
    date = valid_date(body.date, 'Date') or today_ist()
    if date > today_ist():
        raise HTTPException(422, 'The date cannot be in the future.')
    doc = {'id': f'CEX-{uuid.uuid4().hex[:8].upper()}', 'date': date, 'category': body.category, 'vendor': body.vendor.strip()[:100], 'amount': money(body.amount), 'mode': body.mode,
           'reference': body.reference.strip()[:100], 'note': body.note.strip()[:200], 'by': user['name'], 'at': _stamp()}
    await pdb.platform_company_expenses.insert_one(doc.copy())
    await audit(user, 'company_expense_added', doc['id'], {'category': doc['category'], 'amount': doc['amount'], 'vendor': doc['vendor']}, client_ip(request))
    return doc


@finance_router.delete('/company-expenses/{expense_id}')
async def delete_company_expense(expense_id: str, request: Request, user: dict = Depends(require_staff('finance:write'))):
    row = await pdb.platform_company_expenses.find_one({'id': expense_id})
    if not row:
        raise HTTPException(404, 'Expense not found.')
    await pdb.platform_company_expenses.delete_one({'id': expense_id})
    await audit(user, 'company_expense_deleted', expense_id, {'category': row['category'], 'amount': row['amount']}, client_ip(request))
    return {'ok': True}
