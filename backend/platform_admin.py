"""Orison platform admin ("super admin") API.

Used only by Orison's own team to run the business across schools: school records, plans and
feature switches, billing, usage, team logins and an audit log. It is deliberately separate from the
school staff login:

* its own accounts (``platform_users``) with password + mandatory authenticator-app 2FA,
* its own token (different secret, ``role='platform'``) that school endpoints do not accept,
* its own database (``PLATFORM_DB_NAME``, default ``<DB_NAME>_platform``),
* every change is written to ``platform_audit``.

It never reads student, fee or marks records.
"""
import asyncio
import io
import math
import base64
import hashlib
import hmac
import os
import re
import secrets
import struct
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urlparse

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).parent / '.env')

_client = AsyncIOMotorClient(os.environ['MONGO_URL'])
pdb = _client[os.environ.get('PLATFORM_DB_NAME') or f"{os.environ['DB_NAME']}_platform"]
sdb = _client[os.environ['DB_NAME']]

APP_ENV = os.environ.get('APP_ENV', 'development').strip().lower()
_base_secret = os.environ.get('PLATFORM_JWT_SECRET') or (os.environ.get('JWT_SECRET', 'dev-secret') + ':platform')
if APP_ENV in {'production', 'prod'} and (len(_base_secret) < 32 or _base_secret.startswith('dev-secret')):
    raise RuntimeError('Production requires PLATFORM_JWT_SECRET (or JWT_SECRET) with at least 32 characters.')
PLATFORM_SECRET = _base_secret
REQUIRE_2FA = os.environ.get('PLATFORM_REQUIRE_2FA', 'true').strip().lower() != 'false'
TOKEN_HOURS = 8
MAX_FAILED = 5
LOCK_MINUTES = 15
ISSUER = 'Orison Platform'

platform_router = APIRouter(prefix='/api/platform')

# ---------------------------------------------------------------- catalogue (maintained in code)
PLAN_ORDER = ['essential', 'pro', 'premium']
PLAN_LABELS = {'essential': 'Essential', 'pro': 'Pro', 'premium': 'Premium'}
PLAN_LOGINS = {
    'essential': ['admin', 'academic_coordinator', 'teacher'],
    'pro': ['admin', 'academic_coordinator', 'teacher', 'fee_manager', 'director'],
    'premium': ['admin', 'academic_coordinator', 'teacher', 'fee_manager', 'director', 'stock_manager', 'librarian'],
}
# (key, label, minimum plan, built?). "built: False" are the star items that are not built yet.
# Essential = the owner's "Essential model"; Pro = Essential + Transport, Visitor management, Parent App Center and the
# Director app; Premium = Pro + all remaining features.
FEATURE_CATALOG = [
    ('dashboard', 'Dashboard', 'essential', True),
    ('students', 'Student management (add, view, promote, profile)', 'essential', True),
    ('admissions_basic', 'Admission management (enquiries, applications)', 'essential', True),
    ('admissions_crm', 'Admissions follow-ups and reports', 'essential', True),
    ('academic_setup', 'Academic management: setup (year, classes, subjects)', 'essential', True),
    ('academic_action_center', 'Academic management: Action Center', 'essential', True),
    ('syllabus', 'Academic management: syllabus tracking', 'essential', True),
    ('student_health', 'Academic management: student health signals', 'essential', True),
    ('support_plans', 'Academic management: student support plans', 'essential', True),
    ('observations', 'Academic management: classroom observations', 'essential', True),
    ('attendance', 'Attendance management', 'essential', True),
    ('teachers', 'Teachers', 'essential', True),
    ('staff_directory', 'Staff directory', 'essential', True),
    ('fees', 'Fee management (collection and receipts)', 'essential', True),
    ('fee_control_center', 'Fee Control Center', 'essential', True),
    ('collection_intelligence', 'Collection Intelligence', 'essential', True),
    ('exams', 'Exams', 'essential', True),
    ('marks', 'Marks and report cards', 'essential', True),
    ('homework', 'Homework', 'essential', True),
    ('hall_tickets', 'Hall tickets', 'essential', True),
    ('leaves', 'Leave management', 'essential', True),
    ('timetable', 'Timetables', 'essential', True),
    ('notices', 'Notices and notifications', 'essential', True),
    ('communications', 'Communications', 'essential', True),
    ('settings', 'Settings', 'essential', True),
    ('parent_app', 'Parent app', 'essential', True),
    ('teacher_app', 'Teacher app', 'essential', True),
    ('transport', 'Transport', 'pro', True),
    ('visitors', 'Visitor management', 'pro', True),
    ('parent_app_center', 'Parent App Center', 'pro', True),
    ('director_app', 'Director app', 'pro', True),
    ('student_transfer', 'Transfer students (TC and branch transfer)', 'premium', True),
    ('question_bank', 'Question bank', 'premium', True),
    ('online_payments', 'Online fee payment link', 'premium', False),
    ('expenses', 'Expenses', 'premium', True),
    ('hr_payroll', 'HR and payroll', 'premium', True),
    ('inventory', 'Purchase and stock', 'premium', True),
    ('library', 'Library', 'premium', True),
    ('certificates', 'Certificates', 'premium', True),
    ('id_cards', 'ID cards', 'premium', True),
    ('consents', 'Consent forms', 'premium', True),
    ('compliance', 'Compliance (APAAR, PEN, UDISE+)', 'premium', True),
    ('multi_branch', 'Multi-branch', 'premium', True),
    ('management_action_center', 'Management Action Center', 'premium', True),
    ('auto_fee_reminders', 'Automatic fee-reminder schedule', 'premium', False),
    ('advanced_reports_tally', 'Advanced reports and Tally export', 'premium', False),
    ('branding', 'School logo and letterhead', 'premium', False),
    ('hostel', 'Hostel', 'premium', True),
    ('events', 'Events and photo gallery', 'premium', True),
    ('surveys', 'Surveys and feedback', 'premium', True),
    ('biometric', 'Biometric attendance', 'premium', True),
]
FEATURE_KEYS = {k for k, *_ in FEATURE_CATALOG}

# What each login gets by default. This mirrors the role access already built in the school app
# (backend ROLE_CONFIG and frontend roleAccess.js): Admin runs the whole school; every other login gets only
# what that person needs day to day. A school changes this per login; only the changes are stored.
ROLE_DEFAULT_FEATURES = {
    'admin': '*',
    'director': ['dashboard', 'admissions_crm', 'academic_action_center', 'student_health', 'observations', 'attendance', 'teachers',
                 'collection_intelligence', 'marks', 'leaves', 'timetable', 'notices', 'transport', 'visitors',
                 'multi_branch', 'director_app', 'management_action_center', 'parent_app_center', 'compliance', 'consents',
                 'events', 'surveys'],
    'academic_coordinator': ['dashboard', 'academic_action_center', 'syllabus', 'student_health', 'support_plans', 'observations', 'attendance',
                             'exams', 'marks', 'homework', 'timetable', 'consents', 'surveys', 'notices'],
    'fee_manager': ['dashboard', 'fees', 'fee_control_center', 'online_payments', 'collection_intelligence', 'expenses', 'hr_payroll',
                    'advanced_reports_tally', 'auto_fee_reminders', 'notices'],
    'teacher': ['dashboard', 'attendance', 'marks', 'homework', 'timetable', 'leaves', 'consents', 'notices', 'teacher_app'],
    'stock_manager': ['dashboard', 'inventory', 'notices'],
    'librarian': ['dashboard', 'library', 'notices'],
}

# Areas used only to group features on the screen and for the "keep fees away from Admin" shortcut.
# Areas a school can hide from one of its logins (for example "Fees & money" from the school Admin).
# By default every login keeps its standard access; a school only stores what is hidden.
AREAS = {
    'general': {'label': 'Dashboard, settings & communication', 'features': ['dashboard', 'settings', 'notices', 'communications', 'parent_app', 'teacher_app', 'branding']},
    'fees_money': {'label': 'Fees & money', 'features': ['fees', 'fee_control_center', 'collection_intelligence', 'online_payments', 'expenses', 'advanced_reports_tally', 'auto_fee_reminders']},
    'staff_hr': {'label': 'Staff, leave & payroll', 'features': ['teachers', 'staff_directory', 'leaves', 'hr_payroll', 'biometric']},
    'academics': {'label': 'Academics & exams', 'features': ['academic_setup', 'timetable', 'homework', 'exams', 'marks', 'hall_tickets', 'attendance', 'syllabus', 'student_health', 'support_plans', 'observations', 'question_bank', 'academic_action_center']},
    'students': {'label': 'Students & admissions', 'features': ['students', 'student_transfer', 'admissions_basic', 'admissions_crm', 'parent_app_center']},
    'campus': {'label': 'Transport, stock, library & campus', 'features': ['transport', 'inventory', 'library', 'visitors', 'hostel', 'events', 'surveys']},
    'documents': {'label': 'Certificates & compliance', 'features': ['certificates', 'id_cards', 'consents', 'compliance']},
    'leadership': {'label': 'Branches & leadership', 'features': ['multi_branch', 'director_app', 'management_action_center']},
}

# Starting values only. The business team edits them in Plans & pricing; nothing reads these constants after seeding.
DEFAULT_PLANS = {
    'essential': {'rate_per_student': 200, 'minimum_fee': 0, 'setup_fee': 0, 'whatsapp_per_student': 10},
    'pro': {'rate_per_student': 350, 'minimum_fee': 0, 'setup_fee': 0, 'whatsapp_per_student': 20},
    'premium': {'rate_per_student': 500, 'minimum_fee': 0, 'setup_fee': 0, 'whatsapp_per_student': 30},
}
DEFAULT_SETTINGS = {
    'id': 'platform', 'gst_percent': 18, 'overage_rate_per_message': 0, 'alert_thresholds': [80, 100],
    'invoice_prefix': 'ORI', 'company_name': 'Orison Services', 'gstin': '', 'address': '',
    'payment_terms_days': 15,
}

ROLE_PERMISSIONS = {
    'owner': {'*'},
    'developer': {'tickets:read', 'tickets:write'},  # only the support tickets: no schools, prices, billing or team
    # Sales works only on their own leads (schools they visit) and can read the price list to quote. Nothing else.
    'sales': {'leads:own', 'pricing:read'},
}
SCHOOL_STATUSES = ['Trial', 'Active', 'Suspended', 'Expired']


def role_base_features(role: str, plan_feature_list) -> set:
    """The features a login gets by default, limited to what the school's plan includes."""
    plan_set = set(plan_feature_list)
    default = ROLE_DEFAULT_FEATURES.get(role, [])
    return set(plan_set) if default == '*' else {k for k in default if k in plan_set}


def effective_role_features(role: str, plan_feature_list, overrides: Optional[Dict[str, bool]] = None) -> set:
    plan_set = set(plan_feature_list)
    features = role_base_features(role, plan_set)
    for key, value in (overrides or {}).items():
        if key in plan_set:
            (features.add if value else features.discard)(key)
    return features


def plan_features(plan: str, overrides: Optional[Dict[str, bool]] = None) -> List[str]:
    rank = PLAN_ORDER.index(plan) if plan in PLAN_ORDER else 0
    enabled = {k for k, _, p, _ in FEATURE_CATALOG if PLAN_ORDER.index(p) <= rank}
    for key, value in (overrides or {}).items():
        if key in FEATURE_KEYS:
            (enabled.add if value else enabled.discard)(key)
    return sorted(enabled)


# ---------------------------------------------------------------- passwords, tokens, 2FA
def _now() -> datetime:
    return datetime.utcnow()


def _stamp() -> str:
    """A timestamp precise to the millisecond, so entries made in the same second keep their order."""
    return _now().isoformat(timespec='milliseconds')


def _iso(value: Optional[datetime] = None) -> str:
    return (value or _now()).isoformat(timespec='seconds')


def hash_password(password: str, salt_hex: Optional[str] = None):
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 310000)
    return salt.hex(), base64.b64encode(digest).decode('ascii')


def check_password_strength(password: str):
    if len(password or '') < 12:
        raise HTTPException(422, 'Use at least 12 characters for a platform password.')
    if not (re.search(r'[A-Za-z]', password) and re.search(r'\d', password)):
        raise HTTPException(422, 'Use letters and numbers in the password.')


def new_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode('ascii').rstrip('=')


def totp_at(secret: str, counter: int, digits: int = 6) -> str:
    key = base64.b32decode(secret + '=' * (-len(secret) % 8))
    digest = hmac.new(key, struct.pack('>Q', counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return f'{code:0{digits}d}'


def verify_totp(secret: str, code: str, last_counter: int = 0) -> Optional[int]:
    """Return the matched time-step (to block replays) or None."""
    code = re.sub(r'\s', '', str(code or ''))
    if not re.fullmatch(r'\d{6}', code):
        return None
    current = int(time.time() // 30)
    for counter in (current - 1, current, current + 1):
        if counter > last_counter and hmac.compare_digest(totp_at(secret, counter), code):
            return counter
    return None


def make_token(user: dict, mfa: bool) -> str:
    payload = {'role': 'platform', 'sub': user['id'], 'prole': user['role'], 'mfa': bool(mfa),
               'exp': _now() + timedelta(hours=TOKEN_HOURS), 'iat': _now()}
    return jwt.encode(payload, PLATFORM_SECRET, algorithm='HS256')


def client_ip(request: Request) -> str:
    return (request.client.host if request.client else '') or ''


async def audit(actor: Optional[dict], action: str, target: str = '', detail: Any = None, ip: str = '', actor_label: str = ''):
    await pdb.platform_audit.insert_one({
        'id': f'AUD-{uuid.uuid4().hex[:12].upper()}', 'at': _iso(),
        'actor_id': (actor or {}).get('id', ''), 'actor': (actor or {}).get('email', actor_label),
        'actor_role': (actor or {}).get('role', ''), 'action': action, 'target': target,
        'detail': detail if detail is not None else '', 'ip': ip,
    })


def public_user(user: dict) -> dict:
    return {k: user.get(k) for k in ('id', 'email', 'name', 'role', 'active', 'totp_enabled', 'last_login', 'created')}


async def _load_user(authorization: Optional[str], mfa_required: bool) -> dict:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Not authenticated')
    try:
        payload = jwt.decode(authorization.split(' ', 1)[1], PLATFORM_SECRET, algorithms=['HS256'])
    except jwt.PyJWTError:
        raise HTTPException(401, 'Your session has ended. Please sign in again.')
    if payload.get('role') != 'platform':
        raise HTTPException(401, 'Not authenticated')
    user = await pdb.platform_users.find_one({'id': payload.get('sub')})
    if not user or not user.get('active', True):
        raise HTTPException(401, 'This account is not active.')
    if REQUIRE_2FA and mfa_required and not payload.get('mfa'):
        raise HTTPException(403, 'Two-step verification is required. Finish setting it up to continue.')
    user.pop('_id', None)
    return user


async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    """A fully verified platform session (password and, when required, 2FA)."""
    return await _load_user(authorization, True)


async def current_user_pre_mfa(authorization: Optional[str] = Header(None)) -> dict:
    """A password-only session; used just for the 2FA setup screens."""
    return await _load_user(authorization, False)


def require_perm(permission: str):
    async def dependency(user: dict = Depends(current_user)) -> dict:
        allowed = ROLE_PERMISSIONS.get(user.get('role'), set())
        if '*' in allowed or permission in allowed:
            return user
        raise HTTPException(403, 'Your platform role does not allow this action.')
    return dependency


# ---------------------------------------------------------------- models
class LoginBody(BaseModel):
    email: str
    password: str
    otp: str = ''


class PasswordBody(BaseModel):
    current_password: str
    new_password: str


class OtpBody(BaseModel):
    otp: str


class UserBody(BaseModel):
    email: str
    name: str
    role: str = 'support'
    password: str = ''


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    new_password: Optional[str] = None
    reset_2fa: Optional[bool] = None


class SchoolBody(BaseModel):
    name: str
    code: str
    plan: str = 'essential'
    status: str = 'Trial'
    board: str = ''
    address: str = ''
    city: str = ''
    state: str = ''
    contact_name: str = ''
    contact_email: str = ''
    contact_phone: str = ''
    student_count: int = Field(default=0, ge=0)
    branch_count: int = Field(default=1, ge=1)
    contract_start: str = ''
    contract_end: str = ''
    discount_percent: float = Field(default=0, ge=0, le=100)
    setup_fee_waived: bool = False
    notes: str = ''


class SchoolUpdate(BaseModel):
    name: Optional[str] = None
    board: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    student_count: Optional[int] = Field(default=None, ge=0)
    branch_count: Optional[int] = Field(default=None, ge=1)
    student_limit: Optional[int] = Field(default=None, ge=0)
    branch_limit: Optional[int] = Field(default=None, ge=1)
    contract_start: Optional[str] = None
    contract_end: Optional[str] = None
    discount_percent: Optional[float] = Field(default=None, ge=0, le=100)
    setup_fee_waived: Optional[bool] = None
    whatsapp_sender: Optional[str] = None
    whatsapp_used_month: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None
    last_login_at: Optional[str] = None


class PlanChange(BaseModel):
    plan: str
    reason: str = ''


class StatusChange(BaseModel):
    status: str
    reason: str = ''


class FeatureOverrides(BaseModel):
    overrides: Dict[str, bool]
    reason: str = ''


class AccessBody(BaseModel):
    logins: List[str]
    access: Dict[str, List[str]] = Field(default_factory=dict)  # login -> the features it may open
    reason: str = ''


class InvoiceCreate(BaseModel):
    student_count: Optional[int] = Field(default=None, ge=0)
    academic_year: str = ''
    include_setup_fee: Optional[bool] = None
    note: str = ''


class InvoicePay(BaseModel):
    status: str = 'Paid'
    method: str = ''
    reference: str = ''
    paid_on: str = ''


class PlanUpdate(BaseModel):
    rate_per_student: Optional[float] = Field(default=None, ge=0)
    minimum_fee: Optional[float] = Field(default=None, ge=0)
    setup_fee: Optional[float] = Field(default=None, ge=0)
    whatsapp_per_student: Optional[int] = Field(default=None, ge=0)


class SettingsUpdate(BaseModel):
    gst_percent: Optional[float] = Field(default=None, ge=0, le=100)
    overage_rate_per_message: Optional[float] = Field(default=None, ge=0)
    invoice_prefix: Optional[str] = None
    company_name: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: Optional[int] = Field(default=None, ge=0, le=365)


# ---------------------------------------------------------------- helpers
def clean(doc: Optional[dict]) -> Optional[dict]:
    if doc:
        doc.pop('_id', None)
    return doc


def valid_email(value: str) -> str:
    value = (value or '').strip().lower()
    if not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', value):
        raise HTTPException(422, 'Enter a valid email address.')
    return value


def valid_date(value: str, label: str) -> str:
    value = (value or '').strip()
    if not value:
        return ''
    try:
        datetime.strptime(value, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(422, f'{label} must be a date in YYYY-MM-DD format.')
    return value


async def get_plans() -> Dict[str, dict]:
    stored = {doc['id']: clean(doc) for doc in await pdb.platform_plans.find({}).to_list(10)}
    return {p: {**DEFAULT_PLANS[p], **stored.get(p, {}), 'id': p, 'label': PLAN_LABELS[p]} for p in PLAN_ORDER}


async def get_settings() -> dict:
    return {**DEFAULT_SETTINGS, **clean(await pdb.platform_settings.find_one({'id': 'platform'}) or {})}


def shape_school(school: dict, plans: Optional[Dict[str, dict]] = None) -> dict:
    school = clean(dict(school))
    features = plan_features(school.get('plan', 'essential'), school.get('feature_overrides'))
    students = int(school.get('student_count') or 0)
    wa_per = int(((plans or {}).get(school.get('plan', 'essential')) or {}).get('whatsapp_per_student') or 0)
    wa_limit = students * wa_per
    used = int(school.get('whatsapp_used_month') or 0)
    plan_logins = PLAN_LOGINS.get(school.get('plan', 'essential'), [])
    enabled = [r for r in (school.get('enabled_logins') or plan_logins) if r in plan_logins]
    defaults = {r: sorted(role_base_features(r, features)) for r in plan_logins}
    overrides = school.get('role_overrides') or {}
    school['features'] = features
    school['plan_logins'] = plan_logins
    school['logins'] = enabled
    school['role_defaults'] = defaults
    school['role_features'] = {r: sorted(effective_role_features(r, features, overrides.get(r))) for r in enabled}
    school['role_overrides'] = {r: overrides[r] for r in enabled if overrides.get(r)}
    school['whatsapp_limit'] = wa_limit
    school['whatsapp_percent'] = round(used * 100 / wa_limit, 1) if wa_limit else 0
    return school


def compute_invoice(school: dict, plan_cfg: dict, settings: dict, students: int, include_setup: bool) -> dict:
    gross = students * float(plan_cfg['rate_per_student'])
    discount = round(gross * float(school.get('discount_percent') or 0) / 100, 2)
    per_student_total = round(gross - discount, 2)
    minimum = float(plan_cfg['minimum_fee'])
    subscription = max(per_student_total, minimum)
    setup = float(plan_cfg['setup_fee']) if include_setup else 0.0
    taxable = round(subscription + setup, 2)
    gst = round(taxable * float(settings['gst_percent']) / 100, 2)
    return {
        'students': students, 'rate_per_student': float(plan_cfg['rate_per_student']),
        'discount_percent': float(school.get('discount_percent') or 0), 'discount_amount': discount,
        'minimum_fee': minimum, 'minimum_applied': minimum > per_student_total,
        'subscription': subscription, 'setup_fee': setup, 'taxable': taxable,
        'gst_percent': float(settings['gst_percent']), 'gst': gst, 'total': round(taxable + gst, 2),
    }


# ---------------------------------------------------------------- startup
async def platform_startup():
    await pdb.platform_users.create_index('email', unique=True)
    await pdb.schools.create_index('code', unique=True)
    await pdb.schools.create_index([('status', 1), ('plan', 1)])
    await pdb.platform_audit.create_index([('at', -1)])
    await pdb.platform_invoices.create_index([('school_id', 1), ('created', -1)])
    await pdb.platform_invoices.create_index('number', unique=True)
    await pdb.platform_logins.create_index([('school_id', 1), ('at', -1)])
    await pdb.platform_tickets.create_index('id', unique=True)
    await pdb.platform_leads.create_index('id', unique=True)
    await pdb.platform_leads.create_index([('owner_id', 1), ('updated_at', -1)])
    await pdb.school_accounts.create_index([('school_id', 1), ('role', 1)], unique=True)
    await pdb.school_accounts.create_index('username', unique=True)
    await pdb.platform_tickets.create_index([('school_id', 1), ('created_at', -1)])
    await pdb.platform_tickets.create_index([('status', 1), ('created_at', -1)])
    await pdb.platform_tickets.create_index([('reporter_key', 1), ('created_at', -1)])
    await pdb.platform_usage_daily.create_index([('school_id', 1), ('date', 1), ('role', 1), ('client', 1), ('feature', 1)], unique=True)
    await pdb.platform_app_users.create_index([('school_id', 1), ('client', 1), ('user_key', 1)], unique=True)
    for plan, values in DEFAULT_PLANS.items():
        await pdb.platform_plans.update_one({'id': plan}, {'$setOnInsert': {'id': plan, **values}}, upsert=True)
    await pdb.platform_settings.update_one({'id': 'platform'}, {'$setOnInsert': DEFAULT_SETTINGS}, upsert=True)


# ---------------------------------------------------------------- auth
@platform_router.post('/auth/login')
async def platform_login(body: LoginBody, request: Request):
    email = (body.email or '').strip().lower()
    ip = client_ip(request)
    generic = HTTPException(401, 'The email, password or code is not correct.')
    user = await pdb.platform_users.find_one({'email': email})
    if not user or not user.get('active', True):
        await asyncio.to_thread(hash_password, body.password or 'x', None)  # keep timing similar
        await audit(None, 'login_failed', email, 'unknown or inactive account', ip, actor_label=email)
        raise generic
    locked_until = user.get('locked_until')
    if locked_until and datetime.fromisoformat(locked_until) > _now():
        await audit(user, 'login_blocked', email, 'account locked', ip)
        raise HTTPException(429, 'Too many failed attempts. Try again in a few minutes.')
    _, actual = await asyncio.to_thread(hash_password, body.password or '', user['salt'])
    ok = hmac.compare_digest(actual, user['hash'])
    if ok and user.get('totp_enabled'):
        counter = verify_totp(user['totp_secret'], body.otp, int(user.get('totp_last_counter') or 0))
        if counter is None:
            ok = False
        else:
            await pdb.platform_users.update_one({'id': user['id']}, {'$set': {'totp_last_counter': counter}})
    if not ok:
        failed = int(user.get('failed_count') or 0) + 1
        changes = {'failed_count': failed}
        if failed >= MAX_FAILED:
            changes.update({'failed_count': 0, 'locked_until': _iso(_now() + timedelta(minutes=LOCK_MINUTES))})
        await pdb.platform_users.update_one({'id': user['id']}, {'$set': changes})
        await audit(user, 'login_failed', email, f'attempt {failed}', ip)
        raise generic
    await pdb.platform_users.update_one({'id': user['id']}, {'$set': {'failed_count': 0, 'locked_until': '', 'last_login': _iso()}})
    mfa_ok = bool(user.get('totp_enabled'))
    await audit(user, 'login', email, '2FA verified' if mfa_ok else 'password only; 2FA setup pending', ip)
    return {'token': make_token(user, mfa_ok), 'user': public_user(user),
            'needs_2fa_setup': REQUIRE_2FA and not mfa_ok}


@platform_router.get('/auth/me')
async def platform_me(user: dict = Depends(current_user_pre_mfa)):
    return {'user': public_user(user), 'needs_2fa_setup': REQUIRE_2FA and not user.get('totp_enabled'),
            'permissions': sorted(ROLE_PERMISSIONS.get(user['role'], set()))}


class ProfileBody(BaseModel):
    name: str


@platform_router.put('/auth/me')
async def update_profile(body: ProfileBody, request: Request, user: dict = Depends(current_user)):
    """Change your own display name. It shows in the greeting, the menu and wherever your name is recorded."""
    name = ' '.join(body.name.split())
    if not 2 <= len(name) <= 60:
        raise HTTPException(422, 'Enter your name (2 to 60 characters).')
    if name == user['name']:
        raise HTTPException(422, 'That is already your name.')
    await pdb.platform_users.update_one({'id': user['id']}, {'$set': {'name': name}})
    await pdb.platform_tickets.update_many({'assigned_to': user['id']}, {'$set': {'assigned_name': name}})  # keep copies of the name in step
    await pdb.platform_leads.update_many({'owner_id': user['id']}, {'$set': {'owner_name': name}})
    await audit(user, 'profile_updated', user['email'], {'name': name}, client_ip(request))
    return {'user': public_user({**user, 'name': name})}


@platform_router.post('/auth/logout')
async def platform_logout(request: Request, user: dict = Depends(current_user_pre_mfa)):
    await audit(user, 'logout', user['email'], '', client_ip(request))
    return {'ok': True}


@platform_router.post('/auth/2fa/setup')
async def setup_2fa(request: Request, user: dict = Depends(current_user_pre_mfa)):
    if user.get('totp_enabled'):
        raise HTTPException(409, 'Two-step verification is already on. Ask the Owner to reset it if you lost your phone.')
    # Keep the same key until setup succeeds, so reloading the page or opening it twice
    # can never leave the phone with a key the server no longer expects.
    secret = user.get('totp_pending')
    if not secret:
        secret = new_totp_secret()
        await pdb.platform_users.update_one({'id': user['id'], 'totp_pending': {'$exists': False}}, {'$set': {'totp_pending': secret}})
        saved = await pdb.platform_users.find_one({'id': user['id']})
        secret = saved.get('totp_pending') or secret
    uri = f"otpauth://totp/{quote(ISSUER)}:{quote(user['email'])}?secret={secret}&issuer={quote(ISSUER)}&digits=6&period=30"
    await audit(user, '2fa_setup_started', user['email'], '', client_ip(request))
    return {'secret': secret, 'otpauth_uri': uri}


@platform_router.post('/auth/2fa/enable')
async def enable_2fa(body: OtpBody, request: Request, user: dict = Depends(current_user_pre_mfa)):
    secret = user.get('totp_pending')
    if not secret:
        raise HTTPException(409, 'Start the setup first.')
    counter = verify_totp(secret, body.otp)
    if counter is None:
        raise HTTPException(422, 'That code is not correct. Check the time on your phone and try again.')
    await pdb.platform_users.update_one({'id': user['id']}, {
        '$set': {'totp_secret': secret, 'totp_enabled': True, 'totp_last_counter': counter}, '$unset': {'totp_pending': ''}})
    await audit(user, '2fa_enabled', user['email'], '', client_ip(request))
    user['totp_enabled'] = True
    return {'token': make_token(user, True), 'user': public_user(user)}


@platform_router.post('/auth/change-password')
async def change_password(body: PasswordBody, request: Request, user: dict = Depends(current_user)):
    _, actual = await asyncio.to_thread(hash_password, body.current_password or '', user['salt'])
    if not hmac.compare_digest(actual, user['hash']):
        raise HTTPException(401, 'The current password is not correct.')
    check_password_strength(body.new_password)
    salt, digest = await asyncio.to_thread(hash_password, body.new_password, None)
    await pdb.platform_users.update_one({'id': user['id']}, {'$set': {'salt': salt, 'hash': digest, 'password_changed': _iso()}})
    await audit(user, 'password_changed', user['email'], '', client_ip(request))
    return {'ok': True}


# ---------------------------------------------------------------- team
@platform_router.get('/users')
async def list_users(user: dict = Depends(require_perm('team:read'))):
    rows = await pdb.platform_users.find({}).sort('created', 1).to_list(200)
    return [public_user(row) for row in rows]


@platform_router.post('/users')
async def create_user(body: UserBody, request: Request, user: dict = Depends(require_perm('team:write'))):
    email = valid_email(body.email)
    if body.role not in ROLE_PERMISSIONS:
        raise HTTPException(422, 'Choose Owner, Support or Sales.')
    if not body.name.strip():
        raise HTTPException(422, 'Enter the person\'s name.')
    check_password_strength(body.password)
    if await pdb.platform_users.find_one({'email': email}):
        raise HTTPException(409, 'A platform user with this email already exists.')
    salt, digest = await asyncio.to_thread(hash_password, body.password, None)
    doc = {'id': f'PU-{uuid.uuid4().hex[:8].upper()}', 'email': email, 'name': body.name.strip(), 'role': body.role,
           'active': True, 'salt': salt, 'hash': digest, 'totp_enabled': False, 'created': _iso(), 'last_login': ''}
    await pdb.platform_users.insert_one(doc.copy())
    await audit(user, 'user_created', email, {'role': body.role}, client_ip(request))
    return public_user(doc)


@platform_router.put('/users/{user_id}')
async def update_user(user_id: str, body: UserUpdate, request: Request, user: dict = Depends(require_perm('team:write'))):
    target = await pdb.platform_users.find_one({'id': user_id})
    if not target:
        raise HTTPException(404, 'User not found.')
    changes: Dict[str, Any] = {}
    unset: Dict[str, str] = {}
    if body.name is not None and body.name.strip():
        changes['name'] = body.name.strip()
    if body.role is not None:
        if body.role not in ROLE_PERMISSIONS:
            raise HTTPException(422, 'Choose Owner, Support or Sales.')
        changes['role'] = body.role
    if body.active is not None:
        changes['active'] = body.active
    loses_owner = target.get('role') == 'owner' and target.get('active', True) and (
        changes.get('active') is False or ('role' in changes and changes['role'] != 'owner'))
    if loses_owner:
        if target['id'] == user['id']:
            raise HTTPException(422, 'You cannot lock yourself out. Ask another Owner to change your access.')
        if await pdb.platform_users.count_documents({'role': 'owner', 'active': True, 'id': {'$ne': target['id']}}) == 0:
            raise HTTPException(422, 'There must always be at least one active Owner.')
    if body.new_password:
        check_password_strength(body.new_password)
        changes['salt'], changes['hash'] = await asyncio.to_thread(hash_password, body.new_password, None)
        changes.update({'failed_count': 0, 'locked_until': ''})
    if body.reset_2fa:
        changes['totp_enabled'] = False
        unset.update({'totp_secret': '', 'totp_pending': ''})
    if not changes and not unset:
        raise HTTPException(422, 'Nothing to change.')
    update = {'$set': changes}
    if unset:
        update['$unset'] = unset
    await pdb.platform_users.update_one({'id': user_id}, update)
    detail = {k: ('changed' if k in {'salt', 'hash'} else v) for k, v in changes.items() if k not in {'failed_count', 'locked_until'}}
    if body.reset_2fa:
        detail['2fa'] = 'reset'
    await audit(user, 'user_updated', target['email'], detail, client_ip(request))
    return public_user(await pdb.platform_users.find_one({'id': user_id}))


# ---------------------------------------------------------------- catalogue, plans, settings
@platform_router.get('/catalog')
async def get_catalog(user: dict = Depends(current_user)):
    return {
        'features': [{'key': k, 'label': l, 'min_plan': p, 'built': b} for k, l, p, b in FEATURE_CATALOG],
        'plans': PLAN_ORDER, 'plan_labels': PLAN_LABELS, 'plan_logins': PLAN_LOGINS,
        'areas': [{'key': k, 'label': v['label'], 'features': v['features']} for k, v in AREAS.items()],
        'statuses': SCHOOL_STATUSES, 'roles': list(ROLE_PERMISSIONS),
    }


@platform_router.get('/plans')
async def list_plans(user: dict = Depends(require_perm('pricing:read'))):
    plans = await get_plans()
    for plan in plans.values():
        plan['features'] = plan_features(plan['id'])
        plan['logins'] = PLAN_LOGINS[plan['id']]
    settings = await get_settings()
    if '*' not in ROLE_PERMISSIONS.get(user['role'], set()):
        settings = {'gst_percent': settings['gst_percent']}  # a salesperson only needs GST to quote
    return {'plans': list(plans.values()), 'settings': settings}


@platform_router.put('/plans/{plan_id}')
async def update_plan(plan_id: str, body: PlanUpdate, request: Request, user: dict = Depends(require_perm('plans:write'))):
    if plan_id not in PLAN_ORDER:
        raise HTTPException(404, 'Unknown plan.')
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    if not changes:
        raise HTTPException(422, 'Nothing to change.')
    await pdb.platform_plans.update_one({'id': plan_id}, {'$set': changes}, upsert=True)
    await audit(user, 'plan_pricing_updated', plan_id, changes, client_ip(request))
    return (await get_plans())[plan_id]


@platform_router.put('/settings')
async def update_settings(body: SettingsUpdate, request: Request, user: dict = Depends(require_perm('plans:write'))):
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    if not changes:
        raise HTTPException(422, 'Nothing to change.')
    await pdb.platform_settings.update_one({'id': 'platform'}, {'$set': changes}, upsert=True)
    await audit(user, 'billing_settings_updated', 'platform', changes, client_ip(request))
    return await get_settings()


# ---------------------------------------------------------------- schools
@platform_router.get('/schools')
async def list_schools(q: str = '', status: str = '', plan: str = '', user: dict = Depends(require_perm('schools:read'))):
    query: Dict[str, Any] = {}
    if status:
        query['status'] = status
    if plan:
        query['plan'] = plan
    if q.strip():
        pattern = {'$regex': re.escape(q.strip()), '$options': 'i'}
        query['$or'] = [{'name': pattern}, {'code': pattern}, {'city': pattern}, {'contact_name': pattern}]
    plans = await get_plans()
    rows = await pdb.schools.find(query).sort('name', 1).to_list(2000)
    return [shape_school(row, plans) for row in rows]


@platform_router.post('/schools')
async def create_school(body: SchoolBody, request: Request, user: dict = Depends(require_perm('schools:create'))):
    code = body.code.strip().lower()
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{2,23}', code):
        raise HTTPException(422, 'School code: 3 to 24 letters, numbers or hyphens (for example "greenvalley").')
    if not body.name.strip():
        raise HTTPException(422, 'Enter the school name.')
    if body.plan not in PLAN_ORDER:
        raise HTTPException(422, 'Choose Essential, Pro or Premium.')
    if body.status not in SCHOOL_STATUSES:
        raise HTTPException(422, 'Choose a valid status.')
    if body.contact_email:
        valid_email(body.contact_email)
    if await pdb.schools.find_one({'code': code}):
        raise HTTPException(409, 'This school code is already used.')
    doc = body.model_dump()
    doc.update({'id': f'SCH-{uuid.uuid4().hex[:8].upper()}', 'code': code, 'name': body.name.strip(),
                'contract_start': valid_date(body.contract_start, 'Contract start'),
                'contract_end': valid_date(body.contract_end, 'Contract end'),
                'feature_overrides': {}, 'student_limit': None, 'branch_limit': None,
                'whatsapp_sender': '', 'whatsapp_used_month': 0, 'last_login_at': '',
                'created': _iso(), 'created_by': user['email'], 'status_history': [
                    {'status': body.status, 'at': _iso(), 'by': user['email'], 'reason': 'School created'}]})
    await pdb.schools.insert_one(doc.copy())
    await audit(user, 'school_created', doc['id'], {'name': doc['name'], 'plan': doc['plan']}, client_ip(request))
    return shape_school(doc, await get_plans())


async def load_school(school_id: str) -> dict:
    school = await pdb.schools.find_one({'id': school_id})
    if not school:
        raise HTTPException(404, 'School not found.')
    return school


@platform_router.get('/schools/{school_id}')
async def get_school(school_id: str, user: dict = Depends(require_perm('schools:read'))):
    school = shape_school(await load_school(school_id), await get_plans())
    can_billing = '*' in ROLE_PERMISSIONS[user['role']] or 'billing:read' in ROLE_PERMISSIONS[user['role']]
    school['invoices'] = [clean(row) for row in await pdb.platform_invoices.find({'school_id': school_id}).sort('created', -1).to_list(100)] if can_billing else []
    return school


@platform_router.put('/schools/{school_id}')
async def update_school(school_id: str, body: SchoolUpdate, request: Request, user: dict = Depends(require_perm('schools:write'))):
    school = await load_school(school_id)
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    for key in ('contract_start', 'contract_end'):
        if key in changes:
            changes[key] = valid_date(changes[key], key.replace('_', ' ').capitalize())
    if changes.get('contact_email'):
        valid_email(changes['contact_email'])
    if 'name' in changes and not changes['name'].strip():
        raise HTTPException(422, 'Enter the school name.')
    if not changes:
        raise HTTPException(422, 'Nothing to change.')
    await pdb.schools.update_one({'id': school_id}, {'$set': {**changes, 'updated': _iso()}})
    await audit(user, 'school_updated', school_id, {k: v for k, v in changes.items() if v != school.get(k)}, client_ip(request))
    return shape_school(await load_school(school_id), await get_plans())


@platform_router.post('/schools/{school_id}/plan')
async def change_plan(school_id: str, body: PlanChange, request: Request, user: dict = Depends(require_perm('schools:plan'))):
    school = await load_school(school_id)
    if body.plan not in PLAN_ORDER:
        raise HTTPException(422, 'Choose Essential, Pro or Premium.')
    if body.plan == school.get('plan'):
        raise HTTPException(422, 'The school is already on this plan.')
    new_allowed = PLAN_LOGINS[body.plan]
    kept = [r for r in (school.get('enabled_logins') or []) if r in new_allowed] or None
    kept_overrides = {r: o for r, o in (school.get('role_overrides') or {}).items() if r in new_allowed and (kept is None or r in kept)}
    await pdb.schools.update_one({'id': school_id}, {
        '$set': {'plan': body.plan, 'updated': _iso(), 'enabled_logins': kept, 'role_overrides': kept_overrides},
        '$push': {'plan_history': {'from': school.get('plan'), 'to': body.plan, 'at': _iso(), 'by': user['email'], 'reason': body.reason}}})
    await audit(user, 'school_plan_changed', school_id, {'from': school.get('plan'), 'to': body.plan, 'reason': body.reason}, client_ip(request))
    return shape_school(await load_school(school_id), await get_plans())


@platform_router.post('/schools/{school_id}/status')
async def change_status(school_id: str, body: StatusChange, request: Request, user: dict = Depends(require_perm('schools:status'))):
    school = await load_school(school_id)
    if body.status not in SCHOOL_STATUSES:
        raise HTTPException(422, 'Choose a valid status.')
    if body.status == 'Suspended' and not body.reason.strip():
        raise HTTPException(422, 'Enter a reason for suspending the school.')
    await pdb.schools.update_one({'id': school_id}, {
        '$set': {'status': body.status, 'updated': _iso()},
        '$push': {'status_history': {'status': body.status, 'at': _iso(), 'by': user['email'], 'reason': body.reason}}})
    await audit(user, 'school_status_changed', school_id, {'from': school.get('status'), 'to': body.status, 'reason': body.reason}, client_ip(request))
    return shape_school(await load_school(school_id), await get_plans())


@platform_router.put('/schools/{school_id}/features')
async def set_feature_overrides(school_id: str, body: FeatureOverrides, request: Request, user: dict = Depends(require_perm('schools:plan'))):
    school = await load_school(school_id)
    unknown = [k for k in body.overrides if k not in FEATURE_KEYS]
    if unknown:
        raise HTTPException(422, f'Unknown feature: {unknown[0]}')
    base = set(plan_features(school.get('plan', 'essential')))
    # store only real differences from the plan
    overrides = {k: v for k, v in body.overrides.items() if (k in base) != bool(v)}
    await pdb.schools.update_one({'id': school_id}, {'$set': {'feature_overrides': overrides, 'updated': _iso()}})
    await audit(user, 'school_features_changed', school_id, {'overrides': overrides, 'reason': body.reason}, client_ip(request))
    return shape_school(await load_school(school_id), await get_plans())


@platform_router.put('/schools/{school_id}/access')
async def set_school_access(school_id: str, body: AccessBody, request: Request, user: dict = Depends(require_perm('schools:plan'))):
    """Which logins this school gets (within its plan) and which features each login may open.

    Every login starts with its role defaults. Only the differences from those defaults are stored."""
    school = await load_school(school_id)
    plan = school.get('plan', 'essential')
    allowed_roles = PLAN_LOGINS[plan]
    plan_feature_list = plan_features(plan, school.get('feature_overrides'))
    plan_set = set(plan_feature_list)
    logins = list(dict.fromkeys(body.logins))
    if not logins:
        raise HTTPException(422, 'Choose at least one login for the school.')
    outside = [r for r in logins if r not in allowed_roles]
    if outside:
        raise HTTPException(422, f'The {outside[0].replace("_", " ")} login is not part of this school\'s plan.')
    labels = {k: l for k, l, _, _ in FEATURE_CATALOG}
    overrides: Dict[str, Dict[str, bool]] = {}
    effective: Dict[str, set] = {}
    for role in logins:
        base = role_base_features(role, plan_set)
        wanted = set(body.access[role]) if role in body.access else set(base)
        unknown = [k for k in wanted if k not in FEATURE_KEYS]
        if unknown:
            raise HTTPException(422, f'Unknown feature: {unknown[0]}')
        not_in_plan = [k for k in wanted if k not in plan_set]
        if not_in_plan:
            raise HTTPException(422, f'"{labels[not_in_plan[0]]}" is not part of this school\'s plan.')
        effective[role] = wanted
        diff = {**{k: True for k in wanted - base}, **{k: False for k in base - wanted}}
        if diff:
            overrides[role] = diff
    uncovered =[k for k in plan_feature_list if not any(k in effective[r] for r in logins)]
    if uncovered:
        names = ', '.join(f'"{labels[k]}"' for k in uncovered[:3])
        raise HTTPException(422, f'No login would be able to open {names}{" and more" if len(uncovered) > 3 else ""}. Let at least one login keep every feature in the plan.')
    stored = None if set(logins) == set(allowed_roles) else logins
    await pdb.schools.update_one({'id': school_id}, {'$set': {'enabled_logins': stored, 'role_overrides': overrides, 'updated': _iso()}})
    await audit(user, 'school_access_changed', school_id, {'logins': logins, 'changes_from_role_defaults': overrides, 'reason': body.reason}, client_ip(request))
    return shape_school(await load_school(school_id), await get_plans())


# ---------------------------------------------------------------- billing
@platform_router.get('/schools/{school_id}/billing-preview')
async def billing_preview(school_id: str, students: Optional[int] = None, include_setup: Optional[bool] = None,
                          user: dict = Depends(require_perm('billing:read'))):
    school = await load_school(school_id)
    plans, settings = await get_plans(), await get_settings()
    count = int(students if students is not None else school.get('student_count') or 0)
    first_invoice = await pdb.platform_invoices.count_documents({'school_id': school_id}) == 0
    setup = (first_invoice and not school.get('setup_fee_waived')) if include_setup is None else include_setup
    return compute_invoice(school, plans[school.get('plan', 'essential')], settings, count, setup)


@platform_router.post('/schools/{school_id}/invoices')
async def create_invoice(school_id: str, body: InvoiceCreate, request: Request, user: dict = Depends(require_perm('billing:write'))):
    school = await load_school(school_id)
    plans, settings = await get_plans(), await get_settings()
    count = int(body.student_count if body.student_count is not None else school.get('student_count') or 0)
    first_invoice = await pdb.platform_invoices.count_documents({'school_id': school_id}) == 0
    setup = (first_invoice and not school.get('setup_fee_waived')) if body.include_setup_fee is None else body.include_setup_fee
    figures = compute_invoice(school, plans[school.get('plan', 'essential')], settings, count, setup)
    year = _now().year
    sequence = await pdb.platform_invoices.count_documents({'number': {'$regex': f"^{re.escape(settings['invoice_prefix'])}-{year}-"}}) + 1
    for _ in range(5):
        number = f"{settings['invoice_prefix']}-{year}-{sequence:04d}"
        if not await pdb.platform_invoices.find_one({'number': number}):
            break
        sequence += 1
    due = _now() + timedelta(days=int(settings['payment_terms_days']))
    doc = {'id': f'INV-{uuid.uuid4().hex[:10].upper()}', 'number': number, 'school_id': school_id, 'school_name': school['name'],
           'plan': school.get('plan'), 'academic_year': body.academic_year.strip(), 'note': body.note.strip(),
           **figures, 'status': 'Unpaid', 'issued_on': _now().strftime('%Y-%m-%d'), 'due_on': due.strftime('%Y-%m-%d'),
           'created': _iso(), 'created_by': user['email']}
    await pdb.platform_invoices.insert_one(doc.copy())
    await audit(user, 'invoice_created', doc['number'], {'school': school['name'], 'total': doc['total']}, client_ip(request))
    return doc


@platform_router.get('/invoices')
async def list_invoices(status: str = '', school_id: str = '', user: dict = Depends(require_perm('billing:read'))):
    query: Dict[str, Any] = {}
    if status:
        query['status'] = status
    if school_id:
        query['school_id'] = school_id
    return [clean(row) for row in await pdb.platform_invoices.find(query).sort('created', -1).to_list(1000)]


@platform_router.put('/invoices/{invoice_id}/status')
async def update_invoice(invoice_id: str, body: InvoicePay, request: Request, user: dict = Depends(require_perm('billing:write'))):
    invoice = await pdb.platform_invoices.find_one({'id': invoice_id})
    if not invoice:
        raise HTTPException(404, 'Invoice not found.')
    if body.status not in {'Paid', 'Unpaid', 'Cancelled'}:
        raise HTTPException(422, 'Choose Paid, Unpaid or Cancelled.')
    changes: Dict[str, Any] = {'status': body.status, 'updated': _iso()}
    if body.status == 'Paid':
        changes.update({'paid_on': valid_date(body.paid_on, 'Paid on') or _now().strftime('%Y-%m-%d'),
                        'payment_method': body.method.strip(), 'payment_reference': body.reference.strip()})
    await pdb.platform_invoices.update_one({'id': invoice_id}, {'$set': changes})
    await audit(user, 'invoice_status_changed', invoice['number'], {'to': body.status, 'reference': body.reference}, client_ip(request))
    return clean(await pdb.platform_invoices.find_one({'id': invoice_id}))


# ---------------------------------------------------------------- usage and dashboard
@platform_router.get('/usage')
async def usage(user: dict = Depends(require_perm('usage:read'))):
    plans, settings = await get_plans(), await get_settings()
    rows = []
    for school in await pdb.schools.find({'status': {'$in': ['Trial', 'Active']}}).sort('name', 1).to_list(2000):
        shaped = shape_school(school, plans)
        pct = shaped['whatsapp_percent']
        level = 'over' if pct >= settings['alert_thresholds'][-1] else 'warn' if pct >= settings['alert_thresholds'][0] else 'ok'
        student_limit = shaped.get('student_limit')
        rows.append({
            'id': shaped['id'], 'name': shaped['name'], 'plan': shaped['plan'], 'students': shaped['student_count'],
            'student_limit': student_limit, 'over_student_limit': bool(student_limit and shaped['student_count'] > student_limit),
            'branches': shaped['branch_count'], 'branch_limit': shaped.get('branch_limit'),
            'whatsapp_used': shaped['whatsapp_used_month'], 'whatsapp_limit': shaped['whatsapp_limit'],
            'whatsapp_percent': pct, 'whatsapp_level': level, 'sender': shaped.get('whatsapp_sender', ''),
            'last_login_at': shaped.get('last_login_at', ''),
        })
    return {'schools': rows, 'overage_rate_per_message': settings['overage_rate_per_message']}


@platform_router.get('/dashboard')
async def dashboard(user: dict = Depends(require_perm('dashboard:read'))):
    plans, settings = await get_plans(), await get_settings()
    schools = await pdb.schools.find({}).to_list(5000)
    today = _now().date()
    by_status = {s: 0 for s in SCHOOL_STATUSES}
    by_plan = {p: 0 for p in PLAN_ORDER}
    students_total = 0
    annual = 0.0
    renewals, at_risk = [], []
    overdue_rows = await pdb.platform_invoices.find({'status': 'Unpaid', 'due_on': {'$lt': today.isoformat()}}).to_list(2000)
    unpaid_schools = {row['school_id'] for row in overdue_rows}
    arr_by_plan = {p: 0.0 for p in PLAN_ORDER}
    for school in schools:
        by_status[school.get('status', 'Trial')] = by_status.get(school.get('status', 'Trial'), 0) + 1
        live = school.get('status') in {'Active', 'Trial'}
        if live:
            by_plan[school.get('plan', 'essential')] += 1
            students_total += int(school.get('student_count') or 0)
        if school.get('status') == 'Active':
            subscription = compute_invoice(school, plans[school.get('plan', 'essential')], settings, int(school.get('student_count') or 0), False)['subscription']
            annual += subscription
            arr_by_plan[school.get('plan', 'essential')] = round(arr_by_plan.get(school.get('plan', 'essential'), 0) + subscription, 2)
        end = school.get('contract_end')
        if end and live:
            try:
                days = (datetime.strptime(end, '%Y-%m-%d').date() - today).days
            except ValueError:
                days = None
            if days is not None and days <= 30:
                renewals.append({'id': school['id'], 'name': school['name'], 'contract_end': end, 'days': days})
        reasons = []
        if live and school['id'] in unpaid_schools:
            reasons.append('Invoice overdue')
        last = school.get('last_login_at')
        if school.get('status') == 'Active' and last:
            try:
                if (_now() - datetime.fromisoformat(last)).days >= 7:
                    reasons.append('No login for 7+ days')
            except ValueError:
                pass
        if reasons:
            at_risk.append({'id': school['id'], 'name': school['name'], 'reasons': reasons})
    months: Dict[str, int] = {}
    year, month = today.year, today.month
    for _ in range(6):  # the last six calendar months, oldest first
        months[f'{year}-{month:02d}'] = 0
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    months = dict(reversed(list(months.items())))
    for school in schools:
        key = str(school.get('created', ''))[:7]
        if key in months:
            months[key] += 1
    open_invoices = await pdb.platform_invoices.find({'status': 'Unpaid'}).to_list(2000)
    return {
        'schools_total': len(schools), 'by_status': by_status, 'by_plan': by_plan, 'students_total': students_total,
        'annual_recurring_revenue': round(annual, 2), 'monthly_recurring_revenue': round(annual / 12, 2),
        'unpaid_invoices': len(open_invoices), 'unpaid_amount': round(sum(row.get('total', 0) for row in open_invoices), 2),
        'renewals_due': sorted(renewals, key=lambda r: r['days']), 'at_risk': at_risk, 'arr_by_plan': arr_by_plan,
        'overdue_invoices': sorted(({'id': r['id'], 'number': r['number'], 'school_id': r['school_id'], 'school_name': r['school_name'], 'total': r['total'], 'due_on': r['due_on'],
                                     'days_overdue': (today - datetime.strptime(r['due_on'], '%Y-%m-%d').date()).days} for r in overdue_rows), key=lambda r: -r['days_overdue'])[:10],
        'overdue_amount': round(sum(r.get('total', 0) for r in overdue_rows), 2),
        'new_schools_by_month': [{'month': k, 'count': v} for k, v in months.items()],
    }


# ---------------------------------------------------------------- usage tracking
# The school server calls track_login / track_request. Nothing here can break a school request: every
# function swallows its own errors. Tracking is on only when PLATFORM_SCHOOL_CODE names the school that this
# deployment serves (today one deployment serves one school; the multi-school login will pass the school id).
SCHOOL_JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret')
TRACK_SCHOOL_CODE = os.environ.get('PLATFORM_SCHOOL_CODE', '').strip().lower()
CLIENT_LABELS = {'web': 'Web', 'parent-app': 'Parent app', 'teacher-app': 'Teacher app', 'director-app': 'Director app'}
APP_CLIENTS = ['parent-app', 'teacher-app', 'director-app']
ROLE_LABELS = {'admin': 'Admin', 'teacher': 'Class Teacher', 'fee_manager': 'Fee Manager', 'director': 'Director',
               'academic_coordinator': 'Academic Coordinator', 'stock_manager': 'Stock Manager', 'librarian': 'Librarian',
               'parent': 'Parent'}

# API path prefix -> feature key. The longest matching prefix wins.
_FEATURE_PATHS = {
    '/api/students': 'students', '/api/student-promotion-request': 'students', '/api/student-deletion-requests': 'students',
    '/api/student-transfers': 'student_transfer', '/api/student-health-dashboard': 'student_health',
    '/api/admission-leads': 'admissions_basic', '/api/admission-assessment-rules': 'admissions_basic',
    '/api/admission-experience': 'admissions_basic', '/api/admissions-intelligence': 'admissions_crm',
    '/api/academic-structure': 'academic_setup', '/api/academic-year-change-request': 'academic_setup',
    '/api/academic-intelligence': 'academic_action_center', '/api/academic-signals': 'academic_action_center',
    '/api/curriculum-units': 'syllabus', '/api/interventions': 'support_plans', '/api/intervention-owners': 'support_plans',
    '/api/classroom-observations': 'observations', '/api/teacher-performance': 'observations',
    '/api/attendance': 'attendance', '/api/teachers': 'teachers', '/api/teacher-allocations': 'teachers', '/api/teaching': 'teachers',
    '/api/teacher-substitution': 'timetable', '/api/timetable-periods': 'timetable', '/api/staff': 'staff_directory',
    '/api/fees': 'fees', '/api/payments': 'fees', '/api/collections-intelligence': 'collection_intelligence',
    '/api/exams': 'exams', '/api/marks': 'marks', '/api/results': 'marks', '/api/report-card': 'marks',
    '/api/holistic-observations': 'marks', '/api/homework': 'homework', '/api/leaves': 'leaves',
    '/api/notifications': 'notices', '/api/visitors': 'visitors', '/api/transport': 'transport',
    '/api/inventory': 'inventory', '/api/expenses': 'expenses', '/api/hr': 'hr_payroll',
    '/api/branches': 'multi_branch', '/api/branch-access-assignments': 'multi_branch',
    '/api/analytics': 'dashboard', '/api/settings': 'settings',
    '/api/parent-center': 'parent_app_center', '/api/parent-center/hall-tickets': 'hall_tickets',
    '/api/parent-center/homework-completions': 'homework', '/api/parent/': 'parent_app',
}
FEATURE_PATHS = sorted(_FEATURE_PATHS.items(), key=lambda item: -len(item[0]))
TRACKED_FEATURES = set(_FEATURE_PATHS.values())
_school_cache: Dict[str, Any] = {'at': 0.0, 'id': None}


def feature_for_path(path: str) -> Optional[str]:
    for prefix, feature in FEATURE_PATHS:  # longest prefix first
        if path.startswith(prefix):
            return feature
    return None


def normalise_client(value: Optional[str], role: str = '') -> str:
    if role == 'parent':
        return 'parent-app'
    value = (value or '').strip().lower()
    return value if value in CLIENT_LABELS else 'web'


async def tracked_school_id() -> Optional[str]:
    if not TRACK_SCHOOL_CODE:
        return None
    if time.time() - _school_cache['at'] > 60:
        school = await pdb.schools.find_one({'code': TRACK_SCHOOL_CODE}, {'id': 1})
        _school_cache.update({'at': time.time(), 'id': (school or {}).get('id')})
    return _school_cache['id']


async def track_login(role: str, client: str, user_key: str, user_label: str = '', ip: str = ''):
    """A person signed in to the school's web app or one of its mobile apps."""
    try:
        school_id = await tracked_school_id()
        if not school_id:
            return
        now = _iso()
        client = normalise_client(client, role)
        await pdb.platform_logins.insert_one({
            'id': f'LOG-{uuid.uuid4().hex[:12].upper()}', 'school_id': school_id, 'at': now, 'role': role,
            'client': client, 'user_key': str(user_key or role), 'user_label': user_label, 'ip': ip})
        await pdb.schools.update_one({'id': school_id}, {'$set': {'last_login_at': now}})
        if client in APP_CLIENTS:
            await pdb.platform_app_users.update_one(
                {'school_id': school_id, 'client': client, 'user_key': str(user_key or role)},
                {'$setOnInsert': {'first_seen': now, 'role': role, 'label': user_label}, '$set': {'last_seen': now}}, upsert=True)
    except Exception:  # never let tracking break a login
        pass


async def track_request(path: str, status: int, authorization: Optional[str], x_client: Optional[str]):
    """A signed-in person used a feature (counted per day, role and app; no personal data is stored)."""
    try:
        if not TRACK_SCHOOL_CODE or status >= 400 or not path.startswith('/api/') or path.startswith('/api/platform'):
            return
        feature = feature_for_path(path)
        if not feature or not authorization or not authorization.startswith('Bearer '):
            return
        school_id = await tracked_school_id()
        if not school_id:
            return
        payload = jwt.decode(authorization.split(' ', 1)[1], SCHOOL_JWT_SECRET, algorithms=['HS256'])
        role = payload.get('role')
        if not role:
            return
        await pdb.platform_usage_daily.update_one(
            {'school_id': school_id, 'date': _now().strftime('%Y-%m-%d'), 'role': role, 'client': normalise_client(x_client, role), 'feature': feature},
            {'$inc': {'count': 1}, '$set': {'last_used': _iso()}}, upsert=True)
    except Exception:
        pass


def _date_range(date_from: str, date_to: str):
    today = _now().date()
    try:
        end = datetime.strptime(date_to, '%Y-%m-%d').date() if date_to else today
        start = datetime.strptime(date_from, '%Y-%m-%d').date() if date_from else end - timedelta(days=29)
    except ValueError:
        raise HTTPException(422, 'Dates must be in YYYY-MM-DD format.')
    if start > end:
        raise HTTPException(422, 'The start date must be before the end date.')
    if (end - start).days > 366:
        raise HTTPException(422, 'Choose a period of one year or less.')
    return start, end


def _login_query(school_id: str, start, end, client: str, role: str) -> dict:
    query: Dict[str, Any] = {'school_id': school_id, 'at': {'$gte': f'{start}T00:00:00', '$lte': f'{end}T23:59:59'}}
    if client:
        query['client'] = client
    if role:
        query['role'] = role
    return query


@platform_router.get('/schools/{school_id}/activity')
async def school_activity(school_id: str, date_from: str = Query('', alias='from'), date_to: str = Query('', alias='to'),
                          client: str = '', role: str = '', user: dict = Depends(require_perm('usage:read'))):
    """Who signed in, which features were used and how many people activated each mobile app."""
    school = shape_school(await load_school(school_id), await get_plans())
    start, end = _date_range(date_from, date_to)
    days = [(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)]

    logins = await pdb.platform_logins.find(_login_query(school_id, start, end, client, role), {'_id': 0, 'at': 1, 'role': 1, 'client': 1, 'user_key': 1}).to_list(50000)
    per_day = {d: 0 for d in days}
    people, by_client, by_role = set(), {}, {}
    for row in logins:
        per_day[row['at'][:10]] = per_day.get(row['at'][:10], 0) + 1
        people.add((row['role'], row['user_key']))
        by_client[row['client']] = by_client.get(row['client'], 0) + 1
        by_role[row['role']] = by_role.get(row['role'], 0) + 1

    usage_query: Dict[str, Any] = {'school_id': school_id, 'date': {'$gte': start.isoformat(), '$lte': end.isoformat()}}
    if client:
        usage_query['client'] = client
    if role:
        usage_query['role'] = role
    features: Dict[str, dict] = {}
    for row in await pdb.platform_usage_daily.find(usage_query, {'_id': 0}).to_list(100000):
        item = features.setdefault(row['feature'], {'feature': row['feature'], 'count': 0, 'roles': {}, 'last_used': '', 'days': set()})
        item['count'] += row['count']
        item['roles'][row['role']] = item['roles'].get(row['role'], 0) + row['count']
        item['days'].add(row['date'])
        item['last_used'] = max(item['last_used'], row.get('last_used', ''))
    labels = {k: l for k, l, _, _ in FEATURE_CATALOG}
    feature_rows = sorted(({'feature': f['feature'], 'label': labels.get(f['feature'], f['feature']), 'count': f['count'],
                            'roles': sorted(({'role': r, 'label': ROLE_LABELS.get(r, r), 'count': c} for r, c in f['roles'].items()), key=lambda x: -x['count']),
                            'last_used': f['last_used'], 'days_used': len(f['days'])} for f in features.values()), key=lambda x: -x['count'])
    unused = [{'feature': k, 'label': labels[k]} for k in school['features'] if k in TRACKED_FEATURES and k not in features and k != 'parent_app']

    apps = []
    for app in APP_CLIENTS:
        total = await pdb.platform_app_users.count_documents({'school_id': school_id, 'client': app})
        new_in_range = await pdb.platform_app_users.count_documents({'school_id': school_id, 'client': app, 'first_seen': {'$gte': f'{start}T00:00:00', '$lte': f'{end}T23:59:59'}})
        active = {k for r, k in ((row['role'], row['user_key']) for row in logins if row['client'] == app)}
        apps.append({'client': app, 'label': CLIENT_LABELS[app], 'activated_total': total, 'activated_in_range': new_in_range, 'active_in_range': len(active)})

    last = await pdb.platform_logins.find_one({'school_id': school_id}, {'_id': 0, 'at': 1}, sort=[('at', -1)])
    return {
        'range': {'from': start.isoformat(), 'to': end.isoformat()},
        'tracking': {'enabled': bool(TRACK_SCHOOL_CODE), 'this_school': bool(TRACK_SCHOOL_CODE) and school['code'] == TRACK_SCHOOL_CODE},
        'last_login_at': (last or {}).get('at', ''),
        'logins': {'total': len(logins), 'people': len(people), 'by_day': [{'date': d, 'count': per_day.get(d, 0)} for d in days],
                   'by_client': [{'client': c, 'label': CLIENT_LABELS.get(c, c), 'count': n} for c, n in sorted(by_client.items(), key=lambda x: -x[1])],
                   'by_role': [{'role': r, 'label': ROLE_LABELS.get(r, r), 'count': n} for r, n in sorted(by_role.items(), key=lambda x: -x[1])]},
        'features': feature_rows, 'unused_features': unused, 'apps': apps,
    }


@platform_router.get('/schools/{school_id}/logins')
async def school_logins(school_id: str, date_from: str = Query('', alias='from'), date_to: str = Query('', alias='to'),
                        client: str = '', role: str = '', skip: int = 0, limit: int = 50, user: dict = Depends(require_perm('usage:read'))):
    """Who signed in and when, newest first."""
    await load_school(school_id)
    start, end = _date_range(date_from, date_to)
    query = _login_query(school_id, start, end, client, role)
    total = await pdb.platform_logins.count_documents(query)
    rows = await pdb.platform_logins.find(query, {'_id': 0}).sort('at', -1).skip(max(0, skip)).limit(max(1, min(limit, 200))).to_list(200)
    return {'total': total, 'items': [{**r, 'role_label': ROLE_LABELS.get(r['role'], r['role']), 'client_label': CLIENT_LABELS.get(r['client'], r['client'])} for r in rows]}


# ---------------------------------------------------------------- support help desk
# Every login (school staff on the web, the teacher and director apps, and parents in the parent app) can ask the
# Orison team for help or report an error. Tickets are stored here and handled by Orison support and developers.
TICKET_TYPES = ['Help needed', 'Error / bug', 'Suggestion']
TICKET_STATUSES = ['New', 'In progress', 'Waiting for school', 'Resolved', 'Closed']
TICKET_PRIORITIES = ['Low', 'Normal', 'Urgent']
STAFF_CATEGORIES = ['Login & access', 'Students & admissions', 'Attendance', 'Exams & marks', 'Fees & payments', 'Reports & downloads',
                    'Notifications & WhatsApp', 'Settings & setup', 'App crash or slowness', 'Other']
# The parent app's own categories -> the feature they relate to
PARENT_CATEGORY_FEATURES = {'Login & OTP': '', 'Payment & receipts': 'fees', 'Transport tracking': 'transport', 'Notifications': 'notices',
                            'Documents & downloads': 'hall_tickets', 'App crash or slowness': '', 'Other app issue': ''}
PARENT_ERROR_CATEGORIES = {'Login & OTP', 'App crash or slowness'}
PARENT_STATUS = {'New': 'Open', 'In progress': 'Open', 'Waiting for school': 'Open', 'Resolved': 'Resolved', 'Closed': 'Resolved'}
HELP_DESK_HOURS = 'Monday to Saturday, 8:30 AM to 6:00 PM. Urgent issues are monitored continuously.'
SOURCE_LABELS = dict(CLIENT_LABELS)
support_router = APIRouter(prefix='/api/support')


def mask_mobile(value: str) -> str:
    digits = re.sub(r'\D', '', value or '')
    return ('••••••' + digits[-4:]) if len(digits) >= 4 else ''


def feature_label(key: str) -> str:
    return next((l for k, l, _, _ in FEATURE_CATALOG if k == key), '')


def new_ticket_id() -> str:
    return 'TKT-' + uuid.uuid4().hex[:6].upper()


async def school_for_ticket():
    school_id = await tracked_school_id()
    if not school_id:
        return '', 'Unlinked school', ''
    school = await pdb.schools.find_one({'id': school_id}, {'name': 1, 'code': 1}) or {}
    return school_id, school.get('name', 'School'), school.get('code', '')


async def create_ticket(source: str, reporter: dict, ticket_type: str, category: str, feature: str, subject: str, description: str,
                        error_details: str = '', page: str = '', priority: str = 'Normal', environment: Optional[dict] = None,
                        help_request_id: str = '') -> dict:
    school_id, school_name, school_code = await school_for_ticket()
    key = f"{reporter['kind']}:{reporter.get('id') or reporter.get('role')}"
    if await pdb.platform_tickets.count_documents({'reporter_key': key, 'created_at': {'$gte': _iso(_now() - timedelta(hours=1))}}) >= 15:
        raise HTTPException(429, 'You have sent many requests in the last hour. Please wait a little before sending another.')
    now = _iso()
    doc = {
        'id': new_ticket_id(), 'school_id': school_id, 'school_name': school_name, 'school_code': school_code, 'source': source,
        'reporter': reporter, 'reporter_key': key, 'type': ticket_type, 'category': category, 'feature': feature,
        'feature_label': feature_label(feature), 'subject': subject, 'description': description, 'error_details': error_details,
        'page': page, 'priority': priority, 'status': 'New', 'assigned_to': '', 'assigned_name': '', 'environment': environment or {},
        'thread': [], 'help_request_id': help_request_id, 'created_at': now, 'updated_at': now, 'resolved_at': '',
    }
    await pdb.platform_tickets.insert_one(doc.copy())
    return doc


async def create_parent_ticket(record: dict, student: dict):
    """A parent raised an "App support" request in the parent app: also send it to the Orison team. Never fails the parent's request."""
    try:
        category = str(record.get('category') or 'Other app issue')
        priority = record.get('priority') if record.get('priority') in TICKET_PRIORITIES else 'Normal'
        klass = ' '.join(x for x in [(student or {}).get('class_name', ''), (student or {}).get('section', '')] if x)
        reporter = {'kind': 'parent', 'id': record.get('parent_id', ''), 'role': 'parent', 'role_label': 'Parent', 'name': record.get('parent_name', '') or 'Parent',
                    'student_class': klass, 'mobile_masked': mask_mobile(record.get('mobile', ''))}
        await create_ticket('parent-app', reporter, 'Error / bug' if category in PARENT_ERROR_CATEGORIES else 'Help needed', category,
                            PARENT_CATEGORY_FEATURES.get(category, ''), category, record.get('description', ''), '', '', priority,
                            {'client': 'parent-app'}, record.get('id', ''))
    except Exception:
        pass


def reporter_view(reporter: dict) -> dict:
    return {k: reporter.get(k, '') for k in ('kind', 'role', 'role_label', 'name', 'student_class', 'mobile_masked')}


def platform_ticket(t: dict, full: bool = False) -> dict:
    item = {
        'id': t['id'], 'school_id': t.get('school_id', ''), 'school_name': t.get('school_name', ''), 'school_code': t.get('school_code', ''),
        'source': t['source'], 'source_label': SOURCE_LABELS.get(t['source'], t['source']), 'reporter': reporter_view(t['reporter']),
        'type': t['type'], 'category': t['category'], 'feature': t.get('feature', ''), 'feature_label': t.get('feature_label', ''),
        'subject': t['subject'], 'priority': t['priority'], 'status': t['status'], 'assigned_to': t.get('assigned_to', ''),
        'assigned_name': t.get('assigned_name', ''), 'created_at': t['created_at'], 'updated_at': t['updated_at'],
        'resolved_at': t.get('resolved_at', ''), 'messages': len([m for m in t.get('thread', []) if m['from'] in ('school', 'orison')]),
    }
    if full:
        item.update({'description': t['description'], 'error_details': t.get('error_details', ''), 'page': t.get('page', ''),
                     'environment': t.get('environment', {}), 'thread': t.get('thread', [])})
    return item


def staff_ticket(t: dict, full: bool = False) -> dict:
    item = {k: t.get(k, '') for k in ('id', 'type', 'category', 'feature', 'feature_label', 'subject', 'priority', 'status', 'source', 'created_at', 'updated_at', 'resolved_at')}
    item['source_label'] = SOURCE_LABELS.get(t['source'], t['source'])
    item['messages'] = len([m for m in t.get('thread', []) if m['from'] in ('school', 'orison')])
    if full:
        item.update({'description': t['description'], 'error_details': t.get('error_details', ''), 'page': t.get('page', ''),
                     'thread': [{'id': m['id'], 'at': m['at'], 'from': m['from'], 'author': m['author'], 'text': m['text']}
                                for m in t.get('thread', []) if m['from'] in ('school', 'orison')]})
    return item


async def sync_parent_request(ticket: dict):
    """Show the parent (in the parent app's own request list) that Orison answered or resolved their ticket."""
    hid = ticket.get('help_request_id')
    if not hid:
        return
    try:
        public = [m for m in ticket.get('thread', []) if m['from'] == 'orison']
        changes = {'status': PARENT_STATUS.get(ticket['status'], 'Open'), 'updated_at': _iso(), 'updated_by': 'Orison support'}
        if public:
            changes['resolution'] = public[-1]['text']
        await sdb.help_requests.update_one({'id': hid}, {'$set': changes})
    except Exception:
        pass


# ---- school side: used by every staff login (web, teacher app, director app)
async def school_staff(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Not authenticated')
    try:
        payload = jwt.decode(authorization.split(' ', 1)[1], SCHOOL_JWT_SECRET, algorithms=['HS256'])
    except jwt.PyJWTError:
        raise HTTPException(401, 'Invalid token')
    role = payload.get('role')
    if role not in ROLE_LABELS or role == 'parent':
        raise HTTPException(403, 'The help desk is for school staff logins. Parents use the help desk in the parent app.')
    return {'role': role, 'role_label': ROLE_LABELS[role]}


class TicketBody(BaseModel):
    type: str = 'Help needed'
    category: str = ''
    feature: str = ''
    subject: str
    description: str
    error_details: str = ''
    page: str = ''
    priority: str = 'Normal'
    app_version: str = ''


class ReplyBody(BaseModel):
    text: str


async def staff_scope(staff: dict) -> dict:
    query: Dict[str, Any] = {'school_id': await tracked_school_id() or '', 'reporter.kind': 'staff'}
    if staff['role'] not in ('admin', 'director'):  # Admin and Director see every staff request; others see their own login's
        query['reporter.role'] = staff['role']
    return query


@support_router.get('/meta')
async def support_meta(staff: dict = Depends(school_staff)):
    school_id = await tracked_school_id()
    features = plan_features((await pdb.schools.find_one({'id': school_id}) or {}).get('plan', 'premium')) if school_id else [k for k, *_ in FEATURE_CATALOG]
    return {'types': TICKET_TYPES, 'categories': STAFF_CATEGORIES, 'priorities': TICKET_PRIORITIES, 'hours': HELP_DESK_HOURS,
            'features': [{'key': k, 'label': l} for k, l, _, _ in FEATURE_CATALOG if k in features and k not in ('parent_app', 'teacher_app', 'director_app')]}


@support_router.post('/tickets')
async def staff_create_ticket(body: TicketBody, request: Request, staff: dict = Depends(school_staff)):
    subject, description = body.subject.strip(), body.description.strip()
    if body.type not in TICKET_TYPES:
        raise HTTPException(422, 'Choose Help needed, Error / bug or Suggestion.')
    if body.priority not in TICKET_PRIORITIES:
        raise HTTPException(422, 'Choose Low, Normal or Urgent.')
    if not 3 <= len(subject) <= 120:
        raise HTTPException(422, 'Give the request a short title (3 to 120 characters).')
    if not 10 <= len(description) <= 4000:
        raise HTTPException(422, 'Explain what happened in at least 10 characters.')
    if len(body.error_details) > 4000 or len(body.page) > 200 or len(body.category) > 80:
        raise HTTPException(422, 'One of the fields is too long.')
    feature = body.feature if body.feature in FEATURE_KEYS else ''
    client = normalise_client(request.headers.get('x-client'))
    environment = {'client': client, 'user_agent': (request.headers.get('user-agent') or '')[:200],
                   'app_version': (body.app_version or request.headers.get('x-app-version') or '')[:20]}
    reporter = {'kind': 'staff', 'id': staff['role'], 'role': staff['role'], 'role_label': staff['role_label'], 'name': staff['role_label'], 'student_class': '', 'mobile_masked': ''}
    ticket = await create_ticket(client, reporter, body.type, body.category.strip() or 'Other', feature, subject, description,
                                 body.error_details.strip(), body.page.strip(), body.priority, environment)
    return staff_ticket(ticket, full=True)


@support_router.get('/tickets')
async def staff_list_tickets(staff: dict = Depends(school_staff)):
    rows = await pdb.platform_tickets.find(await staff_scope(staff)).sort('created_at', -1).to_list(500)
    items = [staff_ticket(t) for t in rows]
    return {'items': items, 'counts': {
        'active': len([t for t in items if t['status'] in ('New', 'In progress')]),
        'waiting': len([t for t in items if t['status'] == 'Waiting for school']),
        'resolved': len([t for t in items if t['status'] in ('Resolved', 'Closed')])}, 'hours': HELP_DESK_HOURS}


async def staff_owned_ticket(ticket_id: str, staff: dict) -> dict:
    ticket = await pdb.platform_tickets.find_one({**await staff_scope(staff), 'id': ticket_id})
    if not ticket:
        raise HTTPException(404, 'Request not found.')
    return ticket


@support_router.get('/tickets/{ticket_id}')
async def staff_get_ticket(ticket_id: str, staff: dict = Depends(school_staff)):
    return staff_ticket(await staff_owned_ticket(ticket_id, staff), full=True)


@support_router.post('/tickets/{ticket_id}/reply')
async def staff_reply(ticket_id: str, body: ReplyBody, staff: dict = Depends(school_staff)):
    ticket = await staff_owned_ticket(ticket_id, staff)
    text = body.text.strip()
    if not 1 <= len(text) <= 4000:
        raise HTTPException(422, 'Write your message (up to 4000 characters).')
    if ticket['status'] == 'Closed':
        raise HTTPException(409, 'This request is closed. Please raise a new request.')
    message = {'id': f'MSG-{uuid.uuid4().hex[:8].upper()}', 'at': _iso(), 'from': 'school', 'author': staff['role_label'], 'text': text}
    await pdb.platform_tickets.update_one({'id': ticket_id}, {
        '$push': {'thread': message}, '$set': {'updated_at': message['at'], 'resolved_at': '',
                                              'status': 'In progress' if ticket['status'] in ('Waiting for school', 'Resolved') else ticket['status']}})
    return staff_ticket(await pdb.platform_tickets.find_one({'id': ticket_id}), full=True)


# ---- Orison side: support, developers and the owner
class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None


class TicketMessage(BaseModel):
    text: str
    internal: bool = False
    status: Optional[str] = None


async def load_ticket(ticket_id: str) -> dict:
    ticket = await pdb.platform_tickets.find_one({'id': ticket_id})
    if not ticket:
        raise HTTPException(404, 'Ticket not found.')
    return ticket


@platform_router.get('/tickets')
async def list_tickets(status: str = '', school_id: str = '', source: str = '', ticket_type: str = Query('', alias='type'), feature: str = '',
                       priority: str = '', assigned_to: str = '', q: str = '', date_from: str = Query('', alias='from'), date_to: str = Query('', alias='to'),
                       skip: int = 0, limit: int = 50, user: dict = Depends(require_perm('tickets:read'))):
    query: Dict[str, Any] = {}
    for field, value in (('school_id', school_id), ('source', source), ('type', ticket_type), ('feature', feature), ('priority', priority), ('assigned_to', assigned_to)):
        if value:
            query[field] = value
    if q.strip():
        pattern = {'$regex': re.escape(q.strip()), '$options': 'i'}
        query['$or'] = [{'id': pattern}, {'subject': pattern}, {'description': pattern}, {'error_details': pattern}, {'school_name': pattern}, {'reporter.name': pattern}]
    if date_from or date_to:
        start, end = _date_range(date_from, date_to) if date_from and date_to else (None, None)
        if start:
            query['created_at'] = {'$gte': f'{start}T00:00:00', '$lte': f'{end}T23:59:59'}
        else:
            raise HTTPException(422, 'Choose both a start and an end date.')
    status_counts: Dict[str, int] = {s: 0 for s in TICKET_STATUSES}
    for row in await pdb.platform_tickets.find(query, {'status': 1}).to_list(20000):
        status_counts[row['status']] = status_counts.get(row['status'], 0) + 1
    if status:
        query['status'] = status
    total = await pdb.platform_tickets.count_documents(query)
    rows = await pdb.platform_tickets.find(query).sort('created_at', -1).skip(max(0, skip)).limit(max(1, min(limit, 200))).to_list(200)
    schools = await pdb.platform_tickets.aggregate([{'$group': {'_id': '$school_id', 'name': {'$first': '$school_name'}}}, {'$sort': {'name': 1}}]).to_list(500)
    features = [f for f in await pdb.platform_tickets.distinct('feature') if f]
    return {'total': total, 'items': [platform_ticket(t) for t in rows], 'counts': status_counts,
            'schools': [{'id': x['_id'], 'name': x['name']} for x in schools],
            'features': [{'key': f, 'label': feature_label(f) or f} for f in sorted(features)],
            'sources': [{'key': k, 'label': v} for k, v in SOURCE_LABELS.items()]}


@platform_router.get('/tickets/assignees')
async def ticket_assignees(user: dict = Depends(require_perm('tickets:read'))):
    rows = await pdb.platform_users.find({'active': True}).sort('name', 1).to_list(200)
    return [{'id': r['id'], 'name': r['name'], 'role': r['role']} for r in rows if 'tickets:write' in ROLE_PERMISSIONS.get(r['role'], set()) or '*' in ROLE_PERMISSIONS.get(r['role'], set())]


@platform_router.get('/tickets/{ticket_id}')
async def get_ticket(ticket_id: str, user: dict = Depends(require_perm('tickets:read'))):
    return platform_ticket(await load_ticket(ticket_id), full=True)


def system_note(text: str, user: dict) -> dict:
    return {'id': f'MSG-{uuid.uuid4().hex[:8].upper()}', 'at': _iso(), 'from': 'system', 'author': user['name'], 'text': text}


@platform_router.put('/tickets/{ticket_id}')
async def update_ticket(ticket_id: str, body: TicketUpdate, request: Request, user: dict = Depends(require_perm('tickets:write'))):
    ticket = await load_ticket(ticket_id)
    changes: Dict[str, Any] = {}
    notes: List[dict] = []
    if body.status is not None and body.status != ticket['status']:
        if body.status not in TICKET_STATUSES:
            raise HTTPException(422, 'Choose a valid status.')
        changes['status'] = body.status
        changes['resolved_at'] = _iso() if body.status in ('Resolved', 'Closed') else ''
        notes.append(system_note(f"Status changed from {ticket['status']} to {body.status}", user))
    if body.priority is not None and body.priority != ticket['priority']:
        if body.priority not in TICKET_PRIORITIES:
            raise HTTPException(422, 'Choose Low, Normal or Urgent.')
        changes['priority'] = body.priority
        notes.append(system_note(f"Priority changed from {ticket['priority']} to {body.priority}", user))
    if body.assigned_to is not None and body.assigned_to != ticket.get('assigned_to', ''):
        if body.assigned_to:
            person = await pdb.platform_users.find_one({'id': body.assigned_to, 'active': True})
            allowed = ROLE_PERMISSIONS.get((person or {}).get('role', ''), set())
            if not person or not ('*' in allowed or 'tickets:write' in allowed):
                raise HTTPException(422, 'Choose an active team member who can handle tickets.')
            changes.update({'assigned_to': person['id'], 'assigned_name': person['name']})
            notes.append(system_note(f"Assigned to {person['name']}", user))
        else:
            changes.update({'assigned_to': '', 'assigned_name': ''})
            notes.append(system_note('Assignment removed', user))
    if not changes:
        raise HTTPException(422, 'Nothing to change.')
    changes['updated_at'] = _iso()
    update: Dict[str, Any] = {'$set': changes}
    if notes:
        update['$push'] = {'thread': {'$each': notes}}
    await pdb.platform_tickets.update_one({'id': ticket_id}, update)
    await audit(user, 'ticket_updated', ticket_id, {k: v for k, v in changes.items() if k not in ('updated_at', 'resolved_at')}, client_ip(request))
    fresh = await load_ticket(ticket_id)
    await sync_parent_request(fresh)
    return platform_ticket(fresh, full=True)


@platform_router.post('/tickets/{ticket_id}/messages')
async def add_ticket_message(ticket_id: str, body: TicketMessage, request: Request, user: dict = Depends(require_perm('tickets:write'))):
    ticket = await load_ticket(ticket_id)
    text = body.text.strip()
    if not 1 <= len(text) <= 4000:
        raise HTTPException(422, 'Write your message (up to 4000 characters).')
    if body.status is not None and body.status not in TICKET_STATUSES:
        raise HTTPException(422, 'Choose a valid status.')
    message = {'id': f'MSG-{uuid.uuid4().hex[:8].upper()}', 'at': _iso(), 'from': 'note' if body.internal else 'orison', 'author': user['name'], 'text': text}
    new_status = body.status or ('In progress' if (not body.internal and ticket['status'] == 'New') else ticket['status'])
    changes: Dict[str, Any] = {'updated_at': message['at'], 'status': new_status}
    if new_status != ticket['status']:
        changes['resolved_at'] = message['at'] if new_status in ('Resolved', 'Closed') else ''
    push = [message] + ([system_note(f"Status changed from {ticket['status']} to {new_status}", user)] if new_status != ticket['status'] else [])
    await pdb.platform_tickets.update_one({'id': ticket_id}, {'$set': changes, '$push': {'thread': {'$each': push}}})
    await audit(user, 'ticket_note' if body.internal else 'ticket_reply', ticket_id, {'status': new_status}, client_ip(request))
    fresh = await load_ticket(ticket_id)
    await sync_parent_request(fresh)
    return platform_ticket(fresh, full=True)


# ---------------------------------------------------------------- sales pipeline
# Salespeople record the schools they visit: who they met, which products they pitched and at what price, and when to
# follow up. A salesperson sees only their own leads; the Owner sees everyone's.
LEAD_STAGES = ['New lead', 'Visited', 'Demo done', 'Proposal sent', 'Negotiation', 'Won', 'Lost']
OPEN_STAGES = LEAD_STAGES[:5]
LEAD_SOURCES = ['Walk-in', 'Referral', 'Website', 'Campaign', 'Cold call', 'Existing school group', 'Other']
LEAD_TEMPERATURES = ['Hot', 'Warm', 'Cold']
ACTIVITY_TYPES = ['Visit', 'Meeting', 'Demo', 'Call', 'WhatsApp', 'Email', 'Other']
# What can be pitched: an ERP plan (priced per student per year) or another product (quantity x price each)
OTHER_PRODUCTS = {'robotics': 'Robotics', 'vr': 'VR', 'ifb': 'IFB', 'kreedo': 'Kreedo', 'custom': 'Custom'}
PRODUCT_LABELS = {**{k: f'ERP {v}' for k, v in PLAN_LABELS.items()}, **OTHER_PRODUCTS}


def today_ist() -> str:
    return (_now() + timedelta(hours=5, minutes=30)).strftime('%Y-%m-%d')


def lead_scope(user: dict) -> dict:
    return {} if '*' in ROLE_PERMISSIONS.get(user['role'], set()) else {'owner_id': user['id']}


def line_total(quantity, rate, discount) -> float:
    return round(float(quantity or 0) * float(rate or 0) * (1 - float(discount or 0) / 100), 2)


class ContactIn(BaseModel):
    name: str
    designation: str = ''
    phone: str = ''
    email: str = ''
    decision_maker: bool = False


class ProductLine(BaseModel):
    product: str
    quantity: int = Field(default=0, ge=0)
    rate: float = Field(default=0, ge=0)
    discount_percent: float = Field(default=0, ge=0, le=100)
    note: str = ''


class LeadBody(BaseModel):
    school_name: str
    city: str = ''
    state: str = ''
    board: str = ''
    address: str = ''
    student_count: int = Field(default=0, ge=0)
    source: str = 'Walk-in'
    temperature: str = 'Warm'
    stage: str = 'New lead'
    contacts: List[ContactIn] = Field(default_factory=list)
    products: List[ProductLine] = Field(default_factory=list)
    current_system: str = ''
    notes: str = ''
    next_follow_up: str = ''
    follow_up_note: str = ''
    expected_close: str = ''
    location_url: str = ''
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    owner_id: Optional[str] = None


class LeadUpdate(BaseModel):
    school_name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    board: Optional[str] = None
    address: Optional[str] = None
    student_count: Optional[int] = Field(default=None, ge=0)
    source: Optional[str] = None
    temperature: Optional[str] = None
    stage: Optional[str] = None
    lost_reason: Optional[str] = None
    contacts: Optional[List[ContactIn]] = None
    products: Optional[List[ProductLine]] = None
    current_system: Optional[str] = None
    notes: Optional[str] = None
    next_follow_up: Optional[str] = None
    follow_up_note: Optional[str] = None
    expected_close: Optional[str] = None
    location_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    clear_location: Optional[bool] = None
    owner_id: Optional[str] = None


class ActivityBody(BaseModel):
    type: str = 'Visit'
    date: str = ''
    met_name: str = ''
    met_designation: str = ''
    summary: str
    outcome: str = ''
    next_follow_up: Optional[str] = None
    follow_up_note: Optional[str] = None
    distance_km: Optional[float] = Field(default=None, ge=0, le=2000)  # from the previous school visited today (or where the day started)


class DistanceBody(BaseModel):
    distance_km: Optional[float] = Field(default=None, ge=0, le=2000)


class ConvertBody(BaseModel):
    code: str
    plan: Optional[str] = None
    status: str = 'Trial'


def clean_products(lines) -> List[dict]:
    if len(lines) > 12:
        raise HTTPException(422, 'Add up to 12 products to one school.')
    cleaned = []
    for line in lines:
        d = line if isinstance(line, dict) else line.model_dump()
        if d['product'] not in PRODUCT_LABELS:
            raise HTTPException(422, 'Choose an ERP plan, Robotics, VR, IFB, Kreedo or Custom.')
        cleaned.append({'id': f'LINE-{uuid.uuid4().hex[:6].upper()}', 'product': d['product'], 'quantity': int(d['quantity']), 'rate': float(d['rate']),
                        'discount_percent': float(d['discount_percent']), 'note': d['note'].strip()[:200],
                        'total': line_total(d['quantity'], d['rate'], d['discount_percent'])})
    return cleaned


def lead_products(lead: dict) -> List[dict]:
    """The products pitched. Older leads kept one pitch in separate fields; read that as a single line."""
    if lead.get('products') is not None:
        return lead['products']
    if lead.get('pitched_plan'):
        qty, rate, disc = int(lead.get('quoted_students') or 0), float(lead.get('quoted_rate') or 0), float(lead.get('quoted_discount_percent') or 0)
        return [{'id': 'LINE-OLD', 'product': lead['pitched_plan'], 'quantity': qty, 'rate': rate, 'discount_percent': disc, 'note': '', 'total': line_total(qty, rate, disc)}]
    return []


def products_total(lines: List[dict]) -> float:
    return round(sum(float(line['total']) for line in lines), 2)


def describe_products(lines: List[dict]) -> str:
    if not lines:
        return 'no products'
    parts = []
    for line in lines:
        unit = 'students ×' if line['product'] in PLAN_ORDER else '×'
        discount = f" less {line['discount_percent']:g}%" if line['discount_percent'] else ''
        parts.append(f"{PRODUCT_LABELS.get(line['product'], line['product'])} {line['quantity']} {unit} ₹{line['rate']:g}{discount} = ₹{line['total']:,.0f}")
    return '; '.join(parts) + f" · Total ₹{products_total(lines):,.0f} (excluding GST)"


# ---- school location, photos taken at the school, and travel between schools
MAP_HOSTS = ('google.com', 'goo.gl', 'openstreetmap.org', 'apple.com', 'bing.com')
PHOTO_DIR = Path(__file__).parent / 'private_uploads' / 'leads'  # never served as static files; only through the authenticated endpoint
MAX_PHOTO_BYTES = 10 * 1024 * 1024
MAX_PHOTOS_PER_LEAD = 20
PHYSICAL = ('Visit', 'Meeting', 'Demo')
_COORDS = re.compile(r'\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*')


def maps_link(lat: float, lng: float) -> str:
    return f'https://www.google.com/maps?q={lat:.6f},{lng:.6f}'


def coords_in_url(url: str) -> Optional[tuple]:
    """Read latitude and longitude out of a map link (the @lat,lng and !3d..!4d forms Google uses, or ?q=lat,lng)."""
    for pattern in (r'@(-?\d+\.\d+),(-?\d+\.\d+)', r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)', r'[?&](?:q|ll|query|center)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)', r'mlat=(-?\d+\.\d+)&mlon=(-?\d+\.\d+)'):
        m = re.search(pattern, url)
        if m:
            return float(m.group(1)), float(m.group(2))
    return None


def check_coords(lat, lng):
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(422, 'Those coordinates are not on the map. Latitude is -90 to 90 and longitude -180 to 180.')


def location_fields(values: dict) -> dict:
    """Turn what the salesperson typed (a map link, plain coordinates, or the phone's location) into a link plus latitude and longitude.
    Removes the location keys from `values` and returns what to store."""
    clear = values.pop('clear_location', None)
    url, lat, lng = values.pop('location_url', None), values.pop('latitude', None), values.pop('longitude', None)
    if clear:
        return {'location_url': '', 'latitude': None, 'longitude': None}
    out: Dict[str, Any] = {}
    if url is not None:
        url = url.strip()
        typed = _COORDS.fullmatch(url) if url else None
        if typed:  # "17.385, 78.4867" typed instead of a link
            lat, lng, url = float(typed.group(1)), float(typed.group(2)), ''
        elif url:
            parts = urlparse(url)
            host = (parts.hostname or '').lower()
            if parts.scheme not in ('http', 'https') or len(url) > 500 or not any(host == h or host.endswith('.' + h) for h in MAP_HOSTS):
                raise HTTPException(422, 'Paste a Google Maps link (google.com/maps or maps.app.goo.gl), or type the coordinates like 17.385, 78.4867.')
            found = coords_in_url(url)
            if found and lat is None and lng is None:
                lat, lng = found
    if (lat is None) != (lng is None):
        raise HTTPException(422, 'Give both the latitude and the longitude.')
    if lat is not None:
        check_coords(lat, lng)
        out['latitude'], out['longitude'] = round(float(lat), 6), round(float(lng), 6)
        if not url:
            url = maps_link(lat, lng)
    if url is not None:
        out['location_url'] = url
    return out


def haversine_km(a_lat, a_lng, b_lat, b_lng) -> float:
    r = 6371.0088
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = p2 - p1, math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def ist_clock(iso_value: str) -> str:
    try:
        return (datetime.fromisoformat(iso_value) + timedelta(hours=5, minutes=30)).strftime('%I:%M %p').lstrip('0')
    except ValueError:
        return ''


def exif_gps(img) -> Optional[tuple]:
    """Where a phone photo was taken, if the phone saved it."""
    try:
        gps = img.getexif().get_ifd(0x8825)
        if not gps or 2 not in gps or 4 not in gps:
            return None

        def degrees(value, ref):
            d, m, sec = [float(x) for x in value]
            result = d + m / 60 + sec / 3600
            return -result if ref in ('S', 'W') else result
        lat, lng = degrees(gps[2], gps.get(1, 'N')), degrees(gps[4], gps.get(3, 'E'))
        return (lat, lng) if -90 <= lat <= 90 and -180 <= lng <= 180 and (lat or lng) else None
    except Exception:
        return None


def process_photo(data: bytes) -> dict:
    """Check that the upload really is a picture, straighten it, shrink it, and make a thumbnail. Raises if it is not a usable image."""
    from PIL import Image, ImageOps
    probe = Image.open(io.BytesIO(data))
    probe.verify()
    img = Image.open(io.BytesIO(data))
    if img.format not in ('JPEG', 'PNG', 'WEBP'):
        raise ValueError('unsupported format')
    if img.width * img.height > 50_000_000:
        raise ValueError('too large')
    gps = exif_gps(img)
    img = ImageOps.exif_transpose(img).convert('RGB')
    full, thumb = io.BytesIO(), io.BytesIO()
    big = img.copy()
    big.thumbnail((1600, 1600))
    big.save(full, 'JPEG', quality=82, optimize=True)
    small = img.copy()
    small.thumbnail((360, 360))
    small.save(thumb, 'JPEG', quality=75, optimize=True)
    return {'full': full.getvalue(), 'thumb': thumb.getvalue(), 'width': big.width, 'height': big.height, 'gps': gps}


def check_lead_fields(values: dict):
    if values.get('stage') is not None and values['stage'] not in LEAD_STAGES:
        raise HTTPException(422, 'Choose a valid stage.')
    if values.get('source') is not None and values['source'] not in LEAD_SOURCES:
        raise HTTPException(422, 'Choose a valid source.')
    if values.get('temperature') is not None and values['temperature'] not in LEAD_TEMPERATURES:
        raise HTTPException(422, 'Choose Hot, Warm or Cold.')
    for key, label in (('next_follow_up', 'Follow-up date'), ('expected_close', 'Expected close date')):
        if values.get(key) is not None:
            values[key] = valid_date(values[key], label)
    if values.get('school_name') is not None and not values['school_name'].strip():
        raise HTTPException(422, 'Enter the school name.')
    if values.get('contacts') is not None:
        if len(values['contacts']) > 10:
            raise HTTPException(422, 'Add up to 10 contact people.')
        cleaned = []
        for c in values['contacts']:
            c = c if isinstance(c, dict) else c.model_dump()
            if not c['name'].strip():
                raise HTTPException(422, 'Every contact needs a name.')
            if c['email'].strip():
                valid_email(c['email'])
            cleaned.append({'name': c['name'].strip(), 'designation': c['designation'].strip(), 'phone': re.sub(r'[^\d+ ]', '', c['phone']).strip()[:20],
                            'email': c['email'].strip().lower(), 'decision_maker': bool(c['decision_maker'])})
        values['contacts'] = cleaned
    return values


def lead_system_entry(text: str, user: dict) -> dict:
    return {'id': f'ACT-{uuid.uuid4().hex[:8].upper()}', 'at': _stamp(), 'date': today_ist(), 'type': 'System', 'met_name': '', 'met_designation': '',
            'summary': text, 'outcome': '', 'by': user['name'], 'by_id': user['id']}


async def lead_owner_names() -> Dict[str, str]:
    return {u['id']: u['name'] for u in await pdb.platform_users.find({}, {'id': 1, 'name': 1}).to_list(500)}


def lead_row(lead: dict, today: str, owners: Dict[str, str]) -> dict:
    follow = lead.get('next_follow_up', '')
    is_open = lead['stage'] in OPEN_STAGES
    contact = (lead.get('contacts') or [{}])[0]
    return {
        'id': lead['id'], 'school_name': lead['school_name'], 'city': lead.get('city', ''), 'state': lead.get('state', ''), 'stage': lead['stage'],
        'temperature': lead.get('temperature', 'Warm'), 'source': lead.get('source', ''), 'student_count': lead.get('student_count', 0),
        'products': [{'product': l['product'], 'label': PRODUCT_LABELS.get(l['product'], l['product']), 'total': l['total']} for l in lead_products(lead)],
        'quoted_total': lead.get('quoted_total', 0), 'next_follow_up': follow, 'follow_up_note': lead.get('follow_up_note', ''),
        'location_url': lead.get('location_url', ''), 'latitude': lead.get('latitude'), 'longitude': lead.get('longitude'), 'photo_count': len(lead.get('photos', [])),
        'follow_up_overdue': bool(follow and follow < today and is_open), 'follow_up_today': bool(follow and follow == today and is_open),
        'owner_id': lead.get('owner_id', ''), 'owner_name': owners.get(lead.get('owner_id', ''), lead.get('owner_name', '')),
        'contact_name': contact.get('name', ''), 'contact_phone': contact.get('phone', ''),
        'last_activity_at': lead.get('last_activity_at', ''), 'meetings': len([a for a in lead.get('activities', []) if a['type'] != 'System']),
        'created_at': lead['created_at'], 'updated_at': lead['updated_at'], 'school_id': lead.get('school_id', ''),
    }


def lead_detail(lead: dict, today: str, owners: Dict[str, str], gst: float, plans: Dict[str, dict]) -> dict:
    item = lead_row(lead, today, owners)
    lines = [{**l, 'label': PRODUCT_LABELS.get(l['product'], l['product']), 'erp': l['product'] in PLAN_ORDER,
              'list_rate': float((plans.get(l['product']) or {}).get('rate_per_student', 0))} for l in lead_products(lead)]
    total = products_total(lines)
    item.update({
        'address': lead.get('address', ''), 'board': lead.get('board', ''), 'contacts': lead.get('contacts', []), 'current_system': lead.get('current_system', ''),
        'notes': lead.get('notes', ''), 'expected_close': lead.get('expected_close', ''), 'lost_reason': lead.get('lost_reason', ''), 'won_at': lead.get('won_at', ''),
        'products': lines, 'quote': {'total': total, 'gst_percent': gst, 'total_with_gst': round(total * (1 + gst / 100), 2)},
        'photos': [{k: p.get(k) for k in ('id', 'caption', 'uploaded_at', 'by', 'by_id', 'width', 'height', 'latitude', 'longitude')} for p in lead.get('photos', [])],
        'activities': sorted(lead.get('activities', []), key=lambda a: (a['date'], a['at']), reverse=True),
    })
    return item


async def lead_context():
    return today_ist(), await lead_owner_names()


async def lead_view(lead: dict) -> dict:
    today, owners = await lead_context()
    plans = await get_plans()
    return lead_detail(lead, today, owners, float((await get_settings())['gst_percent']), plans)


async def load_lead(lead_id: str, user: dict) -> dict:
    lead = await pdb.platform_leads.find_one({**lead_scope(user), 'id': lead_id})
    if not lead:
        raise HTTPException(404, 'Lead not found.')
    return lead


def lead_summary(rows: List[dict], today: str, owner_view: bool, owners: Dict[str, str]) -> dict:
    start = (datetime.strptime(today, '%Y-%m-%d') - timedelta(days=30)).strftime('%Y-%m-%d')
    open_rows = [r for r in rows if r['stage'] in OPEN_STAGES]
    week = (datetime.strptime(today, '%Y-%m-%d') + timedelta(days=7)).strftime('%Y-%m-%d')
    won = [r for r in rows if r['stage'] == 'Won' and (r.get('won_at') or r.get('updated_at', ''))[:10] >= start]

    def visits(r):
        return len([a for a in r.get('activities', []) if a['type'] in ('Visit', 'Meeting', 'Demo') and a['date'] >= start])
    by_product: Dict[str, dict] = {}
    for r in open_rows:
        for line in lead_products(r):
            p = by_product.setdefault(line['product'], {'product': line['product'], 'label': PRODUCT_LABELS.get(line['product'], line['product']), 'leads': 0, 'value': 0.0})
            p['leads'] += 1
            p['value'] = round(p['value'] + float(line['total']), 2)
    summary = {
        'total': len(rows), 'open': len(open_rows), 'by_stage': {st: len([r for r in rows if r['stage'] == st]) for st in LEAD_STAGES},
        'pipeline_value': round(sum(r.get('quoted_total', 0) for r in open_rows), 2),
        'won_30d': len(won), 'won_value_30d': round(sum(r.get('quoted_total', 0) for r in won), 2), 'visits_30d': sum(visits(r) for r in rows),
        'follow_ups': {'overdue': len([r for r in open_rows if r.get('next_follow_up') and r['next_follow_up'] < today]),
                       'today': len([r for r in open_rows if r.get('next_follow_up') == today]),
                       'next_7_days': len([r for r in open_rows if r.get('next_follow_up') and today < r['next_follow_up'] <= week]),
                       'not_set': len([r for r in open_rows if not r.get('next_follow_up')])},
        'by_product': sorted(by_product.values(), key=lambda p: -p['value']),
    }
    if owner_view:
        by_owner: Dict[str, dict] = {}
        for r in rows:
            o = by_owner.setdefault(r.get('owner_id', ''), {'owner_id': r.get('owner_id', ''), 'name': owners.get(r.get('owner_id', ''), r.get('owner_name', 'Unassigned')),
                                                            'leads': 0, 'open': 0, 'visits_30d': 0, 'proposals': 0, 'won_30d': 0, 'overdue': 0, 'pipeline_value': 0.0, 'km_30d': 0.0})
            o['leads'] += 1
            o['visits_30d'] += visits(r)
            if r['stage'] in OPEN_STAGES:
                o['open'] += 1
                o['pipeline_value'] = round(o['pipeline_value'] + r.get('quoted_total', 0), 2)
                if r.get('next_follow_up') and r['next_follow_up'] < today:
                    o['overdue'] += 1
            if r['stage'] in ('Proposal sent', 'Negotiation'):
                o['proposals'] += 1
            if r in won:
                o['won_30d'] += 1
        for day in build_routes(rows, start, today, '', owners):
            if day['owner_id'] in by_owner:
                by_owner[day['owner_id']]['km_30d'] = round(by_owner[day['owner_id']]['km_30d'] + day['total_km'], 1)
        summary['by_owner'] = sorted(by_owner.values(), key=lambda o: -o['pipeline_value'])
    return summary


@platform_router.get('/leads')
async def list_leads(stage: str = '', owner_id: str = '', plan: str = '', temperature: str = '', followup: str = '', q: str = '', sort: str = 'followup',
                     date_from: str = Query('', alias='from'), date_to: str = Query('', alias='to'), skip: int = 0, limit: int = 50,
                     user: dict = Depends(require_perm('leads:own'))):
    owner_view = '*' in ROLE_PERMISSIONS.get(user['role'], set())
    today, owners = await lead_context()
    rows = await pdb.platform_leads.find(lead_scope(user)).to_list(10000)
    summary = lead_summary(rows, today, owner_view, owners)
    week = (datetime.strptime(today, '%Y-%m-%d') + timedelta(days=7)).strftime('%Y-%m-%d')
    needle = q.strip().lower()

    def keep(r):
        fu = r.get('next_follow_up', '')
        is_open = r['stage'] in OPEN_STAGES
        if stage == 'open' and not is_open:
            return False
        if stage and stage != 'open' and r['stage'] != stage:
            return False
        if owner_view and owner_id and r.get('owner_id') != owner_id:
            return False
        if plan and plan not in [l['product'] for l in lead_products(r)]:
            return False
        if temperature and r.get('temperature') != temperature:
            return False
        if followup == 'overdue' and not (is_open and fu and fu < today):
            return False
        if followup == 'today' and not (is_open and fu == today):
            return False
        if followup == 'week' and not (is_open and fu and today <= fu <= week):
            return False
        if followup == 'none' and not (is_open and not fu):
            return False
        if date_from and r['created_at'][:10] < date_from:
            return False
        if date_to and r['created_at'][:10] > date_to:
            return False
        if needle:
            hay = ' '.join([r['school_name'], r.get('city', ''), ' '.join(c['name'] + ' ' + c.get('phone', '') for c in r.get('contacts', []))]).lower()
            if needle not in hay:
                return False
        return True
    found = [r for r in rows if keep(r)]
    if sort == 'recent':
        found.sort(key=lambda r: r['updated_at'], reverse=True)
    elif sort == 'value':
        found.sort(key=lambda r: -r.get('quoted_total', 0))
    else:  # follow-up due soonest first, leads with no date last
        found.sort(key=lambda r: (0 if r['stage'] in OPEN_STAGES else 1, r.get('next_follow_up') or '9999-12-31', r['school_name'].lower()))
    page = found[max(0, skip): max(0, skip) + max(1, min(limit, 200))]
    sales_users = [{'id': u['id'], 'name': u['name']} for u in await pdb.platform_users.find({'active': True, 'role': {'$in': ['sales', 'owner']}}).sort('name', 1).to_list(200)] if owner_view else []
    # who to follow up today (and what is overdue), and the latest visits and calls
    due = sorted([r for r in rows if r['stage'] in OPEN_STAGES and r.get('next_follow_up') and r['next_follow_up'] <= today], key=lambda r: r['next_follow_up'])[:25]
    feed = [{'lead_id': r['id'], 'school_name': r['school_name'], 'by': a['by'], 'type': a['type'], 'date': a['date'], 'at': a['at'], 'met_name': a['met_name'],
             'met_designation': a['met_designation'], 'summary': a['summary'][:160]} for r in rows for a in r.get('activities', []) if a['type'] != 'System']
    feed.sort(key=lambda x: x['at'], reverse=True)
    return {'total': len(found), 'items': [lead_row(r, today, owners) for r in page], 'summary': summary, 'owner_view': owner_view, 'salespeople': sales_users,
            'due': [lead_row(r, today, owners) for r in due], 'recent': feed[:12], 'today': today,
            'options': {'stages': LEAD_STAGES, 'sources': LEAD_SOURCES, 'temperatures': LEAD_TEMPERATURES, 'activity_types': ACTIVITY_TYPES,
                        'products': [{'key': k, 'label': v, 'erp': k in PLAN_ORDER} for k, v in PRODUCT_LABELS.items()]}}


@platform_router.post('/leads')
async def create_lead(body: LeadBody, request: Request, user: dict = Depends(require_perm('leads:own'))):
    values = check_lead_fields(body.model_dump())
    if body.stage in ('Won', 'Lost'):
        raise HTTPException(422, 'A new lead starts as an open lead.')
    products = clean_products(values.pop('products', []))
    location = location_fields(values)
    owner_id = user['id']
    if body.owner_id and body.owner_id != user['id']:
        if '*' not in ROLE_PERMISSIONS.get(user['role'], set()):
            raise HTTPException(403, 'You can only add leads to your own list.')
        person = await pdb.platform_users.find_one({'id': body.owner_id, 'active': True, 'role': {'$in': ['sales', 'owner']}})
        if not person:
            raise HTTPException(422, 'Choose an active salesperson.')
        owner_id = person['id']
    now = _iso()
    owners = await lead_owner_names()
    entries = [lead_system_entry('Lead added', user)]
    if products:
        entries.append(lead_system_entry(f"Quote updated: {describe_products(products)}", user))
    doc = {**{k: v for k, v in values.items() if k != 'owner_id'}, 'id': f'LEAD-{uuid.uuid4().hex[:8].upper()}', 'school_name': body.school_name.strip(),
           'owner_id': owner_id, 'owner_name': owners.get(owner_id, user['name']), 'products': products, 'quoted_total': products_total(products), **location, 'photos': [],
           'activities': entries, 'last_activity_at': '', 'lost_reason': '', 'school_id': '', 'created_at': now, 'updated_at': now, 'created_by': user['name']}
    await pdb.platform_leads.insert_one(doc.copy())
    await audit(user, 'lead_created', doc['id'], {'school': doc['school_name']}, client_ip(request))
    return await lead_view(doc)


def build_routes(rows: List[dict], start: str, end: str, owner_filter: str, owners: Dict[str, str]) -> List[dict]:
    """One route per salesperson per day: the schools visited in order, and the distance between each pair.
    A distance the salesperson typed wins; otherwise it is estimated in a straight line from the two school locations."""
    stops = []
    for lead in rows:
        for a in lead.get('activities', []):
            if a['type'] in PHYSICAL and start <= a['date'] <= end and (not owner_filter or a['by_id'] == owner_filter):
                stops.append({'by_id': a['by_id'], 'by': a['by'], 'date': a['date'], 'at': a['at'], 'activity_id': a['id'], 'type': a['type'], 'manual': a.get('distance_km'), 'lead': lead})
    stops.sort(key=lambda x: (x['date'], x['by_id'], x['at']))
    days: Dict[tuple, List[dict]] = {}
    for stop in stops:
        days.setdefault((stop['date'], stop['by_id']), []).append(stop)
    result = []
    for (date, by_id), group in days.items():
        out, previous = [], None
        for stop in group:
            lead = stop['lead']
            if previous and previous['lead']['id'] == lead['id']:
                continue  # two visits in a row at the same school are one stop
            km, source = None, None
            if stop['manual'] is not None:
                km, source = float(stop['manual']), 'entered'
            elif previous and previous['lead'].get('latitude') is not None and lead.get('latitude') is not None:
                km, source = round(haversine_km(previous['lead']['latitude'], previous['lead']['longitude'], lead['latitude'], lead['longitude']), 1), 'estimated'
            out.append({'activity_id': stop['activity_id'], 'lead_id': lead['id'], 'school_name': lead['school_name'], 'city': lead.get('city', ''), 'type': stop['type'],
                        'time': ist_clock(stop['at']), 'latitude': lead.get('latitude'), 'longitude': lead.get('longitude'), 'location_url': lead.get('location_url', ''),
                        'km': km, 'km_source': source, 'first': previous is None})
            previous = stop
        points = [f"{s['latitude']:.6f},{s['longitude']:.6f}" for s in out if s['latitude'] is not None]
        result.append({'date': date, 'owner_id': by_id, 'owner_name': owners.get(by_id, group[0]['by']), 'stops': out,
                       'total_km': round(sum(s['km'] for s in out if s['km'] is not None), 1), 'unknown_legs': len([s for s in out if s['km'] is None and not s['first']]),
                       'directions_url': ('https://www.google.com/maps/dir/' + '/'.join(points)) if len(points) >= 2 else ''})
    result.sort(key=lambda d: (d['date'], d['owner_name']), reverse=True)
    return result


@platform_router.get('/leads/routes')
async def lead_routes(owner_id: str = '', date_from: str = Query('', alias='from'), date_to: str = Query('', alias='to'), user: dict = Depends(require_perm('leads:own'))):
    owner_view = '*' in ROLE_PERMISSIONS.get(user['role'], set())
    today, owners = await lead_context()
    end = valid_date(date_to, 'To date') or today
    start = valid_date(date_from, 'From date') or (datetime.strptime(end, '%Y-%m-%d') - timedelta(days=13)).strftime('%Y-%m-%d')
    if start > end:
        raise HTTPException(422, 'The start date must be before the end date.')
    if (datetime.strptime(end, '%Y-%m-%d') - datetime.strptime(start, '%Y-%m-%d')).days > 92:
        raise HTTPException(422, 'Choose a period of three months or less.')
    rows = await pdb.platform_leads.find(lead_scope(user)).to_list(10000)
    days = build_routes(rows, start, end, owner_id if owner_view else '', owners)
    sales_users = [{'id': u['id'], 'name': u['name']} for u in await pdb.platform_users.find({'active': True, 'role': {'$in': ['sales', 'owner']}}).sort('name', 1).to_list(200)] if owner_view else []
    return {'range': {'from': start, 'to': end}, 'days': days, 'owner_view': owner_view, 'salespeople': sales_users, 'today': today,
            'totals': {'km': round(sum(d['total_km'] for d in days), 1), 'days': len(days), 'stops': sum(len(d['stops']) for d in days),
                       'unknown_legs': sum(d['unknown_legs'] for d in days)}}


@platform_router.put('/leads/{lead_id}/activities/{activity_id}/distance')
async def set_activity_distance(lead_id: str, activity_id: str, body: DistanceBody, request: Request, user: dict = Depends(require_perm('leads:own'))):
    """Type or correct the distance from the previous school (leave it empty to go back to the map estimate)."""
    lead = await load_lead(lead_id, user)
    activity = next((a for a in lead.get('activities', []) if a['id'] == activity_id and a['type'] in PHYSICAL), None)
    if not activity:
        raise HTTPException(404, 'Visit not found.')
    if activity.get('by_id') != user['id'] and '*' not in ROLE_PERMISSIONS.get(user['role'], set()):
        raise HTTPException(403, 'You can only change the distance of your own visits.')
    value = None if body.distance_km is None else round(float(body.distance_km), 1)
    await pdb.platform_leads.update_one({'id': lead_id, 'activities.id': activity_id}, {'$set': {'activities.$.distance_km': value, 'updated_at': _iso()}})
    await audit(user, 'lead_distance', lead_id, {'activity': activity_id, 'km': value}, client_ip(request))
    return await get_lead(lead_id, user)


@platform_router.post('/leads/{lead_id}/photos')
async def upload_lead_photo(lead_id: str, request: Request, file: UploadFile = File(...), caption: str = Form(''), user: dict = Depends(require_perm('leads:own'))):
    """A photo taken at the school. It is checked, straightened, shrunk and kept in a private folder; only signed-in staff can open it."""
    lead = await load_lead(lead_id, user)
    if len(lead.get('photos', [])) >= MAX_PHOTOS_PER_LEAD:
        raise HTTPException(422, f'A school can have up to {MAX_PHOTOS_PER_LEAD} photos. Delete one first.')
    data = await file.read(MAX_PHOTO_BYTES + 1)
    if not data:
        raise HTTPException(422, 'The photo is empty.')
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(422, 'Choose a photo smaller than 10 MB.')
    try:
        done = await asyncio.to_thread(process_photo, data)
    except Exception:
        raise HTTPException(422, 'That file is not a photo we can read. Use a JPG, PNG or WebP picture.')
    photo_id = f'PHO-{uuid.uuid4().hex[:10].upper()}'
    folder = PHOTO_DIR / lead_id
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f'{photo_id}.jpg').write_bytes(done['full'])
    (folder / f'{photo_id}_t.jpg').write_bytes(done['thumb'])
    gps = done['gps']
    meta = {'id': photo_id, 'caption': caption.strip()[:200], 'uploaded_at': _stamp(), 'by': user['name'], 'by_id': user['id'], 'width': done['width'], 'height': done['height'],
            'latitude': round(gps[0], 6) if gps else None, 'longitude': round(gps[1], 6) if gps else None}
    update: Dict[str, Any] = {'$push': {'photos': meta}, '$set': {'updated_at': _iso()}}
    if gps and lead.get('latitude') is None:  # the phone knew where the photo was taken: that is where the school is
        update['$set'].update({'latitude': meta['latitude'], 'longitude': meta['longitude'], 'location_url': lead.get('location_url') or maps_link(*gps)})
        update['$push'] = {'photos': meta, 'activities': lead_system_entry('School location set from the photo', user)}
    await pdb.platform_leads.update_one({'id': lead_id}, update)
    await audit(user, 'lead_photo_added', lead_id, {'photo': photo_id}, client_ip(request))
    return await get_lead(lead_id, user)


@platform_router.get('/leads/{lead_id}/photos/{photo_id}')
async def get_lead_photo(lead_id: str, photo_id: str, size: str = 'full', user: dict = Depends(require_perm('leads:own'))):
    lead = await load_lead(lead_id, user)  # also checks that this salesperson may see the school
    if not any(p['id'] == photo_id for p in lead.get('photos', [])):
        raise HTTPException(404, 'Photo not found.')
    path = PHOTO_DIR / lead_id / (f'{photo_id}_t.jpg' if size == 'thumb' else f'{photo_id}.jpg')
    if not path.is_file():
        raise HTTPException(404, 'Photo not found.')
    return FileResponse(path, media_type='image/jpeg', headers={'Cache-Control': 'private, max-age=3600'})


@platform_router.delete('/leads/{lead_id}/photos/{photo_id}')
async def delete_lead_photo(lead_id: str, photo_id: str, request: Request, user: dict = Depends(require_perm('leads:own'))):
    lead = await load_lead(lead_id, user)
    photo = next((p for p in lead.get('photos', []) if p['id'] == photo_id), None)
    if not photo:
        raise HTTPException(404, 'Photo not found.')
    if photo.get('by_id') != user['id'] and '*' not in ROLE_PERMISSIONS.get(user['role'], set()):
        raise HTTPException(403, 'You can only delete photos you added.')
    await pdb.platform_leads.update_one({'id': lead_id}, {'$pull': {'photos': {'id': photo_id}}, '$set': {'updated_at': _iso()}})
    for name in (f'{photo_id}.jpg', f'{photo_id}_t.jpg'):
        try:
            (PHOTO_DIR / lead_id / name).unlink()
        except FileNotFoundError:
            pass
    await audit(user, 'lead_photo_deleted', lead_id, {'photo': photo_id}, client_ip(request))
    return await get_lead(lead_id, user)


@platform_router.get('/leads/{lead_id}')
async def get_lead(lead_id: str, user: dict = Depends(require_perm('leads:own'))):
    return await lead_view(await load_lead(lead_id, user))


@platform_router.put('/leads/{lead_id}')
async def update_lead(lead_id: str, body: LeadUpdate, request: Request, user: dict = Depends(require_perm('leads:own'))):
    lead = await load_lead(lead_id, user)
    owner_view = '*' in ROLE_PERMISSIONS.get(user['role'], set())
    values = check_lead_fields({k: v for k, v in body.model_dump().items() if v is not None})
    new_lines = clean_products(values.pop('products')) if 'products' in values else None
    location = location_fields(values)
    notes: List[dict] = []
    if 'owner_id' in values:
        if not owner_view:
            raise HTTPException(403, 'Only the Owner can reassign a lead.')
        person = await pdb.platform_users.find_one({'id': values['owner_id'], 'active': True, 'role': {'$in': ['sales', 'owner']}})
        if not person:
            raise HTTPException(422, 'Choose an active salesperson.')
        values['owner_name'] = person['name']
        if values['owner_id'] != lead.get('owner_id'):
            notes.append(lead_system_entry(f"Reassigned to {person['name']}", user))
    changes = {k: v for k, v in values.items() if k != 'lost_reason' and v != lead.get(k)}
    moved = {k: v for k, v in location.items() if v != lead.get(k)}
    if moved:
        changes.update(moved)
        notes.append(lead_system_entry('School location cleared' if not moved.get('location_url', lead.get('location_url')) and moved.get('latitude', 1) is None else 'School location saved', user))
    if 'stage' in changes:
        if changes['stage'] == 'Lost' and not (values.get('lost_reason') or lead.get('lost_reason', '')).strip():
            raise HTTPException(422, 'Tell us why the school was lost.')
        notes.append(lead_system_entry(f"Stage: {lead['stage']} → {changes['stage']}", user))
        if changes['stage'] == 'Won':
            changes['won_at'] = _iso()
    if values.get('lost_reason') is not None:
        changes['lost_reason'] = values['lost_reason'].strip()
    if new_lines is not None:
        def signature(lines):
            return [(l['product'], l['quantity'], l['rate'], l['discount_percent'], l['note']) for l in lines]
        if signature(new_lines) != signature(lead_products(lead)):
            changes['products'] = new_lines
            changes['quoted_total'] = products_total(new_lines)
            notes.append(lead_system_entry(f"Quote updated: {describe_products(new_lines)}", user))
    if 'next_follow_up' in changes:
        notes.append(lead_system_entry(f"Next follow-up set to {changes['next_follow_up'] or 'nothing'}", user))
    if not changes:
        raise HTTPException(422, 'Nothing to change.')
    changes['updated_at'] = _iso()
    update: Dict[str, Any] = {'$set': changes}
    if notes:
        update['$push'] = {'activities': {'$each': notes}}
    await pdb.platform_leads.update_one({'id': lead_id}, update)
    await audit(user, 'lead_updated', lead_id, {k: v for k, v in changes.items() if k not in ('updated_at', 'contacts', 'notes', 'products')}, client_ip(request))
    return await get_lead(lead_id, user)


@platform_router.post('/leads/{lead_id}/activities')
async def add_lead_activity(lead_id: str, body: ActivityBody, request: Request, user: dict = Depends(require_perm('leads:own'))):
    lead = await load_lead(lead_id, user)
    if body.type not in ACTIVITY_TYPES:
        raise HTTPException(422, 'Choose what kind of contact it was.')
    summary = body.summary.strip()
    if not 3 <= len(summary) <= 3000:
        raise HTTPException(422, 'Write what happened (3 to 3000 characters).')
    today = today_ist()
    date = valid_date(body.date, 'Date') or today
    if date > today:
        raise HTTPException(422, 'The date cannot be in the future. Use the follow-up date for what comes next.')
    entry = {'id': f'ACT-{uuid.uuid4().hex[:8].upper()}', 'at': _stamp(), 'date': date, 'type': body.type, 'met_name': body.met_name.strip()[:80],
             'met_designation': body.met_designation.strip()[:80], 'summary': summary, 'outcome': body.outcome.strip()[:500], 'by': user['name'], 'by_id': user['id'],
             'distance_km': round(float(body.distance_km), 1) if (body.distance_km is not None and body.type in PHYSICAL) else None}
    changes: Dict[str, Any] = {'last_activity_at': entry['at'], 'updated_at': entry['at']}
    system: List[dict] = []
    if body.next_follow_up is not None:
        changes['next_follow_up'] = valid_date(body.next_follow_up, 'Follow-up date')
        if body.follow_up_note is not None:
            changes['follow_up_note'] = body.follow_up_note.strip()[:300]
    new_stage = lead['stage']
    if lead['stage'] == 'New lead' and body.type in ('Visit', 'Meeting', 'Demo'):
        new_stage = 'Demo done' if body.type == 'Demo' else 'Visited'
    elif lead['stage'] == 'Visited' and body.type == 'Demo':
        new_stage = 'Demo done'
    if new_stage != lead['stage']:
        changes['stage'] = new_stage
        stage_line = lead_system_entry(f"Stage: {lead['stage']} → {new_stage}", user)
        stage_line.update({'at': entry['at'], 'date': entry['date']})  # sits right after the visit that caused it
        system.append(stage_line)
    await pdb.platform_leads.update_one({'id': lead_id}, {'$set': changes, '$push': {'activities': {'$each': [entry] + system}}})
    await audit(user, 'lead_activity', lead_id, {'type': body.type, 'met': entry['met_name']}, client_ip(request))
    return await get_lead(lead_id, user)


@platform_router.post('/leads/{lead_id}/convert')
async def convert_lead(lead_id: str, body: ConvertBody, request: Request, user: dict = Depends(require_perm('schools:create'))):
    """The school signed: create it in Schools, carrying over the ERP plan, the student count and the negotiated ERP price."""
    lead = await load_lead(lead_id, user)
    if lead.get('school_id'):
        raise HTTPException(409, 'This lead was already converted to a school.')
    erp_lines = [l for l in lead_products(lead) if l['product'] in PLAN_ORDER]
    erp = max(erp_lines, key=lambda l: l['total']) if erp_lines else None
    plan = body.plan or (erp['product'] if erp else 'essential')
    plans = await get_plans()
    if plan not in plans:
        raise HTTPException(422, 'Choose Essential, Pro or Premium.')
    list_rate = float(plans[plan]['rate_per_student'])
    net_rate = (float(erp['rate']) * (1 - float(erp['discount_percent']) / 100)) if erp else 0.0
    # carry the negotiated price over only when it was for this same ERP plan (exact, so the school is billed the quoted price)
    discount = round(max(0.0, min(100.0, (1 - net_rate / list_rate) * 100)), 4) if (erp and plan == erp['product'] and list_rate and net_rate) else 0.0
    person = next((c for c in lead.get('contacts', []) if c.get('decision_maker')), (lead.get('contacts') or [{}])[0])
    school = await create_school(SchoolBody(
        name=lead['school_name'], code=body.code, plan=plan, status=body.status, board=lead.get('board', ''), address=lead.get('address', ''),
        city=lead.get('city', ''), state=lead.get('state', ''), contact_name=person.get('name', ''), contact_email=person.get('email', ''),
        contact_phone=person.get('phone', ''), student_count=int((erp['quantity'] if erp else 0) or lead.get('student_count') or 0), discount_percent=discount,
        notes=f"Converted from sales lead {lead['id']} ({lead.get('owner_name', '')})."), request, user)
    now = _iso()
    await pdb.platform_leads.update_one({'id': lead_id}, {'$set': {'stage': 'Won', 'won_at': now, 'school_id': school['id'], 'updated_at': now},
                                                          '$push': {'activities': lead_system_entry(f"Converted to school {school['name']}", user)}})
    await audit(user, 'lead_converted', lead_id, {'school_id': school['id']}, client_ip(request))
    return {'school_id': school['id'], 'lead': await get_lead(lead_id, user)}


# ---------------------------------------------------------------- school login accounts (Owner only)
# The school's own logins (Admin, Teacher...) with a username and a password the Owner sets. A password is stored only as a
# salted hash, so nobody can read it afterwards: it is shown once when it is set, to hand to the school. Reset any time.
ROLE_USERNAME_PART = {'admin': 'admin', 'teacher': 'teacher', 'fee_manager': 'fees', 'director': 'director', 'academic_coordinator': 'academic',
                      'stock_manager': 'stock', 'librarian': 'library'}


class AccountUpdate(BaseModel):
    username: Optional[str] = None
    active: Optional[bool] = None


def generate_password() -> str:
    alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    while True:
        value = ''.join(secrets.choice(alphabet) for _ in range(16))
        if re.search(r'[a-z]', value) and re.search(r'[A-Z]', value) and re.search(r'\d', value):
            return value


async def account_rows(school: dict) -> List[dict]:
    rows = []
    for role in school['logins']:
        rec = await pdb.school_accounts.find_one({'school_id': school['id'], 'role': role}) or {}
        last = await pdb.platform_logins.find_one({'school_id': school['id'], 'role': role}, {'_id': 0, 'at': 1}, sort=[('at', -1)])
        rows.append({'role': role, 'role_label': ROLE_LABELS.get(role, role), 'username': rec.get('username') or f"{school['code']}.{ROLE_USERNAME_PART.get(role, role)}",
                     'password_set': bool(rec.get('hash')), 'password_set_at': rec.get('password_set_at', ''), 'password_set_by': rec.get('password_set_by', ''),
                     'active': rec.get('active', True), 'last_sign_in': (last or {}).get('at', '')})
    return rows


@platform_router.get('/schools/{school_id}/accounts')
async def school_accounts(school_id: str, user: dict = Depends(require_perm('credentials:manage'))):
    school = shape_school(await load_school(school_id), await get_plans())
    return {'accounts': await account_rows(school), 'enforced': False}


@platform_router.put('/schools/{school_id}/accounts/{role}')
async def update_school_account(school_id: str, role: str, body: AccountUpdate, request: Request, user: dict = Depends(require_perm('credentials:manage'))):
    school = shape_school(await load_school(school_id), await get_plans())
    if role not in school['logins']:
        raise HTTPException(404, 'This school does not have that login.')
    current = next(r for r in await account_rows(school) if r['role'] == role)
    changes: Dict[str, Any] = {}
    if body.username is not None:
        username = body.username.strip().lower()
        if not re.fullmatch(r'[a-z0-9][a-z0-9._-]{2,39}', username):
            raise HTTPException(422, 'Username: 3 to 40 letters, numbers, dots, hyphens or underscores.')
        if username != current['username']:
            if await pdb.school_accounts.find_one({'username': username, 'school_id': {'$ne': school_id}}) or await pdb.school_accounts.find_one({'username': username, 'role': {'$ne': role}, 'school_id': school_id}):
                raise HTTPException(409, 'This username is already used.')
            changes['username'] = username
    if body.active is not None and body.active != current['active']:
        changes['active'] = body.active
    if not changes:
        raise HTTPException(422, 'Nothing to change.')
    await pdb.school_accounts.update_one({'school_id': school_id, 'role': role}, {'$set': {**changes, 'username': changes.get('username', current['username']), 'updated': _iso()}}, upsert=True)
    await audit(user, 'school_login_updated', school_id, {'role': role, **changes}, client_ip(request))
    return {'accounts': await account_rows(school)}


@platform_router.post('/schools/{school_id}/accounts/{role}/password')
async def set_school_password(school_id: str, role: str, request: Request, user: dict = Depends(require_perm('credentials:manage'))):
    """Make a new random password for this login. It is returned once; only a hash is kept."""
    school = shape_school(await load_school(school_id), await get_plans())
    if role not in school['logins']:
        raise HTTPException(404, 'This school does not have that login.')
    current = next(r for r in await account_rows(school) if r['role'] == role)
    password = generate_password()
    salt, digest = await asyncio.to_thread(hash_password, password, None)
    await pdb.school_accounts.update_one({'school_id': school_id, 'role': role}, {'$set': {
        'username': current['username'], 'salt': salt, 'hash': digest, 'password_set_at': _iso(), 'password_set_by': user['name'], 'updated': _iso()},
        '$setOnInsert': {'active': True}}, upsert=True)
    await audit(user, 'school_password_set', school_id, {'role': role}, client_ip(request))  # the password itself is never logged
    return {'role': role, 'role_label': ROLE_LABELS.get(role, role), 'username': current['username'], 'password': password}


# ---------------------------------------------------------------- audit log
@platform_router.get('/audit')
async def audit_log(limit: int = 200, action: str = '', actor: str = '', user: dict = Depends(require_perm('audit:read'))):
    query: Dict[str, Any] = {}
    if action:
        query['action'] = action
    if actor:
        query['actor'] = {'$regex': re.escape(actor), '$options': 'i'}
    rows = await pdb.platform_audit.find(query).sort('at', -1).to_list(max(1, min(limit, 1000)))
    return [clean(row) for row in rows]
