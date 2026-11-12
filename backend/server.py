from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Form
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import csv
import io
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import secrets
import hashlib
import hmac
import html
import asyncio
import base64
import json
import re
import math
import urllib.request
import urllib.error
from datetime import datetime, timedelta
import jwt
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

APP_ENV = os.environ.get('APP_ENV', 'development').strip().lower()
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret')
if APP_ENV in {'production', 'prod'} and (JWT_SECRET == 'dev-secret' or len(JWT_SECRET) < 32):
    raise RuntimeError('Production requires JWT_SECRET with at least 32 characters.')
JWT_ALGO = 'HS256'

app = FastAPI()
api_router = APIRouter(prefix="/api")
HOMEWORK_UPLOAD_DIR = ROOT_DIR / 'uploads' / 'homework'
LEAVE_UPLOAD_DIR = ROOT_DIR / 'uploads' / 'leaves'
PARENT_UPLOAD_DIR = ROOT_DIR / 'uploads' / 'parent'
APPROVAL_UPLOAD_DIR = ROOT_DIR / 'uploads' / 'approvals'
ADMISSION_UPLOAD_DIR = ROOT_DIR / 'uploads' / 'admissions'
STUDENT_UPLOAD_DIR = ROOT_DIR / 'uploads' / 'students'
HOMEWORK_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
LEAVE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PARENT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
APPROVAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ADMISSION_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
STUDENT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount('/uploads', StaticFiles(directory=ROOT_DIR / 'uploads'), name='uploads')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def build_admission_application_pdf(lead: dict, school: dict) -> bytes:
    """Create the school's permanent, parent-signable admission application."""
    buffer = io.BytesIO()
    school_name = str(school.get('school_name') or school.get('name') or 'Orison Main Campus')
    school_address = str(school.get('address') or 'Hyderabad, Telangana')
    school_phone = str(school.get('phone') or '+91 98483 31551')
    school_email = str(school.get('email') or 'info@orisonservices.in')
    school_website = str(school.get('website') or 'www.orisonservices.in')
    accent = colors.HexColor('#4F46E5')
    dark = colors.HexColor('#101828')
    muted = colors.HexColor('#667085')
    pale = colors.HexColor('#EEF2FF')
    border = colors.HexColor('#DDE3EE')
    logo_path = ROOT_DIR / 'assets' / 'orison-logo.png'
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm,
        topMargin=45 * mm, bottomMargin=18 * mm,
        title=f"Admission Application - {lead.get('child_name') or lead.get('name') or ''}",
        author='Orison School ERP',
    )
    styles = getSampleStyleSheet()
    body = ParagraphStyle('AdmissionBody', parent=styles['BodyText'], fontName='Helvetica', fontSize=8.7, leading=12, textColor=dark)
    small = ParagraphStyle('AdmissionSmall', parent=body, fontSize=7.3, leading=10, textColor=muted)
    label = ParagraphStyle('AdmissionLabel', parent=small, fontName='Helvetica-Bold', textColor=muted)
    heading = ParagraphStyle('AdmissionHeading', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=dark, spaceAfter=6)
    title_style = ParagraphStyle('AdmissionTitle', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=16, leading=20, alignment=TA_CENTER, textColor=dark, spaceAfter=3)
    centered = ParagraphStyle('AdmissionCentered', parent=small, alignment=TA_CENTER)

    def text(value, fallback='-'):
        value = str(value or '').strip()
        return html.escape(value or fallback)

    def paragraph(value, style=body):
        return Paragraph(text(value), style)

    def section(title):
        return Table([[Paragraph(title.upper(), heading)]], colWidths=[178 * mm], style=TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), pale), ('BOX', (0, 0), (-1, -1), 0.6, colors.HexColor('#C7D2FE')),
            ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))

    def details(rows):
        data = []
        for left_label, left_value, right_label, right_value in rows:
            data.append([Paragraph(text(left_label), label), paragraph(left_value), Paragraph(text(right_label), label), paragraph(right_value)])
        return Table(data, colWidths=[31 * mm, 58 * mm, 31 * mm, 58 * mm], style=TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.45, border), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F8FAFC')), ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#F8FAFC')),
            ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))

    def header_footer(canvas, pdf_doc):
        canvas.saveState()
        width, height = A4
        canvas.setStrokeColor(border)
        canvas.setLineWidth(0.7)
        canvas.line(16 * mm, height - 39 * mm, width - 16 * mm, height - 39 * mm)
        if logo_path.exists():
            canvas.drawImage(str(logo_path), 17 * mm, height - 30 * mm, width=52 * mm, height=16 * mm, preserveAspectRatio=True, anchor='sw', mask='auto')
        canvas.setFont('Helvetica-Bold', 12)
        canvas.setFillColor(dark)
        canvas.drawRightString(width - 16 * mm, height - 16 * mm, school_name)
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColor(muted)
        canvas.drawRightString(width - 16 * mm, height - 21 * mm, school_address[:95])
        canvas.drawRightString(width - 16 * mm, height - 26 * mm, f"{school_phone}  |  {school_email}")
        canvas.drawRightString(width - 16 * mm, height - 31 * mm, school_website)
        canvas.setStrokeColor(border)
        canvas.line(16 * mm, 13 * mm, width - 16 * mm, 13 * mm)
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(muted)
        canvas.drawString(16 * mm, 8 * mm, f"Application ID: {lead.get('id', '')}")
        canvas.drawRightString(width - 16 * mm, 8 * mm, f"Page {pdf_doc.page}")
        canvas.restoreState()

    assessment_conducted = bool(lead.get('assessment_conducted'))
    assessment_result = 'Not conducted'
    if assessment_conducted:
        assessment_result = f"{lead.get('assessment_score', '-')} / {lead.get('assessment_max_marks', '-')} ({lead.get('assessment_result') or 'Recorded'})"
    quoted_items = lead.get('fee_items') or []
    documents = lead.get('documents') or {}
    story = [
        Paragraph('ADMISSION APPLICATION FORM', title_style),
        Paragraph(f"Academic Year: <b>{text(lead.get('academic_year') or '2026-2027')}</b>", centered),
        Spacer(1, 7 * mm), section('1. Student details'), Spacer(1, 2 * mm),
        details([
            ('Student name', lead.get('child_name'), 'Date of birth', lead.get('date_of_birth')),
            ('Gender', lead.get('gender'), 'Class requested', lead.get('interested_class')),
            ('Previous school', lead.get('previous_school'), 'Previous class', lead.get('previous_class')),
            ('Final class', lead.get('recommended_class'), 'Section', lead.get('section')),
        ]), Spacer(1, 5 * mm), section('2. Parent / guardian details'), Spacer(1, 2 * mm),
        details([
            ('Parent / guardian', lead.get('name'), 'Primary mobile', lead.get('phone')),
            ('Alternate mobile', lead.get('alternate_phone'), 'Residential area', lead.get('residential_area')),
            ('Admission source', lead.get('source'), 'Transport required', 'Yes' if lead.get('transport_required') else 'No'),
        ]), Spacer(1, 5 * mm), section('3. Admission decision'), Spacer(1, 2 * mm),
        details([
            ('Parent decision', lead.get('parent_decision'), 'Decision date', str(lead.get('fee_explained_at') or '')[:10]),
            ('Admission amount paid', f"Rs. {float(lead.get('admission_fee_paid_amount') or 0):,.2f}" if lead.get('admission_fee_paid') else 'Not paid', 'Payment mode', lead.get('admission_fee_payment_mode')),
            ('Receipt / reference', lead.get('admission_fee_receipt_no'), 'Assessment', assessment_result),
            ('Assessment date', lead.get('assessment_date'), 'Final class decided by', lead.get('recommended_by')),
        ]),
        Spacer(1, 3 * mm), Paragraph(f"<b>Academic remarks:</b> {text(lead.get('academic_remarks'))}", body),
        Spacer(1, 3 * mm), Paragraph(f"<b>Parent commitments / notes:</b> {text(lead.get('decision_note'))}", body),
        PageBreak(), section('4. Itemised fee schedule accepted by parent'), Spacer(1, 2 * mm),
    ]
    fee_rows = [[Paragraph('Fee name', label), Paragraph('Fee type', label), Paragraph('Amount (Rs.)', label)]]
    for item in quoted_items:
        fee_rows.append([paragraph(item.get('name')), paragraph(item.get('category')), Paragraph(f"{float(item.get('amount') or 0):,.2f}", ParagraphStyle('Amount', parent=body, alignment=TA_RIGHT))])
    fee_rows.append([Paragraph('TOTAL', ParagraphStyle('TotalLabel', parent=body, fontName='Helvetica-Bold')), '', Paragraph(f"{float(lead.get('fee_quote_total') or sum(float(item.get('amount') or 0) for item in quoted_items)):,.2f}", ParagraphStyle('TotalAmount', parent=body, fontName='Helvetica-Bold', alignment=TA_RIGHT))])
    story.extend([
        Table(fee_rows, colWidths=[82 * mm, 48 * mm, 48 * mm], repeatRows=1, style=TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), dark), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -2), 0.45, border), ('BOX', (0, -1), (-1, -1), 0.8, accent),
            ('BACKGROUND', (0, -1), (-1, -1), pale), ('SPAN', (0, -1), (1, -1)),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ('RIGHTPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ])), Spacer(1, 5 * mm), section('5. Documents received'), Spacer(1, 2 * mm),
    ])
    document_rows = []
    document_labels = [
        ('birth_certificate', 'Birth Certificate'), ('transfer_certificate', 'Transfer Certificate'),
        ('bonafide_certificate', 'Bonafide Certificate'), ('address_proof', 'Address Proof'),
        ('student_photo', 'Student Photograph'), ('signed_admission_application', 'Parent-signed Admission Form'),
    ]
    for index in range(0, len(document_labels), 2):
        left_key, left_name = document_labels[index]
        right_key, right_name = document_labels[index + 1]
        document_rows.append([paragraph(left_name), paragraph('Received' if documents.get(left_key) else 'Pending'), paragraph(right_name), paragraph('Received' if documents.get(right_key) else 'Pending')])
    story.extend([
        Table(document_rows, colWidths=[52 * mm, 36 * mm, 52 * mm, 38 * mm], style=TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.45, border), ('BACKGROUND', (1, 0), (1, -1), colors.HexColor('#F8FAFC')),
            ('BACKGROUND', (3, 0), (3, -1), colors.HexColor('#F8FAFC')), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ])), Spacer(1, 6 * mm), section('6. Parent declaration'), Spacer(1, 3 * mm),
        Paragraph('I confirm that the information in this application is correct. I understand the class decision and the itemised fee schedule recorded above. I agree to follow the school rules and to submit any pending documents requested by the school.', body),
        Spacer(1, 18 * mm),
        KeepTogether(Table([
            [Paragraph('Parent / Guardian signature', centered), Paragraph('Admission In-charge', centered)],
            [Paragraph('Name: ______________________________', small), Paragraph('Name: ______________________________', small)],
            [Paragraph('Date: _______________________________', small), Paragraph('Date: _______________________________', small)],
        ], colWidths=[89 * mm, 89 * mm], style=TableStyle([
            ('LINEABOVE', (0, 0), (-1, 0), 0.7, dark), ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))),
    ])
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    buffer.seek(0)
    return buffer.getvalue()

# ---------------- Role config ----------------
ROLE_CONFIG = {
    'admin': {
        'name': 'Admin',
        'menu': None,  # None = all
    },
    'director': {
        'name': 'Director',
        'menu': ['dashboard', 'admissions', 'academics', 'attendance', 'teachers', 'collections',
                 'marks', 'leave', 'timetable', 'notifications', 'transport', 'visitor', 'multibranch'],
    },
    'academic_coordinator': {
        'name': 'Academic Coordinator',
        'menu': ['dashboard', 'academics', 'attendance', 'exams', 'marks', 'homework', 'timetable', 'consents', 'surveys', 'notifications'],
    },
    'fee_manager': {
        'name': 'Fee Manager',
        'menu': ['dashboard', 'fee', 'collections', 'expenses', 'hr', 'notifications'],
    },
    # Operational roles for day-to-day school staff (menus mirror frontend roleAccess.js).
    'teacher': {
        'name': 'Class Teacher',
        'menu': ['dashboard', 'attendance', 'marks', 'homework', 'timetable', 'leave', 'consents', 'notifications'],
    },
    'stock_manager': {
        'name': 'Stock Manager',
        'menu': ['dashboard', 'inventory', 'notifications'],
    },
    'librarian': {
        'name': 'Librarian',
        'menu': ['dashboard', 'library', 'notifications'],
    },
}

# ---------------- Models ----------------
class LoginReq(BaseModel):
    username: str = ""
    password: str = ""
    role: str = ""

class BootstrapAdminReq(BaseModel):
    name: str
    username: str
    password: str
    setup_key: str = ""

class StaffAccountReq(BaseModel):
    name: str
    username: str
    password: str
    role: str
    menu: Optional[List[str]] = None

class StaffPasswordResetReq(BaseModel):
    password: str

class StudentDeletionRequest(BaseModel):
    student_ids: List[str]

class StudentDeletionConfirm(BaseModel):
    otp: str

class StudentPromotionEntry(BaseModel):
    student_id: str
    decision: str
    target_class: str = ""
    target_section: str = ""

class StudentPromotionRequest(BaseModel):
    source_year: str
    target_year: str
    entries: List[StudentPromotionEntry]

class StudentPromotionConfirm(BaseModel):
    otp: str

class StudentTransferRequest(BaseModel):
    student_id: str
    transfer_type: str
    reason: str
    effective_date: str
    destination_school: str = ""
    destination_branch: str = ""
    target_class: str = ""
    target_section: str = ""
    parent_request_no: str = ""
    remarks: str = ""

class StudentTransferClearance(BaseModel):
    fee_cleared: str = "No"
    library_cleared: str = "No"
    transport_cleared: str = "No"
    class_teacher_cleared: str = "No"
    documents_returned: str = "No"

class ParentOtpRequest(BaseModel):
    mobile: str

class ParentOtpVerify(BaseModel):
    mobile: str
    otp: str

class Student(BaseModel):
    id: str = Field(default_factory=lambda: f"EP-{uuid.uuid4().hex[:8].upper()}")
    name: str
    admission_no: str = ""
    class_name: str = ""
    section: str = ""
    roll: str = ""
    academic_year: str = "2024-2025"
    status: str = "Active"
    blood_group: str = ""
    dob: str = ""
    gender: str = ""
    aadhar: str = ""
    father_name: str = ""
    mother_name: str = ""
    mobile: str = ""
    mobile_alt: str = ""
    emergency_contact: str = ""
    guardian_name: str = ""
    guardian_address: str = ""
    caste: str = ""
    subcaste: str = ""
    phone: str = ""
    parent_id: str = ""
    guardian: str = ""
    address: str = ""
    password: str = ""
    parent_name: str = ""
    parent_phone: str = ""
    transport_route_id: str = ""
    transport_route: str = ""
    # India compliance identifiers (APAAR / PEN via UDISE+ SDMS) and RTE quota tracking
    apaar_id: str = ""
    pen: str = ""
    aadhaar_consent: str = ""
    rte_quota: str = ""
    previous_school: str = ""
    bus_number: str = ""
    pickup_stop: str = ""
    balance: float = 0.0
    avatar: str = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces"

class Exam(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    class_name: str = "Class 10"
    section: str = "Section A"
    subject: str = "Mathematics"
    subjects: List[str] = []
    date: str = ""
    room: str = ""
    start_time: str = ""
    end_time: str = ""
    max_marks: int = 100
    passing_marks: int = 40
    assessment_component: str = "Theory"
    grade_scheme: List[dict] = []
    status: str = "Draft"
    academic_year: str = ""
    term: str = ""
    papers: List[dict] = []

class Leave(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    leave_type: str
    from_date: str
    to_date: str
    person_type: str = "Staff"
    person_id: str = ""
    class_name: str = ""
    section: str = ""
    days: int = 1
    reason: str = ""
    status: str = "Pending"
    attachment_name: str = ""
    attachment_url: str = ""
    attachment_type: str = ""
    submitted_at: str = ""
    reviewed_by: str = ""
    reviewed_at: str = ""
    duration: str = "Full Day"
    review_note: str = ""
    avatar: str = "https://i.pravatar.cc/80?img=12"

class PayReq(BaseModel):
    method: str = "Cash"
    amount: Optional[float] = None
    discount: float = 0
    discount_reason: str = ""
    transaction_reference: str = ""

class TeacherAllocation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    teacher_id: str
    teacher_name: str
    subject: str
    class_name: str
    section: str = ""
    academic_year: str = "2026-2027"

class TimetablePeriod(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    class_name: str
    section: str
    day: str
    start_time: str
    end_time: str
    subject: str
    teacher_id: str = ""
    teacher_name: str = ""
    room: str = ""
    academic_year: str = ""
    schedule_scope: str = "Week"
    effective_from: str = ""
    effective_to: str = ""

class TeacherSubstitution(BaseModel):
    period_id: str
    date: str
    substitute_teacher_id: str
    note: str = ""

class InventoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_name: str
    category: str = "Stationery"
    sku: str = ""
    unit: str = "Units"
    quantity: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=0, ge=0)
    unit_price: float = Field(default=0, ge=0)
    parent_price: float = Field(default=0, ge=0)
    supplier: str = ""
    location: str = "Central Store"
    notes: str = ""
    status: str = "Active"

class ExpenseEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    expense_date: str
    category: str
    paid_to: str
    description: str
    amount: float = Field(gt=0)
    payment_method: str = "Cash"
    reference: str = ""
    notes: str = ""

class SchoolBranch(BaseModel):
    id: str = Field(default_factory=lambda: f"BR-{uuid.uuid4().hex[:8].upper()}")
    name: str
    code: str
    city: str
    address: str = ""
    phone: str = ""
    email: str = ""
    principal_name: str = ""
    academic_year: str = ""
    board: str = "CBSE"
    capacity: int = Field(default=0, ge=0)
    status: str = "Setup"

class NotificationBroadcast(BaseModel):
    title: str
    message: str
    audience: str = "Parents"
    class_name: str = ""
    section: str = ""
    recipient_id: str = ""
    channels: List[str] = ["App Push"]
    scheduled_for: str = ""

class NotificationRuleUpdate(BaseModel):
    enabled: bool
    channels: List[str] = ["App Push"]

class ClassroomObservation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    teacher_id: str
    teacher_name: str
    class_name: str
    section: str = ""
    subject: str
    unit_name: str = ""
    observation_date: str = ""
    observation_type: str = "Scheduled"
    plan_score: int = Field(ge=0, le=5)
    behaviour_score: int = Field(ge=0, le=5)
    engagement_score: int = Field(ge=0, le=5)
    notes: str = ""
    strengths: str = ""
    improvement_area: str = ""
    agreed_action: str = ""
    follow_up_date: str = ""
    feedback_status: str = "Pending"
    teacher_ack_status: str = "Awaiting"
    teacher_response: str = ""
    follow_up_score: Optional[int] = Field(default=None, ge=0, le=15)
    follow_up_notes: str = ""
    student_evidence: List[dict] = Field(default_factory=list)
    academic_year: str = "2026-2027"

# ---------------- Auth helpers ----------------
def create_token(role: str, **claims):
    payload = {'role': role, 'exp': datetime.utcnow() + timedelta(hours=12), **claims}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def normalize_username(value: str) -> str:
    return str(value or '').strip().lower()

def validate_password(password: str):
    if len(password or '') < 10:
        raise HTTPException(status_code=422, detail='Password must contain at least 10 characters.')

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    validate_password(password)
    salt_bytes = bytes.fromhex(salt) if salt else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt_bytes, 310000)
    return salt_bytes.hex(), base64.b64encode(digest).decode('ascii')

def password_matches(password: str, salt: str, expected: str) -> bool:
    try:
        _, actual = hash_password(password, salt)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, HTTPException):
        return False

def decode_token(authorization: Optional[str]):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(' ', 1)[1]
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current(authorization: Optional[str] = Header(None)):
    payload = decode_token(authorization)
    role = payload.get('role')
    if role not in ROLE_CONFIG:
        raise HTTPException(status_code=401, detail="Invalid role")
    return role

async def get_parent_current(authorization: Optional[str] = Header(None)):
    payload = decode_token(authorization)
    if payload.get('role') != 'parent' or not payload.get('parent_id'):
        raise HTTPException(status_code=403, detail='A verified parent session is required.')
    return payload

PARENT_CENTER_ROLES = {'admin', 'director', 'academic_coordinator', 'fee_manager'}
PARENT_FINANCE_ROLES = {'admin', 'director', 'fee_manager'}
PARENT_ACADEMIC_ROLES = {'admin', 'director', 'academic_coordinator'}
PARENT_TRANSPORT_ROLES = {'admin', 'director'}

import contextvars
_request_ctx = contextvars.ContextVar('orison_request', default=('', 'GET'))

# Extra, path-scoped access for operational roles. A role may use an endpoint that is
# normally limited to one of `bases` only when the request path starts with one of its
# prefixes (and, for read-only prefixes, only with GET).
ROLE_ENDPOINT_GRANTS = {
    'teacher': {
        'bases': {'academic_coordinator', 'admin'},
        'rw': ('/api/attendance', '/api/marks', '/api/homework', '/api/parent-center/homework-completions',
               '/api/leaves', '/api/consents'),
        'ro': ('/api/exams', '/api/results', '/api/timetable', '/api/staff', '/api/students', '/api/academic',
               '/api/teacher', '/api/notifications', '/api/hall-tickets', '/api/subjects', '/api/classes'),
    },
    'fee_manager': {
        'bases': {'admin', 'director'},
        'rw': ('/api/expenses', '/api/hr'),
        'ro': ('/api/staff',),
    },
    'stock_manager': {
        'bases': {'admin', 'director', 'fee_manager'},
        'rw': ('/api/inventory', '/api/expenses'),
        'ro': ('/api/staff', '/api/students', '/api/notifications', '/api/teachers', '/api/academic'),
    },
    'librarian': {
        'bases': {'admin', 'director', 'academic_coordinator'},
        'rw': (),
        'ro': ('/api/students', '/api/notifications', '/api/academic'),
    },
}

def require_roles(role: str, allowed: set):
    if role in allowed:
        return
    grant = ROLE_ENDPOINT_GRANTS.get(role)
    if grant and grant['bases'] & set(allowed):
        path, method = _request_ctx.get()
        if path.startswith(grant['rw']) or (method == 'GET' and path.startswith(grant['ro'])):
            return
    raise HTTPException(status_code=403, detail='Your staff role does not have permission to perform this action.')

def clean(doc):
    if doc and '_id' in doc:
        doc.pop('_id', None)
    return doc

async def add_event(etype: str, title: str, body: str, branch_id: str = 'BR-MAIN'):
    await db.events.insert_one({
        'id': str(uuid.uuid4()), 'type': etype, 'title': title, 'body': body,
        'unread': True, 'created': datetime.utcnow().isoformat(),
        'branch_id': branch_id or 'BR-MAIN',
    })

NOTIFICATION_RULES = [
    {'key': 'attendance_absent', 'event': 'Student marked absent', 'audience': 'Parent', 'description': 'Send the parent an absence alert after daily attendance is saved.', 'channels': ['Parent App', 'WhatsApp'], 'enabled': True},
    {'key': 'homework_assigned', 'event': 'Homework assigned', 'audience': 'Parent', 'description': 'Send homework and attachments to the selected Class and Section.', 'channels': ['Parent App', 'WhatsApp'], 'enabled': True},
    {'key': 'fee_receipt', 'event': 'Fee payment received', 'audience': 'Parent', 'description': 'Send receipt confirmation and balance after payment.', 'channels': ['Parent App', 'WhatsApp'], 'enabled': True},
    {'key': 'fee_due', 'event': 'Fee due or overdue', 'audience': 'Parent + Fee Manager', 'description': 'Remind parents about unpaid fee heads; show a follow-up alert to Fee Manager.', 'channels': ['Parent App', 'WhatsApp'], 'enabled': True},
    {'key': 'exam_result', 'event': 'Results published', 'audience': 'Parent', 'description': 'Tell the parent when published marks and report card are ready.', 'channels': ['Parent App'], 'enabled': True},
    {'key': 'syllabus_delay', 'event': 'Chapter behind timeline', 'audience': 'Teacher + Academic Coordinator', 'description': 'Alert the responsible teacher and Academic Coordinator when the planned date passes.', 'channels': ['Website Alert', 'App Push'], 'enabled': True},
    {'key': 'critical_escalation', 'event': 'Critical academic or collection issue', 'audience': 'Director', 'description': 'Escalate only critical, unresolved issues to leadership.', 'channels': ['Website Alert', 'App Push'], 'enabled': True},
    {'key': 'approval_request', 'event': 'Approval requested', 'audience': 'Director', 'description': 'Send approval and OTP requests for sensitive changes.', 'channels': ['Website Alert', 'App Push'], 'enabled': True},
]

async def get_notification_rules(branch_id: str = 'BR-MAIN'):
    saved = await db.notification_rules.find(branch_scope(branch_id)).to_list(100)
    saved_by_key = {item.get('key'): clean(item) for item in saved}
    return [{**rule, **saved_by_key.get(rule['key'], {})} for rule in NOTIFICATION_RULES]

async def notification_rule_enabled(rule_key: str, branch_id: str = 'BR-MAIN') -> bool:
    saved = await db.notification_rules.find_one(branch_scope(branch_id, {'key': rule_key}))
    return saved is None or saved.get('enabled', True)

# ---------------- Auth routes ----------------
@api_router.post("/auth/login")
async def login(req: LoginReq):
    role = req.role
    if role not in ROLE_CONFIG:
        raise HTTPException(status_code=400, detail="Unknown role")
    cfg = ROLE_CONFIG[role]
    branch_ids = await get_role_branch_ids(role)
    default_branch_id = 'BR-MAIN' if '*' in branch_ids else branch_ids[0]
    default_branch = await db.branches.find_one({'id': default_branch_id}) or {'id': default_branch_id, 'name': 'Orison Main Campus' if default_branch_id == 'BR-MAIN' else default_branch_id}
    return {
        'token': create_token(role, branch_ids=branch_ids),
        'role': role,
        'name': cfg['name'],
        'menu': cfg['menu'],
        'branch_ids': branch_ids,
        'default_branch': {'id': default_branch_id, 'name': default_branch.get('name', default_branch_id), 'code': default_branch.get('code', '')},
    }

@api_router.get("/auth/me")
async def me(role: str = Depends(get_current)):
    cfg = ROLE_CONFIG[role]
    branch_ids = await get_role_branch_ids(role)
    default_branch_id = 'BR-MAIN' if '*' in branch_ids else branch_ids[0]
    default_branch = await db.branches.find_one({'id': default_branch_id}) or {'id': default_branch_id, 'name': 'Orison Main Campus' if default_branch_id == 'BR-MAIN' else default_branch_id}
    return {'role': role, 'name': cfg['name'], 'menu': cfg['menu'], 'branch_ids': branch_ids, 'default_branch': {'id': default_branch_id, 'name': default_branch.get('name', default_branch_id), 'code': default_branch.get('code', '')}}

# ---------------- Students ----------------
@api_router.get("/students")
async def list_students(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    docs = await db.students.find(branch_scope(x_branch_id or 'BR-MAIN')).to_list(1000)
    return [clean(d) for d in docs]

@api_router.get("/students/{sid}")
async def get_student(sid: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    doc = await db.students.find_one(branch_scope(x_branch_id, {'id': sid}))
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return clean(doc)

TRANSFER_TYPES = {'School Transfer / TC', 'Branch Transfer'}
TRANSFER_CLEARANCE_VALUES = {'Yes', 'No', 'Not Applicable'}
TRANSFER_CLEARANCE_KEYS = {
    'fee_cleared', 'library_cleared', 'transport_cleared',
    'class_teacher_cleared', 'documents_returned',
}

@api_router.get('/student-transfers')
async def list_student_transfers(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    rows = await db.student_transfers.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('created_at', -1).to_list(1000)
    return [clean(row) for row in rows]

@api_router.post('/student-transfers')
async def create_student_transfer(payload: StudentTransferRequest, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin'})
    branch_id = x_branch_id or 'BR-MAIN'
    student = await db.students.find_one(branch_scope(branch_id, {'id': payload.student_id}))
    if not student:
        raise HTTPException(status_code=404, detail='The selected student no longer exists.')
    if str(student.get('status') or 'Active') != 'Active':
        raise HTTPException(status_code=422, detail='Only an active student can begin a new transfer.')
    if payload.transfer_type not in TRANSFER_TYPES:
        raise HTTPException(status_code=422, detail='Choose a valid transfer type.')
    if not payload.reason.strip() or not payload.effective_date.strip():
        raise HTTPException(status_code=422, detail='Reason and effective date are required.')
    if payload.transfer_type == 'School Transfer / TC' and not payload.destination_school.strip():
        raise HTTPException(status_code=422, detail='Enter the destination school for a Transfer Certificate.')
    destination = None
    if payload.transfer_type == 'Branch Transfer':
        destination_value = payload.destination_branch.strip()
        if not destination_value:
            raise HTTPException(status_code=422, detail='Choose the destination branch.')
        destination = await db.branches.find_one({'$or': [
            {'id': destination_value}, {'code': destination_value.upper()},
            {'name': {'$regex': f'^{re.escape(destination_value)}$', '$options': 'i'}},
        ]})
        if not destination or destination.get('status') != 'Active':
            raise HTTPException(status_code=422, detail='Choose an Active destination branch.')
        if destination.get('id') == branch_id:
            raise HTTPException(status_code=422, detail='Choose a different destination branch.')
        target_class = payload.target_class.strip() or student.get('class_name', '')
        target_section = payload.target_section.strip() or student.get('section', '')
        destination_structure = await attendance_academic_structure(destination['id'])
        allowed = {(item.get('name'), section.get('name')) for item in destination_structure.get('classes') or [] for section in item.get('sections') or []}
        if (target_class, target_section) not in allowed:
            raise HTTPException(status_code=422, detail=f"Create {target_class} {target_section} in the destination Academic Setup before transferring this student.")
        await ensure_branch_capacity(destination['id'])
    if await db.student_transfers.find_one(branch_scope(branch_id, {'student_id': payload.student_id, 'status': {'$in': ['Pending Clearance', 'Ready for Approval']}})):
        raise HTTPException(status_code=409, detail='This student already has an open transfer request.')

    now = datetime.utcnow().isoformat()
    transfer_id = f"TR-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:5].upper()}"
    record = {
        'id': transfer_id, **payload.dict(), 'student_name': student.get('name', ''),
        'admission_no': student.get('admission_no', ''), 'academic_year': student.get('academic_year', ''),
        'source_class': student.get('class_name', ''), 'source_section': student.get('section', ''),
        'parent_name': student.get('father_name') or student.get('parent_name') or student.get('guardian_name', ''),
        'parent_phone': student.get('mobile') or student.get('parent_phone') or student.get('phone', ''),
        'clearances': {key: 'No' for key in TRANSFER_CLEARANCE_KEYS},
        'status': 'Pending Clearance', 'tc_number': '', 'created_at': now,
        'created_by': ROLE_CONFIG[role]['name'], 'updated_at': now,
        'branch_id': branch_id,
        'source_branch_id': branch_id,
        'destination_branch_id': destination.get('id') if destination else '',
        'destination_branch': destination.get('name') if destination else payload.destination_branch,
        'target_class': payload.target_class.strip() or student.get('class_name', ''),
        'target_section': payload.target_section.strip() or student.get('section', ''),
    }
    await db.student_transfers.insert_one(dict(record))
    await add_event('warning', 'Student transfer initiated', f"Transfer clearance started for {record['student_name']} ({record['admission_no']}).", branch_id)
    return clean(record)

@api_router.put('/student-transfers/{transfer_id}/clearances')
async def update_student_transfer_clearances(transfer_id: str, payload: StudentTransferClearance, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    record = await db.student_transfers.find_one(branch_scope(branch_id, {'id': transfer_id}))
    if not record:
        raise HTTPException(status_code=404, detail='Transfer request not found.')
    if record.get('status') == 'Issued':
        raise HTTPException(status_code=409, detail='An issued transfer cannot be changed.')
    clearances = payload.dict()
    if any(value not in TRANSFER_CLEARANCE_VALUES for value in clearances.values()):
        raise HTTPException(status_code=422, detail='Each department must be marked Yes, No, or Not Applicable.')
    status = 'Ready for Approval'
    await db.student_transfers.update_one(branch_scope(branch_id, {'id': transfer_id}), {'$set': {
        'clearances': clearances, 'status': status, 'updated_at': datetime.utcnow().isoformat(),
        'clearance_updated_by': ROLE_CONFIG[role]['name'],
    }})
    return {'ok': True, 'status': status, 'clearances': clearances}

@api_router.post('/student-transfers/{transfer_id}/issue')
async def issue_student_transfer(transfer_id: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    record = await db.student_transfers.find_one(branch_scope(branch_id, {'id': transfer_id}))
    if not record:
        raise HTTPException(status_code=404, detail='Transfer request not found.')
    if record.get('status') == 'Issued':
        return clean(record)
    clearances = record.get('clearances') or {}
    if not all(clearances.get(key) in TRANSFER_CLEARANCE_VALUES or isinstance(clearances.get(key), bool) for key in TRANSFER_CLEARANCE_KEYS):
        raise HTTPException(status_code=422, detail='Record every department as Yes, No, or Not Applicable before issuing the transfer.')
    student = await db.students.find_one(branch_scope(branch_id, {'id': record.get('student_id')}))
    if not student:
        raise HTTPException(status_code=404, detail='The student record no longer exists.')

    now = datetime.utcnow()
    prefix = 'BT' if record.get('transfer_type') == 'Branch Transfer' else 'TC'
    tc_number = f"{prefix}-{now.strftime('%Y')}-{await db.student_transfers.count_documents(branch_scope(branch_id, {'status': 'Issued'})) + 1:05d}"
    student_updates = {'last_transfer_id': transfer_id, 'transfer_issued_at': now.isoformat()}
    if record.get('transfer_type') == 'Branch Transfer':
        destination_id = record.get('destination_branch_id')
        destination = await db.branches.find_one({'id': destination_id, 'status': 'Active'})
        if not destination:
            raise HTTPException(status_code=422, detail='The destination branch is no longer Active.')
        await ensure_branch_capacity(destination_id, student.get('id', ''))
        student_updates.update({
            'status': 'Active', 'branch_id': destination_id,
            'class_name': record.get('target_class') or student.get('class_name', ''),
            'section': record.get('target_section') or student.get('section', ''),
            'academic_year': destination.get('academic_year') or student.get('academic_year', ''),
            'previous_branch_id': branch_id, 'destination_branch': destination.get('name', ''),
        })
    else:
        student_updates.update({'status': 'Transferred Out', 'destination_school': record.get('destination_school', '')})
    await db.student_enrollments.update_one(
        branch_scope(branch_id, {'student_id': student['id'], 'academic_year': student.get('academic_year', '')}),
        {'$set': {
            'id': str(uuid.uuid4()), 'student_id': student['id'], 'academic_year': student.get('academic_year', ''),
            'class_name': student.get('class_name', ''), 'section': student.get('section', ''),
            'status': student_updates.get('status', 'Active'), 'student_snapshot': clean(dict(student)),
            'transfer_id': transfer_id, 'archived_at': now.isoformat(), 'branch_id': branch_id,
        }}, upsert=True,
    )
    await db.students.update_one(branch_scope(branch_id, {'id': student['id']}), {'$set': student_updates})
    if record.get('transfer_type') == 'Branch Transfer':
        moved_student = {**student, **student_updates}
        await db.student_enrollments.insert_one({
            'id': str(uuid.uuid4()), 'student_id': student['id'],
            'academic_year': moved_student.get('academic_year', ''),
            'class_name': moved_student.get('class_name', ''), 'section': moved_student.get('section', ''),
            'status': 'Active', 'student_snapshot': clean(dict(moved_student)),
            'transfer_id': transfer_id, 'enrolled_at': now.isoformat(),
            'branch_id': moved_student.get('branch_id'), 'source_branch_id': branch_id,
        })
        await apply_active_fee_structures(moved_student)
    issued = {
        'status': 'Issued', 'tc_number': tc_number, 'issued_at': now.isoformat(),
        'issued_by': ROLE_CONFIG[role]['name'], 'updated_at': now.isoformat(),
    }
    await db.student_transfers.update_one(branch_scope(branch_id, {'id': transfer_id}), {'$set': issued})
    await db.student_branch_transfers.insert_one({**clean(dict(record)), **issued, 'source_branch_id': branch_id, 'destination_branch_id': record.get('destination_branch_id', '')})
    await add_event('success', 'Student transfer issued', f"{tc_number} was issued for {record.get('student_name', 'Student')}. Academic records remain preserved.", branch_id)
    return clean({**record, **issued})

REQUIRED_STUDENT_FIELDS = {
    'name': 'Student Name', 'admission_no': 'Admission Number', 'class_name': 'Class',
    'section': 'Section', 'academic_year': 'Academic Year', 'gender': 'Gender',
    'father_name': 'Father/Guardian Name', 'mobile': 'Mobile Number',
}

async def sync_student_fee_balance(student_id: str, branch_id: str = 'BR-MAIN'):
    """Keep the student-level balance equal to every unpaid fee head, not one invoice."""
    invoices = await db.fees.find(branch_scope(branch_id, {'student_id': student_id})).to_list(5000)
    balance = round(sum(float(item.get('due') or 0) for item in invoices), 2)
    await db.students.update_one(branch_scope(branch_id, {'id': student_id}), {'$set': {'balance': balance}})
    return balance

async def apply_active_fee_structures(student: dict):
    """Apply matching, current-year fee structures when a student is admitted."""
    class_name = str(student.get('class_name') or '').strip()
    section = str(student.get('section') or '').strip()
    academic_year = str(student.get('academic_year') or '').strip()
    if not class_name or not section:
        return 0

    created = 0
    branch_id = student.get('branch_id') or 'BR-MAIN'
    structures = await db.fee_structures.find(branch_scope(branch_id)).to_list(1000)
    for structure in structures:
        if structure.get('active') is False:
            continue
        structure_year = str(structure.get('academic_year') or '').strip()
        if structure_year and academic_year and structure_year != academic_year:
            continue
        targets = structure.get('targets') or []
        applies_to_student = any(
            str(target.get('class_name') or '').strip() == class_name
            and str(target.get('section') or '').strip() == section
            for target in targets
        )
        if not applies_to_student:
            continue
        if await db.fees.find_one(branch_scope(branch_id, {'student_id': student['id'], 'structure_id': structure.get('id')})):
            continue
        amount = float(structure.get('amount') or 0)
        if amount <= 0:
            continue
        await db.fees.insert_one({
            'id': f"FEE-{uuid.uuid4().hex[:8].upper()}", 'structure_id': structure.get('id'),
            'student_id': student['id'], 'name': student.get('name', ''), 'avatar': student.get('avatar', ''),
            'fee_name': structure.get('name', 'School Fee'), 'category': structure.get('category', ''),
            'description': structure.get('description', ''), 'academic_year': academic_year or structure_year,
            'due_date': structure.get('due_date', ''), 'total': amount, 'paid': 0, 'discount': 0,
            'due': amount, 'status': 'Unpaid', 'created': datetime.utcnow().isoformat(), 'branch_id': branch_id,
        })
        created += 1
    await sync_student_fee_balance(student['id'], branch_id)
    return created

async def validate_student_transport_assignment(student: dict, branch_id: str, exclude_student_id: str = ''):
    route_value = str(student.get('transport_route_id') or student.get('transport_route') or '').strip()
    if not route_value:
        return
    route = await db.transport_routes.find_one(branch_scope(branch_id, {'$or': [{'id': route_value}, {'route_name': route_value}]}))
    if not route or route.get('status') != 'Active':
        raise HTTPException(status_code=422, detail='Choose an Active transport route from this branch.')
    pickup_stop = str(student.get('pickup_stop') or '').strip()
    allowed_stops = {str(stop.get('name') or '').strip() for stop in route.get('stops', [])}
    if pickup_stop and pickup_stop not in allowed_stops:
        raise HTTPException(status_code=422, detail=f"Pickup stop '{pickup_stop}' is not part of {route.get('route_name', 'the selected route')}.")
    assigned_query = branch_scope(branch_id, {'id': {'$ne': exclude_student_id} if exclude_student_id else {'$exists': True}, '$or': [{'transport_route_id': route['id']}, {'transport_route': route['id']}, {'transport_route': route.get('route_name', '')}]})
    assigned = [row for row in await db.students.find(assigned_query).to_list(5000) if student_is_active_on(row)]
    if len(assigned) >= int(route.get('vehicle_capacity') or 0):
        raise HTTPException(status_code=409, detail=f"{route.get('route_name')} has reached its recorded vehicle capacity.")
    student['transport_route_id'] = route['id']
    student['transport_route'] = route.get('route_name', '')

@api_router.post("/students")
async def create_student(s: Student, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    doc = s.dict()
    doc['branch_id'] = x_branch_id or 'BR-MAIN'
    missing = [label for k, label in REQUIRED_STUDENT_FIELDS.items() if not str(doc.get(k) or '').strip()]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required field(s): {', '.join(missing)}")
    adm = str(doc.get('admission_no') or '').strip()
    if await db.students.find_one({'admission_no': adm}):
        raise HTTPException(status_code=409, detail=f"A student with admission number '{adm}' already exists.")
    structure = await db.academic_structure.find_one({'id': 'school-structure'}) if doc['branch_id'] == 'BR-MAIN' else await db.branch_academic_structures.find_one({'branch_id': doc['branch_id']})
    if structure and structure.get('classes'):
        allowed = {(item.get('name'), section.get('name')) for item in structure.get('classes', []) for section in item.get('sections', [])}
        if (doc['class_name'], doc['section']) not in allowed:
            raise HTTPException(status_code=422, detail='Choose a class and section created in Academic Setup.')
        doc['academic_year'] = structure.get('academic_year') or doc['academic_year']
    await ensure_branch_capacity(doc['branch_id'])
    await validate_student_transport_assignment(doc, doc['branch_id'])
    await db.students.insert_one(dict(doc))
    fees_added = await apply_active_fee_structures(doc)
    await add_event('success', 'New admission approved', f"{doc['name']} has been enrolled in {doc.get('class_name','')} {doc.get('section','')}.".strip())
    return {**doc, 'fees_assigned': fees_added}

@api_router.put("/students/{sid}")
async def update_student(sid: str, s: Student, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    existing = await db.students.find_one(branch_scope(x_branch_id, {'id': sid}))
    if not existing:
        raise HTTPException(status_code=404, detail='Student not found in the selected branch.')
    doc = s.dict()
    doc['id'] = sid
    doc['branch_id'] = existing.get('branch_id') or x_branch_id or 'BR-MAIN'
    await validate_student_transport_assignment(doc, doc['branch_id'], sid)
    await db.students.update_one(branch_scope(doc['branch_id'], {'id': sid}), {'$set': doc})
    return doc

@api_router.post('/students/{sid}/documents/{document_type}')
async def upload_student_document(sid: str, document_type: str, file: UploadFile = File(...), role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    student = await db.students.find_one(branch_scope(x_branch_id, {'id': sid}))
    if not student:
        raise HTTPException(status_code=404, detail='Student not found in the selected branch.')
    allowed_types = {'birth_certificate', 'transfer_certificate', 'bonafide_certificate', 'address_proof', 'student_photo', 'aadhaar_card', 'medical_record', 'signed_admission_application'}
    if document_type not in allowed_types:
        raise HTTPException(status_code=422, detail='Choose a valid student document type.')
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail='Upload a file smaller than 8 MB.')
    extension = Path(file.filename or '').suffix.lower()
    if extension not in {'.pdf', '.png', '.jpg', '.jpeg'}:
        raise HTTPException(status_code=422, detail='Upload a PDF, PNG or JPG file.')
    if document_type == 'signed_admission_application' and extension != '.pdf':
        raise HTTPException(status_code=422, detail='Upload the signed admission application as a PDF file.')
    stored_name = f"{sid}-{document_type}-{uuid.uuid4().hex[:8]}{extension}"
    (STUDENT_UPLOAD_DIR / stored_name).write_bytes(content)
    document = {
        'type': document_type, 'name': file.filename,
        'url': f'/uploads/students/{stored_name}',
        'size': len(content), 'uploaded_at': datetime.utcnow().isoformat(),
        'uploaded_by': ROLE_CONFIG[role]['name'],
    }
    checklist_key = {
        'birth_certificate': 'birth_certificate', 'address_proof': 'address_proof',
        'student_photo': 'photos', 'transfer_certificate': 'previous_record',
        'bonafide_certificate': 'previous_record',
    }.get(document_type)
    changes = {f'admission_documents.{document_type}': document, 'updated_at': datetime.utcnow().isoformat()}
    if checklist_key:
        changes[f'document_checklist.{checklist_key}'] = True
    await db.students.update_one({'id': sid}, {'$set': changes})
    await add_event('success', 'Student document uploaded', f"{file.filename} was added to {student.get('name', 'the student')}'s profile.")
    return document

@api_router.delete("/students/{sid}")
async def delete_student(sid: str, role: str = Depends(get_current)):
    require_roles(role, {'admin'})
    raise HTTPException(
        status_code=409,
        detail='Student deletion is protected. Request a KDM OTP from View Students before deleting this record.',
    )

async def permanently_delete_students(student_ids: List[str], student_snapshots: List[dict]):
    """Remove active student data while retaining receipt and approval audit trails."""
    names = [item.get('name') for item in student_snapshots if item.get('name')]
    await db.students.delete_many({'id': {'$in': student_ids}})
    await db.fees.delete_many({'student_id': {'$in': student_ids}})
    await db.attendance_records.delete_many({'attendance_role': 'student', 'entity_id': {'$in': student_ids}})
    await db.academic_signals.delete_many({'student_id': {'$in': student_ids}})
    await db.interventions.delete_many({'student_id': {'$in': student_ids}})
    await db.leaves.delete_many({'person_type': {'$regex': '^student$', '$options': 'i'}, 'person_id': {'$in': student_ids}})
    await db.homework_completions.delete_many({'student_id': {'$in': student_ids}})
    await db.parent_notifications.delete_many({'student_id': {'$in': student_ids}})
    await db.parent_accounts.update_many({}, {'$pull': {'student_ids': {'$in': student_ids}}})
    await db.transport_routes.update_many({}, {'$pull': {'student_ids': {'$in': student_ids}}})
    # Marks rows are embedded inside each submitted marks set.
    mark_sets = await db.marks_sets.find({'rows': {'$elemMatch': {'$or': [
        {'student_id': {'$in': student_ids}}, {'id': {'$in': student_ids}}, {'name': {'$in': names}},
    ]}}}).to_list(5000)
    for mark_set in mark_sets:
        kept_rows = [row for row in mark_set.get('rows', []) if
                     row.get('student_id') not in student_ids and row.get('id') not in student_ids and row.get('name') not in names]
        await db.marks_sets.update_one({'_id': mark_set['_id']}, {'$set': {'rows': kept_rows}})
    # Financial receipts remain as immutable accounting evidence, but are clearly marked as belonging to a deleted student.
    for snapshot in student_snapshots:
        await db.fee_receipts.update_many(
            {'student_id': snapshot.get('id')},
            {'$set': {'student_deleted': True, 'deleted_student_snapshot': snapshot}},
        )

@api_router.post('/student-deletion-requests')
async def request_student_deletion(payload: StudentDeletionRequest, role: str = Depends(get_current)):
    require_roles(role, {'admin'})
    student_ids = list(dict.fromkeys(str(item or '').strip() for item in payload.student_ids if str(item or '').strip()))
    if not student_ids:
        raise HTTPException(status_code=422, detail='Select at least one student to delete.')
    if len(student_ids) > 200:
        raise HTTPException(status_code=422, detail='Delete a maximum of 200 students in one protected request.')
    students = [clean(item) for item in await db.students.find({'id': {'$in': student_ids}}).sort('name', 1).to_list(200)]
    found_ids = {item.get('id') for item in students}
    missing = [item for item in student_ids if item not in found_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"{len(missing)} selected student record(s) no longer exist. Refresh and try again.")
    await db.student_deletion_requests.update_many(
        {'status': 'Pending', 'requested_by_role': role},
        {'$set': {'status': 'Superseded', 'superseded_at': datetime.utcnow().isoformat()}},
    )
    now = datetime.utcnow()
    request_id = f"STD-DEL-{uuid.uuid4().hex[:10].upper()}"
    otp = f"{secrets.randbelow(1000000):06d}"
    snapshots = [{
        'id': item.get('id'), 'name': item.get('name'), 'admission_no': item.get('admission_no'),
        'class_name': item.get('class_name'), 'section': item.get('section'),
    } for item in students]
    record = {
        'id': request_id, 'student_ids': student_ids, 'students': snapshots, 'student_count': len(students),
        'otp': otp, 'status': 'Pending', 'attempts': 0, 'requested_by': ROLE_CONFIG[role]['name'],
        'requested_by_role': role, 'approval_owner': 'KDM', 'created': now.isoformat(),
        'expires_at': (now + timedelta(minutes=15)).isoformat(),
    }
    await db.student_deletion_requests.insert_one(record.copy())
    await db.director_approval_requests.insert_one({
        'id': f"APR-{uuid.uuid4().hex[:10].upper()}", 'linked_request_id': request_id,
        'approval_type': 'Protected Student Deletion', 'priority': 'High',
        'title': f"Delete {len(students)} student record{'s' if len(students) != 1 else ''}",
        'summary': 'Admin requested permanent deletion of selected student records.',
        'reason': 'Protected deletion requested from View Students.',
        'institutional_impact': 'Student profiles and linked operational records will be permanently removed.',
        'approval_required': 'Share this one-time KDM code with the requesting Admin only after verifying the request.',
        'requested_by': ROLE_CONFIG[role]['name'], 'requested_role': ROLE_CONFIG[role]['name'],
        'supporting_documents': [], 'decision_due': record['expires_at'], 'status': 'Pending',
        'target_app': 'Director App', 'channels': ['Director App', 'App Push'], 'otp_code': otp,
        'students': snapshots, 'created': now.isoformat(),
    })
    await add_event('warning', 'KDM approval requested', f"Admin requested protected deletion of {len(students)} student record(s).")
    return {
        'request_id': request_id, 'status': 'Pending', 'student_count': len(students),
        'expires_at': record['expires_at'],
        'message': 'OTP request sent to the KDM / Director account. Enter that OTP here to continue.',
    }

@api_router.get('/student-deletion-requests/kdm')
async def kdm_student_deletion_requests(role: str = Depends(get_current)):
    require_roles(role, {'director'})
    rows = await db.student_deletion_requests.find({'status': 'Pending'}).sort('created', -1).to_list(100)
    return [clean(item) for item in rows]

@api_router.post('/student-deletion-requests/{request_id}/confirm')
async def confirm_student_deletion(request_id: str, payload: StudentDeletionConfirm, role: str = Depends(get_current)):
    require_roles(role, {'admin'})
    request = await db.student_deletion_requests.find_one({'id': request_id})
    if not request:
        raise HTTPException(status_code=404, detail='This deletion request was not found.')
    if request.get('status') != 'Pending':
        raise HTTPException(status_code=409, detail=f"This deletion request is {str(request.get('status', 'closed')).lower()}.")
    if datetime.utcnow() > datetime.fromisoformat(request['expires_at']):
        await db.student_deletion_requests.update_one({'id': request_id}, {'$set': {'status': 'Expired'}})
        await db.director_approval_requests.update_one({'linked_request_id': request_id}, {'$set': {'status': 'Expired'}})
        raise HTTPException(status_code=410, detail='The KDM OTP expired. Request a new OTP.')
    attempts = int(request.get('attempts', 0)) + 1
    entered_otp = ''.join(character for character in str(payload.otp or '') if character.isdigit())
    if not hmac.compare_digest(entered_otp, str(request.get('otp', ''))):
        status = 'Locked' if attempts >= 5 else 'Pending'
        await db.student_deletion_requests.update_one({'id': request_id}, {'$set': {'attempts': attempts, 'status': status}})
        if status == 'Locked':
            await db.director_approval_requests.update_one({'linked_request_id': request_id}, {'$set': {'status': 'Locked'}})
            raise HTTPException(status_code=423, detail='Too many incorrect OTP attempts. Create a new deletion request.')
        raise HTTPException(status_code=401, detail=f"Incorrect KDM OTP. {5 - attempts} attempt(s) remaining.")
    student_ids = request.get('student_ids') or []
    snapshots = request.get('students') or []
    await permanently_delete_students(student_ids, snapshots)
    completed_at = datetime.utcnow().isoformat()
    await db.student_deletion_requests.update_one(
        {'id': request_id},
        {'$set': {'status': 'Completed', 'confirmed_by': ROLE_CONFIG[role]['name'], 'completed_at': completed_at}, '$unset': {'otp': ''}},
    )
    await db.director_approval_requests.update_one(
        {'linked_request_id': request_id},
        {'$set': {'status': 'Approved', 'decision': 'OTP verified by Admin', 'decided_at': completed_at}, '$unset': {'otp_code': ''}},
    )
    await add_event('warning', 'Student deletion completed', f"{len(student_ids)} student record(s) were deleted after KDM OTP verification.")
    return {'ok': True, 'deleted': len(student_ids), 'message': f"{len(student_ids)} student record(s) deleted after KDM approval."}

# ---------------- Attendance ----------------
ATTENDANCE_ROLES = {'student': 'students', 'teacher': 'teachers', 'staff': 'staff'}

ACTIVE_ATTENDANCE_STATUSES = {'active', 'enrolled', 'admitted', 'on leave', ''}
ACTIVE_STUDENT_STATUSES = {'active', 'enrolled', 'admitted', ''}

async def attendance_academic_structure(branch_id: str) -> dict:
    if branch_id == 'BR-MAIN':
        return await db.academic_structure.find_one({'id': 'school-structure'}) or {}
    return await db.branch_academic_structures.find_one({'branch_id': branch_id}) or {}

def attendance_person_is_active(person: dict, attendance_date: str) -> bool:
    """Only people who belong in the register on the selected date are returned."""
    status = str(person.get('status') or '').strip().lower()
    if status not in ACTIVE_ATTENDANCE_STATUSES:
        return False
    joined = str(person.get('admission_date') or person.get('joining_date') or person.get('joined_on') or '')[:10]
    left = str(person.get('exit_date') or person.get('withdrawal_date') or person.get('transfer_date') or '')[:10]
    if joined and attendance_date and joined > attendance_date:
        return False
    if left and attendance_date and left < attendance_date:
        return False
    return True

def student_is_active_on(student: dict, target_date: str = '') -> bool:
    """Use one eligibility rule for every student-facing operational module."""
    status = str(student.get('status') or '').strip().lower()
    if status not in ACTIVE_STUDENT_STATUSES:
        return False
    joined = str(student.get('admission_date') or student.get('joining_date') or student.get('joined_on') or '')[:10]
    left = str(student.get('exit_date') or student.get('withdrawal_date') or student.get('transfer_date') or '')[:10]
    if joined and target_date and joined > target_date:
        return False
    if left and target_date and left < target_date:
        return False
    return True

async def attendance_day_status(attendance_date: str, branch_id: str) -> dict:
    try:
        day = datetime.strptime(attendance_date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=422, detail='Choose a valid attendance date.')
    structure = await attendance_academic_structure(branch_id)
    working_days = structure.get('working_days') or ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    weekday = day.strftime('%A')
    holiday = await db.school_holidays.find_one(branch_scope(branch_id, {'date': attendance_date, 'status': {'$ne': 'Cancelled'}}))
    settings_record = await db.school_settings.find_one({'id': f'school-settings:{branch_id}'}) or {}
    configured_holidays = str((settings_record.get('settings') or {}).get('holidayDates') or '')
    for line in configured_holidays.splitlines():
        holiday_date, _, holiday_name = line.partition('|')
        if holiday_date.strip() == attendance_date:
            holiday = {'name': holiday_name.strip() or 'School holiday'}
            break
    if holiday:
        return {'is_working_day': False, 'reason': holiday.get('name') or 'School holiday', 'weekday': weekday}
    if weekday not in working_days:
        return {'is_working_day': False, 'reason': f'{weekday} is configured as a non-working day', 'weekday': weekday}
    return {'is_working_day': True, 'reason': 'Working day', 'weekday': weekday}

@api_router.get("/staff")
async def list_staff(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    return [clean(doc) for doc in await db.staff.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('name', 1).to_list(1000)]

def staff_record(payload: dict, staff_id: str = ''):
    name = str(payload.get('name') or '').strip()
    if not name:
        raise HTTPException(status_code=422, detail='Staff member name is required.')
    employee_id = str(staff_id or payload.get('employee_id') or payload.get('id') or '').strip() or f"STF-{uuid.uuid4().hex[:8].upper()}"
    return {
        'id': employee_id, 'name': name, 'access_role': str(payload.get('access_role') or '').strip(),
        'working_hours': str(payload.get('working_hours') or 'Full-time').strip(),
        'phone': str(payload.get('phone') or '').strip(), 'email': str(payload.get('email') or '').strip(),
        'joining_date': str(payload.get('joining_date') or '').strip(),
        'designation': str(payload.get('designation') or '').strip(),
        'department': str(payload.get('department') or '').strip(),
        'date_of_birth': str(payload.get('date_of_birth') or '').strip(),
        'address': str(payload.get('address') or '').strip(),
        'emergency_contact': str(payload.get('emergency_contact') or '').strip(),
        'blood_group': str(payload.get('blood_group') or '').strip(),
        'qualification': str(payload.get('qualification') or '').strip(),
        'experience': str(payload.get('experience') or '').strip(),
        'reporting_manager': str(payload.get('reporting_manager') or '').strip(),
        'bank_name': str(payload.get('bank_name') or '').strip(),
        'bank_account': str(payload.get('bank_account') or '').strip(),
        'ifsc_code': str(payload.get('ifsc_code') or '').strip().upper(),
        'biometric_id': str(payload.get('biometric_id') or '').strip(),
        'exit_date': str(payload.get('exit_date') or '').strip(),
        'exit_reason': str(payload.get('exit_reason') or '').strip(),
        'clearance_status': str(payload.get('clearance_status') or 'Not started').strip(),
        'status': str(payload.get('status') or 'Active').strip() or 'Active',
        'avatar': str(payload.get('avatar') or 'https://i.pravatar.cc/80?img=49').strip(),
        'created': payload.get('created') or datetime.utcnow().isoformat(),
    }

@api_router.post("/staff")
async def create_staff(payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    doc = staff_record(payload)
    doc['branch_id'] = branch_id
    if await db.staff.find_one(branch_scope(branch_id, {'id': doc['id']})):
        raise HTTPException(status_code=409, detail='That employee ID already exists.')
    if doc['email'] and await db.staff.find_one(branch_scope(branch_id, {'email': doc['email']})):
        raise HTTPException(status_code=409, detail='That email is already used by another staff member.')
    await db.staff.insert_one(dict(doc))
    await add_event('success', 'Staff member added', f"{doc['name']} was added to the staff directory.")
    return doc

@api_router.put("/staff/{staff_id}")
async def update_staff(staff_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    old = await db.staff.find_one(branch_scope(branch_id, {'id': staff_id}))
    if not old:
        raise HTTPException(status_code=404, detail='Staff member not found.')
    doc = staff_record({**old, **payload}, staff_id=staff_id)
    doc['branch_id'] = branch_id
    if doc['email']:
        duplicate = await db.staff.find_one(branch_scope(branch_id, {'email': doc['email'], 'id': {'$ne': staff_id}}))
        if duplicate:
            raise HTTPException(status_code=409, detail='That email is already used by another staff member.')
    await db.staff.update_one(branch_scope(branch_id, {'id': staff_id}), {'$set': doc})
    return doc

@api_router.get('/staff-template')
async def staff_template(role: str = Depends(get_current)):
    require_roles(role, {'admin', 'director'})
    buf = io.StringIO(); writer = csv.writer(buf)
    writer.writerow(['name','employee_id','phone','email','joining_date','designation','department','working_hours','emergency_contact','qualification','experience','status'])
    writer.writerow(['Ravi Kumar','STF-1001','9876543210','ravi@school.edu','2026-06-01','Administrator','Administration','Full-time','9876500000','B.Com','5 years','Active'])
    return PlainTextResponse(buf.getvalue(), media_type='text/csv', headers={'Content-Disposition': 'attachment; filename=staff-template.csv'})

@api_router.post('/staff/bulk')
async def bulk_upload_staff(file: UploadFile = File(...), role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    reader = csv.DictReader(io.StringIO((await file.read()).decode('utf-8', errors='ignore')))
    inserted, errors = 0, []
    for row_number, row in enumerate(reader, start=2):
        try:
            doc = staff_record(row)
            doc['branch_id'] = branch_id
            if await db.staff.find_one(branch_scope(branch_id, {'id': doc['id']})):
                errors.append({'row': row_number, 'error': 'Duplicate employee ID'}); continue
            if doc['email'] and await db.staff.find_one(branch_scope(branch_id, {'email': doc['email']})):
                errors.append({'row': row_number, 'error': 'Duplicate email'}); continue
            await db.staff.insert_one(doc); inserted += 1
        except HTTPException as error:
            errors.append({'row': row_number, 'error': error.detail})
    if inserted:
        await add_event('success', 'Staff imported', f'{inserted} staff member(s) were added through CSV import.')
    return {'inserted': inserted, 'errors': errors}

# ---------------- HR & Payroll ----------------
@api_router.get('/hr/payroll-center')
async def hr_payroll_center(month: str, role: str = Depends(get_current)):
    require_roles(role, {'admin', 'director'})
    try:
        month_start = datetime.strptime(month, '%Y-%m')
    except ValueError:
        raise HTTPException(status_code=422, detail='Choose a valid payroll month.')
    month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    start_text, end_text = month_start.date().isoformat(), (month_end - timedelta(days=1)).date().isoformat()
    teachers = [clean(row) for row in await db.teachers.find().sort('name', 1).to_list(1000)]
    staff = [clean(row) for row in await db.staff.find().sort('name', 1).to_list(1000)]
    employees = [
        {'id': row.get('id'), 'name': row.get('name', ''), 'employee_type': kind, 'designation': row.get('designation') or row.get('subject') or kind, 'department': row.get('department') or ('Academics' if kind == 'Teacher' else 'Administration'), 'status': row.get('status', 'Active'), 'avatar': row.get('avatar', '')}
        for kind, rows in [('Teacher', teachers), ('Staff', staff)] for row in rows
    ]
    structures = {row['employee_id']: clean(row) for row in await db.salary_structures.find({'employee_id': {'$in': [item['id'] for item in employees]}}).to_list(2000)}
    records = {row['employee_id']: clean(row) for row in await db.payroll_records.find({'month': month}).to_list(2000)}
    attendance = await db.attendance_records.find({'attendance_role': {'$in': ['teacher', 'staff']}, 'attendance_date': {'$gte': start_text, '$lte': end_text}}).to_list(10000)
    attendance_by_employee = {}
    for item in attendance:
        summary = attendance_by_employee.setdefault(item.get('entity_id'), {'present': 0, 'absent': 0, 'late': 0, 'leave': 0})
        key = str(item.get('status') or '').lower()
        if key in summary: summary[key] += 1
    output = []
    for employee in employees:
        structure, record = structures.get(employee['id']), records.get(employee['id'])
        output.append({**employee, 'salary': structure, 'payroll': record, 'attendance': attendance_by_employee.get(employee['id'], {'present': 0, 'absent': 0, 'late': 0, 'leave': 0})})
    return {'month': month, 'employees': output, 'summary': {'employees': len(output), 'salary_configured': len(structures), 'processed': len(records), 'gross': sum(float(row.get('gross', 0)) for row in records.values()), 'deductions': sum(float(row.get('deductions', 0)) for row in records.values()), 'net': sum(float(row.get('net', 0)) for row in records.values())}}

@api_router.post('/hr/salary-structures')
async def save_salary_structure(payload: dict, role: str = Depends(get_current)):
    require_roles(role, {'admin'})
    employee_id = str(payload.get('employee_id') or '').strip()
    employee = await db.teachers.find_one({'id': employee_id}) or await db.staff.find_one({'id': employee_id})
    if not employee: raise HTTPException(status_code=404, detail='Employee not found.')
    basic = max(0, float(payload.get('basic') or 0)); hra = max(0, float(payload.get('hra') or 0)); allowances = max(0, float(payload.get('allowances') or 0)); statutory = max(0, float(payload.get('statutory_deductions') or 0)); other = max(0, float(payload.get('other_deductions') or 0))
    if basic <= 0: raise HTTPException(status_code=422, detail='Basic salary must be greater than zero.')
    record = {'employee_id': employee_id, 'employee_name': employee.get('name', ''), 'basic': basic, 'hra': hra, 'allowances': allowances, 'statutory_deductions': statutory, 'other_deductions': other, 'gross': basic + hra + allowances, 'updated': datetime.utcnow().isoformat(), 'updated_by': ROLE_CONFIG[role]['name']}
    await db.salary_structures.update_one({'employee_id': employee_id}, {'$set': record}, upsert=True)
    return record

@api_router.post('/hr/payroll/run')
async def run_hr_payroll(payload: dict, role: str = Depends(get_current)):
    require_roles(role, {'admin'})
    month = str(payload.get('month') or '').strip()
    try: datetime.strptime(month, '%Y-%m')
    except ValueError: raise HTTPException(status_code=422, detail='Choose a valid payroll month.')
    structures = await db.salary_structures.find().to_list(2000)
    if not structures: raise HTTPException(status_code=422, detail='Configure at least one employee salary before processing payroll.')
    processed_at = datetime.utcnow().isoformat()
    for item in structures:
        deductions = float(item.get('statutory_deductions', 0)) + float(item.get('other_deductions', 0)); gross = float(item.get('gross', 0))
        record = {'id': f"PAY-{month}-{item['employee_id']}", 'month': month, 'employee_id': item['employee_id'], 'employee_name': item.get('employee_name', ''), 'gross': gross, 'deductions': deductions, 'net': max(0, gross - deductions), 'status': 'Processed', 'processed_at': processed_at, 'processed_by': ROLE_CONFIG[role]['name']}
        await db.payroll_records.update_one({'month': month, 'employee_id': item['employee_id']}, {'$set': record}, upsert=True)
    await add_event('success', 'Payroll processed', f"{month} payroll was processed for {len(structures)} employee(s).")
    return {'processed': len(structures), 'month': month}

@api_router.get('/attendance/overview')
async def attendance_overview(attendance_date: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    branch_id = x_branch_id or 'BR-MAIN'
    day_status = await attendance_day_status(attendance_date, branch_id)
    structure = await attendance_academic_structure(branch_id)
    groups = [
        {'class_name': class_item.get('name', ''), 'section': section_item.get('name', '')}
        for class_item in structure.get('classes') or []
        for section_item in class_item.get('sections') or []
        if class_item.get('name') and section_item.get('name')
    ]
    records = [clean(row) for row in await db.attendance_records.find(branch_scope(branch_id, {
        'attendance_role': 'student', 'attendance_date': attendance_date,
    })).to_list(10000)]
    completed_keys = {(row.get('class_name'), row.get('section')) for row in records}
    completed = [group for group in groups if (group['class_name'], group['section']) in completed_keys]
    pending = [group for group in groups if (group['class_name'], group['section']) not in completed_keys]
    start_date = (datetime.strptime(attendance_date, '%Y-%m-%d') - timedelta(days=29)).date().isoformat()
    recent = await db.attendance_records.find(branch_scope(branch_id, {
        'attendance_role': 'student', 'attendance_date': {'$gte': start_date, '$lte': attendance_date}, 'status': 'Absent',
    })).to_list(20000)
    recurring = {}
    for row in recent:
        item = recurring.setdefault(row.get('entity_id'), {
            'student_id': row.get('entity_id'), 'student_name': row.get('entity_name', ''),
            'class_name': row.get('class_name', ''), 'section': row.get('section', ''), 'absence_count': 0,
        })
        item['absence_count'] += 1
    recurring_rows = sorted([item for item in recurring.values() if item['absence_count'] >= 3], key=lambda item: (-item['absence_count'], item['student_name']))
    return {
        'attendance_date': attendance_date, 'day_status': day_status,
        'groups_total': len(groups), 'groups_completed': completed, 'groups_pending': pending,
        'students_marked': len(records),
        'present': len([row for row in records if row.get('status') == 'Present']),
        'absent': len([row for row in records if row.get('status') == 'Absent']),
        'late': len([row for row in records if row.get('status') == 'Late']),
        'leave': len([row for row in records if row.get('status') == 'Leave']),
        'recurring_absence': recurring_rows,
    }

@api_router.get("/attendance/roster")
async def attendance_roster(attendance_role: str, attendance_date: str, class_name: str = '', section: str = '', role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    branch_id = x_branch_id or 'BR-MAIN'
    collection = ATTENDANCE_ROLES.get(attendance_role)
    if not collection:
        raise HTTPException(status_code=422, detail='Choose Student, Teacher or Staff.')
    query = {}
    if attendance_role == 'student':
        if not class_name or not section:
            return []
        query = {'class_name': class_name, 'section': section}
    people = [clean(doc) for doc in await db[collection].find(branch_scope(branch_id, query)).sort('name', 1).to_list(1000)]
    people = [person for person in people if attendance_person_is_active(person, attendance_date)]
    ids = [person.get('id') for person in people if person.get('id')]
    saved = {doc['entity_id']: clean(doc) for doc in await db.attendance_records.find(branch_scope(branch_id, {'attendance_role': attendance_role, 'attendance_date': attendance_date, 'entity_id': {'$in': ids}})).to_list(1000)} if ids else {}
    approved_parent_leaves = {}
    if ids:
        person_type = {'student': 'Student', 'teacher': 'Teacher', 'staff': 'Staff'}[attendance_role]
        leave_rows = await db.leaves.find(branch_scope(branch_id, {
            'person_type': person_type, 'person_id': {'$in': ids}, 'status': 'Approved',
            'from_date': {'$lte': attendance_date}, 'to_date': {'$gte': attendance_date},
        })).to_list(1000)
        approved_parent_leaves = {row.get('person_id'): clean(row) for row in leave_rows}
    return [{
        'id': person.get('id'), 'name': person.get('name', ''), 'roll': person.get('roll', ''),
        'avatar': person.get('avatar') or person.get('photo') or person.get('profile_picture') or '',
        'class_name': person.get('class_name', class_name), 'section': person.get('section', section),
        'status': 'Leave' if person.get('id') in approved_parent_leaves else saved.get(person.get('id'), {}).get('status', ''),
        'leave_locked': person.get('id') in approved_parent_leaves,
        'leave_id': approved_parent_leaves.get(person.get('id'), {}).get('id', ''),
        'leave_reason': approved_parent_leaves.get(person.get('id'), {}).get('reason', ''),
        'leave_duration': approved_parent_leaves.get(person.get('id'), {}).get('duration', 'Full Day'),
        'has_saved_attendance': person.get('id') in saved,
    } for person in people]

@api_router.post("/attendance/mark")
async def mark_attendance(payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    branch_id = x_branch_id or 'BR-MAIN'
    attendance_role = payload.get('attendance_role')
    attendance_date = str(payload.get('attendance_date') or '').strip()
    class_name, section = str(payload.get('class_name') or '').strip(), str(payload.get('section') or '').strip()
    collection = ATTENDANCE_ROLES.get(attendance_role)
    entries = payload.get('entries') or []
    if not collection or not attendance_date or not entries:
        raise HTTPException(status_code=422, detail='Choose role, date and at least one attendance entry.')
    if attendance_role == 'student' and (not class_name or not section):
        raise HTTPException(status_code=422, detail='Choose both Class and Section for student attendance.')
    day_status = await attendance_day_status(attendance_date, branch_id)
    if not day_status['is_working_day']:
        raise HTTPException(status_code=422, detail=f"Attendance cannot be marked: {day_status['reason']}.")
    submitted_group = {'attendance_role': attendance_role, 'attendance_date': attendance_date}
    if attendance_role == 'student':
        submitted_group.update({'class_name': class_name, 'section': section})
    allow_correction = bool(payload.get('allow_correction'))
    correction_reason = str(payload.get('correction_reason') or '').strip()
    if await db.attendance_records.find_one(branch_scope(branch_id, submitted_group)) and not allow_correction:
        group_name = f"{class_name} {section}".strip() if attendance_role == 'student' else attendance_role.title() + 's'
        raise HTTPException(status_code=409, detail=f"Attendance for {group_name} has already been submitted for {attendance_date}. Use View Attendance or Attendance Reports to review it.")
    if allow_correction and (role not in ('admin', 'director') or not correction_reason):
        raise HTTPException(status_code=403, detail='Admin or Director must provide a reason to correct saved attendance.')
    valid_statuses = {'Present', 'Absent', 'Late', 'Leave'}
    saved = 0
    parent_notifications = 0
    for entry in entries:
        entity_id = str(entry.get('entity_id') or '').strip()
        status = str(entry.get('status') or '').strip()
        if not entity_id or status not in valid_statuses:
            continue
        person = await db[collection].find_one(branch_scope(branch_id, {'id': entity_id}))
        if not person:
            continue
        if not attendance_person_is_active(person, attendance_date):
            continue
        if attendance_role == 'student' and (person.get('class_name') != class_name or person.get('section') != section):
            continue
        approved_parent_leave = None
        if attendance_role in {'student', 'teacher', 'staff'}:
            person_type = {'student': 'Student', 'teacher': 'Teacher', 'staff': 'Staff'}[attendance_role]
            approved_parent_leave = await db.leaves.find_one(branch_scope(branch_id, {
                'person_type': person_type, 'person_id': entity_id, 'status': 'Approved',
                'from_date': {'$lte': attendance_date}, 'to_date': {'$gte': attendance_date},
            }))
            if attendance_role == 'student' and status == 'Leave' and not approved_parent_leave:
                raise HTTPException(status_code=422, detail=f"{person.get('name', 'Student')} can be marked Leave only after a Parent App request is approved.")
            if approved_parent_leave:
                status = 'Leave'
        record_query = branch_scope(branch_id, {'attendance_role': attendance_role, 'attendance_date': attendance_date, 'entity_id': entity_id})
        existing_record = await db.attendance_records.find_one(record_query)
        now = datetime.utcnow().isoformat()
        audit = {
            'at': now, 'by': ROLE_CONFIG[role]['name'],
            'action': 'Attendance corrected' if existing_record else 'Attendance marked',
            'previous_status': (existing_record or {}).get('status', ''), 'new_status': status,
            'reason': correction_reason if allow_correction else '',
        }
        record = {'id': (existing_record or {}).get('id') or f"ATT-{uuid.uuid4().hex[:10].upper()}", 'branch_id': branch_id, 'attendance_role': attendance_role, 'attendance_date': attendance_date,
                  'entity_id': entity_id, 'entity_name': person.get('name', ''), 'class_name': person.get('class_name', class_name) if attendance_role == 'student' else '',
                  'section': person.get('section', section) if attendance_role == 'student' else '', 'status': status,
                  'leave_request_id': (approved_parent_leave or {}).get('id', ''),
                  'correction_reason': correction_reason if allow_correction else '',
                  'created_by': (existing_record or {}).get('created_by') or ROLE_CONFIG[role]['name'],
                  'created_at': (existing_record or {}).get('created_at') or now,
                  'updated_by': ROLE_CONFIG[role]['name'], 'updated': now}
        await db.attendance_records.update_one(record_query, {'$set': record, '$push': {'audit_history': audit}}, upsert=True)
        if attendance_role == 'student' and status == 'Absent' and await notification_rule_enabled('attendance_absent'):
            parent_name = person.get('parent_name') or person.get('father_name') or person.get('guardian_name') or 'Parent'
            parent_phone = person.get('parent_phone') or person.get('mobile_alt') or person.get('phone') or person.get('mobile') or ''
            message = f"Dear {parent_name}, your child {person.get('name', '')} from {class_name}, Section {section} is absent from school today ({attendance_date}). Please contact the school if this is incorrect."
            await db.parent_notifications.insert_one({
                'id': f"PAR-ATT-{uuid.uuid4().hex[:10].upper()}", 'student_id': entity_id,
                'student_name': person.get('name', ''), 'parent_name': parent_name, 'parent_phone': parent_phone,
                'channel': 'SMS / WhatsApp', 'message': message, 'status': 'Queued',
                'attendance_date': attendance_date, 'class_name': class_name, 'section': section,
                'branch_id': branch_id, 'created': datetime.utcnow().isoformat(),
            })
            parent_notifications += 1
        saved += 1
    if not saved:
        raise HTTPException(status_code=422, detail='No valid attendance entries were found for the selected role and group.')
    await add_event('success', 'Attendance saved', f"{saved} {attendance_role} attendance record(s) saved for {attendance_date}.")
    if parent_notifications:
        await add_event('info', 'Parent absence messages queued', f"{parent_notifications} parent message(s) were queued for absent students in {class_name} {section}.")
    return {'saved': saved, 'parent_notifications': parent_notifications, 'attendance_date': attendance_date}

@api_router.get("/attendance/records")
async def attendance_records(attendance_role: str = '', date_from: str = '', date_to: str = '', class_name: str = '', section: str = '', status: str = '', role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    query = {}
    if attendance_role:
        query['attendance_role'] = attendance_role
    if class_name:
        query['class_name'] = class_name
    if section:
        query['section'] = section
    if status:
        query['status'] = status
    if date_from or date_to:
        query['attendance_date'] = {}
        if date_from: query['attendance_date']['$gte'] = date_from
        if date_to: query['attendance_date']['$lte'] = date_to
    return [clean(doc) for doc in await db.attendance_records.find(branch_scope(x_branch_id or 'BR-MAIN', query)).sort([('attendance_date', -1), ('entity_name', 1)]).to_list(5000)]

# ---------------- Homework ----------------
@api_router.post('/homework/attachment')
async def upload_homework_attachment(file: UploadFile = File(...), role: str = Depends(get_current)):
    if not file.filename:
        raise HTTPException(status_code=422, detail='Choose a file to attach.')
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=422, detail='Each homework attachment must be smaller than 15 MB.')
    safe_name = Path(file.filename).name
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    (HOMEWORK_UPLOAD_DIR / stored_name).write_bytes(content)
    return {
        'name': safe_name, 'size': len(content), 'content_type': file.content_type or 'application/octet-stream',
        'url': f'http://localhost:8001/uploads/homework/{stored_name}',
    }

@api_router.post('/leaves/attachment')
async def upload_leave_attachment(file: UploadFile = File(...), role: str = Depends(get_current)):
    if not file.filename:
        raise HTTPException(status_code=422, detail='Choose a file to attach.')
    allowed_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'}
    allowed_mime_prefixes = ('image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/')
    lower_name = Path(file.filename).name.lower()
    ext = Path(lower_name).suffix.lower()
    mime = (file.content_type or '').lower()
    if ext not in allowed_extensions and not any(mime.startswith(prefix) for prefix in allowed_mime_prefixes):
        raise HTTPException(status_code=422, detail='Attachments must be an image, PDF, or document file.')
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=422, detail='Each leave attachment must be smaller than 15 MB.')
    safe_name = Path(file.filename).name
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    (LEAVE_UPLOAD_DIR / stored_name).write_bytes(content)
    return {
        'name': safe_name,
        'size': len(content),
        'content_type': mime or 'application/octet-stream',
        'url': f'http://localhost:8001/uploads/leaves/{stored_name}',
    }

@api_router.get('/homework')
async def get_homework(class_name: str = '', section: str = '', role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    query = {}
    if class_name: query['class_name'] = class_name
    if section: query['section'] = section
    return [clean(item) for item in await db.homework.find(branch_scope(x_branch_id or 'BR-MAIN', query)).sort('created', -1).to_list(5000)]

@api_router.post('/homework')
async def create_homework(payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    class_name = str(payload.get('class_name') or '').strip()
    section = str(payload.get('section') or '').strip()
    instructions = str(payload.get('instructions') or '').strip()
    subject = str(payload.get('subject') or '').strip()
    due_date = str(payload.get('due_date') or '').strip()
    if not class_name or not section or not subject or not instructions or not due_date:
        raise HTTPException(status_code=422, detail='Choose Class, Section and Subject, enter homework instructions, and set a due date.')
    try:
        due = datetime.strptime(due_date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=422, detail='Choose a valid due date.')
    if due < datetime.utcnow().date():
        raise HTTPException(status_code=422, detail='The homework due date cannot be in the past.')
    calendar_status = await attendance_day_status(due_date, branch_id)
    if not calendar_status['is_working_day']:
        raise HTTPException(status_code=422, detail=f"Homework cannot be due on {due_date}: {calendar_status['reason']}.")
    structure = await attendance_academic_structure(branch_id)
    school_class = next((item for item in structure.get('classes', []) if item.get('name') == class_name), None)
    if not school_class or not any(item.get('name') == section for item in school_class.get('sections', [])):
        raise HTTPException(status_code=422, detail='Choose a Class and Section from Academic Setup.')
    allocation = await db.teacher_allocations.find_one(branch_scope(branch_id, {'class_name': class_name, 'section': section, 'subject': subject}))
    if not allocation:
        raise HTTPException(status_code=422, detail='Assign a subject teacher to this Class and Section before publishing homework.')
    duplicate = await db.homework.find_one(branch_scope(branch_id, {'class_name': class_name, 'section': section, 'subject': subject, 'due_date': due_date, 'instructions': instructions, 'status': {'$nin': ['Cancelled', 'Archived']}}))
    if duplicate:
        raise HTTPException(status_code=409, detail='This homework is already assigned for the same subject and due date.')
    now = datetime.utcnow().isoformat()
    homework = {
        'id': f'HW-{uuid.uuid4().hex[:10].upper()}', 'class_name': class_name, 'section': section,
        'subject': subject, 'instructions': instructions, 'due_date': due_date, 'chapter': str(payload.get('chapter') or '').strip(),
        'estimated_minutes': max(0, int(payload.get('estimated_minutes') or 0)),
        'attachments': payload.get('attachments') or [], 'send_parent_app': bool(payload.get('send_parent_app', True)),
        'send_whatsapp': bool(payload.get('send_whatsapp', True)), 'assigned_by': ROLE_CONFIG[role]['name'],
        'teacher_id': allocation.get('teacher_id', ''), 'teacher_name': allocation.get('teacher_name', ''),
        'created': now, 'status': str(payload.get('status') or 'Published') if str(payload.get('status') or 'Published') in {'Draft', 'Published'} else 'Published', 'branch_id': branch_id,
    }
    await db.homework.insert_one(homework)
    recipients = [clean(item) for item in await db.students.find(branch_scope(branch_id, {'class_name': class_name, 'section': section})).to_list(5000)]
    recipients = [student for student in recipients if student_is_active_on(student, due_date)]
    channels = []
    homework_notifications_enabled = await notification_rule_enabled('homework_assigned')
    if homework_notifications_enabled and homework['status'] == 'Published' and homework['send_parent_app']: channels.append('Parent App')
    if homework_notifications_enabled and homework['status'] == 'Published' and homework['send_whatsapp']: channels.append('WhatsApp')
    queued = 0
    for recipient in recipients:
        for channel in channels:
            await db.parent_notifications.insert_one({
                'id': f'PAR-HW-{uuid.uuid4().hex[:10].upper()}', 'student_id': recipient.get('id'),
                'student_name': recipient.get('name', ''), 'parent_name': recipient.get('parent_name') or recipient.get('father_name') or 'Parent',
                'parent_phone': recipient.get('parent_phone') or recipient.get('phone') or recipient.get('mobile') or '',
                'channel': channel, 'status': 'Queued', 'homework_id': homework['id'],
                'message': f"Homework for {class_name}, Section {section}: {instructions}", 'created': now, 'branch_id': branch_id,
            })
            queued += 1
    await add_event('success', 'Homework assigned', f"{class_name} {section} homework was assigned by {ROLE_CONFIG[role]['name']} and {queued} parent notification(s) were queued.")
    output = clean(homework)
    output['notifications_queued'] = queued
    output['students'] = len(recipients)
    return output

@api_router.put('/homework/{homework_id}')
async def update_homework(homework_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    record = await db.homework.find_one(branch_scope(branch_id, {'id': homework_id}))
    if not record: raise HTTPException(status_code=404, detail='Homework not found.')
    allowed = {'instructions', 'due_date', 'chapter', 'estimated_minutes', 'status'}
    changes = {key: payload[key] for key in allowed if key in payload}
    if changes.get('status') not in {None, 'Draft', 'Published', 'Cancelled', 'Archived'}:
        raise HTTPException(status_code=422, detail='Choose a valid homework status.')
    if changes.get('status') == 'Cancelled' and not str(payload.get('reason') or '').strip():
        raise HTTPException(status_code=422, detail='Enter a reason for cancelling homework.')
    changes.update({'updated_at': datetime.utcnow().isoformat(), 'updated_by': ROLE_CONFIG[role]['name'], 'change_reason': str(payload.get('reason') or '').strip()})
    if changes.get('due_date'):
        calendar_status = await attendance_day_status(str(changes['due_date']), branch_id)
        if not calendar_status['is_working_day']:
            raise HTTPException(status_code=422, detail=f"Homework cannot be due on {changes['due_date']}: {calendar_status['reason']}.")
    await db.homework.update_one(branch_scope(branch_id, {'id': homework_id}), {'$set': changes, '$push': {'audit_history': {'at': changes['updated_at'], 'by': ROLE_CONFIG[role]['name'], 'changes': list(changes.keys()), 'reason': changes['change_reason']}}})
    return clean(await db.homework.find_one(branch_scope(branch_id, {'id': homework_id})))

@api_router.get('/homework/{homework_id}/register')
async def homework_register(homework_id: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    homework = await db.homework.find_one(branch_scope(branch_id, {'id': homework_id}))
    if not homework: raise HTTPException(status_code=404, detail='Homework not found.')
    students = await db.students.find(branch_scope(branch_id, {'class_name': homework.get('class_name'), 'section': homework.get('section')})).sort('name', 1).to_list(2000)
    students = [student for student in students if student_is_active_on(student, homework.get('due_date', ''))]
    saved = {item.get('student_id'): clean(item) for item in await db.homework_completions.find(branch_scope(branch_id, {'homework_id': homework_id})).to_list(5000)}
    now_date = datetime.utcnow().date().isoformat()
    rows = []
    for student in students:
        completion = saved.get(student.get('id'), {})
        workflow = completion.get('workflow_status') or ('Verified' if completion.get('completed') else 'Pending')
        if workflow == 'Pending' and homework.get('due_date', '') < now_date: workflow = 'Overdue'
        rows.append({'student_id': student.get('id'), 'student_name': student.get('name', ''), 'roll': student.get('roll') or student.get('admission_no', ''), 'parent_phone': student.get('parent_phone') or student.get('phone') or '', 'workflow_status': workflow, 'evidence': completion.get('evidence', []), 'parent_note': completion.get('parent_note', ''), 'teacher_feedback': completion.get('teacher_feedback', ''), 'updated': completion.get('updated', '')})
    return {'homework': clean(homework), 'rows': rows, 'summary': {status: len([row for row in rows if row['workflow_status'] == status]) for status in ['Pending', 'Submitted', 'Verified', 'Needs Correction', 'Exempted', 'Overdue']}}

@api_router.put('/homework/{homework_id}/students/{student_id}/review')
async def review_homework(homework_id: str, student_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    homework = await db.homework.find_one(branch_scope(branch_id, {'id': homework_id}))
    student = await db.students.find_one(branch_scope(branch_id, {'id': student_id}))
    if not homework or not student: raise HTTPException(status_code=404, detail='Homework or student not found.')
    status = str(payload.get('status') or '')
    if status not in {'Verified', 'Needs Correction', 'Exempted'}: raise HTTPException(status_code=422, detail='Choose Verified, Needs Correction or Exempted.')
    now = datetime.utcnow().isoformat()
    changes = {'workflow_status': status, 'completed': status in {'Verified', 'Exempted'}, 'teacher_feedback': str(payload.get('feedback') or '').strip(), 'reviewed_by': ROLE_CONFIG[role]['name'], 'reviewed_at': now, 'updated': now}
    await db.homework_completions.update_one(branch_scope(branch_id, {'student_id': student_id, 'homework_id': homework_id}), {'$set': {'id': f'HWC-{student_id}-{homework_id}', 'student_id': student_id, 'student_name': student.get('name', ''), 'homework_id': homework_id, 'subject': homework.get('subject', ''), 'branch_id': branch_id, **changes}}, upsert=True)
    return clean(await db.homework_completions.find_one(branch_scope(branch_id, {'student_id': student_id, 'homework_id': homework_id})))

@api_router.post('/homework/{homework_id}/remind')
async def remind_homework(homework_id: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    homework = await db.homework.find_one(branch_scope(branch_id, {'id': homework_id}))
    if not homework: raise HTTPException(status_code=404, detail='Homework not found.')
    register = await homework_register(homework_id, role, branch_id)
    pending = [row for row in register['rows'] if row['workflow_status'] in {'Pending', 'Overdue', 'Needs Correction'}]
    now = datetime.utcnow().isoformat()
    for row in pending:
        await db.parent_notifications.insert_one({'id': f'PAR-HWR-{uuid.uuid4().hex[:10].upper()}', 'student_id': row['student_id'], 'student_name': row['student_name'], 'parent_phone': row.get('parent_phone', ''), 'channel': 'Parent App / WhatsApp', 'status': 'Queued', 'homework_id': homework_id, 'message': f"Reminder: {homework.get('subject')} homework is due on {homework.get('due_date')}.", 'created': now, 'branch_id': branch_id})
    return {'reminders_queued': len(pending)}

# ---------------- Fees ----------------
def fee_status(doc: dict):
    due, total = float(doc.get('due') or 0), float(doc.get('total') or 0)
    if due <= 0:
        return 'Paid'
    if float(doc.get('paid') or 0) > 0:
        return 'Partial'
    if doc.get('due_date') and doc.get('due_date') < datetime.utcnow().strftime('%Y-%m-%d'):
        return 'Overdue'
    return doc.get('status') if doc.get('status') in {'Overdue', 'Unpaid'} else 'Unpaid'

async def fee_with_student(doc: dict, branch_id: str = 'BR-MAIN'):
    item = clean(doc)
    student = await db.students.find_one(branch_scope(branch_id, {'id': item.get('student_id')})) if item.get('student_id') else None
    if student:
        item['name'] = student.get('name') or item.get('name', '')
        item['class_name'] = student.get('class_name', '')
        item['section'] = student.get('section', '')
        item['roll'] = student.get('roll', '')
        item['admission_no'] = student.get('admission_no', '')
        item['parent_name'] = student.get('parent_name') or student.get('father_name', '')
        item['parent_phone'] = student.get('parent_phone') or student.get('mobile') or student.get('phone', '')
        item['avatar'] = student.get('avatar', item.get('avatar', ''))
    item['status'] = fee_status(item)
    return item

@api_router.get("/fees")
async def list_fees(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    docs = await db.fees.find(branch_scope(branch_id)).to_list(5000)
    return [await fee_with_student(d, branch_id) for d in docs]

@api_router.get("/fees/summary")
async def fees_summary(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    docs = await db.fees.find(branch_scope(x_branch_id or 'BR-MAIN')).to_list(5000)
    total = sum(d.get('total', 0) for d in docs)
    paid = sum(d.get('paid', 0) for d in docs)
    due = sum(d.get('due', 0) for d in docs)
    return {
        'collected': paid, 'pending': due, 'total': total,
        'invoices': len(docs),
    }

@api_router.get("/fees/structures")
async def fee_structures(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    return [clean(x) for x in await db.fee_structures.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('created', -1).to_list(500)]

@api_router.get("/fees/edit-requests")
async def fee_edit_requests(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    rows = [clean(x) for x in await db.fee_edit_requests.find(branch_scope(x_branch_id or 'BR-MAIN', {'status': 'Pending'})).sort('requested_at', -1).to_list(100)]
    if role != 'director':
        for row in rows:
            row.pop('otp', None)
    return rows

@api_router.post("/fees/structures")
async def create_fee_structure(payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    name = str(payload.get('name') or '').strip()
    category = str(payload.get('category') or '').strip()
    amount = float(payload.get('amount') or 0)
    targets = payload.get('targets') or []
    if not name or not category or amount <= 0 or not targets:
        raise HTTPException(status_code=422, detail='Enter a fee name, category, positive amount and at least one class-section.')
    structure = await attendance_academic_structure(branch_id)
    academic_year = str(payload.get('academic_year') or structure.get('academic_year') or '').strip()
    existing_structures = await db.fee_structures.find(branch_scope(branch_id, {
        'academic_year': academic_year, 'category': {'$regex': f'^{re.escape(category)}$', '$options': 'i'},
        'name': {'$regex': f'^{re.escape(name)}$', '$options': 'i'},
    })).to_list(500)
    requested_targets = {(str(item.get('class_name') or ''), str(item.get('section') or '')) for item in targets}
    if any(requested_targets.intersection({(str(item.get('class_name') or ''), str(item.get('section') or '')) for item in row.get('targets', [])}) for row in existing_structures):
        raise HTTPException(status_code=409, detail='A fee with this name and category already exists for one or more selected Class and Section targets.')
    fee_structure = {
        'id': f"FSTR-{uuid.uuid4().hex[:8].upper()}", 'name': name, 'category': category,
        'amount': amount, 'description': str(payload.get('description') or '').strip(),
        'academic_year': academic_year, 'start_date': str(payload.get('start_date') or '').strip(),
        'due_date': str(payload.get('due_date') or '').strip(), 'targets': targets,
        'created': datetime.utcnow().isoformat(), 'created_by': ROLE_CONFIG[role]['name'], 'branch_id': branch_id,
    }
    await db.fee_structures.insert_one(dict(fee_structure))
    clauses = [{'class_name': str(x.get('class_name') or ''), 'section': str(x.get('section') or '')} for x in targets if x.get('class_name') and x.get('section')]
    students = await db.students.find(branch_scope(branch_id, {'$or': clauses})).to_list(5000) if clauses else []
    students = [student for student in students if student_is_active_on(student, fee_structure['start_date'] or datetime.utcnow().date().isoformat())]
    created = 0
    for student in students:
        invoice = {
            'id': f"FEE-{uuid.uuid4().hex[:8].upper()}", 'structure_id': fee_structure['id'],
            'student_id': student.get('id'), 'name': student.get('name', ''), 'avatar': student.get('avatar', ''),
            'fee_name': name, 'category': category, 'description': fee_structure['description'],
            'academic_year': academic_year, 'due_date': fee_structure['due_date'],
            'total': amount, 'paid': 0, 'due': amount, 'status': 'Unpaid', 'created': datetime.utcnow().isoformat(), 'branch_id': branch_id,
        }
        await db.fees.insert_one(invoice)
        created += 1
    for student in students:
        await sync_student_fee_balance(student.get('id', ''), branch_id)
    await add_event('success', 'Fee structure created', f"{name} was assigned to {created} student(s).")
    return {**fee_structure, 'invoices_created': created}

@api_router.post("/fees/structures/{structure_id}/edit-request")
async def request_fee_structure_edit(structure_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    fee_structure = await db.fee_structures.find_one(branch_scope(branch_id, {'id': structure_id}))
    if not fee_structure:
        raise HTTPException(status_code=404, detail='Fee structure not found.')
    if await db.fee_edit_requests.find_one(branch_scope(branch_id, {'structure_id': structure_id, 'status': 'Pending'})):
        raise HTTPException(status_code=409, detail='An approval request is already waiting for the Director.')
    editable = {key: payload.get(key) for key in ['name', 'category', 'amount', 'description', 'start_date', 'due_date'] if key in payload}
    if not editable:
        raise HTTPException(status_code=422, detail='Enter at least one fee detail to change.')
    if 'amount' in editable:
        try:
            editable['amount'] = float(editable['amount'])
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail='Amount must be a valid number.')
        if editable['amount'] <= 0:
            raise HTTPException(status_code=422, detail='Amount must be greater than zero.')
    request = {'id': f"FEE-EDIT-{uuid.uuid4().hex[:10].upper()}", 'structure_id': structure_id,
               'fee_name': fee_structure.get('name', ''), 'changes': editable, 'status': 'Pending',
               'otp': f"{secrets.randbelow(1000000):06d}", 'requested_by': ROLE_CONFIG[role]['name'],
               'requested_at': datetime.utcnow().isoformat(), 'branch_id': branch_id}
    await db.fee_edit_requests.insert_one(request)
    await add_event('info', 'Fee edit approval required', f"Director OTP approval is required to change {fee_structure.get('name', 'a fee structure')}.")
    return {'id': request['id'], 'status': 'Pending', 'message': 'Request sent to the Director. Ask the Director for the approval OTP.'}

@api_router.post("/fees/edit-requests/{request_id}/confirm")
async def confirm_fee_structure_edit(request_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin'})
    branch_id = x_branch_id or 'BR-MAIN'
    request = await db.fee_edit_requests.find_one(branch_scope(branch_id, {'id': request_id, 'status': 'Pending'}))
    if not request:
        raise HTTPException(status_code=404, detail='This edit request is no longer available.')
    if str(payload.get('otp') or '').strip() != request.get('otp'):
        raise HTTPException(status_code=422, detail='The Director approval OTP is incorrect.')
    changes = request.get('changes') or {}
    await db.fee_structures.update_one(branch_scope(branch_id, {'id': request['structure_id']}), {'$set': {**changes, 'updated': datetime.utcnow().isoformat(), 'updated_by': ROLE_CONFIG[role]['name']}})
    # Update unpaid invoice balances without changing money already collected or discounts already given.
    if 'amount' in changes or 'name' in changes or 'category' in changes or 'description' in changes or 'due_date' in changes:
        invoices = await db.fees.find(branch_scope(branch_id, {'structure_id': request['structure_id']})).to_list(5000)
        for invoice in invoices:
            update = {key: changes[key] for key in ['name', 'category', 'description', 'due_date'] if key in changes}
            if 'name' in update:
                update['fee_name'] = update.pop('name')
            if 'amount' in changes:
                paid = float(invoice.get('paid') or 0); discount = float(invoice.get('discount') or 0)
                update['total'] = changes['amount']; update['due'] = max(0, changes['amount'] - paid - discount)
                update['status'] = 'Paid' if update['due'] <= 0 else ('Partial' if paid or discount else 'Unpaid')
            await db.fees.update_one(branch_scope(branch_id, {'id': invoice['id']}), {'$set': update})
    await db.fee_edit_requests.update_one(branch_scope(branch_id, {'id': request_id}), {'$set': {'status': 'Approved', 'confirmed_at': datetime.utcnow().isoformat(), 'confirmed_by': ROLE_CONFIG[role]['name']}})
    await add_event('success', 'Fee structure updated', f"Director-approved changes were applied to {request.get('fee_name', 'the fee structure')}.")
    return {'ok': True}

@api_router.get("/fees/collections")
async def fee_collections(class_name: str = '', section: str = '', role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    invoices = [await fee_with_student(x, branch_id) for x in await db.fees.find(branch_scope(branch_id)).to_list(5000)]
    groups = {}
    for fee in invoices:
        if class_name and fee.get('class_name') != class_name: continue
        if section and fee.get('section') != section: continue
        sid = fee.get('student_id') or fee.get('name') or fee.get('id')
        row = groups.setdefault(sid, {'student_id': fee.get('student_id', ''), 'name': fee.get('name', ''), 'avatar': fee.get('avatar', ''), 'class_name': fee.get('class_name', ''), 'section': fee.get('section', ''), 'admission_no': fee.get('admission_no', ''), 'total': 0, 'paid': 0, 'due': 0, 'invoices': []})
        row['total'] += float(fee.get('total') or 0); row['paid'] += float(fee.get('paid') or 0); row['due'] += float(fee.get('due') or 0); row['invoices'].append(fee)
    result = []
    for row in groups.values():
        row['status'] = 'Paid' if row['due'] <= 0 else ('Partial' if row['paid'] > 0 else 'Unpaid')
        result.append(row)
    return sorted(result, key=lambda x: x['name'].lower())

@api_router.get("/fees/receipts")
async def fee_receipts(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    return [clean(x) for x in await db.fee_receipts.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('paid_at', -1).to_list(5000)]

@api_router.get('/fees/reconciliation')
async def fee_reconciliation(date: str = '', role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    selected = date or datetime.utcnow().date().isoformat()
    rows = await db.fee_receipts.find(branch_scope(x_branch_id or 'BR-MAIN', {'paid_at': {'$regex': f'^{re.escape(selected)}'}, 'status': {'$ne': 'Reversed'}})).to_list(5000)
    methods = {}
    for row in rows:
        method = str(row.get('method') or 'Other')
        methods[method] = methods.get(method, 0) + float(row.get('amount') or 0)
    return {'date': selected, 'receipts': len(rows), 'total': sum(methods.values()), 'by_method': methods,
            'discounts': sum(float(row.get('discount') or 0) for row in rows)}

@api_router.post('/fees/receipts/{receipt_id}/reverse')
async def reverse_fee_receipt(receipt_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    reason = str(payload.get('reason') or '').strip()
    if not reason:
        raise HTTPException(status_code=422, detail='Enter the reason for reversing this receipt.')
    receipt = await db.fee_receipts.find_one(branch_scope(branch_id, {'id': receipt_id}))
    if not receipt:
        raise HTTPException(status_code=404, detail='Receipt not found.')
    if receipt.get('status') == 'Reversed':
        raise HTTPException(status_code=409, detail='This receipt is already reversed.')
    fee = await db.fees.find_one(branch_scope(branch_id, {'id': receipt.get('fee_id')}))
    if not fee:
        raise HTTPException(status_code=404, detail='The connected fee invoice was not found.')
    amount, discount = float(receipt.get('amount') or 0), float(receipt.get('discount') or 0)
    updated_paid = max(0, float(fee.get('paid') or 0) - amount)
    updated_discount = max(0, float(fee.get('discount') or 0) - discount)
    updated_due = max(0, float(fee.get('total') or 0) - updated_paid - updated_discount)
    await db.fees.update_one(branch_scope(branch_id, {'id': fee['id']}), {'$set': {'paid': updated_paid, 'discount': updated_discount, 'due': updated_due, 'status': 'Partial' if updated_paid or updated_discount else 'Unpaid'}})
    now = datetime.utcnow().isoformat()
    await db.fee_receipts.update_one(branch_scope(branch_id, {'id': receipt_id}), {'$set': {'status': 'Reversed', 'reversal_reason': reason, 'reversed_at': now, 'reversed_by': ROLE_CONFIG[role]['name']}})
    if fee.get('student_id'):
        await sync_student_fee_balance(fee['student_id'], branch_id)
    await add_event('warning', 'Fee receipt reversed', f"{receipt_id} was reversed by {ROLE_CONFIG[role]['name']}.")
    return {'ok': True, 'receipt_id': receipt_id, 'balance_after': updated_due}

@api_router.post("/fees/{fid}/pay")
async def pay_fee(fid: str, req: PayReq, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    doc = await db.fees.find_one(branch_scope(branch_id, {'id': fid}))
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    current_due = doc.get('due', 0)
    amt = req.amount if req.amount is not None else current_due
    discount = max(0, float(req.discount or 0))
    method = str(req.method or 'Cash').strip()
    transaction_reference = str(req.transaction_reference or '').strip()
    if method != 'Cash' and not transaction_reference:
        raise HTTPException(status_code=422, detail=f'Enter the {method} transaction or bank reference before recording payment.')
    if discount > 0 and role not in ('admin', 'director'):
        raise HTTPException(status_code=403, detail='Only Admin or Director can approve a fee discount.')
    if discount > 0 and not str(req.discount_reason or '').strip():
        raise HTTPException(status_code=422, detail='Enter the approved discount reason.')
    amt = max(0, min(float(amt), current_due))
    discount = min(discount, max(0, current_due - amt))
    if amt + discount <= 0:
        raise HTTPException(status_code=422, detail='Enter a payment amount or an approved discount.')
    doc['paid'] = float(doc.get('paid', 0)) + amt
    doc['discount'] = float(doc.get('discount', 0)) + discount
    doc['due'] = current_due - amt - discount
    doc['status'] = 'Paid' if doc['due'] <= 0 else 'Partial'
    doc['method'] = method
    await db.fees.update_one(branch_scope(branch_id, {'id': fid}), {'$set': doc})
    # Keep the student balance equal to all of their unpaid fee heads.
    if doc.get('student_id'):
        await sync_student_fee_balance(doc['student_id'], branch_id)
    student = await db.students.find_one(branch_scope(branch_id, {'id': doc.get('student_id')})) if doc.get('student_id') else None
    receipt = {'id': f"RCP-{uuid.uuid4().hex[:10].upper()}", 'fee_id': fid, 'student_id': doc.get('student_id', ''),
               'student_name': doc.get('name', ''), 'fee_name': doc.get('fee_name', 'School Fee'), 'amount': amt,
               'discount': discount, 'discount_reason': req.discount_reason, 'method': method,
               'transaction_reference': transaction_reference, 'balance_after': doc['due'],
               'academic_year': doc.get('academic_year', ''), 'admission_no': (student or {}).get('admission_no', ''),
               'class_name': (student or {}).get('class_name', ''), 'section': (student or {}).get('section', ''),
               'parent_name': (student or {}).get('parent_name') or (student or {}).get('father_name') or '',
               'parent_phone': (student or {}).get('parent_phone') or (student or {}).get('mobile') or '',
               'paid_at': datetime.utcnow().isoformat(), 'received_by': ROLE_CONFIG[role]['name'], 'branch_id': branch_id}
    await db.fee_receipts.insert_one(receipt)
    if student:
        await db.parent_notifications.insert_one({'id': f"PAR-FEE-{uuid.uuid4().hex[:10].upper()}", 'student_id': doc.get('student_id'),
            'student_name': doc.get('name', ''), 'parent_name': receipt['parent_name'], 'parent_phone': receipt['parent_phone'],
            'channel': 'SMS / WhatsApp / App Push', 'status': 'Queued',
            'message': f"Fee receipt {receipt['id']}: ₹{amt:,.2f} received for {doc.get('fee_name', 'School Fee')}. Remaining balance: ₹{doc['due']:,.2f}.",
            'created': datetime.utcnow().isoformat(), 'branch_id': branch_id})
    await add_event('success', 'Fee collected', f"\u20b9{amt:,.0f} collected from {doc.get('name','student')} via {req.method}.")
    return {**clean(doc), 'receipt': clean(receipt)}

# ---------------- Exams ----------------
def exam_papers(document: dict) -> list:
    papers = [dict(item) for item in (document.get('papers') or []) if isinstance(item, dict)]
    if papers:
        return papers
    return [{
        'subject': document.get('subject', ''), 'date': document.get('date', ''),
        'start_time': document.get('start_time', ''), 'end_time': document.get('end_time', ''),
        'room': document.get('room', ''), 'max_marks': document.get('max_marks', 100),
    }]

async def validate_exam_papers(document: dict, branch_id: str, exclude_exam_id: str = ''):
    papers = exam_papers(document)
    scheduled = str(document.get('status') or 'Draft') != 'Draft'
    structure = await attendance_academic_structure(branch_id)
    class_item = next((item for item in structure.get('classes', []) if item.get('name') == document.get('class_name')), None)
    section_item = next((item for item in (class_item or {}).get('sections', []) if item.get('name') == document.get('section')), None)
    configured_subjects = {str(item.get('name') if isinstance(item, dict) else item).strip() for item in (section_item or {}).get('subjects', [])}
    if scheduled and not section_item:
        raise HTTPException(status_code=422, detail='Choose a Class and Section configured in Academic Setup before scheduling this examination.')
    if float(document.get('max_marks') or 0) <= 0:
        raise HTTPException(status_code=422, detail='Maximum marks must be greater than zero.')
    if float(document.get('passing_marks') or 0) < 0 or float(document.get('passing_marks') or 0) > float(document.get('max_marks') or 0):
        raise HTTPException(status_code=422, detail='Passing marks must be between zero and the maximum marks.')
    subjects = []
    for index, paper in enumerate(papers, start=1):
        subject = str(paper.get('subject') or '').strip()
        date = str(paper.get('date') or '').strip()
        start_time = str(paper.get('start_time') or '').strip()
        end_time = str(paper.get('end_time') or '').strip()
        if scheduled and (not subject or not date or not start_time or not end_time):
            raise HTTPException(status_code=422, detail=f'Paper {index} needs Subject, Date, Start Time and End Time before scheduling the examination.')
        if not subject:
            continue
        if configured_subjects and subject not in configured_subjects:
            raise HTTPException(status_code=422, detail=f'{subject} is not configured for the selected Class and Section in Academic Setup.')
        try:
            paper_maximum = float(paper.get('max_marks', document.get('max_marks') or 0) or 0)
            paper_passing = float(paper.get('passing_marks', document.get('passing_marks') or 0) or 0)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail=f'{subject}: enter valid numeric maximum and passing marks.')
        if paper_maximum <= 0 or paper_passing < 0 or paper_passing > paper_maximum:
            raise HTTPException(status_code=422, detail=f'{subject}: passing marks must be between zero and the paper maximum.')
        if subject.lower() in {item.lower() for item in subjects}:
            raise HTTPException(status_code=422, detail=f'{subject} is added more than once in this examination.')
        subjects.append(subject)
        if not date or not start_time or not end_time:
            continue
        start, end = timetable_minutes(start_time), timetable_minutes(end_time)
        if end <= start:
            raise HTTPException(status_code=422, detail=f'{subject}: end time must be after the start time.')
        calendar_status = await attendance_day_status(date, branch_id)
        if not calendar_status['is_working_day']:
            raise HTTPException(status_code=422, detail=f"{subject} cannot be scheduled on {date}: {calendar_status['reason']}.")
    declared_subjects = [str(item).strip() for item in (document.get('subjects') or []) if str(item).strip() and str(item).strip() != 'All Subjects']
    if scheduled:
        missing_papers = [subject for subject in declared_subjects if subject.lower() not in {item.lower() for item in subjects}]
        if missing_papers:
            raise HTTPException(status_code=422, detail=f"Add a complete examination paper for: {', '.join(missing_papers)}.")
    if not declared_subjects:
        document['subjects'] = subjects
    for index, paper in enumerate(papers):
        if not paper.get('date') or not paper.get('start_time') or not paper.get('end_time'):
            continue
        for other in papers[index + 1:]:
            if paper.get('date') != other.get('date') or not other.get('start_time') or not other.get('end_time'):
                continue
            if time_ranges_overlap(paper['start_time'], paper['end_time'], other['start_time'], other['end_time']):
                if document.get('class_name') and document.get('section'):
                    raise HTTPException(status_code=409, detail=f"{paper.get('subject')} and {other.get('subject')} overlap for the same Class and Section.")
                if paper.get('room') and str(paper.get('room')).strip().lower() == str(other.get('room') or '').strip().lower():
                    raise HTTPException(status_code=409, detail=f"{paper.get('room')} is assigned to two papers at the same time.")
    query = {'status': {'$ne': 'Draft'}}
    if exclude_exam_id:
        query['id'] = {'$ne': exclude_exam_id}
    other_exams = await db.exams.find(branch_scope(branch_id, query)).to_list(2000)
    for paper in papers:
        if not paper.get('date') or not paper.get('start_time') or not paper.get('end_time'):
            continue
        for other_exam in other_exams:
            for other in exam_papers(other_exam):
                if paper.get('date') != other.get('date') or not other.get('start_time') or not other.get('end_time'):
                    continue
                if not time_ranges_overlap(paper['start_time'], paper['end_time'], other['start_time'], other['end_time']):
                    continue
                same_group = other_exam.get('class_name') == document.get('class_name') and other_exam.get('section') == document.get('section')
                same_room = bool(str(paper.get('room') or '').strip()) and str(paper.get('room')).strip().lower() == str(other.get('room') or other_exam.get('room') or '').strip().lower()
                if same_group:
                    raise HTTPException(status_code=409, detail=f"{paper.get('subject')} overlaps with {other_exam.get('title', 'another examination')} for this Class and Section.")
                if same_room:
                    raise HTTPException(status_code=409, detail=f"{paper.get('room')} is already assigned to {other_exam.get('title', 'another examination')} at this time.")
    return papers

@api_router.get("/exams")
async def list_exams(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    docs = await db.exams.find(branch_scope(branch_id)).to_list(1000)
    rows = []
    for document in docs:
        item = clean(document)
        sheets = await db.marks_sets.find(branch_scope(branch_id, {'exam_id': item.get('id')})).to_list(500)
        expected_subjects = [str(subject).strip() for subject in (item.get('subjects') or [item.get('subject')]) if str(subject).strip() and subject != 'All Subjects']
        recorded = {str(sheet.get('subject') or '').strip() for sheet in sheets}
        published = {str(sheet.get('subject') or '').strip() for sheet in sheets if sheet.get('status') == 'Published'}
        item['marks_progress'] = {'expected': len(expected_subjects), 'recorded': len(recorded & set(expected_subjects)), 'published': len(published & set(expected_subjects))}
        rows.append(item)
    return rows

@api_router.post("/exams")
async def create_exam(e: Exam, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    doc = e.dict()
    structure = await attendance_academic_structure(branch_id)
    doc['academic_year'] = doc.get('academic_year') or structure.get('academic_year', '')
    duplicate = await db.exams.find_one(branch_scope(branch_id, {'title': doc['title'], 'class_name': doc['class_name'], 'section': doc['section'], 'academic_year': doc['academic_year']}))
    if duplicate:
        raise HTTPException(status_code=409, detail='An examination with this name already exists for the selected Class, Section and Academic Year.')
    doc['papers'] = await validate_exam_papers(doc, branch_id)
    if doc.get('status') != 'Draft' and not doc.get('status'):
        doc['status'] = 'Scheduled'
    doc['created_at'] = datetime.utcnow().isoformat()
    doc['created_by'] = ROLE_CONFIG[role]['name']
    doc['branch_id'] = branch_id
    await db.exams.insert_one(dict(doc))
    return doc

@api_router.delete("/exams")
async def clear_exams(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    if role not in ('admin', 'director'):
        raise HTTPException(status_code=403, detail='Only Admin or Director can clear examination records.')
    result = await db.exams.delete_many(branch_scope(x_branch_id or 'BR-MAIN'))
    await add_event('info', 'Examination records cleared', f"{result.deleted_count} old examination record(s) were removed before the new academic setup.")
    return {'deleted': result.deleted_count}

@api_router.put("/exams/{eid}")
async def update_exam(eid: str, e: Exam, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    existing = await db.exams.find_one(branch_scope(branch_id, {'id': eid}))
    if not existing:
        raise HTTPException(status_code=404, detail='Examination not found.')
    if await db.marks_sets.count_documents(branch_scope(branch_id, {'exam_id': eid, 'status': 'Published'})):
        raise HTTPException(status_code=409, detail='Published examination records are locked. Create a controlled correction instead.')
    doc = e.dict(); doc['id'] = eid
    doc['academic_year'] = doc.get('academic_year') or existing.get('academic_year', '')
    doc['papers'] = await validate_exam_papers(doc, branch_id, exclude_exam_id=eid)
    doc['updated_at'] = datetime.utcnow().isoformat(); doc['updated_by'] = ROLE_CONFIG[role]['name']; doc['branch_id'] = branch_id
    await db.exams.update_one(branch_scope(branch_id, {'id': eid}), {'$set': doc}, upsert=True)
    return doc

# ---------------- Leaves ----------------
@api_router.get("/leaves")
async def list_leaves(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    docs = await db.leaves.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('created', -1).to_list(1000)
    return [clean(d) for d in docs]

@api_router.get("/leaves/summary")
async def leaves_summary(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    docs = await db.leaves.find(branch_scope(x_branch_id or 'BR-MAIN')).to_list(1000)
    def cnt(s): return len([d for d in docs if d.get('status') == s])
    return {'total': len(docs), 'approved': cnt('Approved'),
            'rejected': cnt('Rejected'), 'pending': cnt('Pending')}

@api_router.post("/leaves")
async def create_leave(l: Leave, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    doc = l.dict()
    if doc.get('person_type') == 'Student':
        raise HTTPException(status_code=403, detail='Student leave requests must be submitted by a parent through the Parent App.')
    if doc.get('person_type') != 'Staff':
        raise HTTPException(status_code=403, detail='Admin can create leave only for Staff. Teachers must apply through the Teacher login.')
    collections = {'Student': 'students', 'Teacher': 'teachers', 'Staff': 'staff'}
    collection = collections.get(doc.get('person_type'))
    if not collection or not doc.get('person_id'):
        raise HTTPException(status_code=422, detail='Choose Student, Teacher or Staff and select the person.')
    person = await db[collection].find_one(branch_scope(branch_id, {'id': doc['person_id']}))
    if not person:
        raise HTTPException(status_code=422, detail='The selected person is no longer available.')
    try:
        start = datetime.strptime(doc['from_date'], '%Y-%m-%d').date()
        end = datetime.strptime(doc['to_date'], '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=422, detail='Choose valid From and To dates.')
    if end < start:
        raise HTTPException(status_code=422, detail='To date cannot be before From date.')
    overlap = await db.leaves.find_one(branch_scope(branch_id, {
        'person_id': doc['person_id'], 'status': {'$in': ['Pending', 'Approved']},
        'from_date': {'$lte': doc['to_date']}, 'to_date': {'$gte': doc['from_date']},
    }))
    if overlap:
        raise HTTPException(status_code=422, detail='This person already has a pending or approved leave request covering these dates.')
    doc['name'] = person.get('name', doc['name'])
    doc['days'] = (end - start).days + 1
    if doc.get('duration') not in {'Full Day', 'First Half', 'Second Half'}:
        raise HTTPException(status_code=422, detail='Choose Full Day, First Half or Second Half.')
    if doc.get('duration') != 'Full Day' and start != end:
        raise HTTPException(status_code=422, detail='Half-day leave must use the same From and To date.')
    doc['days'] = 0.5 if doc.get('duration') != 'Full Day' else doc['days']
    doc['class_name'] = person.get('class_name', doc.get('class_name', '')) if doc['person_type'] == 'Student' else ''
    doc['section'] = person.get('section', doc.get('section', '')) if doc['person_type'] == 'Student' else ''
    doc['avatar'] = person.get('avatar', doc.get('avatar', ''))
    doc['submitted_at'] = doc.get('submitted_at') or datetime.utcnow().isoformat()
    doc['created'] = doc.get('created') or datetime.utcnow().isoformat()
    doc['submitted_by'] = ROLE_CONFIG[role]['name']
    doc['attachment_name'] = doc.get('attachment_name', '')
    doc['attachment_url'] = doc.get('attachment_url', '')
    doc['attachment_type'] = doc.get('attachment_type', '')
    doc['audit_history'] = [{'at': datetime.utcnow().isoformat(), 'by': ROLE_CONFIG[role]['name'], 'action': 'Leave request created'}]
    doc['branch_id'] = branch_id
    await db.leaves.insert_one(dict(doc))
    await add_event('info', 'New leave request', f"{doc['name']} requested {doc['leave_type']} ({doc['from_date']} - {doc['to_date']}).")
    return doc

@api_router.put("/leaves/{lid}/status")
async def set_leave_status(lid: str, status: str, note: str = '', role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    if role not in ('admin', 'director', 'principal'):
        raise HTTPException(status_code=403, detail='Only Admin, Principal or Director can approve or reject leave requests.')
    if status not in {'Approved', 'Rejected', 'Pending'}:
        raise HTTPException(status_code=422, detail='Choose Approved, Rejected or Pending.')
    branch_id = x_branch_id or 'BR-MAIN'
    existing = await db.leaves.find_one(branch_scope(branch_id, {'id': lid}))
    if not existing: raise HTTPException(status_code=404, detail='Leave request not found.')
    if status == 'Rejected' and not note.strip(): raise HTTPException(status_code=422, detail='Add a rejection reason before rejecting the request.')
    now = datetime.utcnow().isoformat()
    await db.leaves.update_one(branch_scope(branch_id, {'id': lid}), {'$set': {'status': status, 'review_note': note.strip(), 'reviewed_by': ROLE_CONFIG[role]['name'], 'reviewed_at': now}, '$push': {'audit_history': {'at': now, 'by': ROLE_CONFIG[role]['name'], 'action': f'Leave {status.lower()}', 'note': note.strip()}}})
    doc = await db.leaves.find_one(branch_scope(branch_id, {'id': lid}))
    await add_event('success' if status == 'Approved' else 'info', 'Leave request updated', f"{doc.get('name', 'Leave request')} was {status.lower()}.")
    if doc.get('person_type') == 'Student':
        await db.parent_notifications.insert_one({'id': f"PAR-LEV-{uuid.uuid4().hex[:10].upper()}", 'student_id': doc.get('person_id'), 'student_name': doc.get('name', ''), 'channel': 'Parent App', 'status': 'Queued', 'leave_id': lid, 'message': f"Leave request for {doc.get('from_date')} to {doc.get('to_date')} was {status.lower()}. {note.strip()}".strip(), 'created': now, 'branch_id': branch_id})
    return clean(doc)

@api_router.put('/leaves/{lid}/cancel')
async def cancel_leave(lid: str, reason: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    branch_id = x_branch_id or 'BR-MAIN'
    leave = await db.leaves.find_one(branch_scope(branch_id, {'id': lid}))
    if not leave: raise HTTPException(status_code=404, detail='Leave request not found.')
    if leave.get('status') not in {'Pending', 'Approved'}: raise HTTPException(status_code=409, detail='Only pending or approved leave can be cancelled.')
    if not reason.strip(): raise HTTPException(status_code=422, detail='Add a cancellation reason.')
    now = datetime.utcnow().isoformat()
    await db.leaves.update_one(branch_scope(branch_id, {'id': lid}), {'$set': {'status': 'Cancelled', 'cancelled_at': now, 'cancelled_by': ROLE_CONFIG[role]['name'], 'cancellation_reason': reason.strip()}, '$push': {'audit_history': {'at': now, 'by': ROLE_CONFIG[role]['name'], 'action': 'Leave cancelled', 'reason': reason.strip()}}})
    if leave.get('person_type') == 'Student':
        await db.parent_notifications.insert_one({'id': f"PAR-LEV-{uuid.uuid4().hex[:10].upper()}", 'student_id': leave.get('person_id'), 'student_name': leave.get('name', ''), 'channel': 'Parent App', 'status': 'Queued', 'leave_id': lid, 'message': f"Leave request was cancelled. Reason: {reason.strip()}", 'created': now, 'branch_id': branch_id})
    await add_event('info', 'Leave cancelled', f"{leave.get('name', 'Leave request')} was cancelled by {ROLE_CONFIG[role]['name']}.")
    return clean(await db.leaves.find_one(branch_scope(branch_id, {'id': lid})))

# ---------------- Teachers ----------------
@api_router.get("/teachers")
async def list_teachers(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    docs = await db.teachers.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('name', 1).to_list(1000)
    return [clean(d) for d in docs]

def teacher_record(payload: dict, teacher_id: str = ''):
    name = str(payload.get('name') or payload.get('teacher_name') or '').strip()
    if not name:
        raise HTTPException(status_code=422, detail='Teacher name is required.')
    employee_id = str(teacher_id or payload.get('employee_id') or payload.get('id') or '').strip() or f"TCH-{uuid.uuid4().hex[:8].upper()}"
    return {
        'id': employee_id, 'name': name,
        'subject': str(payload.get('primary_subject') if 'primary_subject' in payload else payload.get('subject') or '').strip(),
        'phone': str(payload.get('phone') or '').strip(), 'email': str(payload.get('email') or '').strip(),
        'qualification': str(payload.get('qualification') or '').strip(),
        'department': str(payload.get('department') or '').strip(),
        'designation': str(payload.get('designation') or '').strip(),
        'joining_date': str(payload.get('joining_date') or '').strip(),
        'experience': str(payload.get('experience') or '').strip(),
        'emergency_contact': str(payload.get('emergency_contact') or '').strip(),
        'address': str(payload.get('address') or '').strip(),
        'status': str(payload.get('status') or 'Active').strip() or 'Active',
        'avatar': str(payload.get('avatar') or 'https://i.pravatar.cc/80?img=12').strip(),
        'created': payload.get('created') or datetime.utcnow().isoformat(),
    }

@api_router.post("/teachers")
async def create_teacher(payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    branch_id = x_branch_id or 'BR-MAIN'
    doc = teacher_record(payload)
    doc['branch_id'] = branch_id
    if await db.teachers.find_one(branch_scope(branch_id, {'id': doc['id']})):
        raise HTTPException(status_code=409, detail='That employee ID already exists.')
    if doc['email'] and await db.teachers.find_one(branch_scope(branch_id, {'email': doc['email']})):
        raise HTTPException(status_code=409, detail='That email is already used by another teacher.')
    await db.teachers.insert_one(dict(doc))
    await add_event('success', 'Teacher added', f"{doc['name']} was added to the teacher directory.")
    return doc

@api_router.put("/teachers/{teacher_id}")
async def update_teacher(teacher_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    branch_id = x_branch_id or 'BR-MAIN'
    old = await db.teachers.find_one(branch_scope(branch_id, {'id': teacher_id}))
    if not old:
        raise HTTPException(status_code=404, detail='Teacher not found.')
    doc = teacher_record({**old, **payload}, teacher_id=teacher_id)
    doc['branch_id'] = branch_id
    if doc['email']:
        duplicate = await db.teachers.find_one(branch_scope(branch_id, {'email': doc['email'], 'id': {'$ne': teacher_id}}))
        if duplicate:
            raise HTTPException(status_code=409, detail='That email is already used by another teacher.')
    await db.teachers.update_one(branch_scope(branch_id, {'id': teacher_id}), {'$set': doc})
    return doc

# ---------------- Visitor management ----------------
@api_router.get('/visitors')
async def list_visitors(
    status: str = '', visit_date: str = '', q: str = '',
    role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN'),
):
    branch_id = x_branch_id or 'BR-MAIN'
    # Repair records created by the earlier flow, which treated a pending gate
    # request as already inside and issued a token before approval.
    await db.visitors.update_many(branch_scope(branch_id, {'status': 'Inside', 'entry_decision': 'Pending'}), {'$set': {'status': 'Waiting Approval', 'share_token': '', 'share_expires_at': ''}})
    query = branch_scope(branch_id)
    if status and status != 'All':
        query['status'] = status
    if visit_date:
        query['visit_date'] = visit_date
    if q:
        query['$or'] = [
            {'visitor_name': {'$regex': q, '$options': 'i'}},
            {'phone': {'$regex': q, '$options': 'i'}},
            {'pass_number': {'$regex': q, '$options': 'i'}},
            {'host_name': {'$regex': q, '$options': 'i'}},
            {'purpose': {'$regex': q, '$options': 'i'}},
        ]
    docs = await db.visitors.find(query).sort('created', -1).to_list(5000)
    return [clean(doc) for doc in docs]

@api_router.post('/visitors')
async def register_visitor(payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    branch_id = x_branch_id or 'BR-MAIN'
    visitor_name = str(payload.get('visitor_name') or '').strip()
    phone = str(payload.get('phone') or '').strip()
    purpose = str(payload.get('purpose') or '').strip()
    host_name = str(payload.get('host_name') or '').strip()
    if not visitor_name or not phone or not purpose or not host_name:
        raise HTTPException(status_code=422, detail='Visitor name, mobile number, purpose and person to meet are required.')
    phone_digits = ''.join(character for character in phone if character.isdigit())
    if len(phone_digits) < 10:
        raise HTTPException(status_code=422, detail='Enter a valid visitor mobile number.')
    if await db.visitors.find_one(branch_scope(branch_id, {'phone_normalized': phone_digits[-10:], 'status': {'$in': ['Waiting Approval', 'Inside']}})):
        raise HTTPException(status_code=409, detail='This visitor already has an active gate record. Complete or reject it before creating another entry.')
    watch_match = await db.visitor_watchlist.find_one(branch_scope(branch_id, {'$or': [{'phone_normalized': phone_digits[-10:]}, {'id_number': str(payload.get('id_number') or '').strip()}]}))
    if watch_match and watch_match.get('active', True):
        raise HTTPException(status_code=403, detail='Restricted visitor match found. Entry requires authorised school-office review.')
    visitor_type = str(payload.get('visitor_type') or 'Parent / Guardian').strip()
    student_id = str(payload.get('student_id') or '').strip()
    pickup_authorized = False
    if visitor_type == 'Student Pickup':
        if not student_id:
            raise HTTPException(status_code=422, detail='Select the student for this pickup visit.')
        student = await db.students.find_one(branch_scope(branch_id, {'id': student_id}))
        if not student:
            raise HTTPException(status_code=404, detail='Selected student was not found.')
        authorised_numbers = {str(student.get(key) or '').strip() for key in ('parent_phone', 'phone', 'mobile', 'mobile_alt')}
        pickup_authorized = phone in authorised_numbers or phone_digits in {''.join(ch for ch in number if ch.isdigit()) for number in authorised_numbers}
        if not pickup_authorized and not payload.get('pickup_override_reason'):
            raise HTTPException(status_code=403, detail='This mobile number is not an authorised guardian number. School-office approval and a reason are required.')
    now = datetime.utcnow()
    pass_number = f"VIS-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    doc = {
        'id': f"VST-{uuid.uuid4().hex[:10].upper()}",
        'pass_number': pass_number,
        'share_token': '',
        'share_expires_at': '',
        'visitor_name': visitor_name,
        'phone': phone,
        'phone_normalized': phone_digits[-10:],
        'visitor_type': visitor_type,
        'organization': str(payload.get('organization') or '').strip(),
        'purpose': purpose,
        'host_name': host_name,
        'host_role': str(payload.get('host_role') or '').strip(),
        'host_department': str(payload.get('host_department') or '').strip(),
        'host_id': str(payload.get('host_id') or '').strip(),
        'host_category': str(payload.get('host_category') or '').strip(),
        'id_type': str(payload.get('id_type') or '').strip(),
        'id_number': str(payload.get('id_number') or '').strip(),
        'vehicle_number': str(payload.get('vehicle_number') or '').strip().upper(),
        'people_count': max(1, int(payload.get('people_count') or 1)),
        'companion_names': str(payload.get('companion_names') or '').strip(),
        'visitor_photo': str(payload.get('visitor_photo') or '').strip(),
        'access_zone': str(payload.get('access_zone') or 'Reception only').strip(),
        'expected_minutes': max(15, min(480, int(payload.get('expected_minutes') or 60))),
        'appointment_at': str(payload.get('appointment_at') or '').strip(),
        'student_id': student_id,
        'pickup_authorized': pickup_authorized,
        'pickup_override_reason': str(payload.get('pickup_override_reason') or '').strip(),
        'notes': str(payload.get('notes') or '').strip(),
        'visit_date': now.date().isoformat(),
        'arrival_at': now.isoformat(),
        'check_in_at': '',
        'check_out_at': '',
        'status': 'Waiting Approval',
        'host_notified': False,
        'host_decision': 'Pending',
        'entry_decision': 'Pending',
        'registered_by': ROLE_CONFIG[role]['name'],
        'created': now.isoformat(),
        'branch_id': branch_id,
        'audit_history': [{'action': 'Visitor registered at gate', 'at': now.isoformat(), 'by': ROLE_CONFIG[role]['name']}],
    }
    await db.visitors.insert_one(dict(doc))
    await db.notification_broadcasts.insert_one({
        'id': f"NOT-{uuid.uuid4().hex[:10].upper()}", 'title': 'Visitor waiting at the gate',
        'message': f"{visitor_name} is waiting to meet {host_name}. Purpose: {purpose}",
        'audience': 'Teachers' if doc['host_category'] == 'Teachers' else 'Staff',
        'recipient_id': doc['host_id'], 'recipients_count': 1, 'channels': ['App Push'],
        'status': 'Queued', 'source': 'Visitor Management', 'created': now.isoformat(), 'sent_by': ROLE_CONFIG[role]['name'],
        'branch_id': branch_id, 'visitor_id': doc['id'], 'action_required': True,
    })
    await db.host_notifications.insert_one({'id': f"HNO-{uuid.uuid4().hex[:10].upper()}", 'visitor_id': doc['id'], 'recipient_id': doc['host_id'], 'recipient_name': host_name, 'recipient_category': doc['host_category'], 'title': 'Visitor waiting at the gate', 'message': f'{visitor_name} is waiting. Purpose: {purpose}', 'status': 'Action Required', 'created': now.isoformat(), 'branch_id': branch_id})
    await db.visitors.update_one(branch_scope(branch_id, {'id': doc['id']}), {'$set': {'host_notified': True}, '$push': {'audit_history': {'action': 'Host notification queued', 'at': now.isoformat(), 'by': 'System'}}})
    doc['host_notified'] = True
    await add_event('info', 'Visitor awaiting approval', f"{visitor_name} is waiting at the gate to meet {host_name}.")
    return doc

@api_router.put('/visitors/{visitor_id}/decision')
async def decide_visitor(visitor_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    decision = str(payload.get('decision') or '').strip().title()
    if decision not in {'Approved', 'Rejected'}:
        raise HTTPException(status_code=422, detail='Choose Approved or Rejected.')
    query = branch_scope(branch_id, {'id': visitor_id})
    visitor = await db.visitors.find_one(query)
    if not visitor:
        raise HTTPException(status_code=404, detail='Visitor record not found.')
    if visitor.get('status') != 'Waiting Approval':
        raise HTTPException(status_code=409, detail='Only a visitor waiting at the gate can be approved or rejected.')
    now_dt = datetime.utcnow()
    now = now_dt.isoformat()
    note = str(payload.get('note') or '').strip()
    changes = {'host_decision': decision, 'entry_decision': decision, 'decision_note': note, 'decided_at': now, 'decided_by': ROLE_CONFIG[role]['name']}
    if decision == 'Approved':
        changes.update({'status': 'Inside', 'check_in_at': now, 'share_token': secrets.token_urlsafe(24), 'share_expires_at': (now_dt + timedelta(hours=6)).isoformat()})
    else:
        changes.update({'status': 'Denied', 'check_in_at': '', 'share_token': '', 'share_expires_at': ''})
    await db.visitors.update_one(query, {'$set': changes, '$push': {'audit_history': {'action': f'Entry {decision.lower()}', 'note': note, 'at': now, 'by': ROLE_CONFIG[role]['name']}}})
    await db.host_notifications.update_many(branch_scope(branch_id, {'visitor_id': visitor_id}), {'$set': {'status': decision, 'resolved_at': now, 'resolved_by': ROLE_CONFIG[role]['name']}})
    return clean(await db.visitors.find_one(query))

@api_router.put('/visitors/{visitor_id}/extend')
async def extend_visitor(visitor_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    minutes = max(15, min(240, int(payload.get('minutes') or 30)))
    reason = str(payload.get('reason') or '').strip()
    if not reason:
        raise HTTPException(status_code=422, detail='Add a reason for extending the visit.')
    query = branch_scope(x_branch_id or 'BR-MAIN', {'id': visitor_id, 'status': 'Inside'})
    if not await db.visitors.find_one(query): raise HTTPException(status_code=409, detail='Only a visitor currently inside can be extended.')
    now = datetime.utcnow().isoformat()
    await db.visitors.update_one(query, {'$inc': {'expected_minutes': minutes}, '$push': {'audit_history': {'action': f'Visit extended by {minutes} minutes', 'note': reason, 'at': now, 'by': ROLE_CONFIG[role]['name']}}})
    return clean(await db.visitors.find_one(query))

@api_router.get('/visitors-emergency-register')
async def visitor_emergency_register(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    return [clean(item) for item in await db.visitors.find(branch_scope(x_branch_id or 'BR-MAIN', {'status': 'Inside'})).sort('check_in_at', 1).to_list(2000)]

@api_router.get('/public/visitor-pass/{share_token}')
async def public_visitor_pass(share_token: str):
    visitor = await db.visitors.find_one({'share_token': share_token})
    if not visitor:
        raise HTTPException(status_code=404, detail='Visitor pass not found.')
    expires_at = visitor.get('share_expires_at', '')
    try:
        expired = not expires_at or datetime.fromisoformat(expires_at) <= datetime.utcnow()
    except ValueError:
        expired = True
    if expired or visitor.get('status') != 'Inside' or visitor.get('entry_decision') != 'Approved':
        raise HTTPException(status_code=410, detail='This visitor pass link has expired.')
    return {
        'pass_number': visitor.get('pass_number', ''),
        'visitor_name': visitor.get('visitor_name', ''),
        'purpose': visitor.get('purpose', ''),
        'host_name': visitor.get('host_name', ''),
        'check_in_at': visitor.get('check_in_at', ''),
    }

@api_router.put('/visitors/{visitor_id}/checkout')
async def checkout_visitor(visitor_id: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    query = branch_scope(x_branch_id or 'BR-MAIN', {'id': visitor_id})
    visitor = await db.visitors.find_one(query)
    if not visitor:
        raise HTTPException(status_code=404, detail='Visitor record not found.')
    if visitor.get('status') != 'Inside':
        raise HTTPException(status_code=409, detail='Only a visitor currently inside can be checked out.')
    now = datetime.utcnow().isoformat()
    await db.visitors.update_one(query, {'$set': {
        'status': 'Checked Out', 'check_out_at': now,
        'checked_out_by': ROLE_CONFIG[role]['name'], 'updated': now,
    }, '$push': {'audit_history': {'action': 'Visitor checked out', 'at': now, 'by': ROLE_CONFIG[role]['name']}}})
    updated = await db.visitors.find_one(query)
    await add_event('success', 'Visitor checked out', f"{visitor.get('visitor_name', 'Visitor')} left the campus.")
    return clean(updated)

@api_router.get("/teachers-template")
async def teachers_template(role: str = Depends(get_current)):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(['teacher_name', 'employee_id', 'phone', 'email', 'primary_subject', 'qualification', 'status'])
    writer.writerow(['Anita Rao', 'TCH-1001', '9876543210', 'anita@example.com', 'Mathematics', 'B.Ed, M.Sc', 'Active'])
    return PlainTextResponse(buf.getvalue(), media_type='text/csv', headers={'Content-Disposition': 'attachment; filename=teachers-template.csv'})

@api_router.post("/teachers/bulk")
async def bulk_upload_teachers(file: UploadFile = File(...), role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    branch_id = x_branch_id or 'BR-MAIN'
    content = (await file.read()).decode('utf-8', errors='ignore')
    reader = csv.DictReader(io.StringIO(content))
    inserted, errors = 0, []
    for row_number, row in enumerate(reader, start=2):
        try:
            doc = teacher_record(row)
            doc['branch_id'] = branch_id
            if await db.teachers.find_one(branch_scope(branch_id, {'id': doc['id']})):
                errors.append({'row': row_number, 'error': 'Duplicate employee ID'})
                continue
            if doc['email'] and await db.teachers.find_one(branch_scope(branch_id, {'email': doc['email']})):
                errors.append({'row': row_number, 'error': 'Duplicate email'})
                continue
            await db.teachers.insert_one(dict(doc))
            inserted += 1
        except HTTPException as error:
            errors.append({'row': row_number, 'error': error.detail})
    if inserted:
        await add_event('success', 'Teachers imported', f"{inserted} teacher(s) were added via CSV upload.")
    return {'inserted': inserted, 'errors': errors}

# ---------------- Teaching excellence ----------------
@api_router.get("/teaching/setup")
async def teaching_setup(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    branch_id = x_branch_id or 'BR-MAIN'
    teachers = await db.teachers.count_documents(branch_scope(branch_id))
    students = len([student for student in await db.students.find(branch_scope(branch_id)).to_list(2000) if student_is_active_on(student)])
    allocations = await db.teacher_allocations.count_documents(branch_scope(branch_id))
    structure = await attendance_academic_structure(branch_id)
    return {
        'academic_year': '2026-2027',
        'checklist': [
            {'key': 'teachers', 'label': 'Add teacher details', 'complete': teachers > 0},
            {'key': 'students', 'label': 'Add student details', 'complete': students > 0},
            {'key': 'allocations', 'label': 'Allocate subject teachers', 'complete': allocations > 0},
            {'key': 'calendar', 'label': 'Set up academic calendar', 'complete': bool(structure.get('working_days'))},
        ],
        'allocations': [clean(d) for d in await db.teacher_allocations.find(branch_scope(branch_id)).sort('teacher_name', 1).to_list(1000)],
    }

@api_router.post("/teacher-allocations")
async def create_teacher_allocation(a: TeacherAllocation, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    branch_id = x_branch_id or 'BR-MAIN'
    teacher = await db.teachers.find_one(branch_scope(branch_id, {'id': a.teacher_id}))
    if not teacher:
        raise HTTPException(status_code=422, detail='Choose a teacher from the teacher directory.')
    if str(teacher.get('status') or 'Active').strip().lower() != 'active':
        raise HTTPException(status_code=422, detail='Only an active teacher can receive a new subject allocation.')
    structure = await attendance_academic_structure(branch_id)
    class_item = next((item for item in (structure or {}).get('classes', []) if item.get('name') == a.class_name), None)
    section_item = next((item for item in (class_item or {}).get('sections', []) if item.get('name') == a.section), None)
    if not section_item or a.subject not in (section_item.get('subjects') or []):
        raise HTTPException(status_code=422, detail='Choose a Class, Section and Subject from Academic Setup.')
    existing = await db.teacher_allocations.find_one(branch_scope(branch_id, {'class_name': a.class_name, 'section': a.section, 'subject': a.subject}))
    if existing:
        raise HTTPException(status_code=409, detail=f"{a.subject} is already allocated for {a.class_name} {a.section}.")
    doc = a.dict()
    doc['teacher_name'] = teacher.get('name', '')
    doc['academic_year'] = (structure or {}).get('academic_year') or a.academic_year
    doc['branch_id'] = branch_id
    await db.teacher_allocations.insert_one(dict(doc))
    await db.curriculum_units.update_many(
        branch_scope(branch_id, {'class_name': a.class_name, 'section': a.section, 'subject': a.subject, 'status': {'$ne': 'Completed'}}),
        {'$set': {'teacher_id': doc['teacher_id'], 'teacher_name': doc['teacher_name']}}
    )
    await add_event('info', 'Teacher allocated', f"{doc['teacher_name']} was allocated to {doc['subject']} for {doc['class_name']} {doc['section']}.")
    return doc

@api_router.get("/teacher-allocations")
async def list_teacher_allocations(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    branch_id = x_branch_id or 'BR-MAIN'
    rows = [clean(doc) for doc in await db.teacher_allocations.find(branch_scope(branch_id)).sort([('class_name', 1), ('section', 1), ('subject', 1)]).to_list(1000)]
    teachers = {item.get('id'): item for item in await db.teachers.find(branch_scope(branch_id)).to_list(1000)}
    periods = await db.timetable_periods.find(branch_scope(branch_id)).to_list(5000)
    allocation_counts = {}
    period_counts = {}
    for row in rows:
        allocation_counts[row.get('teacher_id')] = allocation_counts.get(row.get('teacher_id'), 0) + 1
    for period in periods:
        period_counts[period.get('teacher_id')] = period_counts.get(period.get('teacher_id'), 0) + 1
    for row in rows:
        teacher = teachers.get(row.get('teacher_id'), {})
        row['teacher_status'] = teacher.get('status', 'Active')
        row['primary_subject'] = teacher.get('subject', '')
        row['teacher_allocation_count'] = allocation_counts.get(row.get('teacher_id'), 0)
        row['teacher_period_count'] = period_counts.get(row.get('teacher_id'), 0)
        row['workload_limit'] = 40
    return rows

@api_router.delete("/teacher-allocations/{aid}")
async def delete_teacher_allocation(aid: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    if role not in ('admin', 'director', 'academic_coordinator'):
        raise HTTPException(status_code=403, detail='Only Admin, Director or Academic Coordinator can remove an allocation.')
    branch_id = x_branch_id or 'BR-MAIN'
    allocation = await db.teacher_allocations.find_one(branch_scope(branch_id, {'id': aid}))
    if not allocation:
        raise HTTPException(status_code=404, detail='Teacher allocation not found.')
    connected_periods = await db.timetable_periods.count_documents(branch_scope(branch_id, {
        'class_name': allocation.get('class_name'), 'section': allocation.get('section'),
        'subject': allocation.get('subject'), 'teacher_id': allocation.get('teacher_id'),
    }))
    if connected_periods:
        raise HTTPException(status_code=409, detail=f'This allocation is used in {connected_periods} timetable period(s). Reassign those periods before removing it.')
    await db.teacher_allocations.delete_one(branch_scope(branch_id, {'id': aid}))
    return {'ok': True}

# ---------------- Timetable ----------------
TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

def timetable_minutes(value: str) -> int:
    try:
        hour, minute = str(value).split(':', 1)
        return int(hour) * 60 + int(minute)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail='Enter valid start and end times.')

@api_router.get("/timetable-periods")
async def list_timetable_periods(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    rows = await db.timetable_periods.find(branch_scope(x_branch_id or 'BR-MAIN')).to_list(5000)
    day_order = {day: index for index, day in enumerate(TIMETABLE_DAYS)}
    return [clean(row) for row in sorted(rows, key=lambda row: (row.get('class_name', ''), row.get('section', ''), day_order.get(row.get('day'), 99), row.get('start_time', '')))]

@api_router.post("/timetable-periods")
async def create_timetable_period(period: TimetablePeriod, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    branch_id = x_branch_id or 'BR-MAIN'
    if period.day not in TIMETABLE_DAYS:
        raise HTTPException(status_code=422, detail='Choose a valid school day.')
    start, end = timetable_minutes(period.start_time), timetable_minutes(period.end_time)
    if end <= start:
        raise HTTPException(status_code=422, detail='End time must be after the start time.')
    if period.schedule_scope not in {'Day', 'Week', 'Month'}:
        raise HTTPException(status_code=422, detail='Choose Day, Week or Month schedule scope.')
    try:
        effective_start = datetime.strptime(period.effective_from, '%Y-%m-%d').date()
        effective_end = datetime.strptime(period.effective_to, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=422, detail='Choose a valid calendar date for this timetable period.')
    if effective_end < effective_start:
        raise HTTPException(status_code=422, detail='The timetable end date cannot be before its start date.')
    structure = await attendance_academic_structure(branch_id)
    working_days = structure.get('working_days') or TIMETABLE_DAYS
    if period.day not in working_days:
        raise HTTPException(status_code=422, detail=f'{period.day} is configured as a non-working day in Academic Setup.')
    if period.schedule_scope == 'Day':
        calendar_status = await attendance_day_status(period.effective_from, branch_id)
        if not calendar_status['is_working_day']:
            raise HTTPException(status_code=422, detail=f"This timetable date is unavailable: {calendar_status['reason']}.")
    class_item = next((item for item in (structure or {}).get('classes', []) if item.get('name') == period.class_name), None)
    section_item = next((item for item in (class_item or {}).get('sections', []) if item.get('name') == period.section), None)
    if not section_item or period.subject not in (section_item.get('subjects') or []):
        raise HTTPException(status_code=422, detail='Choose a Class, Section and Subject from Academic Setup.')
    allocation = await db.teacher_allocations.find_one(branch_scope(branch_id, {'class_name': period.class_name, 'section': period.section, 'subject': period.subject}))
    if not allocation:
        raise HTTPException(status_code=422, detail='Assign a teacher to this Class, Section and Subject before creating its timetable period.')
    teacher = await db.teachers.find_one(branch_scope(branch_id, {'id': allocation.get('teacher_id')})) or {}
    if str(teacher.get('status') or 'Active').strip().lower() != 'active':
        raise HTTPException(status_code=422, detail=f"{allocation.get('teacher_name', 'The allocated teacher')} is not currently active. Update the teacher status or allocation first.")
    day_rows = await db.timetable_periods.find(branch_scope(branch_id, {'day': period.day})).to_list(5000)
    for row in day_rows:
        row_from, row_to = row.get('effective_from', ''), row.get('effective_to', '')
        date_ranges_overlap = not row_from or not row_to or (period.effective_from <= row_to and period.effective_to >= row_from)
        if not date_ranges_overlap:
            continue
        row_start, row_end = timetable_minutes(row.get('start_time')), timetable_minutes(row.get('end_time'))
        overlaps = start < row_end and end > row_start
        same_group = row.get('class_name') == period.class_name and row.get('section') == period.section
        same_teacher = row.get('teacher_id') == allocation.get('teacher_id')
        same_room = bool(period.room.strip()) and str(row.get('room') or '').strip().lower() == period.room.strip().lower()
        if overlaps and same_group:
            raise HTTPException(status_code=409, detail='This Class and Section already has a period during that time.')
        if overlaps and same_teacher:
            raise HTTPException(status_code=409, detail=f"{allocation.get('teacher_name')} is already scheduled at this time.")
        if overlaps and same_room:
            raise HTTPException(status_code=409, detail=f"{period.room.strip()} is already assigned to another class during this time.")
    teacher_periods = await db.timetable_periods.find(branch_scope(branch_id, {'teacher_id': allocation.get('teacher_id')})).to_list(5000)
    overlapping_version_periods = [row for row in teacher_periods if not row.get('effective_from') or not row.get('effective_to') or (period.effective_from <= row.get('effective_to', '') and period.effective_to >= row.get('effective_from', ''))]
    if len(overlapping_version_periods) >= 40:
        raise HTTPException(status_code=409, detail=f"{allocation.get('teacher_name')} already has 40 periods in this timetable range. Review workload before adding another period.")
    doc = period.dict()
    doc['teacher_id'] = allocation.get('teacher_id', '')
    doc['teacher_name'] = allocation.get('teacher_name', '')
    doc['academic_year'] = (structure or {}).get('academic_year') or period.academic_year
    doc['created'] = datetime.utcnow().isoformat()
    doc['branch_id'] = branch_id
    await db.timetable_periods.insert_one(dict(doc))
    await add_event('info', 'Timetable updated', f"{doc['subject']} was scheduled for {doc['class_name']} {doc['section']} on {doc['day']}.")
    return doc

@api_router.delete("/timetable-periods/{period_id}")
async def delete_timetable_period(period_id: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    result = await db.timetable_periods.delete_one(branch_scope(x_branch_id or 'BR-MAIN', {'id': period_id}))
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail='Timetable period not found.')
    return {'ok': True}

def parse_school_date(value: str):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail='Choose a valid date.')

def time_ranges_overlap(start_a: str, end_a: str, start_b: str, end_b: str) -> bool:
    return timetable_minutes(start_a) < timetable_minutes(end_b) and timetable_minutes(end_a) > timetable_minutes(start_b)

@api_router.get("/teacher-substitution-alerts")
async def teacher_substitution_alerts(target_date: str = '', role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    branch_id = x_branch_id or 'BR-MAIN'
    selected = parse_school_date(target_date) if target_date else datetime.utcnow().date()
    selected_text = selected.isoformat()
    weekday = selected.strftime('%A')
    leaves = await db.leaves.find(branch_scope(branch_id)).to_list(2000)
    approved_teacher_leaves = []
    for leave in leaves:
        if str(leave.get('person_type', '')).lower() != 'teacher' or str(leave.get('status', '')).lower() != 'approved':
            continue
        try:
            if parse_school_date(leave.get('from_date')) <= selected <= parse_school_date(leave.get('to_date')):
                approved_teacher_leaves.append(leave)
        except HTTPException:
            continue

    day_periods = await db.timetable_periods.find(branch_scope(branch_id, {'day': weekday})).sort('start_time', 1).to_list(2000)
    day_periods = [period for period in day_periods if
                   (not period.get('effective_from') or period.get('effective_from') <= selected_text) and
                   (not period.get('effective_to') or period.get('effective_to') >= selected_text)]
    substitutions = await db.teacher_substitutions.find(branch_scope(branch_id, {'date': selected_text})).to_list(2000)
    substitutions_by_period = {item.get('period_id'): item for item in substitutions}
    teachers = await db.teachers.find(branch_scope(branch_id)).sort('name', 1).to_list(1000)
    absent_ids = {item.get('person_id') for item in approved_teacher_leaves if item.get('person_id')}
    absent_names = {str(item.get('name', '')).strip().lower() for item in approved_teacher_leaves}

    affected = []
    teacher_summary = {}
    for leave in approved_teacher_leaves:
        leave_id = leave.get('person_id', '')
        leave_name = str(leave.get('name', '')).strip()
        matches = [period for period in day_periods if
                   (leave_id and period.get('teacher_id') == leave_id) or
                   (leave_name and str(period.get('teacher_name', '')).strip().lower() == leave_name.lower())]
        if not matches:
            continue
        teacher_summary[leave_id or leave_name.lower()] = {
            'teacher_id': leave_id, 'teacher_name': leave_name,
            'leave_type': leave.get('leave_type', 'Approved leave'),
            'reason': leave.get('reason', ''), 'period_count': len(matches),
        }
        for period in matches:
            current = substitutions_by_period.get(period.get('id'))
            subject = str(period.get('subject', '')).strip().lower()
            subject_teachers = [teacher for teacher in teachers if str(teacher.get('subject', '')).strip().lower() == subject]
            candidate_pool = subject_teachers or teachers
            candidates = []
            for teacher in candidate_pool:
                teacher_id = teacher.get('id', '')
                teacher_name = str(teacher.get('name', '')).strip()
                if str(teacher.get('status', 'Active')).lower() != 'active' or teacher_id in absent_ids or teacher_name.lower() in absent_names:
                    continue
                regular_clash = any(
                    row.get('teacher_id') == teacher_id and row.get('id') != period.get('id') and
                    time_ranges_overlap(period.get('start_time'), period.get('end_time'), row.get('start_time'), row.get('end_time'))
                    for row in day_periods
                )
                substitution_clash = any(
                    item.get('substitute_teacher_id') == teacher_id and item.get('period_id') != period.get('id') and
                    any(row.get('id') == item.get('period_id') and time_ranges_overlap(period.get('start_time'), period.get('end_time'), row.get('start_time'), row.get('end_time')) for row in day_periods)
                    for item in substitutions
                )
                if not regular_clash and not substitution_clash:
                    candidates.append({'id': teacher_id, 'name': teacher_name, 'subject': teacher.get('subject', '')})
            affected.append({
                **clean(period), 'leave_id': leave.get('id', ''), 'leave_type': leave.get('leave_type', ''),
                'leave_reason': leave.get('reason', ''), 'substitution': clean(current) if current else None,
                'available_substitutes': candidates,
            })

    return {
        'date': selected_text, 'day': weekday,
        'affected_teachers': list(teacher_summary.values()),
        'affected_periods': affected,
        'unassigned_periods': len([item for item in affected if not item.get('substitution')]),
    }

@api_router.post("/teacher-substitutions")
async def assign_teacher_substitution(payload: TeacherSubstitution, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator'})
    branch_id = x_branch_id or 'BR-MAIN'
    selected = parse_school_date(payload.date)
    period = await db.timetable_periods.find_one(branch_scope(branch_id, {'id': payload.period_id}))
    if not period:
        raise HTTPException(status_code=404, detail='The affected timetable period no longer exists.')
    calendar_status = await attendance_day_status(payload.date, branch_id)
    if not calendar_status['is_working_day']:
        raise HTTPException(status_code=422, detail=f"A substitute cannot be assigned on this date: {calendar_status['reason']}.")
    if period.get('day') != selected.strftime('%A') or (period.get('effective_from') and payload.date < period.get('effective_from')) or (period.get('effective_to') and payload.date > period.get('effective_to')):
        raise HTTPException(status_code=422, detail='This timetable period is not active on the selected date.')
    leave_rows = await db.leaves.find(branch_scope(branch_id, {
        'person_type': 'Teacher', 'status': 'Approved',
        'from_date': {'$lte': payload.date}, 'to_date': {'$gte': payload.date},
    })).to_list(500)
    absent = any(
        (item.get('person_id') and item.get('person_id') == period.get('teacher_id')) or
        str(item.get('name') or '').strip().lower() == str(period.get('teacher_name') or '').strip().lower()
        for item in leave_rows
    )
    if not absent:
        raise HTTPException(status_code=409, detail='The allocated teacher does not have approved leave on this date.')
    teacher = await db.teachers.find_one(branch_scope(branch_id, {'id': payload.substitute_teacher_id}))
    if not teacher or str(teacher.get('status', 'Active')).lower() != 'active':
        raise HTTPException(status_code=422, detail='Choose an active substitute teacher.')
    if teacher.get('id') == period.get('teacher_id'):
        raise HTTPException(status_code=422, detail='Choose a different teacher as the substitute.')

    weekday = selected.strftime('%A')
    day_periods = await db.timetable_periods.find(branch_scope(branch_id, {'day': weekday, 'teacher_id': teacher.get('id')})).to_list(1000)
    if any(time_ranges_overlap(period.get('start_time'), period.get('end_time'), row.get('start_time'), row.get('end_time')) for row in day_periods):
        raise HTTPException(status_code=409, detail=f"{teacher.get('name')} already has a class during this period.")
    existing_substitutions = await db.teacher_substitutions.find(branch_scope(branch_id, {'date': payload.date, 'substitute_teacher_id': teacher.get('id'), 'period_id': {'$ne': payload.period_id}})).to_list(1000)
    existing_period_ids = [item.get('period_id') for item in existing_substitutions]
    existing_periods = await db.timetable_periods.find(branch_scope(branch_id, {'id': {'$in': existing_period_ids}})).to_list(1000) if existing_period_ids else []
    if any(time_ranges_overlap(period.get('start_time'), period.get('end_time'), row.get('start_time'), row.get('end_time')) for row in existing_periods):
        raise HTTPException(status_code=409, detail=f"{teacher.get('name')} is already covering another class during this period.")

    doc = {
        'id': str(uuid.uuid4()), 'period_id': payload.period_id, 'date': payload.date,
        'absent_teacher_id': period.get('teacher_id', ''), 'absent_teacher_name': period.get('teacher_name', ''),
        'substitute_teacher_id': teacher.get('id', ''), 'substitute_teacher_name': teacher.get('name', ''),
        'class_name': period.get('class_name', ''), 'section': period.get('section', ''),
        'subject': period.get('subject', ''), 'start_time': period.get('start_time', ''), 'end_time': period.get('end_time', ''),
        'note': payload.note.strip(), 'status': 'Assigned', 'assigned_by': ROLE_CONFIG[role]['name'],
        'updated': datetime.utcnow().isoformat(), 'branch_id': branch_id,
    }
    await db.teacher_substitutions.update_one(branch_scope(branch_id, {'period_id': payload.period_id, 'date': payload.date}), {'$set': doc}, upsert=True)
    await add_event('success', 'Substitute teacher assigned', f"{teacher.get('name')} will cover {period.get('subject')} for {period.get('class_name')} {period.get('section')} on {payload.date}.")
    return doc

# ---------------- Inventory ----------------
INVENTORY_CATEGORIES = ['Textbooks & Workbooks', 'Stationery', 'Laboratory', 'Sports', 'IT & Electronics', 'Furniture & Fixtures', 'Uniforms', 'Transport', 'Housekeeping', 'Other']

def inventory_stock_status(item: dict) -> str:
    quantity = int(item.get('quantity') or 0)
    reorder_level = int(item.get('reorder_level') or 0)
    if quantity <= 0:
        return 'Out of Stock'
    if reorder_level and quantity <= reorder_level:
        return 'Low Stock'
    return 'In Stock'

def inventory_public(item: dict) -> dict:
    row = clean(item)
    row['stock_status'] = inventory_stock_status(row)
    row['stock_value'] = round(float(row.get('quantity') or 0) * float(row.get('unit_price') or 0), 2)
    return row

@api_router.get("/inventory/items")
async def list_inventory_items(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin'})
    rows = await db.inventory_items.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('item_name', 1).to_list(2000)
    return [inventory_public(row) for row in rows]

@api_router.post("/inventory/items")
async def create_inventory_item(item: InventoryItem, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin'})
    branch_id = x_branch_id or 'BR-MAIN'
    name = item.item_name.strip()
    if not name:
        raise HTTPException(status_code=422, detail='Enter an item name.')
    if item.sku.strip() and await db.inventory_items.find_one(branch_scope(branch_id, {'sku': item.sku.strip()})):
        raise HTTPException(status_code=409, detail='This SKU already exists. Use a unique SKU for each stock item.')
    doc = item.dict()
    doc['item_name'] = name
    doc['sku'] = doc['sku'].strip()
    doc['created'] = datetime.utcnow().isoformat()
    doc['updated'] = doc['created']
    doc['branch_id'] = branch_id
    await db.inventory_items.insert_one(dict(doc))
    await db.inventory_transactions.insert_one({
        'id': str(uuid.uuid4()), 'item_id': doc['id'], 'item_name': doc['item_name'], 'category': doc['category'],
        'transaction_type': 'Opening Stock', 'quantity': doc['quantity'], 'balance_after': doc['quantity'],
        'unit': doc['unit'], 'reference': 'Initial stock entry', 'issue_to': '', 'recipient': '', 'notes': doc['notes'],
        'created': doc['created'], 'recorded_by': ROLE_CONFIG.get(role, {}).get('name', role), 'branch_id': branch_id,
    })
    await add_event('info', 'Inventory item added', f"{doc['item_name']} was added to the school inventory.", branch_id)
    return inventory_public(doc)

@api_router.put("/inventory/items/{item_id}")
async def update_inventory_item(item_id: str, item: InventoryItem, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin'})
    branch_id = x_branch_id or 'BR-MAIN'
    current = await db.inventory_items.find_one(branch_scope(branch_id, {'id': item_id}))
    if not current:
        raise HTTPException(status_code=404, detail='Inventory item not found.')
    duplicate_sku = item.sku.strip() and await db.inventory_items.find_one(branch_scope(branch_id, {'sku': item.sku.strip(), 'id': {'$ne': item_id}}))
    if duplicate_sku:
        raise HTTPException(status_code=409, detail='This SKU already exists. Use a unique SKU for each stock item.')
    doc = item.dict()
    doc['id'] = item_id
    doc['item_name'] = doc['item_name'].strip()
    doc['sku'] = doc['sku'].strip()
    doc['updated'] = datetime.utcnow().isoformat()
    doc['branch_id'] = branch_id
    await db.inventory_items.replace_one(branch_scope(branch_id, {'id': item_id}), doc)
    await add_event('info', 'Inventory item updated', f"Details for {doc['item_name']} were updated.", branch_id)
    return inventory_public(doc)

@api_router.post("/inventory/items/{item_id}/movement")
async def create_inventory_movement(item_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin'})
    branch_id = x_branch_id or 'BR-MAIN'
    item = await db.inventory_items.find_one(branch_scope(branch_id, {'id': item_id}))
    if not item:
        raise HTTPException(status_code=404, detail='Inventory item not found.')
    movement_type = str(payload.get('transaction_type') or '').strip()
    if movement_type not in ('Stock In', 'Issue'):
        raise HTTPException(status_code=422, detail='Choose Stock In or Issue.')
    try:
        quantity = int(payload.get('quantity') or 0)
    except (TypeError, ValueError):
        quantity = 0
    if quantity <= 0:
        raise HTTPException(status_code=422, detail='Enter a quantity greater than zero.')
    if movement_type == 'Issue' and quantity > int(item.get('quantity') or 0):
        raise HTTPException(status_code=422, detail=f"Only {item.get('quantity', 0)} {item.get('unit', 'units')} are currently available.")
    if movement_type == 'Issue' and not str(payload.get('issue_to') or '').strip():
        raise HTTPException(status_code=422, detail='Choose where these items are being issued.')
    new_quantity = int(item.get('quantity') or 0) + quantity if movement_type == 'Stock In' else int(item.get('quantity') or 0) - quantity
    now = datetime.utcnow().isoformat()
    await db.inventory_items.update_one(branch_scope(branch_id, {'id': item_id}), {'$set': {'quantity': new_quantity, 'updated': now}})
    transaction = {
        'id': str(uuid.uuid4()), 'item_id': item_id, 'item_name': item.get('item_name', ''), 'category': item.get('category', ''),
        'transaction_type': movement_type, 'quantity': quantity, 'balance_after': new_quantity, 'unit': item.get('unit', 'Units'),
        'reference': str(payload.get('reference') or '').strip(), 'issue_to': str(payload.get('issue_to') or '').strip(),
        'recipient': str(payload.get('recipient') or '').strip(), 'notes': str(payload.get('notes') or '').strip(),
        'created': now, 'recorded_by': ROLE_CONFIG.get(role, {}).get('name', role), 'branch_id': branch_id,
    }
    await db.inventory_transactions.insert_one(dict(transaction))
    action_text = 'received into stock' if movement_type == 'Stock In' else f"issued to {transaction['issue_to']}"
    await add_event('info', 'Inventory movement recorded', f"{quantity} {item.get('unit', 'units')} of {item.get('item_name')} were {action_text}.", branch_id)
    updated = await db.inventory_items.find_one(branch_scope(branch_id, {'id': item_id}))
    return {'item': inventory_public(updated), 'transaction': clean(transaction)}

@api_router.post("/inventory/items/{item_id}/purchase")
async def purchase_inventory_item(item_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    """Receive a purchased stock item and automatically record the outgoing payment."""
    require_roles(role, {'admin'})
    branch_id = x_branch_id or 'BR-MAIN'
    item = await db.inventory_items.find_one(branch_scope(branch_id, {'id': item_id}))
    if not item:
        raise HTTPException(status_code=404, detail='Inventory item not found.')
    try:
        quantity = int(payload.get('quantity') or 0)
        unit_cost = float(payload.get('unit_cost') or 0)
    except (TypeError, ValueError):
        quantity = 0; unit_cost = 0
    supplier = str(payload.get('supplier') or '').strip()
    purchase_date = str(payload.get('purchase_date') or '').strip()
    reference = str(payload.get('reference') or '').strip()
    if quantity <= 0 or unit_cost < 0 or not supplier or not purchase_date or not reference:
        raise HTTPException(status_code=422, detail='Choose the date, supplier, quantity and cost, and enter the PO or invoice number.')
    now = datetime.utcnow().isoformat()
    total = round(quantity * unit_cost, 2)
    new_quantity = int(item.get('quantity') or 0) + quantity
    item_category = str(item.get('category') or '')
    expense_category = 'Books & Academic' if item_category == 'Textbooks & Workbooks' else ('Stationery & Supplies' if item_category == 'Stationery' else 'Other')
    expense = {
        'id': str(uuid.uuid4()), 'expense_date': purchase_date, 'category': expense_category,
        'paid_to': supplier, 'description': f"Purchase: {quantity} {item.get('unit', 'Units')} of {item.get('item_name', '')}",
        'amount': total, 'payment_method': str(payload.get('payment_method') or 'Cash').strip(),
        'reference': reference, 'notes': str(payload.get('notes') or '').strip(),
        'status': 'Paid', 'source': 'Stock Purchase', 'approved_at': now, 'paid_at': now,
        'created': now, 'recorded_by': ROLE_CONFIG.get(role, {}).get('name', role), 'inventory_item_id': item_id, 'branch_id': branch_id,
    }
    await db.expenses.insert_one(dict(expense))
    await db.inventory_items.update_one(branch_scope(branch_id, {'id': item_id}), {'$set': {'quantity': new_quantity, 'unit_price': unit_cost, 'supplier': supplier, 'updated': now}})
    transaction = {
        'id': str(uuid.uuid4()), 'item_id': item_id, 'item_name': item.get('item_name', ''), 'category': item_category,
        'transaction_type': 'Purchase Received', 'quantity': quantity, 'balance_after': new_quantity,
        'unit': item.get('unit', 'Units'), 'reference': expense['reference'], 'issue_to': '', 'recipient': supplier,
        'notes': expense['notes'], 'created': now, 'recorded_by': ROLE_CONFIG.get(role, {}).get('name', role),
        'expense_id': expense['id'], 'branch_id': branch_id,
    }
    await db.inventory_transactions.insert_one(dict(transaction))
    await add_event('success', 'Stock purchased and expense recorded', f"{quantity} {item.get('unit', 'units')} of {item.get('item_name')} were received; ₹{total:,.2f} was recorded as an expense.", branch_id)
    return {'item': inventory_public(await db.inventory_items.find_one(branch_scope(branch_id, {'id': item_id}))), 'expense': clean(expense), 'transaction': clean(transaction)}

@api_router.post("/inventory/items/{item_id}/issue-to-parent")
async def issue_inventory_to_parent(item_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    """Issue a stocked book/item to a parent and create a matching student fee head."""
    require_roles(role, {'admin'})
    branch_id = x_branch_id or 'BR-MAIN'
    item = await db.inventory_items.find_one(branch_scope(branch_id, {'id': item_id}))
    if not item:
        raise HTTPException(status_code=404, detail='Inventory item not found.')
    student_id = str(payload.get('student_id') or '').strip()
    student = await db.students.find_one(branch_scope(branch_id, {'id': student_id}))
    if not student:
        raise HTTPException(status_code=422, detail='Choose the student receiving this item.')
    try:
        quantity = int(payload.get('quantity') or 0)
        unit_price = float(payload.get('unit_price') or 0)
    except (TypeError, ValueError):
        quantity = 0; unit_price = 0
    if quantity <= 0 or unit_price <= 0:
        raise HTTPException(status_code=422, detail='Enter a quantity and the amount to charge the parent.')
    if quantity > int(item.get('quantity') or 0):
        raise HTTPException(status_code=422, detail=f"Only {item.get('quantity', 0)} {item.get('unit', 'units')} are currently available.")
    now = datetime.utcnow().isoformat()
    total = round(quantity * unit_price, 2)
    new_quantity = int(item.get('quantity') or 0) - quantity
    issue_id = f"INV-ISSUE-{uuid.uuid4().hex[:10].upper()}"
    structure = await attendance_academic_structure(branch_id)
    academic_year = str(student.get('academic_year') or structure.get('academic_year') or '').strip()
    fee = {
        'id': f"FEE-{uuid.uuid4().hex[:8].upper()}", 'inventory_issue_id': issue_id, 'student_id': student_id,
        'name': student.get('name', ''), 'avatar': student.get('avatar', ''), 'fee_name': item.get('item_name', 'School Item'),
        'category': 'Books & Academic', 'description': f"{quantity} {item.get('unit', 'Units')} issued from school stock",
        'academic_year': academic_year, 'due_date': str(payload.get('due_date') or '').strip(),
        'total': total, 'paid': 0, 'discount': 0, 'due': total, 'status': 'Unpaid', 'created': now, 'branch_id': branch_id,
    }
    await db.fees.insert_one(dict(fee))
    await db.inventory_items.update_one(branch_scope(branch_id, {'id': item_id}), {'$set': {'quantity': new_quantity, 'updated': now}})
    transaction = {
        'id': str(uuid.uuid4()), 'item_id': item_id, 'item_name': item.get('item_name', ''), 'category': item.get('category', ''),
        'transaction_type': 'Issued to Parent', 'quantity': quantity, 'balance_after': new_quantity, 'unit': item.get('unit', 'Units'),
        'reference': str(payload.get('reference') or '').strip(), 'issue_to': 'Parent', 'recipient': student.get('name', ''),
        'notes': str(payload.get('notes') or '').strip(), 'created': now, 'recorded_by': ROLE_CONFIG.get(role, {}).get('name', role),
        'student_id': student_id, 'fee_id': fee['id'], 'inventory_issue_id': issue_id, 'branch_id': branch_id,
    }
    await db.inventory_transactions.insert_one(dict(transaction))
    await sync_student_fee_balance(student_id, branch_id)
    await add_event('success', 'Item issued to parent', f"{item.get('item_name')} was issued to {student.get('name')} and ₹{total:,.2f} was added to the student fee account.", branch_id)
    return {'item': inventory_public(await db.inventory_items.find_one(branch_scope(branch_id, {'id': item_id}))), 'fee': clean(fee), 'transaction': clean(transaction)}

@api_router.get("/inventory/transactions")
async def list_inventory_transactions(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin'})
    rows = await db.inventory_transactions.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('created', -1).to_list(3000)
    return [clean(row) for row in rows]

# ---------------- Expenses ----------------
@api_router.get("/expenses")
async def list_expenses(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    rows = await db.expenses.find(branch_scope(x_branch_id or 'BR-MAIN')).sort([('expense_date', -1), ('created', -1)]).to_list(3000)
    return [clean(row) for row in rows]

@api_router.post("/expenses")
async def create_expense(expense: ExpenseEntry, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    if not expense.expense_date.strip():
        raise HTTPException(status_code=422, detail='Choose the expense date.')
    if not expense.category.strip() or not expense.paid_to.strip() or not expense.description.strip():
        raise HTTPException(status_code=422, detail='Category, paid to and description are required.')
    doc = expense.dict()
    doc['paid_to'] = doc['paid_to'].strip()
    doc['description'] = doc['description'].strip()
    doc['category'] = doc['category'].strip()
    doc['reference'] = doc['reference'].strip()
    doc['notes'] = doc['notes'].strip()
    doc['created'] = datetime.utcnow().isoformat()
    doc['recorded_by'] = ROLE_CONFIG.get(role, {}).get('name', role)
    doc['status'] = 'Pending Approval'
    doc['source'] = 'Expense Request'
    doc['branch_id'] = branch_id
    await db.expenses.insert_one(dict(doc))
    await add_event('info', 'Expense submitted for approval', f"₹{doc['amount']:,.2f} was requested under {doc['category']}.", branch_id)
    return clean(doc)

@api_router.put("/expenses/{expense_id}/status")
async def update_expense_status(expense_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    branch_id = x_branch_id or 'BR-MAIN'
    expense = await db.expenses.find_one(branch_scope(branch_id, {'id': expense_id}))
    if not expense:
        raise HTTPException(status_code=404, detail='Expense entry not found.')
    next_status = str(payload.get('status') or '').strip()
    current_status = str(expense.get('status') or 'Paid')
    allowed = {
        'Pending Approval': {'Approved', 'Rejected'},
        'Approved': {'Paid', 'Rejected'},
        'Paid': set(),
        'Rejected': set(),
    }
    if next_status not in allowed.get(current_status, set()):
        raise HTTPException(status_code=422, detail=f'Cannot change this expense from {current_status} to {next_status}.')
    if next_status in {'Approved', 'Rejected'}:
        require_roles(role, {'admin', 'director'})
    elif next_status == 'Paid':
        require_roles(role, {'admin', 'fee_manager'})
    now = datetime.utcnow().isoformat()
    actor = ROLE_CONFIG.get(role, {}).get('name', role)
    updates = {'status': next_status, 'updated': now}
    if next_status == 'Approved':
        updates.update({'approved_at': now, 'approved_by': actor})
    elif next_status == 'Paid':
        updates.update({'paid_at': now, 'paid_by': actor})
    elif next_status == 'Rejected':
        updates.update({'rejected_at': now, 'rejected_by': actor, 'rejection_reason': str(payload.get('reason') or '').strip()})
    await db.expenses.update_one(branch_scope(branch_id, {'id': expense_id}), {'$set': updates})
    await add_event('success' if next_status in ('Approved', 'Paid') else 'info', f'Expense {next_status.lower()}', f"{expense.get('description', 'Expense')} is now {next_status.lower()}.", branch_id)
    return clean(await db.expenses.find_one(branch_scope(branch_id, {'id': expense_id})))

@api_router.get("/classroom-observations")
async def list_classroom_observations(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    docs = await db.classroom_observations.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('observation_date', -1).to_list(1000)
    return [clean(d) for d in docs]

@api_router.post("/classroom-observations")
async def create_classroom_observation(o: ClassroomObservation, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    if role not in ('admin', 'academic_coordinator'):
        raise HTTPException(status_code=403, detail='Only Admin or Academic Coordinator can record a classroom observation.')
    doc = o.dict()
    branch_id = x_branch_id or 'BR-MAIN'
    allocation = await db.teacher_allocations.find_one(branch_scope(branch_id, {'teacher_id': doc['teacher_id'], 'class_name': doc['class_name'], 'section': doc['section'], 'subject': doc['subject']}))
    if not allocation:
        raise HTTPException(status_code=422, detail='Select the teacher allocated to this exact class, section and subject.')
    if doc.get('observation_date') and doc['observation_date'] > datetime.utcnow().date().isoformat():
        raise HTTPException(status_code=422, detail='A classroom observation can only be recorded after the class visit.')
    participation_map = {'Active participation': 90, 'Needed prompting': 60, 'Disengaged': 30}
    verified_evidence = []
    seen_students = set()
    for evidence in doc.get('student_evidence') or []:
        student_id = str(evidence.get('student_id') or '').strip()
        rating = str(evidence.get('rating') or '').strip()
        if not student_id or student_id in seen_students:
            continue
        student = await db.students.find_one(branch_scope(branch_id, {'id': student_id, 'class_name': doc['class_name'], 'section': doc['section']}))
        if not student or not student_is_active_on(student, doc.get('observation_date', '')):
            raise HTTPException(status_code=422, detail='Every participation record must belong to the selected class and section.')
        if rating not in (*participation_map.keys(), 'Absent during observation'):
            raise HTTPException(status_code=422, detail='Choose a valid participation observation for every selected student.')
        seen_students.add(student_id)
        record = {'student_id': student_id, 'student_name': student.get('name', ''), 'rating': rating,
                  'participation_percent': participation_map.get(rating), 'recorded_at': datetime.utcnow().isoformat()}
        verified_evidence.append(record)
        if rating in participation_map:
            await db.academic_signals.update_one(
                branch_scope(branch_id, {'student_id': student_id}),
                {'$set': {'student_id': student_id, 'student_name': student.get('name', ''),
                          'participation_percent': participation_map[rating],
                          'participation_source': 'Classroom observation',
                          'participation_observation_date': doc.get('observation_date', ''),
                          'updated': datetime.utcnow().isoformat(), 'branch_id': branch_id}},
                upsert=True,
            )
    doc['student_evidence'] = verified_evidence
    doc['total_score'] = doc['plan_score'] + doc['behaviour_score'] + doc['engagement_score']
    doc['recorded_by'] = ROLE_CONFIG[role]['name']
    doc['created'] = datetime.utcnow().isoformat()
    doc['branch_id'] = branch_id
    await db.classroom_observations.insert_one(dict(doc))
    await add_event('info', 'Classroom observation added', f"Observation recorded for {doc['teacher_name']} in {doc['class_name']}.")
    if verified_evidence:
        await detect_academic_risks(create_cases=True, branch_id=branch_id)
    return doc

@api_router.put("/classroom-observations/{oid}")
async def update_classroom_observation(oid: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    if role not in ('admin', 'academic_coordinator'):
        raise HTTPException(status_code=403, detail='Only Admin or Academic Coordinator can update a classroom observation.')
    branch_id = x_branch_id or 'BR-MAIN'
    existing = await db.classroom_observations.find_one(branch_scope(branch_id, {'id': oid}))
    if not existing:
        raise HTTPException(status_code=404, detail='Classroom observation not found.')
    allowed = {'strengths', 'improvement_area', 'agreed_action', 'follow_up_date', 'feedback_status', 'notes',
               'teacher_ack_status', 'teacher_response', 'follow_up_score', 'follow_up_notes'}
    changes = {key: value for key, value in payload.items() if key in allowed}
    if changes.get('follow_up_score') in (None, ''):
        changes.pop('follow_up_score', None)
    else:
        try:
            changes['follow_up_score'] = int(changes['follow_up_score'])
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail='Follow-up score must be between 0 and 15.')
        if changes['follow_up_score'] < 0 or changes['follow_up_score'] > 15:
            raise HTTPException(status_code=422, detail='Follow-up score must be between 0 and 15.')
        changes['follow_up_delta'] = changes['follow_up_score'] - int(existing.get('total_score') or 0)
    if changes.get('feedback_status') in ('Shared', 'Completed') and not existing.get('feedback_shared_at'):
        changes['feedback_shared_at'] = datetime.utcnow().isoformat()
    if changes.get('teacher_ack_status') == 'Acknowledged' and not existing.get('teacher_acknowledged_at'):
        changes['teacher_acknowledged_at'] = datetime.utcnow().isoformat()
    changes['updated'] = datetime.utcnow().isoformat()
    await db.classroom_observations.update_one(branch_scope(branch_id, {'id': oid}), {'$set': changes})
    return clean(await db.classroom_observations.find_one(branch_scope(branch_id, {'id': oid})))

@api_router.delete("/classroom-observations/{oid}")
async def delete_classroom_observation(oid: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'academic_coordinator'})
    await db.classroom_observations.delete_one(branch_scope(x_branch_id or 'BR-MAIN', {'id': oid}))
    return {'ok': True}

@api_router.get("/teacher-performance")
async def teacher_performance(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    branch_id = x_branch_id or 'BR-MAIN'
    teachers = [clean(d) for d in await db.teachers.find(branch_scope(branch_id)).to_list(1000)]
    observations = [clean(d) for d in await db.classroom_observations.find(branch_scope(branch_id)).to_list(1000)]
    by_teacher = {}
    for o in observations:
        key = o.get('teacher_id') or o.get('teacher_name')
        by_teacher.setdefault(key, []).append(o)
    rows = []
    for teacher in teachers:
        key = teacher.get('id') or teacher.get('name')
        records = by_teacher.get(key, [])
        observation_average = round(sum(x.get('follow_up_score') if x.get('follow_up_score') is not None else x.get('total_score', 0) for x in records) / len(records), 1) if records else 0
        score = round((observation_average / 15) * 100, 1) if records else 0
        rows.append({'teacher_id': teacher.get('id'), 'teacher_name': teacher.get('name'),
                     'subject': teacher.get('subject', ''), 'observations': len(records),
                     'observation_average': observation_average, 'performance_score': score})
    rows.sort(key=lambda x: x['performance_score'], reverse=True)
    return {'rows': rows, 'doing_well': [x for x in rows if x['performance_score'] >= 75],
            'needs_support': [x for x in rows if x['observations'] and x['performance_score'] < 75]}

# ---------------- Multi Branch Management ----------------
BRANCH_VIEW_ROLES = {'admin', 'director'}

def branch_scope(branch_id: str, extra: Optional[dict] = None) -> dict:
    """Current untagged ERP records belong to the Main Campus."""
    if branch_id == 'BR-MAIN':
        scope = {'$or': [
            {'branch_id': 'BR-MAIN'}, {'branch_id': {'$exists': False}},
            {'branch_id': ''}, {'branch_id': None},
        ]}
    else:
        scope = {'branch_id': branch_id}
    return {'$and': [scope, extra]} if extra else scope

async def get_role_branch_ids(role: str) -> List[str]:
    """Resolve the campuses a staff login can open.

    Admin and Director are network roles. Operational demo roles are deliberately
    restricted to Main Campus until Admin assigns additional campuses.
    """
    if role in BRANCH_VIEW_ROLES:
        return ['*']
    assignment = await db.branch_access_assignments.find_one({'role': role}) or {}
    branch_ids = [str(item) for item in assignment.get('branch_ids') or [] if str(item).strip()]
    return branch_ids or ['BR-MAIN']

async def ensure_branch_capacity(branch_id: str, exclude_student_id: str = ''):
    branch = await db.branches.find_one({'id': branch_id})
    if not branch or int(branch.get('capacity') or 0) <= 0:
        return
    query = branch_scope(branch_id)
    rows = await db.students.find(query).to_list(10000)
    active_count = sum(1 for row in rows if row.get('id') != exclude_student_id and student_is_active_on(row))
    if active_count >= int(branch.get('capacity') or 0):
        raise HTTPException(status_code=409, detail=f"{branch.get('name', 'The selected branch')} has reached its student capacity. Increase capacity or choose another campus.")

async def ensure_main_branch() -> dict:
    structure = await db.academic_structure.find_one({'id': 'school-structure'}) or {}
    document = {
        'id': 'BR-MAIN', 'name': 'Orison Main Campus', 'code': 'ORI-MAIN',
        'city': 'Hyderabad', 'address': '', 'phone': '', 'email': '',
        'principal_name': 'Principal', 'academic_year': structure.get('academic_year', ''),
        'board': 'CBSE', 'capacity': 0, 'status': 'Active',
        'created': datetime.utcnow().isoformat(), 'created_by': 'System',
    }
    await db.branches.update_one({'id': 'BR-MAIN'}, {'$setOnInsert': document}, upsert=True)
    branch = await db.branches.find_one({'id': 'BR-MAIN'}) or document
    if structure.get('academic_year') and branch.get('academic_year') != structure.get('academic_year'):
        await db.branches.update_one({'id': 'BR-MAIN'}, {'$set': {'academic_year': structure.get('academic_year')}})
        branch['academic_year'] = structure.get('academic_year')
    return clean(branch)

async def branch_metrics(branch: dict) -> dict:
    branch_id = branch['id']
    people_query = branch_scope(branch_id, {'status': {'$ne': 'Inactive'}})
    student_rows = await db.students.find(branch_scope(branch_id)).to_list(10000)
    students = sum(1 for student in student_rows if student_is_active_on(student))
    teachers = await db.teachers.count_documents(people_query)
    staff = await db.staff.count_documents(people_query)

    fees = await db.fees.find(branch_scope(branch_id)).to_list(10000)
    expected = round(sum(float(item.get('total') or 0) for item in fees), 2)
    collected = round(sum(float(item.get('paid') or 0) for item in fees), 2)
    outstanding = round(sum(float(item.get('due') or 0) for item in fees), 2)
    collection_efficiency = round((collected / expected) * 100, 1) if expected else 0
    today = datetime.utcnow().strftime('%Y-%m-%d')
    overdue = len([item for item in fees if float(item.get('due') or 0) > 0 and item.get('due_date') and item.get('due_date') < today])

    period = datetime.utcnow().strftime('%Y-%m')
    attendance = await db.attendance_records.find(branch_scope(branch_id, {
        'attendance_role': 'student', 'attendance_date': {'$regex': f'^{period}'},
    })).to_list(20000)
    attendance_present = len([item for item in attendance if item.get('status') in {'Present', 'Late'}])
    attendance_rate = round(attendance_present / len(attendance) * 100, 1) if attendance else None
    attendance_today = len([item for item in attendance if item.get('attendance_date') == today])

    mark_sets = await db.marks_sets.find(branch_scope(branch_id, {'status': 'Published'})).to_list(5000)
    percentages = []
    for mark_set in mark_sets:
        total_max = float(mark_set.get('total_max') or 100)
        if total_max <= 0:
            continue
        for row in mark_set.get('rows') or []:
            percentages.append(float(row.get('total') or 0) / total_max * 100)
    academic_average = round(sum(percentages) / len(percentages), 1) if percentages else None

    expenses = await db.expenses.find(branch_scope(branch_id)).to_list(10000)
    total_expenses = round(sum(float(item.get('amount') or 0) for item in expenses), 2)
    try:
        low_stock = await db.inventory_items.count_documents(branch_scope(branch_id, {'$expr': {'$lte': ['$quantity', '$reorder_level']}}))
    except Exception:  # fall back if the database rejects $expr or fields are missing
        items = await db.inventory_items.find(branch_scope(branch_id)).to_list(10000)
        low_stock = sum(1 for item in items if float(item.get('quantity') or 0) <= float(item.get('reorder_level') or 0))
    transport_routes = await db.transport_routes.count_documents(branch_scope(branch_id))
    pending_approvals = await db.director_approval_requests.count_documents(branch_scope(branch_id, {'status': 'Pending'}))

    if branch_id == 'BR-MAIN':
        structure = await db.academic_structure.find_one({'id': 'school-structure'}) or {}
    else:
        structure = await db.branch_academic_structures.find_one({'branch_id': branch_id}) or {}
    classes = structure.get('classes') or []
    sections = sum(len(item.get('sections') or []) for item in classes)
    fee_structures = await db.fee_structures.count_documents(branch_scope(branch_id))
    setup_checks = [
        {'key': 'profile', 'label': 'Branch profile and location', 'complete': bool(branch.get('name') and branch.get('code') and branch.get('city'))},
        {'key': 'leadership', 'label': 'Principal / branch head assigned', 'complete': bool(branch.get('principal_name'))},
        {'key': 'academics', 'label': 'Academic year, classes and sections', 'complete': bool(branch.get('academic_year') and classes and sections)},
        {'key': 'people', 'label': 'Teachers and staff added', 'complete': bool(teachers or staff)},
        {'key': 'finance', 'label': 'Fee structure configured', 'complete': bool(fee_structures)},
    ]
    setup_progress = round(sum(1 for item in setup_checks if item['complete']) / len(setup_checks) * 100)
    capacity = int(branch.get('capacity') or 0)
    occupancy = round(students / capacity * 100, 1) if capacity else None

    score_inputs = []
    if attendance_rate is not None: score_inputs.append(attendance_rate)
    if expected: score_inputs.append(collection_efficiency)
    if academic_average is not None: score_inputs.append(academic_average)
    health_score = round(sum(score_inputs) / len(score_inputs)) if score_inputs else setup_progress
    risks = []
    if overdue: risks.append({'level': 'High', 'label': f'{overdue} overdue fee account(s)'})
    if attendance_rate is not None and attendance_rate < 75: risks.append({'level': 'High', 'label': f'Attendance is {attendance_rate}%'})
    if low_stock: risks.append({'level': 'Medium', 'label': f'{low_stock} stock item(s) need attention'})
    if occupancy is not None and occupancy >= 100: risks.append({'level': 'High', 'label': 'Student capacity has been reached'})
    elif occupancy is not None and occupancy >= 90: risks.append({'level': 'Medium', 'label': f'Campus is at {occupancy}% capacity'})
    if not risks and students: risks.append({'level': 'Clear', 'label': 'No critical operational risk'})
    if not students: risks.append({'level': 'Setup', 'label': 'Complete setup before admitting students'})

    return {
        **clean(branch), 'students': students, 'teachers': teachers, 'staff': staff,
        'people': teachers + staff, 'classes': len(classes), 'sections': sections,
        'fees_expected': expected, 'fees_collected': collected, 'outstanding': outstanding,
        'collection_efficiency': collection_efficiency, 'overdue_accounts': overdue,
        'attendance_rate': attendance_rate, 'attendance_marked_today': attendance_today,
        'attendance_records': len(attendance), 'attendance_present': attendance_present,
        'academic_average': academic_average, 'expenses': total_expenses,
        'low_stock': low_stock, 'transport_routes': transport_routes,
        'pending_approvals': pending_approvals, 'setup_progress': setup_progress,
        'setup_checks': setup_checks, 'health_score': health_score, 'risks': risks,
        'capacity': capacity, 'occupancy': occupancy, 'metric_period': period,
        'app_connections': [
            {'name': 'Parent App', 'purpose': 'Attendance, fees, homework, transport and notices'},
            {'name': 'Teacher App', 'purpose': 'Assigned classes, attendance, timetable and academics'},
            {'name': 'Director App', 'purpose': 'Branch comparison, risk and approval decisions'},
        ],
    }

@api_router.get('/branches/network')
async def branch_network(role: str = Depends(get_current)):
    if role not in BRANCH_VIEW_ROLES:
        raise HTTPException(status_code=403, detail='Multi Branch Management is available to Admin and Director.')
    await ensure_main_branch()
    documents = await db.branches.find().sort([('status', 1), ('name', 1)]).to_list(500)
    rows = [await branch_metrics(clean(item)) for item in documents]
    active = [item for item in rows if item.get('status') == 'Active']
    total_expected = sum(item['fees_expected'] for item in rows)
    total_collected = sum(item['fees_collected'] for item in rows)
    total_attendance = sum(item.get('attendance_records', 0) for item in rows)
    total_present = sum(item.get('attendance_present', 0) for item in rows)
    return {
        'summary': {
            'branches': len(rows), 'active_branches': len(active),
            'students': sum(item['students'] for item in rows),
            'people': sum(item['people'] for item in rows),
            'fees_expected': round(total_expected, 2), 'fees_collected': round(total_collected, 2),
            'outstanding': round(sum(item.get('outstanding', 0) for item in rows), 2),
            'collection_efficiency': round(total_collected / total_expected * 100, 1) if total_expected else 0,
            'attendance_rate': round(total_present / total_attendance * 100, 1) if total_attendance else None,
            'pending_approvals': sum(item['pending_approvals'] for item in rows),
        },
        'branches': rows,
        'governance': {
            'admin': 'Creates branches, completes setup and controls branch access.',
            'director': 'Compares every branch and handles management approvals.',
            'academic_coordinator': 'Owns academic delivery for the assigned branch.',
            'fee_manager': 'Owns branch billing, collection and follow-up.',
        },
    }

@api_router.post('/branches')
async def create_branch(branch: SchoolBranch, role: str = Depends(get_current)):
    if role != 'admin':
        raise HTTPException(status_code=403, detail='Only Admin can create a branch.')
    document = branch.dict()
    document['name'] = document['name'].strip()
    document['code'] = document['code'].strip().upper()
    document['city'] = document['city'].strip()
    if not document['name'] or not document['code'] or not document['city']:
        raise HTTPException(status_code=422, detail='Branch name, unique branch code and city are required.')
    if await db.branches.find_one({'$or': [{'code': document['code']}, {'name': {'$regex': f"^{document['name']}$", '$options': 'i'}}]}):
        raise HTTPException(status_code=409, detail='A branch with this name or code already exists.')
    document['status'] = 'Setup'
    document['created'] = datetime.utcnow().isoformat()
    document['created_by'] = ROLE_CONFIG[role]['name']
    await db.branches.insert_one(dict(document))
    await add_event('info', 'New branch created', f"{document['name']} was created in Setup mode.")
    return await branch_metrics(clean(document))

@api_router.put('/branches/{branch_id}')
async def update_branch(branch_id: str, payload: dict, role: str = Depends(get_current)):
    if role != 'admin':
        raise HTTPException(status_code=403, detail='Only Admin can update branch setup.')
    branch = await db.branches.find_one({'id': branch_id})
    if not branch:
        raise HTTPException(status_code=404, detail='Branch not found.')
    allowed = {'name', 'city', 'address', 'phone', 'email', 'principal_name', 'academic_year', 'board', 'capacity', 'status'}
    update = {key: payload.get(key) for key in allowed if key in payload}
    if update.get('status') not in {None, 'Setup', 'Active', 'Suspended'}:
        raise HTTPException(status_code=422, detail='Choose Setup, Active or Suspended.')
    if update.get('status') == 'Active':
        metrics = await branch_metrics(clean(branch))
        incomplete = [item['label'] for item in metrics.get('setup_checks', []) if not item.get('complete')]
        if incomplete:
            raise HTTPException(status_code=422, detail=f"Complete branch readiness before activation: {', '.join(incomplete)}.")
    if update.get('status') == 'Suspended' and not str(payload.get('status_reason') or '').strip():
        raise HTTPException(status_code=422, detail='Add a reason before suspending a branch.')
    update['updated'] = datetime.utcnow().isoformat()
    audit = {'at': update['updated'], 'by': ROLE_CONFIG[role]['name'], 'action': 'Branch setup updated', 'changes': list(update.keys()), 'reason': str(payload.get('status_reason') or '').strip()}
    await db.branches.update_one({'id': branch_id}, {'$set': update, '$push': {'audit_history': audit}})
    return await branch_metrics(clean(await db.branches.find_one({'id': branch_id})))

@api_router.get('/branches/{branch_id}')
async def get_branch(branch_id: str, role: str = Depends(get_current)):
    if role not in BRANCH_VIEW_ROLES:
        raise HTTPException(status_code=403, detail='Multi Branch Management is available to Admin and Director.')
    await ensure_main_branch()
    branch = await db.branches.find_one({'id': branch_id})
    if not branch:
        raise HTTPException(status_code=404, detail='Branch not found.')
    return await branch_metrics(clean(branch))

@api_router.get('/branch-access-assignments')
async def list_branch_access_assignments(role: str = Depends(get_current)):
    if role not in BRANCH_VIEW_ROLES:
        raise HTTPException(status_code=403, detail='Only Admin and Director can view branch access.')
    rows = [clean(row) for row in await db.branch_access_assignments.find().to_list(100)]
    saved = {row.get('role'): row for row in rows}
    return [
        saved.get(key) or {'role': key, 'branch_ids': ['BR-MAIN'], 'updated': '', 'updated_by': ''}
        for key in ('academic_coordinator', 'fee_manager')
    ]

@api_router.put('/branch-access-assignments/{staff_role}')
async def save_branch_access_assignment(staff_role: str, payload: dict, role: str = Depends(get_current)):
    if role != 'admin':
        raise HTTPException(status_code=403, detail='Only Admin can change branch access.')
    if staff_role not in {'academic_coordinator', 'fee_manager'}:
        raise HTTPException(status_code=422, detail='Choose an operational staff role.')
    branch_ids = list(dict.fromkeys(str(item).strip() for item in payload.get('branch_ids') or [] if str(item).strip()))
    if not branch_ids:
        raise HTTPException(status_code=422, detail='Assign at least one branch.')
    available = {row.get('id') for row in await db.branches.find({'id': {'$in': branch_ids}, 'status': {'$ne': 'Suspended'}}).to_list(500)}
    if set(branch_ids) != available:
        raise HTTPException(status_code=422, detail='One or more selected branches are unavailable or suspended.')
    record = {
        'role': staff_role, 'branch_ids': branch_ids,
        'updated': datetime.utcnow().isoformat(), 'updated_by': ROLE_CONFIG[role]['name'],
    }
    await db.branch_access_assignments.update_one({'role': staff_role}, {'$set': record}, upsert=True)
    return record

# ---------------- Global Search ----------------
@api_router.get("/search")
async def search(q: str = "", role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    q = (q or "").strip()
    if not q:
        return {'students': [], 'teachers': [], 'classes': []}
    rx = {'$regex': q, '$options': 'i'}
    students = await db.students.find(branch_scope(x_branch_id, {'$or': [{'name': rx}, {'id': rx}, {'class_name': rx}]})).to_list(8)
    teachers = await db.teachers.find(branch_scope(x_branch_id, {'$or': [{'name': rx}, {'subject': rx}]})).to_list(8)
    # classes derived from students
    all_students = await db.students.find(branch_scope(x_branch_id)).to_list(1000)
    classes = sorted({s.get('class_name', '') for s in all_students if q.lower() in s.get('class_name', '').lower() and s.get('class_name')})
    return {
        'students': [{'id': s['id'], 'name': s['name'], 'class_name': s.get('class_name', ''), 'avatar': s.get('avatar', '')} for s in students],
        'teachers': [{'id': t['id'], 'name': t['name'], 'subject': t.get('subject', ''), 'avatar': t.get('avatar', '')} for t in teachers],
        'classes': [{'name': c} for c in classes],
    }

# ---------------- Analytics ----------------
@api_router.get("/analytics/dashboard")
async def analytics_dashboard(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    now = datetime.utcnow()
    today = now.date()
    today_key = today.isoformat()
    active_query = branch_scope(x_branch_id, {'status': {'$ne': 'Inactive'}})
    students = await db.students.find(active_query).to_list(5000)
    teachers = await db.teachers.find(active_query).to_list(2000)
    staff = await db.staff.find(active_query).to_list(2000)
    fees = await db.fees.find(branch_scope(x_branch_id)).to_list(10000)
    receipts = await db.fee_receipts.find(branch_scope(x_branch_id)).sort('paid_at', -1).to_list(10000)
    structure = await db.academic_structure.find_one({'id': 'school-structure'}) or {}

    expected = round(sum(float(item.get('total') or 0) for item in fees), 2)
    collected = round(sum(float(item.get('paid') or 0) for item in fees), 2)
    outstanding = round(sum(float(item.get('due') or 0) for item in fees), 2)
    collection_efficiency = round(collected / expected * 100, 1) if expected else 0
    overdue_fees = [item for item in fees if float(item.get('due') or 0) > 0 and item.get('due_date') and item.get('due_date') < today_key]

    today_attendance = await db.attendance_records.find({
        'attendance_role': 'student', 'attendance_date': today_key,
    }).to_list(10000)
    marked_student_ids = {item.get('entity_id') for item in today_attendance if item.get('entity_id')}
    present_today = len([item for item in today_attendance if item.get('status') in {'Present', 'Late'}])
    absent_today = len([item for item in today_attendance if item.get('status') == 'Absent'])
    attendance_rate = round(present_today / len(today_attendance) * 100, 1) if today_attendance else None
    unmarked_today = max(0, len(students) - len(marked_student_ids))

    attendance_trend = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        day_key = day.isoformat()
        records = await db.attendance_records.find({
            'attendance_role': 'student', 'attendance_date': day_key,
        }).to_list(10000)
        present = len([item for item in records if item.get('status') in {'Present', 'Late'}])
        attendance_trend.append({
            'date': day_key, 'day': day.strftime('%a'), 'marked': len(records),
            'present': present, 'absent': len([item for item in records if item.get('status') == 'Absent']),
            'rate': round(present / len(records) * 100, 1) if records else None,
        })

    month_keys = []
    for offset in range(5, -1, -1):
        month_number = now.month - offset
        year = now.year
        while month_number <= 0:
            month_number += 12
            year -= 1
        month_keys.append((f'{year:04d}-{month_number:02d}', datetime(year, month_number, 1).strftime('%b')))
    monthly_totals = {key: 0 for key, _ in month_keys}
    for receipt in receipts:
        paid_at = str(receipt.get('paid_at') or '')
        month_key = paid_at[:7]
        if month_key in monthly_totals:
            monthly_totals[month_key] += float(receipt.get('amount') or 0)
    fees_trend = [
        {'month': label, 'amount': round(monthly_totals[key], 2)}
        for key, label in month_keys
    ]

    pending_leaves = await db.leaves.count_documents({'status': 'Pending'})
    pending_approvals = sum([
        await db.director_approval_requests.count_documents({'status': 'Pending'}),
        await db.academic_year_change_requests.count_documents({'status': 'Pending'}),
        await db.fee_edit_requests.count_documents({'status': 'Pending'}),
    ])
    curriculum_units = await db.curriculum_units.find().to_list(5000)
    syllabus_behind = len([
        item for item in curriculum_units
        if item.get('status') == 'Overdue' or (
            item.get('target_date') and item.get('target_date') < today_key and item.get('status') != 'Completed'
        )
    ])
    interventions_open = await db.interventions.count_documents({'status': {'$ne': 'Completed'}})
    upcoming_exams = await db.exams.count_documents({'date': {'$gte': today_key}, 'status': {'$ne': 'Draft'}})

    classes = structure.get('classes') or []
    sections = sum(len(item.get('sections') or []) for item in classes)
    subject_slots = sum(
        len(section.get('subjects') or [])
        for class_item in classes for section in (class_item.get('sections') or [])
    )
    allocations = await db.teacher_allocations.count_documents({})
    allocation_coverage = round(min(100, allocations / subject_slots * 100), 1) if subject_slots else 0

    priorities = []
    if unmarked_today:
        priorities.append({'level': 'high', 'title': 'Attendance is still incomplete', 'detail': f'{unmarked_today} student(s) have no attendance status today.', 'value': unmarked_today, 'path': '/attendance/add'})
    if overdue_fees:
        priorities.append({'level': 'critical', 'title': 'Overdue fee follow-ups', 'detail': f'₹{sum(float(item.get("due") or 0) for item in overdue_fees):,.0f} needs collection action.', 'value': len(overdue_fees), 'path': '/collections'})
    if pending_approvals:
        priorities.append({'level': 'medium', 'title': 'Management approvals pending', 'detail': 'Requests are waiting for a Director decision.', 'value': pending_approvals, 'path': '/notifications'})
    if syllabus_behind:
        priorities.append({'level': 'medium', 'title': 'Syllabus timelines behind', 'detail': 'Chapter plans have crossed their target completion date.', 'value': syllabus_behind, 'path': '/academics/syllabus'})
    if pending_leaves:
        priorities.append({'level': 'low', 'title': 'Leave requests to review', 'detail': 'Teacher or staff leave requests are awaiting action.', 'value': pending_leaves, 'path': '/leave/requests'})
    if not priorities:
        priorities.append({'level': 'clear', 'title': 'School operations are on track', 'detail': 'No critical management action is waiting right now.', 'value': 0, 'path': '/management/action-center'})

    events = [clean(item) for item in await db.events.find().sort('created', -1).to_list(6)]
    return {
        'stats': {
            'students': len(students),
            'teachers': len(teachers),
            'staff': len(staff),
            'fees_collected': collected,
            'fees_expected': expected,
            'fees_outstanding': outstanding,
            'collection_efficiency': collection_efficiency,
            'attendance': attendance_rate,
            'present_today': present_today,
            'absent_today': absent_today,
            'attendance_marked': len(today_attendance),
            'attendance_unmarked': unmarked_today,
            'classes': len(classes),
            'sections': sections,
        },
        'academic_year': structure.get('academic_year') or 'Not configured',
        'attendance_trend': attendance_trend,
        'fees_trend': fees_trend,
        'priorities': priorities[:5],
        'academic_pulse': {
            'upcoming_exams': upcoming_exams,
            'syllabus_behind': syllabus_behind,
            'open_interventions': interventions_open,
            'teacher_allocation_coverage': allocation_coverage,
        },
        'operations': {
            'pending_approvals': pending_approvals,
            'pending_leaves': pending_leaves,
            'overdue_fee_accounts': len(overdue_fees),
        },
        'recent_activity': events,
        'generated_at': now.isoformat(),
    }

@api_router.get("/analytics/ai")
async def analytics_ai(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    branch_id = x_branch_id or 'BR-MAIN'
    # subject scores derived from saved marks sets (fallback to defaults)
    sets = await db.marks_sets.find(branch_scope(branch_id)).to_list(100)
    agg = {}
    for ms in sets:
        subj = (ms.get('subject') or 'Subject').split()[-1] if ms.get('subject') else 'Subject'
        tm = ms.get('total_max', 100) or 100
        for r in ms.get('rows', []):
            pct = (r.get('total', 0) / tm) * 100
            agg.setdefault(subj, []).append(pct)
    if agg:
        subject_scores = [{'subject': k, 'score': round(sum(v) / len(v))} for k, v in agg.items()]
    else:
        subject_scores = []
    students = len([student for student in await db.students.find(branch_scope(branch_id)).to_list(2000) if student_is_active_on(student)])
    risks = (await detect_academic_risks(branch_id=branch_id))['risks']
    return {
        'kpis': {'pass_rate': 0, 'at_risk': len(risks), 'engagement': 0, 'forecast_revenue': '₹0'},
        'performance_trend': [],
        'subject_scores': subject_scores,
        'risk_distribution': [{'name': 'Safe', 'value': max(0, students - len(risks))}, {'name': 'At-Risk', 'value': len(risks)}],
    }

# ---------------- Per-student detail ----------------
DEFAULT_SUBJECTS = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'Computer Science']

def grade_for(total):
    if total >= 90: return 'A+'
    if total >= 80: return 'A'
    if total >= 70: return 'B+'
    if total >= 60: return 'B'
    if total >= 40: return 'C'
    return 'F'

def build_attendance(sid):
    seed = sum(ord(c) for c in sid)
    absent = {(3 + seed % 5), (10 + seed % 3) + 7}
    late = {(1 + seed % 3), (16 + seed % 2)}
    days = []
    # July 2025 starts on Tuesday -> 2 leading blanks
    days += [{'day': None}, {'day': None}]
    for d in range(1, 32):
        idx = (d + 1) % 7  # 0=Sun ... after 2 blanks
        dow = (1 + d) % 7  # July1=Tue => index2
        col = (d + 1) % 7
        is_weekend = col in (0, 6)
        if is_weekend:
            days.append({'day': d, 'status': 'weekend'})
        elif d in absent:
            days.append({'day': d, 'status': 'absent'})
        elif d in late:
            days.append({'day': d, 'status': 'late'})
        else:
            days.append({'day': d, 'status': 'present'})
    while len(days) % 7 != 0:
        days.append({'day': None})
    working = len([x for x in days if x.get('status') and x['status'] != 'weekend'])
    present = len([x for x in days if x.get('status') == 'present'])
    late_c = len([x for x in days if x.get('status') == 'late'])
    absent_c = len([x for x in days if x.get('status') == 'absent'])
    rate = round((present + late_c) / working * 100, 1) if working else 0
    logs = [
        {'date': 'Jul 31, 2025', 'status': 'Present', 'in': '08:14 AM', 'out': '02:30 PM'},
        {'date': 'Jul 30, 2025', 'status': 'Present', 'in': '08:10 AM', 'out': '02:35 PM'},
        {'date': 'Jul 29, 2025', 'status': 'Present', 'in': '08:15 AM', 'out': '02:32 PM'},
        {'date': 'Jul 28, 2025', 'status': 'Present', 'in': '08:20 AM', 'out': '02:30 PM'},
        {'date': 'Jul 25, 2025', 'status': 'Absent', 'in': '--', 'out': '--'},
        {'date': 'Jul 24, 2025', 'status': 'Present', 'in': '08:12 AM', 'out': '02:31 PM'},
    ]
    return {
        'month': 'July 2025', 'days': days,
        'stats': {'rate': f"{rate}%", 'totalWorking': f"{working} days", 'totalPresent': f"{present} days",
                  'lateArrivals': f"{late_c} days", 'absentDays': f"{absent_c} days"},
        'logs': logs,
    }

async def build_marks_for(name, sid):
    rows = []
    sets = await db.marks_sets.find().to_list(100)
    for ms in sets:
        for r in ms.get('rows', []):
            if r.get('name', '').lower() == (name or '').lower():
                rows.append({'subject': ms.get('subject', 'Subject'),
                             'internal': r.get('practical', 0), 'external': r.get('written', 0),
                             'total': r.get('total', 0), 'grade': grade_for(r.get('total', 0))})
    # Preserve recorded marks and fill only subjects that do not yet have a
    # mark. Previously one saved English row prevented every other subject
    # from appearing in the grade sheet and performance chart.
    seed = sum(ord(c) for c in sid)
    base = 82 + seed % 12
    existing_subjects = {
        str(row.get('subject') or '').strip().casefold() for row in rows
    }
    for i, subj in enumerate(DEFAULT_SUBJECTS):
        if subj.casefold() in existing_subjects:
            continue
        total = min(99, base + ((seed + i * 7) % 15) - 5)
        internal = round(total * 0.28)
        rows.append({'subject': subj, 'internal': internal, 'external': total - internal,
                     'total': total, 'grade': grade_for(total)})
    return rows

async def build_subject_performance(student):
    """Return every class subject grouped by the month in which marks were recorded."""
    sid = student.get('id')
    name = (student.get('name') or '').strip().casefold()
    structure = await db.academic_structure.find_one({}) or {}
    configured_subjects = []
    for item in structure.get('classes', []):
        if item.get('name') != student.get('class_name'):
            continue
        for section in item.get('sections', []):
            if section.get('name') == student.get('section'):
                configured_subjects = [str(subject).strip() for subject in section.get('subjects', []) if str(subject).strip()]
                break

    month_scores = {}
    mark_sets = await db.marks_sets.find().sort('created', -1).to_list(5000)
    for mark_set in mark_sets:
        matching_row = next((row for row in mark_set.get('rows', []) if
                             (sid and row.get('student_id') == sid) or
                             ((row.get('name') or '').strip().casefold() == name)), None)
        if not matching_row:
            continue
        raw_date = str(mark_set.get('created') or mark_set.get('created_at') or '').strip()
        exam = await db.exams.find_one({'id': mark_set.get('exam_id')}) if mark_set.get('exam_id') else None
        raw_date = str((exam or {}).get('date') or raw_date).strip()
        try:
            parsed = datetime.fromisoformat(raw_date.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            parsed = datetime.utcnow()
        month_key = parsed.strftime('%Y-%m')
        total_max = float(mark_set.get('total_max') or 100)
        total = float(matching_row.get('total') or 0)
        subject = str(mark_set.get('subject') or 'Subject').strip()
        month_scores.setdefault(month_key, {}).setdefault(subject, []).append(
            round((total / total_max) * 100, 1) if total_max else 0
        )

    all_subjects = list(dict.fromkeys(configured_subjects or DEFAULT_SUBJECTS))
    for scores in month_scores.values():
        for subject in scores:
            if subject not in all_subjects:
                all_subjects.append(subject)

    # Demo schools may initially enter marks for only one subject. Keep those
    # real marks and complete the remaining subject/month points with stable
    # student-specific sample scores so the profile trend is useful immediately.
    today = datetime.utcnow()
    recent_months = []
    for offset in range(5, -1, -1):
        month_number = today.month - offset
        year = today.year
        while month_number <= 0:
            month_number += 12
            year -= 1
        recent_months.append(f'{year:04d}-{month_number:02d}')
    student_seed = sum(ord(char) for char in str(sid or name))
    for month_index, month_key in enumerate(recent_months):
        subject_map = month_scores.setdefault(month_key, {})
        for subject_index, subject in enumerate(all_subjects):
            if subject_map.get(subject):
                continue
            subject_seed = sum(ord(char) for char in subject)
            baseline = 62 + ((student_seed + subject_seed + subject_index * 7) % 22)
            movement = month_index * 2 + ((subject_seed + month_index) % 5) - 2
            subject_map[subject] = [max(40, min(98, baseline + movement))]

    months = []
    for month_key in sorted(month_scores, reverse=True):
        scores = month_scores[month_key]
        months.append({
            'key': month_key,
            'label': datetime.strptime(month_key, '%Y-%m').strftime('%B %Y'),
            'subjects': [
                {'subject': subject, 'score': round(sum(scores[subject]) / len(scores[subject]), 1) if scores.get(subject) else None}
                for subject in all_subjects
            ],
        })
    return months

@api_router.get("/students/{sid}/detail")
async def student_detail(sid: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    student = await db.students.find_one(branch_scope(x_branch_id, {'id': sid}))
    if not student:
        raise HTTPException(status_code=404, detail="Not found")
    student = clean(student)
    fee = await db.fees.find_one({'student_id': sid}) or await db.fees.find_one({'name': student.get('name')})
    due = fee.get('due', 0) if fee else 0
    pending = []
    if due > 0:
        pending = [
            {'checked': True, 'desc': 'Tuition Fee - Quarter 2', 'sub': 'Standard term tuition',
             'due': 'Oct 15, 2024', 'amount': f"\u20b9{due:,.2f}", 'status': 'OVERDUE'},
            {'checked': True, 'desc': 'Library Membership', 'sub': 'Annual digital & physical access',
             'due': 'Nov 01, 2024', 'amount': '\u20b9150.00', 'status': 'PENDING'},
        ]
    marks = await build_marks_for(student.get('name'), sid)
    performance_months = await build_subject_performance(student)
    cgpa = round(sum(m['total'] for m in marks) / len(marks) / 10, 2) if marks else 0
    att = build_attendance(sid)
    seed = sum(ord(c) for c in sid)
    return {
        'student': {
            'name': student.get('name'), 'id': student.get('id'),
            'className': f"{student.get('class_name','')} - {student.get('section','').replace('Section ','')}".strip(' -'),
            'roll': student.get('roll', ''), 'balance': f"\u20b9{due:,.2f}", 'status': student.get('status', 'Active'),
            'avatar': student.get('avatar', ''), 'admission_no': student.get('admission_no', ''),
            'raw': student,
        },
        'fees': {'pending': pending, 'total': f"\u20b9{due:,.2f}", 'due': due,
                 'fee_id': fee.get('id') if fee else None},
        'marks': marks,
        'performance_months': performance_months,
        'gpa': {'cgpa': f"{cgpa}", 'grade': grade_for(marks[0]['total'] if marks else 0) + ' (Excellent)',
                'credits': '24 / 24', 'standing': 'First Class with Distinction'},
        'standing': {'rank': f"{(seed % 40) + 1:02d} / 45 Students", 'percentile': f"{88 + seed % 11}.0% Percentile"},
        'attendance': att,
    }

@api_router.get("/students/{sid}/timeline")
async def student_timeline(sid: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    """One branch-safe journey assembled from the student's operational records."""
    student = await db.students.find_one(branch_scope(x_branch_id, {'id': sid}))
    if not student:
        raise HTTPException(status_code=404, detail='Student not found in the selected branch.')

    events = []
    def add(kind: str, title: str, detail: str = '', at: str = '', status: str = '', source_id: str = ''):
        events.append({'type': kind, 'title': title, 'detail': detail, 'at': at or '', 'status': status, 'source_id': source_id})

    created_at = student.get('created') or student.get('created_at') or ''
    add('Student', 'Student record created', f"{student.get('class_name', '')} · {student.get('section', '')}", created_at, student.get('status', 'Active'), student.get('id', ''))

    enrollments = await db.student_enrollments.find({'student_id': sid}).sort('academic_year', 1).to_list(100)
    for enrollment in enrollments:
        decision = str(enrollment.get('decision') or '').strip().lower()
        if decision not in {'promote', 'retain'}:
            continue
        target = f"{enrollment.get('class_name', '')} · {enrollment.get('section', '')}".strip(' ·')
        previous = f"{enrollment.get('previous_class', '')} · {enrollment.get('previous_section', '')}".strip(' ·')
        title = f"Promoted to {target}" if decision == 'promote' else f"Continued in {target}"
        detail = f"From {previous} · Academic year {enrollment.get('academic_year', '')}" if previous else f"Academic year {enrollment.get('academic_year', '')}"
        add('Promotion', title, detail, enrollment.get('created') or enrollment.get('archived_at') or '', 'Promoted' if decision == 'promote' else 'Retained', enrollment.get('id', ''))

    route_filters = []
    if student.get('transport_route_id'):
        route_filters.append({'id': student.get('transport_route_id')})
    if student.get('transport_route'):
        route_filters.extend([{'id': student.get('transport_route')}, {'route_name': student.get('transport_route')}])
    route = await db.transport_routes.find_one({'$or': route_filters}) if route_filters else None
    if route:
        pickup = student.get('pickup_stop') or next((stop.get('name') for stop in route.get('stops', []) if stop.get('name')), '')
        route_detail = f"{route.get('bus_number') or 'Vehicle pending'}"
        if pickup:
            route_detail += f" · Pickup {pickup}"
        if route.get('driver_name'):
            route_detail += f" · Driver {route.get('driver_name')}"
        add('Transport', f"Transport assigned · {route.get('route_name') or route.get('id', 'Route')}", route_detail, route.get('updated') or route.get('created') or student.get('updated') or created_at, route.get('status', 'Active'), route.get('id', ''))

    health = await db.holistic_observations.find_one({'student_id': sid, 'status': 'Recorded'}, sort=[('updated_at', -1)])
    if health:
        observations = [
            f"Punctuality: {health.get('punctuality')}" if health.get('punctuality') else '',
            f"Uniform: {health.get('uniform_dress')}" if health.get('uniform_dress') else '',
            f"Hygiene: {health.get('personal_hygiene')}" if health.get('personal_hygiene') else '',
            f"General health: {health.get('general_health')}" if health.get('general_health') else '',
        ]
        health_detail = ' · '.join(item for item in observations if item)
        if health.get('health_note'):
            health_detail += f" · {health.get('health_note')}"
        add('Health', f"Holistic observation · {health.get('exam_title') or 'Latest review'}", health_detail, health.get('recorded_at') or health.get('updated_at') or '', 'Recorded', health.get('id', ''))

    lead = await db.admission_leads.find_one(branch_scope(x_branch_id or 'BR-MAIN', {'student_id': sid}))
    if lead:
        add('Admission', 'Admission confirmed', f"Admission no. {lead.get('admission_no') or student.get('admission_no') or '—'}", lead.get('confirmed_at') or lead.get('last_activity') or lead.get('created', ''), lead.get('stage', ''), lead.get('id', ''))
        for activity in lead.get('activities', []):
            add('Admission', activity.get('outcome') or 'Admission follow-up', activity.get('notes', ''), activity.get('at', ''), '', lead.get('id', ''))

    transfers = await db.student_transfers.find(branch_scope(x_branch_id or 'BR-MAIN', {'student_id': sid})).to_list(200)
    for item in transfers:
        add('Transfer', item.get('transfer_type') or 'Student transfer', item.get('reason') or item.get('remarks', ''), item.get('issued_at') or item.get('created_at') or item.get('created', ''), item.get('status', ''), item.get('id', ''))

    # The journey is a long-term student record, not another notification feed.
    # Show one cumulative attendance signal instead of every absence, late entry
    # or approved parent-leave request.
    joined_on = str(student.get('joined_on') or student.get('admission_date') or created_at or '')[:10]
    attendance_query = {'attendance_role': 'student', 'entity_id': sid}
    if joined_on:
        attendance_query['attendance_date'] = {'$gte': joined_on}
    attendance = await db.attendance_records.find(attendance_query).sort('attendance_date', 1).to_list(5000)
    if attendance:
        present = len([item for item in attendance if item.get('status') in {'Present', 'Late'}])
        absent = len([item for item in attendance if item.get('status') == 'Absent'])
        approved_leave = len([item for item in attendance if item.get('status') == 'Leave'])
        late = len([item for item in attendance if item.get('status') == 'Late'])
        half_days = len([item for item in attendance if item.get('status') == 'Half Day'])
        attended_equivalent = present + (half_days * 0.5)
        percentage = round(attended_equivalent / len(attendance) * 100, 1)
        first_day = attendance[0].get('attendance_date') or joined_on or 'joining'
        last_day = attendance[-1].get('attendance_date') or datetime.utcnow().date().isoformat()
        attendance_status = 'Excellent' if percentage >= 95 else 'Good' if percentage >= 85 else 'Needs attention'
        detail = f"{first_day} to {last_day} · {present} present of {len(attendance)} marked days · {absent} absent · {approved_leave} approved leave"
        if late:
            detail += f" · {late} late"
        if half_days:
            detail += f" · {half_days} half day"
        add('Attendance', f"Attendance since joining · {percentage}%", detail, last_day, attendance_status, f"ATT-SUMMARY-{sid}")

    receipts = await db.fee_receipts.find(branch_scope(x_branch_id, {'student_id': sid})).to_list(1000)
    for item in receipts:
        add('Fees', f"Payment received · ₹{float(item.get('amount') or 0):,.0f}", item.get('fee_name', ''), item.get('paid_at', ''), 'Paid', item.get('id', ''))

    # Keep communication useful and quiet: show only the latest important
    # parent message, excluding routine absence, leave and homework alerts.
    parent_messages = await db.parent_notifications.find({'student_id': sid}).sort('created', -1).to_list(200)
    important_message = next((item for item in parent_messages if item.get('message') and not item.get('attendance_date') and not item.get('leave_id') and not item.get('homework_id')), None)
    if important_message:
        channel = important_message.get('channel') or 'Parent App'
        add('Communication', 'Latest important parent communication', f"{channel} · {important_message.get('message')}", important_message.get('read_at') or important_message.get('delivered_at') or important_message.get('created', ''), important_message.get('status', 'Sent'), important_message.get('id', ''))

    # Collapse subject sheets into the latest complete examination summary.
    # Marks are joined using student_id, then ranked against every student in
    # the same class/section and examination.
    mark_sets = await db.marks_sets.find(branch_scope(x_branch_id, {'rows.student_id': sid})).to_list(5000)
    exam_groups = {}
    for item in mark_sets:
        exam_key = str(item.get('exam_id') or item.get('exam_title') or '').strip()
        if not exam_key:
            continue
        exam_groups.setdefault(exam_key, []).append(item)
    if exam_groups:
        def exam_updated(group):
            return max(str(item.get('published_at') or item.get('updated_at') or item.get('created') or '') for item in group)
        latest_exam_key, latest_sheets = max(exam_groups.items(), key=lambda pair: exam_updated(pair[1]))
        class_totals = {}
        current_total = 0.0
        current_max = 0.0
        current_points = []
        appeared_subjects = 0
        for sheet in latest_sheets:
            total_max = float(sheet.get('total_max') or (float(sheet.get('max_written') or 0) + float(sheet.get('max_practical') or 0)) or 100)
            scheme = sheet.get('grade_scheme') or []
            for row in sheet.get('rows', []):
                student_id = row.get('student_id')
                if not student_id or (row.get('appearance_status') or 'Appeared') != 'Appeared' or row.get('total') is None:
                    continue
                score = float(row.get('total') or 0)
                bucket = class_totals.setdefault(student_id, {'score': 0.0, 'max': 0.0})
                bucket['score'] += score
                bucket['max'] += total_max
                if student_id == sid:
                    current_total += score
                    current_max += total_max
                    appeared_subjects += 1
                    percent = score / total_max * 100 if total_max else 0
                    grade_row = next((entry for entry in scheme if entry.get('from') is not None and entry.get('to') is not None and float(entry.get('from')) <= percent <= float(entry.get('to'))), None)
                    if grade_row and grade_row.get('point') is not None:
                        current_points.append(float(grade_row.get('point')))
        if current_max:
            class_performance = sorted(
                [{'student_id': student_id, 'percent': values['score'] / values['max'] * 100 if values['max'] else 0} for student_id, values in class_totals.items()],
                key=lambda item: (-item['percent'], item['student_id'])
            )
            rank = next((index + 1 for index, item in enumerate(class_performance) if item['student_id'] == sid), None)
            overall_percent = round(current_total / current_max * 100, 1)
            grade = grade_for(overall_percent)
            grade_point = round(sum(current_points) / len(current_points), 1) if current_points else round(min(10, overall_percent / 10), 1)
            exam_title = latest_sheets[0].get('exam_title') or latest_exam_key
            publication_status = 'Published' if latest_sheets and all(item.get('status') == 'Published' for item in latest_sheets) else 'Under verification'
            detail = f"Overall {current_total:g}/{current_max:g} ({overall_percent}%) · Class rank {rank or '—'} of {len(class_performance)} · Grade point {grade_point:g} · Grade {grade} · {appeared_subjects} subjects"
            add('Assessment', f"Latest exam · {exam_title}", detail, exam_updated(latest_sheets), publication_status, f"EXAM-SUMMARY-{latest_exam_key}-{sid}")

    plans = await db.interventions.find({'student_id': sid}).to_list(500)
    for item in plans:
        add('Support', item.get('concern') or item.get('title') or 'Student support plan', item.get('school_action') or item.get('action') or '', item.get('updated_at') or item.get('created', ''), item.get('status', 'Open'), item.get('id', ''))

    completions = await db.homework_completions.find({'student_id': sid}).to_list(1000)
    homework_ids = [item.get('homework_id') for item in completions if item.get('homework_id')]
    homework_by_id = {item.get('id'): item for item in await db.homework.find({'id': {'$in': homework_ids}}).to_list(1000)} if homework_ids else {}
    for item in completions:
        homework = homework_by_id.get(item.get('homework_id'), {})
        add('Homework', homework.get('title') or 'Homework update', item.get('parent_note') or item.get('teacher_note') or '', item.get('reviewed_at') or item.get('submitted_at') or item.get('updated_at', ''), item.get('status') or item.get('workflow_status', ''), item.get('id', ''))

    events.sort(key=lambda item: str(item.get('at') or ''), reverse=True)
    return {'student_id': sid, 'student_name': student.get('name', ''), 'events': events, 'count': len(events)}

# ---------------- Marks & Results ----------------
class MarksSet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    exam_id: str = ""
    exam_title: str
    class_name: str = ""
    section: str = ""
    subject: str = ""
    max_written: int = 70
    max_practical: int = 30
    passing_marks: int = 40
    grade_scheme: List[dict] = []
    rows: List[dict] = []
    created: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    academic_year: str = ""
    term: str = ""
    assessment_component: str = "Theory"
    status: str = "Submitted"

@api_router.get('/marks-sheet')
async def get_marks_sheet(exam_id: str, subject: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    sheet = await db.marks_sets.find_one(branch_scope(x_branch_id or 'BR-MAIN', {'exam_id': exam_id, 'subject': subject}))
    return clean(sheet) if sheet else None

async def holistic_marks_context(exam_id: str, subject: str, role: str, branch_id: str = 'BR-MAIN'):
    exam = await db.exams.find_one(branch_scope(branch_id, {'id': exam_id}))
    if not exam:
        raise HTTPException(status_code=404, detail='Examination not found.')
    class_name, section = exam.get('class_name', ''), exam.get('section', '')
    structure = await attendance_academic_structure(branch_id)
    class_setup = next((item for item in structure.get('classes', []) if item.get('name') == class_name), {})
    section_setup = next((item for item in class_setup.get('sections', []) if item.get('name') == section), {})
    class_teacher_id = str(section_setup.get('class_teacher_id') or '').strip()
    class_teacher_name = str(section_setup.get('class_teacher_name') or '').strip()
    allocation = await db.teacher_allocations.find_one(branch_scope(branch_id, {'class_name': class_name, 'section': section, 'subject': subject})) or {}
    papers = [item for item in (exam.get('papers') or []) if item.get('subject')]
    papers.sort(key=lambda item: (str(item.get('date') or exam.get('date') or '9999-12-31'), str(item.get('start_time') or '99:99'), str(item.get('subject') or '')))
    exam_subjects = [str(item).strip() for item in (exam.get('subjects') or [exam.get('subject')]) if str(item).strip() and item != 'All Subjects']
    first_paper_subject = str((papers[0] if papers else {}).get('subject') or (exam_subjects[0] if exam_subjects else subject)).strip()
    class_teacher_subject = bool(class_teacher_id and allocation.get('teacher_id') == class_teacher_id)
    admin_fallback = not class_teacher_id and role == 'admin' and subject == first_paper_subject
    allowed = class_teacher_subject or admin_fallback
    reason = ('Assigned class teacher subject' if class_teacher_subject else f'No class teacher is assigned; Admin records this exam’s observations with its first paper, {first_paper_subject}' if admin_fallback else 'Holistic observations are available only in the assigned class teacher’s subject' if class_teacher_id else f'No class teacher is assigned; Admin entry for this exam is available only with its first paper, {first_paper_subject}')
    return {'allowed': allowed, 'reason': reason, 'class_teacher_id': class_teacher_id, 'class_teacher_name': class_teacher_name, 'subject_teacher_id': allocation.get('teacher_id', ''), 'subject_teacher_name': allocation.get('teacher_name', ''), 'first_paper_subject': first_paper_subject, 'exam_id': exam_id, 'class_name': class_name, 'section': section}

@api_router.get('/marks/holistic-context')
async def get_holistic_marks_context(exam_id: str, subject: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    return await holistic_marks_context(exam_id, subject, role, x_branch_id or 'BR-MAIN')

@api_router.put('/marks/holistic-observations')
async def save_holistic_from_marks(payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    exam_id, subject = str(payload.get('exam_id') or ''), str(payload.get('subject') or '')
    branch_id = x_branch_id or 'BR-MAIN'
    context = await holistic_marks_context(exam_id, subject, role, branch_id)
    if not context['allowed']:
        raise HTTPException(status_code=403, detail=context['reason'])
    status = 'Recorded' if payload.get('status') == 'Recorded' else 'Draft'
    allowed_ratings = {'Excellent', 'Good', 'Needs Attention', 'Not Observed'}
    now, saved = datetime.utcnow().isoformat(), 0
    exam = await db.exams.find_one(branch_scope(branch_id, {'id': exam_id})) or {}
    for item in payload.get('observations') or []:
        student_id = str(item.get('student_id') or '')
        student = await db.students.find_one(branch_scope(branch_id, {'id': student_id, 'class_name': context['class_name'], 'section': context['section']}))
        if not student: continue
        values = {key: str(item.get(key) or 'Not Observed') for key in ['punctuality', 'uniform_dress', 'personal_hygiene', 'general_health']}
        if any(value not in allowed_ratings for value in values.values()):
            raise HTTPException(status_code=422, detail=f"Choose valid observation ratings for {student.get('name', 'student')}.")
        key = branch_scope(branch_id, {'student_id': student_id, 'exam_id': exam_id})
        old = await db.holistic_observations.find_one(key) or {}
        recorder = context.get('class_teacher_name') or ROLE_CONFIG[role]['name']
        document = {'id': old.get('id') or f"HOL-{uuid.uuid4().hex[:10].upper()}", 'student_id': student_id, 'exam_id': exam_id, 'student_name': student.get('name', ''), 'class_name': context['class_name'], 'section': context['section'], 'exam_title': exam.get('title', ''), 'source_subject': subject, **values, 'health_note': str(item.get('health_note') or '').strip(), 'status': status, 'entered_by': recorder, 'recorded_by': recorder if status == 'Recorded' else '', 'recorded_at': now if status == 'Recorded' else '', 'updated_by': ROLE_CONFIG[role]['name'], 'updated_at': now, 'validated_by': '', 'validated_at': '', 'branch_id': branch_id}
        await db.holistic_observations.replace_one(key, document, upsert=True); saved += 1
    return {'saved': saved, 'status': status}

@api_router.post("/marks")
async def save_marks(ms: MarksSet, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    doc = ms.dict()
    branch_id = x_branch_id or 'BR-MAIN'
    exam = {}
    if doc.get('exam_id'):
        exam = await db.exams.find_one(branch_scope(branch_id, {'id': doc['exam_id']}))
        if not exam:
            raise HTTPException(status_code=404, detail='The selected exam no longer exists.')
        if exam.get('class_name') != doc.get('class_name') or exam.get('section') != doc.get('section'):
            raise HTTPException(status_code=422, detail='Marks must use the selected exam class and section.')
        allowed_subjects = exam.get('subjects') or [exam.get('subject')]
        if doc.get('subject') not in allowed_subjects:
            raise HTTPException(status_code=422, detail='Choose a subject included in the selected exam.')
        doc['academic_year'] = doc.get('academic_year') or exam.get('academic_year', '')
        doc['term'] = doc.get('term') or exam.get('term', '')
        doc['assessment_component'] = exam.get('assessment_component', doc.get('assessment_component') or 'Theory')
        allocation = await db.teacher_allocations.find_one(branch_scope(branch_id, {'class_name': doc['class_name'], 'section': doc['section'], 'subject': doc['subject']}))
        doc['teacher_id'] = (allocation or {}).get('teacher_id', '')
        doc['teacher_name'] = (allocation or {}).get('teacher_name', '')
    total_max = doc['max_written'] + doc['max_practical']
    enrolled = await db.students.find(branch_scope(branch_id, {'class_name': doc['class_name'], 'section': doc['section']})).to_list(2000)
    enrolled = [student for student in enrolled if student_is_active_on(student, str(exam.get('date') or datetime.utcnow().date().isoformat()))]
    active_student_ids = {str(item.get('id') or '') for item in enrolled if item.get('id')}
    student_by_name = {(item.get('name') or '').strip().lower(): item.get('id') for item in enrolled if item.get('name') and item.get('id')}
    for r in doc['rows']:
        if not r.get('student_id'):
            r['student_id'] = student_by_name.get((r.get('name') or '').strip().lower(), '')
        if not r.get('student_id'):
            raise HTTPException(status_code=422, detail=f"Marks row for {r.get('name') or 'a student'} is not linked to a valid student ID.")
        if str(r.get('student_id')) not in active_student_ids:
            raise HTTPException(status_code=422, detail=f"{r.get('name') or 'This student'} is not active in this class on the examination date.")
        appearance = str(r.get('appearance_status') or 'Appeared')
        if appearance not in {'Appeared', 'Absent', 'Medical Leave', 'Exempted', 'Withheld'}:
            raise HTTPException(status_code=422, detail='Choose a valid examination status for every student.')
        r['appearance_status'] = appearance
        if appearance == 'Appeared':
            written = float(r.get('written', 0) or 0); practical = float(r.get('practical', 0) or 0)
            if written < 0 or practical < 0 or written > doc['max_written'] or practical > doc['max_practical']:
                raise HTTPException(status_code=422, detail=f"Marks for {r.get('name') or 'a student'} exceed the configured maximum.")
            r['total'] = written + practical
        else:
            r['written'] = None; r['practical'] = None; r['total'] = None
    doc['total_max'] = total_max
    existing_query = branch_scope(branch_id, {'exam_id': doc.get('exam_id'), 'class_name': doc['class_name'], 'section': doc['section'], 'subject': doc['subject']})
    existing = await db.marks_sets.find_one(existing_query)
    if existing and existing.get('status') == 'Published':
        raise HTTPException(status_code=409, detail='Published marks are locked. Ask the Admin to reopen this subject for correction.')
    now = datetime.utcnow().isoformat()
    doc['status'] = 'Submitted' if doc.get('status') not in {'Draft', 'Submitted'} else doc['status']
    doc['updated_at'] = now; doc['updated_by'] = ROLE_CONFIG[role]['name']; doc['branch_id'] = branch_id
    doc['audit_history'] = (existing or {}).get('audit_history', []) + [{'at': now, 'by': ROLE_CONFIG[role]['name'], 'action': 'Marks updated' if existing else 'Marks submitted', 'previous_rows': (existing or {}).get('rows', [])}]
    await db.marks_sets.replace_one(
        existing_query,
        dict(doc), upsert=True
    )
    # New marks immediately refresh the academic-risk engine.
    await detect_academic_risks(create_cases=True, branch_id=branch_id)
    await add_event('info', 'Marks submitted', f"{doc['subject']} marks for {doc['class_name']} {doc['section']} were finalized.")
    return clean(doc)

@api_router.post('/exams/{exam_id}/publish-results')
async def publish_exam_results(exam_id: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin'})
    branch_id = x_branch_id or 'BR-MAIN'
    exam = await db.exams.find_one(branch_scope(branch_id, {'id': exam_id}))
    if not exam:
        raise HTTPException(status_code=404, detail='Examination not found.')
    subjects = [str(subject).strip() for subject in (exam.get('subjects') or [exam.get('subject')]) if str(subject).strip() and subject != 'All Subjects']
    if not subjects:
        structure = await attendance_academic_structure(branch_id)
        class_setup = next((item for item in structure.get('classes', []) if item.get('name') == exam.get('class_name')), {})
        section_setup = next((item for item in class_setup.get('sections', []) if item.get('name') == exam.get('section')), {})
        subjects = [str(item.get('name') if isinstance(item, dict) else item).strip() for item in section_setup.get('subjects', []) if str(item.get('name') if isinstance(item, dict) else item).strip()]
    sheets = await db.marks_sets.find(branch_scope(branch_id, {'exam_id': exam_id})).to_list(500)
    by_subject = {str(sheet.get('subject') or '').strip(): sheet for sheet in sheets}
    missing = [subject for subject in subjects if subject not in by_subject]
    if missing:
        raise HTTPException(status_code=422, detail=f"Complete marks for: {', '.join(missing)} before publishing.")
    not_ready = [
        subject for subject in subjects
        if (by_subject.get(subject, {}).get('status') or ('Submitted' if by_subject.get(subject, {}).get('rows') else 'Pending')) not in {'Submitted', 'Published'}
    ]
    if not_ready:
        raise HTTPException(status_code=422, detail=f"Submit these subjects for Admin validation first: {', '.join(not_ready)}.")
    now = datetime.utcnow().isoformat()
    await db.marks_sets.update_many(branch_scope(branch_id, {'exam_id': exam_id}), {'$set': {'status': 'Published', 'published_at': now, 'published_by': ROLE_CONFIG[role]['name']}, '$push': {'audit_history': {'at': now, 'by': ROLE_CONFIG[role]['name'], 'action': 'Results validated and published'}}})
    await db.exams.update_one(branch_scope(branch_id, {'id': exam_id}), {'$set': {'status': 'Completed', 'results_published_at': now, 'results_published_by': ROLE_CONFIG[role]['name']}})
    students = await db.students.find(branch_scope(branch_id, {'class_name': exam.get('class_name'), 'section': exam.get('section')})).to_list(2000)
    students = [student for student in students if student_is_active_on(student, exam.get('date') or datetime.utcnow().date().isoformat())]
    if await notification_rule_enabled('exam_result'):
        for student in students:
            await db.parent_notifications.insert_one({'id': f"PAR-RESULT-{uuid.uuid4().hex[:10].upper()}", 'student_id': student.get('id'), 'student_name': student.get('name', ''), 'parent_name': student.get('parent_name') or student.get('father_name') or 'Parent', 'parent_phone': student.get('parent_phone') or student.get('mobile') or student.get('phone') or '', 'channel': 'Parent App', 'status': 'Queued', 'message': f"{exam.get('title')} results are now available in the Parent App.", 'created': now, 'branch_id': branch_id})
    await add_event('success', 'Results published', f"{exam.get('title')} results were validated by Admin and sent to {len(students)} parent account(s).")
    return {'ok': True, 'published_subjects': len(sheets), 'parents_notified': len(students)}

@api_router.post('/marks/{marks_id}/reopen')
async def reopen_published_marks(marks_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin'})
    branch_id = x_branch_id or 'BR-MAIN'
    sheet = await db.marks_sets.find_one(branch_scope(branch_id, {'id': marks_id}))
    if not sheet:
        raise HTTPException(status_code=404, detail='Marks sheet not found.')
    reason = str(payload.get('reason') or '').strip()
    if not reason:
        raise HTTPException(status_code=422, detail='Enter a reason for reopening published marks.')
    now = datetime.utcnow().isoformat()
    await db.marks_sets.update_one(branch_scope(branch_id, {'id': marks_id}), {'$set': {'status': 'Correction Required', 'reopened_at': now, 'reopened_by': ROLE_CONFIG[role]['name'], 'reopen_reason': reason}, '$push': {'audit_history': {'at': now, 'by': ROLE_CONFIG[role]['name'], 'action': 'Published marks reopened', 'reason': reason}}})
    await db.exams.update_one(branch_scope(branch_id, {'id': sheet.get('exam_id')}), {'$set': {'status': 'Scheduled'}})
    return clean(await db.marks_sets.find_one(branch_scope(branch_id, {'id': marks_id})))

@api_router.get("/results")
async def results(class_name: str = '', section: str = '', exam_title: str = '', role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    # A result set is selected by its real Class and Section. This prevents
    # showing a different class's latest marks by mistake.
    all_sets = await db.marks_sets.find(branch_scope(branch_id)).sort('created', -1).to_list(5000)
    all_exam_records = await db.exams.find(branch_scope(branch_id)).to_list(5000)
    groups = sorted(
        [{'class_name': item.get('class_name', ''), 'section': item.get('section', '')}
         for item in [*all_sets, *all_exam_records] if item.get('class_name') and item.get('section')],
        key=lambda item: (item['class_name'], item['section'])
    )
    unique_groups = []
    seen_groups = set()
    for group in groups:
        key = (group['class_name'], group['section'])
        if key not in seen_groups:
            unique_groups.append(group)
            seen_groups.add(key)

    if not class_name or not section:
        return {'available_groups': unique_groups, 'available_exams': [], 'selected': False, 'rows': [], 'class_average': 0, 'highest': 0, 'pass_rate': 0, 'students': 0}

    group_sets = [item for item in all_sets if item.get('class_name') == class_name and item.get('section') == section]
    school_exams = await db.exams.find(branch_scope(branch_id, {'class_name': class_name, 'section': section})).sort('date', -1).to_list(1000)
    school_exam_titles = [item.get('title', '') for item in school_exams if item.get('title')]
    available_exams = list(dict.fromkeys(title for title in school_exam_titles))
    selected_exam = exam_title or (available_exams[0] if available_exams else '')
    selected_exam_record = next((item for item in school_exams if item.get('title') == selected_exam), None)
    selected_exam_id = (selected_exam_record or {}).get('id', '')
    normalized_exam_title = str(selected_exam or '').strip().casefold()
    exam_sets = [
        item for item in group_sets
        if (selected_exam_id and item.get('exam_id') == selected_exam_id)
        or str(item.get('exam_title') or '').strip().casefold() == normalized_exam_title
    ]
    structure = await attendance_academic_structure(branch_id)
    class_setup = next((item for item in structure.get('classes', []) if item.get('name') == class_name), {})
    section_setup = next((item for item in class_setup.get('sections', []) if item.get('name') == section), {})
    configured_subjects = [str(item.get('name') if isinstance(item, dict) else item).strip() for item in section_setup.get('subjects', []) if str(item.get('name') if isinstance(item, dict) else item).strip()]
    exam_subjects = [str(subject).strip() for subject in ((selected_exam_record or {}).get('subjects') or [(selected_exam_record or {}).get('subject')]) if str(subject).strip() and subject != 'All Subjects']
    saved_subjects = [str(item.get('subject') or '').strip() for item in exam_sets if str(item.get('subject') or '').strip()]
    expected_subjects = list(dict.fromkeys([*(exam_subjects or configured_subjects), *saved_subjects]))
    if not exam_sets:
        return {'available_groups': unique_groups, 'available_exams': available_exams, 'selected': True, 'exam_title': selected_exam or '\u2014', 'exam_id': (selected_exam_record or {}).get('id', ''), 'class': f'{class_name} - {section}', 'expected_subjects': expected_subjects, 'subject_validation': [{'subject': subject, 'status': 'Pending', 'teacher_name': '', 'students_total': 0, 'students_completed': 0} for subject in expected_subjects], 'subjects': [], 'sheets': [], 'publication_status': 'Under Verification', 'rows': [], 'class_average': 0, 'highest': 0, 'pass_rate': 0, 'students': 0}

    newest_by_subject = {}
    for mark_set in exam_sets:
        subject = str(mark_set.get('subject') or 'Subject').strip()
        if subject not in newest_by_subject:
            newest_by_subject[subject] = mark_set
    student_rows = {}
    for subject, mark_set in newest_by_subject.items():
        subject_max = float(mark_set.get('total_max') or 100)
        subject_pass = float(mark_set.get('passing_marks') or 40)
        for item in mark_set.get('rows', []):
            key = item.get('student_id') or item.get('roll') or item.get('name')
            row = student_rows.setdefault(key, {'student_id': item.get('student_id'), 'roll': item.get('roll', ''), 'name': item.get('name', ''), 'total': 0.0, 'total_max': 0.0, 'subjects': [], 'all_passed': True})
            appearance = item.get('appearance_status') or 'Appeared'
            if appearance != 'Appeared':
                row['total_max'] += subject_max
                row['all_passed'] = False
                row['subjects'].append({'subject': subject, 'score': None, 'total_max': subject_max, 'percent': None, 'appearance_status': appearance})
                continue
            score = float(item.get('total') or 0)
            pct = round(score / subject_max * 100, 1) if subject_max else 0
            row['total'] += score
            row['total_max'] += subject_max
            row['all_passed'] = row['all_passed'] and score >= subject_pass
            row['subjects'].append({'subject': subject, 'score': score, 'total_max': subject_max, 'percent': pct, 'appearance_status': 'Appeared'})

    rows = []
    for row in student_rows.values():
        row['total'] = round(row['total'], 2)
        row['total_max'] = round(row['total_max'], 2)
        row['percent'] = round(row['total'] / row['total_max'] * 100, 1) if row['total_max'] else 0
        row['grade'] = grade_for(row['percent'])
        row['grade_point'] = '—'
        row['result'] = 'Pass' if row.pop('all_passed') else 'Needs support'
        rows.append(row)
    rows.sort(key=lambda x: (-x['total'], x['name'].lower()))
    for i, r in enumerate(rows):
        r['rank'] = i + 1
    pcts = [r['percent'] for r in rows] or [0]
    passed = len([row for row in rows if row['result'] == 'Pass'])
    subject_validation = []
    for subject in expected_subjects:
        sheet = newest_by_subject.get(subject)
        sheet_rows = (sheet or {}).get('rows', [])
        completed = len([item for item in sheet_rows if (item.get('appearance_status') or 'Appeared') != 'Appeared' or item.get('written') is not None])
        workflow_status = (sheet or {}).get('status') or ('Submitted' if sheet_rows else 'Pending')
        subject_validation.append({'subject': subject, 'sheet_id': (sheet or {}).get('id', ''), 'status': workflow_status, 'teacher_name': (sheet or {}).get('teacher_name', ''), 'updated_by': (sheet or {}).get('updated_by', ''), 'updated_at': (sheet or {}).get('updated_at', ''), 'students_total': len(sheet_rows), 'students_completed': completed})
    return {
        'available_groups': unique_groups, 'available_exams': available_exams, 'selected': True,
        'exam_title': selected_exam, 'class': f"{class_name} - {section}",
        'exam_id': (selected_exam_record or {}).get('id', ''),
        'expected_subjects': expected_subjects, 'subject_validation': subject_validation,
        'subjects': list(newest_by_subject.keys()), 'subject_count': len(newest_by_subject), 'rows': rows,
        'class_average': round(sum(pcts) / len(pcts), 1), 'highest': max(pcts),
        'pass_rate': round(passed / len(pcts) * 100), 'students': len(rows),
        'top_scorer': rows[0] if rows else None,
        'publication_status': 'Published' if exam_sets and all(item.get('status') == 'Published' for item in exam_sets) else 'Under Verification',
        'sheets': [{'id': item.get('id'), 'exam_id': item.get('exam_id'), 'subject': item.get('subject'), 'status': item.get('status', 'Submitted'), 'teacher_name': item.get('teacher_name', ''), 'updated_by': item.get('updated_by', ''), 'updated_at': item.get('updated_at', '')} for item in newest_by_subject.values()],
    }

@api_router.get("/report-card/{sid}")
async def report_card(sid: str, published_only: bool = False, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    branch_id = x_branch_id or 'BR-MAIN'
    student = await db.students.find_one(branch_scope(branch_id, {'id': sid}))
    if not student:
        raise HTTPException(status_code=404, detail='Student not found.')
    student = clean(student)
    class_name, section = student.get('class_name', ''), student.get('section', '')
    structure = await attendance_academic_structure(branch_id)
    class_setup = next((item for item in structure.get('classes', []) if str(item.get('name', '')).strip().casefold() == str(class_name).strip().casefold()), {})
    section_setup = next((item for item in class_setup.get('sections', []) if str(item.get('name', '')).strip().casefold() == str(section).strip().casefold()), {})
    def subject_name(item):
        return str(item.get('name', '') if isinstance(item, dict) else item).strip()
    configured_subjects = [subject_name(item) for item in section_setup.get('subjects', []) if subject_name(item)]
    scheduled_exams = await db.exams.find(branch_scope(branch_id, {'class_name': class_name, 'section': section})).to_list(1000)
    scheduled_subjects = []
    for exam in scheduled_exams:
        scheduled_subjects.extend(subject_name(item) for item in (exam.get('subjects') or ([exam.get('subject')] if exam.get('subject') else [])) if subject_name(item))
    mark_sets = await db.marks_sets.find(branch_scope(branch_id, {'class_name': class_name, 'section': section})).sort('created', -1).to_list(5000)
    if published_only:
        mark_sets = [item for item in mark_sets if item.get('status') == 'Published']
    latest_sets, seen_sheets = [], set()
    for mark_set in mark_sets:
        sheet_key = (str(mark_set.get('exam_id') or mark_set.get('exam_title', '')).strip().casefold(), str(mark_set.get('subject', '')).strip().casefold())
        if sheet_key in seen_sheets:
            continue
        seen_sheets.add(sheet_key)
        latest_sets.append(mark_set)
    mark_sets = latest_sets
    marks, class_scores = [], {}
    for mark_set in mark_sets:
        total_max = float(mark_set.get('total_max') or (mark_set.get('max_written', 0) + mark_set.get('max_practical', 0)) or 100)
        scheme = mark_set.get('grade_scheme') or []
        passing_percent = (float(mark_set.get('passing_marks', 40)) / total_max * 100) if total_max else 40
        for row in mark_set.get('rows', []):
            row_student_id = row.get('student_id')
            appearance = row.get('appearance_status') or 'Appeared'
            if appearance != 'Appeared':
                if row_student_id != sid:
                    continue
                marks.append({'exam_id': mark_set.get('exam_id', ''), 'assessment': mark_set.get('exam_title', 'Exam'), 'assessment_component': mark_set.get('assessment_component', ''), 'subject': mark_set.get('subject', 'Subject'), 'score': None, 'total_max': total_max, 'percent': None, 'grade': '—', 'grade_point': '—', 'result': appearance, 'created': mark_set.get('created', ''), 'status': mark_set.get('status', 'Submitted')})
                continue
            total = float(row.get('total') or 0)
            percent = round(total / total_max * 100, 1) if total_max else 0
            if row_student_id:
                class_scores.setdefault(row_student_id, []).append(percent)
            if row_student_id != sid:
                continue
            grade_row = next((item for item in scheme if item.get('from') is not None and item.get('to') is not None and float(item.get('from')) <= percent <= float(item.get('to'))), None)
            result = grade_row.get('result') if grade_row and grade_row.get('result') else ('Pass' if percent >= passing_percent else 'Fail')
            marks.append({
                'exam_id': mark_set.get('exam_id', ''), 'assessment': mark_set.get('exam_title', 'Exam'),
                'assessment_component': mark_set.get('assessment_component', ''), 'subject': mark_set.get('subject', 'Subject'),
                'score': total, 'total_max': total_max, 'percent': percent,
                'grade': grade_row.get('grade') if grade_row else grade_for(percent),
                'grade_point': grade_row.get('point') if grade_row and grade_row.get('point') is not None else '—',
                'result': result, 'created': mark_set.get('created', ''), 'status': mark_set.get('status', 'Submitted'),
            })

    scored_marks = [item for item in marks if item.get('percent') is not None]
    student_average = round(sum(item['percent'] for item in scored_marks) / len(scored_marks), 1) if scored_marks else 0
    class_averages = sorted(
        [{'student_id': student_id, 'average': sum(scores) / len(scores)} for student_id, scores in class_scores.items()],
        key=lambda item: -item['average']
    )
    rank = next((index + 1 for index, item in enumerate(class_averages) if item['student_id'] == sid), None)
    attendance_records = await db.attendance_records.find(branch_scope(branch_id, {'attendance_role': 'student', 'entity_id': sid})).to_list(5000)
    attendance_total = len(attendance_records)
    attendance_present = len([item for item in attendance_records if item.get('status') in {'Present', 'Late'}])
    attendance_percent = round(attendance_present / attendance_total * 100, 1) if attendance_total else None
    holistic_records = await db.holistic_observations.find(branch_scope(branch_id, {'student_id': sid})).sort('updated_at', -1).to_list(500)
    overall_result = 'Awaiting marks' if not marks else ('Pass' if all(item['result'] == 'Pass' for item in marks) else 'Needs attention')
    report_subjects = sorted(set(configured_subjects + [str(item).strip() for item in scheduled_subjects if str(item).strip()] + [item['subject'] for item in marks if item.get('subject')]))
    return {
        'student': {
            'id': student.get('id'), 'name': student.get('name', ''), 'roll': student.get('roll') or student.get('admission_no') or '—',
            'admission_no': student.get('admission_no', ''), 'class_name': class_name, 'section': section,
        },
        'marks': marks, 'configured_subjects': report_subjects,
        'exams': [{'id': str(exam.get('id', '')), 'title': exam.get('title', ''), 'assessment_type': exam.get('assessment_type', ''), 'subjects': [subject_name(item) for item in (exam.get('subjects') or ([exam.get('subject')] if exam.get('subject') else [])) if subject_name(item) and subject_name(item) != 'All Subjects']} for exam in scheduled_exams],
        'academic_year': structure.get('academic_year', ''), 'summary': {
            'average_percent': student_average, 'assessments': len(marks), 'result': overall_result,
            'attendance_percent': attendance_percent, 'attendance_total': attendance_total,
            'attendance_present': attendance_present, 'class_rank': rank, 'class_size': len(class_averages),
        },
        'verification_status': 'Published' if marks and all(item.get('status') == 'Published' for item in marks) else 'Result under verification',
        'holistic_observations': clean(holistic_records),
    }

@api_router.get('/holistic-observations')
async def holistic_observations(class_name: str, section: str, exam_id: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    records = await db.holistic_observations.find(branch_scope(branch_id, {'class_name': class_name, 'section': section, 'exam_id': exam_id})).to_list(2000)
    by_student = {item.get('student_id'): item for item in records}
    students = await db.students.find(branch_scope(branch_id, {'class_name': class_name, 'section': section})).to_list(2000)
    students = [student for student in students if student_is_active_on(student)]
    output = []
    for student in students:
        record = by_student.get(student.get('id')) or {}
        attendance = await db.attendance_records.find(branch_scope(branch_id, {'attendance_role': 'student', 'entity_id': student.get('id')})).to_list(5000)
        late_count = len([item for item in attendance if item.get('status') == 'Late'])
        suggested = 'Not Observed' if not attendance else ('Excellent' if late_count == 0 else 'Good' if late_count < 3 else 'Needs Attention')
        output.append({**record, 'student_id': student.get('id'), 'student_name': student.get('name', ''), 'punctuality_suggested': suggested, 'late_count': late_count, 'attendance_days': len(attendance)})
    return clean(output)

@api_router.put('/holistic-observations/{student_id}')
async def save_holistic_observation(student_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    student = await db.students.find_one(branch_scope(branch_id, {'id': student_id}))
    if not student:
        raise HTTPException(status_code=404, detail='Student not found.')
    exam_id = str(payload.get('exam_id') or '').strip()
    exam = await db.exams.find_one(branch_scope(branch_id, {'id': exam_id}))
    if not exam:
        raise HTTPException(status_code=404, detail='Examination not found.')
    if not student_is_active_on(student, exam.get('date', '')):
        raise HTTPException(status_code=422, detail='Holistic observations can be recorded only for a student active on the examination date.')
    allowed = {'Excellent', 'Good', 'Needs Attention', 'Not Observed'}
    fields = ['punctuality', 'uniform_dress', 'personal_hygiene', 'general_health']
    values = {field: str(payload.get(field) or 'Not Observed') for field in fields}
    if any(value not in allowed for value in values.values()):
        raise HTTPException(status_code=422, detail='Choose a valid observation rating.')
    requested_status = str(payload.get('status') or 'Draft')
    if requested_status not in {'Draft', 'Submitted'}:
        raise HTTPException(status_code=422, detail='Observation status must be Draft or Submitted.')
    now = datetime.utcnow().isoformat()
    key = branch_scope(branch_id, {'student_id': student_id, 'exam_id': exam_id})
    existing = await db.holistic_observations.find_one(key) or {}
    document = {
        'id': existing.get('id') or f"HOL-{uuid.uuid4().hex[:10].upper()}", 'student_id': student_id,
        'student_name': student.get('name', ''), 'class_name': student.get('class_name', ''), 'section': student.get('section', ''),
        'exam_id': exam_id, 'exam_title': exam.get('title', ''), **values,
        'health_note': str(payload.get('health_note') or '').strip(), 'status': requested_status,
        'entered_by': existing.get('entered_by') or ROLE_CONFIG[role]['name'], 'updated_by': ROLE_CONFIG[role]['name'], 'updated_at': now,
        'validated_by': '', 'validated_at': '', 'branch_id': branch_id,
    }
    await db.holistic_observations.replace_one(key, document, upsert=True)
    return clean(document)

@api_router.post('/holistic-observations/{observation_id}/validate')
async def validate_holistic_observation(observation_id: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin'})
    branch_id = x_branch_id or 'BR-MAIN'
    record = await db.holistic_observations.find_one(branch_scope(branch_id, {'id': observation_id}))
    if not record:
        raise HTTPException(status_code=404, detail='Observation record not found.')
    if record.get('status') != 'Submitted':
        raise HTTPException(status_code=422, detail='The class teacher must submit this observation before validation.')
    now = datetime.utcnow().isoformat()
    await db.holistic_observations.update_one(branch_scope(branch_id, {'id': observation_id}), {'$set': {'status': 'Validated', 'validated_by': ROLE_CONFIG[role]['name'], 'validated_at': now, 'updated_at': now}})
    return clean(await db.holistic_observations.find_one(branch_scope(branch_id, {'id': observation_id})))

# ---------------- Notifications ----------------
def notification_matches_role_scope(item: dict, role: str) -> bool:
    if role not in {'academic_coordinator', 'fee_manager'}:
        return True
    text = ' '.join(str(item.get(key) or '') for key in ('title', 'message', 'event', 'description', 'key', 'source')).lower()
    if role == 'fee_manager':
        return any(word in text for word in ('fee', 'payment', 'receipt', 'collection', 'invoice', 'outstanding', 'unpaid'))
    return any(word in text for word in ('academic', 'exam', 'mark', 'result', 'homework', 'syllabus', 'curriculum', 'class', 'subject', 'teacher', 'learning', 'support plan', 'parent-teacher'))

@api_router.get("/notifications")
async def notifications(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    branch_id = x_branch_id or 'BR-MAIN'
    events = await db.events.find(branch_scope(branch_id)).sort('created', -1).to_list(50)
    out = []
    def ago(iso):
        try:
            dt = datetime.fromisoformat(iso)
            secs = (datetime.utcnow() - dt).total_seconds()
            if secs < 3600: return f"{int(secs//60)} min ago"
            if secs < 86400: return f"{int(secs//3600)} hour(s) ago"
            return f"{int(secs//86400)} day(s) ago"
        except Exception:
            return 'recently'
    for e in events:
        out.append({'title': e['title'], 'body': e['body'], 'time': ago(e.get('created', '')),
                    'type': e.get('type', 'info'), 'unread': e.get('unread', False)})
    # derived overdue fee alerts
    overdue = await db.fees.find(branch_scope(branch_id, {'status': 'Overdue'})).to_list(100)
    if overdue:
        names = ', '.join([o['name'] for o in overdue[:3]])
        out.insert(0, {'title': 'Fee payment overdue', 'body': f"{len(overdue)} students have overdue dues ({names}...).",
                       'time': 'live', 'type': 'warning', 'unread': True})
    return out

@api_router.post("/notifications/read-all")
async def read_all(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    await db.events.update_many(branch_scope(x_branch_id or 'BR-MAIN'), {'$set': {'unread': False}})
    return {'ok': True}

@api_router.get("/notifications/center")
async def notification_center(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    now = datetime.utcnow().isoformat()
    # Scheduled records become ready for the configured provider when their time arrives.
    # The provider adapter can later replace this state with Delivered / Failed.
    await db.notification_broadcasts.update_many(
        branch_scope(branch_id, {'status': 'Scheduled', 'scheduled_for': {'$ne': '', '$lte': now}}),
        {'$set': {'status': 'Queued', 'queued_at': now}, '$push': {'audit_history': {'action': 'Schedule released', 'at': now, 'by': 'System'}}},
    )
    events = [clean(item) for item in await db.events.find(branch_scope(branch_id)).sort('created', -1).to_list(12)]
    broadcasts = [clean(item) for item in await db.notification_broadcasts.find(branch_scope(branch_id)).sort('created', -1).to_list(100)]
    for broadcast in broadcasts:
        deliveries = await db.notification_deliveries.find(branch_scope(branch_id, {'broadcast_id': broadcast.get('id')})).to_list(10000)
        if deliveries:
            broadcast['delivery_summary'] = {
                'total': len(deliveries),
                'queued': len([row for row in deliveries if row.get('status') in {'Queued', 'Scheduled', 'Awaiting Provider'}]),
                'delivered': len([row for row in deliveries if row.get('status') == 'Delivered']),
                'failed': len([row for row in deliveries if row.get('status') == 'Failed']),
                'read': len([row for row in deliveries if row.get('read_at')]),
            }
    automatic = [clean(item) for item in await db.parent_notifications.find(branch_scope(branch_id)).sort('created', -1).to_list(100)]
    if role in {'academic_coordinator', 'fee_manager'}:
        events = [item for item in events if notification_matches_role_scope(item, role)]
        broadcasts = [item for item in broadcasts if notification_matches_role_scope(item, role)]
        automatic = [item for item in automatic if notification_matches_role_scope(item, role)]
    automatic_student_ids = [item.get('student_id') for item in automatic if item.get('student_id')]
    automatic_students = {
        item.get('id'): clean(item)
        for item in await db.students.find(branch_scope(branch_id, {'id': {'$in': automatic_student_ids}})).to_list(1000)
    } if automatic_student_ids else {}
    year_requests = [clean(item) for item in await db.academic_year_change_requests.find(branch_scope(branch_id)).sort('created', -1).to_list(20)]
    fee_requests = [clean(item) for item in await db.fee_edit_requests.find(branch_scope(branch_id)).sort('requested_at', -1).to_list(20)]
    director_requests = [clean(item) for item in await db.director_approval_requests.find(branch_scope(branch_id)).sort('created', -1).to_list(30)]
    # The protected-action OTP belongs only in the Director/KDM account. Admin can
    # see that an approval is pending, but cannot read the code they must request.
    if role != 'director':
        director_requests = [
            {key: value for key, value in item.items() if key != 'otp_code'}
            for item in director_requests
        ]
    approvals = [
        {
            **item,
            'type': item.get('approval_type', 'Management Approval'),
            'target_app': 'Director App',
        }
        for item in director_requests
    ] + [
        {
            'id': item.get('id'), 'type': 'Academic Year Change',
            'title': f"Academic year {item.get('current_year', '—')} → {item.get('requested_year', '—')}",
            'status': item.get('status', 'Pending'), 'requested_by': item.get('requested_by', 'Admin'),
            'created': item.get('created') or item.get('created_at'), 'target_app': 'Director App',
        }
        for item in year_requests
    ] + [
        {
            'id': item.get('id'), 'type': 'Fee Structure Edit',
            'title': f"Edit fee structure: {item.get('fee_name', 'Fee')}",
            'status': item.get('status', 'Pending'), 'requested_by': item.get('requested_by', 'Admin'),
            'created': item.get('requested_at') or item.get('created'), 'target_app': 'Director App',
        }
        for item in fee_requests
    ]
    approvals.sort(key=lambda item: item.get('created') or '', reverse=True)
    return {
        'summary': {
            'total_sent': len(broadcasts),
            'parent_sends': sum(1 for item in broadcasts if item.get('audience') == 'Parents'),
            'teacher_sends': sum(1 for item in broadcasts if item.get('audience') == 'Teachers'),
            'director_sends': sum(1 for item in broadcasts if item.get('audience') == 'Director'),
            'pending_approvals': sum(1 for item in approvals if item.get('status') == 'Pending'),
        },
        'alerts': events,
        'history': sorted(broadcasts + [{
            **item,
            'id': item.get('id'),
            'title': item.get('title') or 'Automatic ERP notification',
            'audience': 'Parents',
            'recipients_count': item.get('recipients_count', 1),
            'source': item.get('source') or 'ERP automation',
            'class_name': item.get('class_name') or automatic_students.get(item.get('student_id'), {}).get('class_name', ''),
            'section': item.get('section') or automatic_students.get(item.get('student_id'), {}).get('section', ''),
            'automatic': True,
        } for item in automatic], key=lambda item: item.get('created') or '', reverse=True)[:100],
        'approvals': approvals[:20],
    }

@api_router.get("/notifications/rules")
async def notification_rules(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'academic_coordinator', 'fee_manager'})
    rules = await get_notification_rules(x_branch_id or 'BR-MAIN')
    return [item for item in rules if notification_matches_role_scope(item, role)]

@api_router.put("/notifications/rules/{rule_key}")
async def update_notification_rule(rule_key: str, payload: NotificationRuleUpdate, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    if rule_key not in {rule['key'] for rule in NOTIFICATION_RULES}:
        raise HTTPException(status_code=404, detail='Notification rule not found.')
    await db.notification_rules.update_one(
        branch_scope(x_branch_id or 'BR-MAIN', {'key': rule_key}),
        {'$set': {'key': rule_key, 'enabled': payload.enabled, 'channels': payload.channels, 'updated': datetime.utcnow().isoformat(), 'branch_id': x_branch_id or 'BR-MAIN'}},
        upsert=True,
    )
    return {'ok': True}

@api_router.post("/notifications/broadcast")
async def queue_notification_broadcast(payload: NotificationBroadcast, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'academic_coordinator', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    title, message = payload.title.strip(), payload.message.strip()
    if not title or not message:
        raise HTTPException(status_code=400, detail='Title and message are required.')
    valid_audiences = {'Parents', 'Teachers', 'Director'}
    if payload.audience not in valid_audiences:
        raise HTTPException(status_code=422, detail='Choose a valid audience.')
    if role == 'fee_manager' and (payload.audience != 'Parents' or not notification_matches_role_scope({'title': title, 'message': message}, role)):
        raise HTTPException(status_code=403, detail='Fee Manager can send only fee-related messages to parents.')
    if role == 'academic_coordinator' and (payload.audience not in {'Parents', 'Teachers'} or not notification_matches_role_scope({'title': title, 'message': message}, role)):
        raise HTTPException(status_code=403, detail='Academic Coordinator can send only academic messages to parents or teachers.')
    if payload.audience == 'Director':
        raise HTTPException(status_code=422, detail='Director requests must include the complete approval details and supporting documents.')
    query = branch_scope(branch_id, {'status': {'$ne': 'Inactive'}})
    recipient_rows = []
    if payload.audience == 'Parents':
        if payload.recipient_id:
            query['id'] = payload.recipient_id
        elif payload.class_name:
            query['class_name'] = payload.class_name
        if payload.section:
            query['section'] = payload.section
        recipient_rows = [row for row in await db.students.find(query).to_list(5000) if student_is_active_on(row)]
    elif payload.audience == 'Teachers':
        if payload.recipient_id:
            query['id'] = payload.recipient_id
        recipient_rows = await db.teachers.find(query).to_list(5000)
    recipients_count = len(recipient_rows)
    if not recipients_count:
        raise HTTPException(status_code=422, detail='No active recipients match this selection.')
    uses_unicode = any(ord(character) > 127 for character in message)
    single_limit, multipart_limit = (70, 67) if uses_unicode else (160, 153)
    sms_units = 0 if 'SMS' not in payload.channels else (1 if len(message) <= single_limit else math.ceil(len(message) / multipart_limit))
    record = {
        'id': f"NOT-{uuid.uuid4().hex[:10].upper()}", 'title': title, 'message': message,
        'audience': payload.audience, 'class_name': payload.class_name, 'section': payload.section, 'recipient_id': payload.recipient_id,
        'channels': payload.channels, 'recipients_count': recipients_count,
        'status': 'Scheduled' if payload.scheduled_for else ('Awaiting Provider' if payload.channels == ['SMS'] else 'Queued'),
        'scheduled_for': payload.scheduled_for, 'created': datetime.utcnow().isoformat(), 'sent_by': ROLE_CONFIG[role]['name'],
        'source': 'Direct SMS' if payload.channels == ['SMS'] else 'Manual communication',
        'branch_id': branch_id,
        'sms_units': sms_units, 'credits': recipients_count * sms_units,
    }
    record['audit_history'] = [{'action': 'Scheduled' if payload.scheduled_for else 'Queued', 'at': record['created'], 'by': ROLE_CONFIG[role]['name']}]
    await db.notification_broadcasts.insert_one(record)
    delivery_status = 'Awaiting Provider' if payload.channels == ['SMS'] else ('Scheduled' if payload.scheduled_for else 'Queued')
    delivery_rows = []
    for recipient in recipient_rows:
        for channel in payload.channels:
            delivery_rows.append({
                'id': f"NDL-{uuid.uuid4().hex[:12].upper()}", 'broadcast_id': record['id'],
                'recipient_id': recipient.get('id', ''), 'recipient_name': recipient.get('name', ''),
                'recipient_type': 'Parent' if payload.audience == 'Parents' else 'Teacher',
                'channel': channel, 'status': delivery_status, 'created': record['created'], 'branch_id': branch_id,
            })
    if delivery_rows:
        await db.notification_deliveries.insert_many(delivery_rows)
    if payload.audience == 'Parents' and any(channel in {'Parent App', 'App Push'} for channel in payload.channels):
        await db.parent_notices.insert_one({
            'id': f"PNO-{uuid.uuid4().hex[:10].upper()}", 'title': title, 'message': message,
            'target_type': 'Student' if payload.recipient_id else 'Class',
            'student_ids': [payload.recipient_id] if payload.recipient_id else [],
            'class_name': payload.class_name, 'section': payload.section,
            'status': 'Published', 'published_at': record['created'], 'created': record['created'],
            'source': 'Notification Center', 'broadcast_id': record['id'], 'branch_id': branch_id,
        })
        parent_rows = [{
            'id': f"PAR-NOT-{uuid.uuid4().hex[:10].upper()}", 'student_id': recipient.get('id'),
            'student_name': recipient.get('name', ''), 'title': title, 'message': message,
            'channel': 'Parent App', 'status': 'Queued', 'broadcast_id': record['id'],
            'created': record['created'], 'branch_id': branch_id,
        } for recipient in recipient_rows]
        if parent_rows:
            await db.parent_notifications.insert_many(parent_rows)
    if payload.audience == 'Teachers' and any(channel in {'Teacher App', 'App Push'} for channel in payload.channels):
        teacher_rows = [{
            'id': f"TNO-{uuid.uuid4().hex[:10].upper()}", 'teacher_id': recipient.get('id'),
            'teacher_name': recipient.get('name', ''), 'title': title, 'message': message,
            'status': 'Queued', 'broadcast_id': record['id'], 'created': record['created'], 'branch_id': branch_id,
        } for recipient in recipient_rows]
        if teacher_rows:
            await db.teacher_notifications.insert_many(teacher_rows)
    await add_event('info', 'Notification sent', f"{recipients_count} {payload.audience.lower()} will receive '{title}' through the selected app.")
    clean(record)
    return record

@api_router.post('/notifications/{notification_id}/cancel')
async def cancel_notification(notification_id: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin'})
    query = branch_scope(x_branch_id or 'BR-MAIN', {'id': notification_id})
    record = await db.notification_broadcasts.find_one(query)
    if not record:
        raise HTTPException(status_code=404, detail='Notification not found.')
    if record.get('status') in {'Delivered', 'Cancelled'}:
        raise HTTPException(status_code=422, detail=f"A {record.get('status', '').lower()} notification cannot be cancelled.")
    now = datetime.utcnow().isoformat()
    await db.notification_broadcasts.update_one(query, {'$set': {'status': 'Cancelled', 'cancelled_at': now}, '$push': {'audit_history': {'action': 'Cancelled', 'at': now, 'by': ROLE_CONFIG[role]['name']}}})
    await db.notification_deliveries.update_many(branch_scope(x_branch_id or 'BR-MAIN', {'broadcast_id': notification_id, 'status': {'$in': ['Queued', 'Scheduled', 'Awaiting Provider']}}), {'$set': {'status': 'Cancelled', 'updated': now}})
    return {'ok': True}

@api_router.post('/notifications/{notification_id}/resend')
async def resend_notification(notification_id: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin'})
    source = await db.notification_broadcasts.find_one(branch_scope(x_branch_id or 'BR-MAIN', {'id': notification_id}))
    if not source:
        raise HTTPException(status_code=404, detail='Notification not found.')
    now = datetime.utcnow().isoformat()
    copy = {key: value for key, value in clean(source).items() if key not in {'_id', 'id', 'created', 'scheduled_for', 'status', 'audit_history'}}
    copy.update({'id': f"NOT-{uuid.uuid4().hex[:10].upper()}", 'created': now, 'scheduled_for': '', 'status': 'Queued', 'resent_from': notification_id, 'sent_by': ROLE_CONFIG[role]['name'], 'audit_history': [{'action': 'Resent', 'at': now, 'by': ROLE_CONFIG[role]['name'], 'from': notification_id}]})
    await db.notification_broadcasts.insert_one(copy)
    return clean(copy)

@api_router.post('/notifications/director-approval')
async def create_director_approval(
    title: str = Form(...),
    summary: str = Form(...),
    approval_type: str = Form(...),
    priority: str = Form(...),
    reason: str = Form(...),
    institutional_impact: str = Form(...),
    approval_required: str = Form(...),
    requested_by: str = Form(...),
    decision_due: str = Form(...),
    channels: str = Form('["Director App"]'),
    supporting_documents: List[UploadFile] = File(...),
    role: str = Depends(get_current),
):
    require_roles(role, {'admin'})
    required_values = {
        'Request title': title,
        'Executive summary': summary,
        'Approval type': approval_type,
        'Priority': priority,
        'Reason': reason,
        'Institutional impact': institutional_impact,
        'Why approval is required': approval_required,
        'Requested by': requested_by,
        'Decision timeline': decision_due,
    }
    missing = [label for label, value in required_values.items() if not str(value or '').strip()]
    if missing:
        raise HTTPException(status_code=422, detail=f"Complete the mandatory field(s): {', '.join(missing)}.")
    try:
        due_at = datetime.fromisoformat(decision_due.replace('Z', '+00:00'))
        if due_at.replace(tzinfo=None) < datetime.utcnow() - timedelta(minutes=1):
            raise HTTPException(status_code=422, detail='Decision timeline cannot be in the past.')
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=422, detail='Choose a valid decision timeline.')
    try:
        selected_channels = json.loads(channels)
    except Exception:
        selected_channels = ['Director App']
    selected_channels = [item for item in selected_channels if item in {'Director App', 'App Push'}]
    if 'Director App' not in selected_channels:
        selected_channels.insert(0, 'Director App')
    allowed_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx'}
    documents = []
    for upload in supporting_documents:
        if not upload.filename:
            continue
        safe_name = Path(upload.filename).name
        if Path(safe_name).suffix.lower() not in allowed_extensions:
            raise HTTPException(status_code=422, detail=f'{safe_name}: attach only PDF, image, Word or Excel files.')
        content = await upload.read()
        if len(content) > 15 * 1024 * 1024:
            raise HTTPException(status_code=422, detail=f'{safe_name}: each supporting document must be smaller than 15 MB.')
        stored_name = f"{uuid.uuid4().hex}_{safe_name}"
        (APPROVAL_UPLOAD_DIR / stored_name).write_bytes(content)
        documents.append({
            'name': safe_name,
            'size': len(content),
            'content_type': upload.content_type or 'application/octet-stream',
            'url': f'http://localhost:8001/uploads/approvals/{stored_name}',
        })
    if not documents:
        raise HTTPException(status_code=422, detail='Attach at least one supporting document for the Director.')
    now = datetime.utcnow().isoformat()
    approval_id = f"APR-{uuid.uuid4().hex[:10].upper()}"
    record = {
        'id': approval_id,
        'approval_type': approval_type.strip(),
        'priority': priority.strip(),
        'title': title.strip(),
        'summary': summary.strip(),
        'message': summary.strip(),
        'reason': reason.strip(),
        'institutional_impact': institutional_impact.strip(),
        'approval_required': approval_required.strip(),
        'requested_by': requested_by.strip(),
        'requested_role': ROLE_CONFIG[role]['name'],
        'supporting_documents': documents,
        'decision_due': decision_due,
        'status': 'Pending',
        'target_app': 'Director App',
        'channels': selected_channels,
        'created': now,
    }
    await db.director_approval_requests.insert_one(record.copy())
    broadcast = {
        'id': f"NOT-{uuid.uuid4().hex[:10].upper()}",
        'approval_id': approval_id,
        'title': record['title'],
        'message': record['summary'],
        'audience': 'Director',
        'class_name': '',
        'section': '',
        'channels': selected_channels,
        'recipients_count': 1,
        'status': 'Pending approval',
        'scheduled_for': '',
        'created': now,
        'sent_by': ROLE_CONFIG[role]['name'],
    }
    await db.notification_broadcasts.insert_one(broadcast)
    await add_event('warning', 'Director approval requested', f"{requested_by.strip()} submitted '{title.strip()}' for a Director decision.")
    clean(record)
    return record

# ---------------- Bulk upload ----------------
CSV_HEADERS = ['Student_Name', 'Student_Class', 'Student_Section', 'Admission Number', 'birthday', 'sex',
               'aadhar_number', 'caste', 'subcaste', 'Phone', 'Parent Name', 'Parent Phone', 'Address',
               'mother_name', 'guardian', 'address', 'Bus route', 'Bus number', 'Bus stop']
SAMPLE_ROW = ['K.Tapasvi', 'VIII', 'A', '26', '12/6/2005', 'Female', '12324543657', 'Hindu', 'OC',
              '9876345908', 'K. Srikar', '9876345908', 'Himyathnagar, Hyderabad', 'K.Manasvi',
              'J.Raghu', 'Himyathnagar, Hyderabad', 'Route 2', 'TG 09 AB 1234', 'temple road']

MANDATORY_STUDENT_COLUMNS = {
    'Student_Name': ('Student_Name', 'student_name'),
    'Student_Class': ('Student_Class', 'student_class'),
    'Student_Section': ('Student_Section', 'student_section'),
    'Admission Number': ('Admission Number', 'Admission_Number', 'admission_number', 'admission_no'),
    'Phone': ('Phone', 'phone'),
    'Parent Name': ('Parent Name', 'Parent_Name', 'parent_name'),
    'Parent Phone': ('Parent Phone', 'Parent_Phone', 'parent_phone'),
}


def csv_cell(row, *headings):
    """Read a CSV value while tolerating underscore/space and case differences."""
    # Exact lookup comes first so the template's distinct `Address` and
    # `address` columns remain available as residential and guardian addresses.
    for heading in headings:
        if heading in row and str(row.get(heading) or '').strip():
            return str(row.get(heading) or '').strip()
    normalised = {
        ''.join(char.lower() for char in str(key) if char.isalnum()): str(value or '').strip()
        for key, value in row.items() if key is not None
    }
    for heading in headings:
        value = normalised.get(''.join(char.lower() for char in heading if char.isalnum()), '')
        if value:
            return value
    return ''

@api_router.get("/students-template")
async def students_template(class_name: str = '', section: str = '', academic_year: str = '', role: str = Depends(get_current)):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(CSV_HEADERS)
    row = list(SAMPLE_ROW)
    if class_name: row[1] = class_name
    if section: row[2] = section
    w.writerow(row)
    return PlainTextResponse(buf.getvalue(), media_type='text/csv',
                             headers={'Content-Disposition': 'attachment; filename=students_template.csv'})

@api_router.post("/students/bulk")
async def bulk_upload(file: UploadFile = File(...), class_name: str = '', section: str = '', academic_year: str = '', role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    branch_id = x_branch_id or 'BR-MAIN'
    content = (await file.read()).decode('utf-8', errors='ignore')
    reader = csv.DictReader(io.StringIO(content))
    inserted, errors = 0, []
    if not reader.fieldnames:
        return {'inserted': 0, 'errors': [{'row': 1, 'error': 'The CSV file is empty or has no header row'}]}
    available_headers = {
        ''.join(char.lower() for char in str(header) if char.isalnum()) for header in reader.fieldnames
    }
    missing_headers = []
    for label, aliases in MANDATORY_STUDENT_COLUMNS.items():
        accepted = {''.join(char.lower() for char in alias if char.isalnum()) for alias in aliases}
        if not available_headers.intersection(accepted):
            missing_headers.append(label)
    if missing_headers:
        return {'inserted': 0, 'errors': [{
            'row': 1,
            'error': f"Missing mandatory CSV column(s): {', '.join(missing_headers)}. Download and use the latest template."
        }]}
    structure = await db.academic_structure.find_one({'id': 'school-structure'})
    allowed = {(item.get('name'), item_section.get('name')) for item in (structure or {}).get('classes', []) for item_section in item.get('sections', [])}
    for i, row in enumerate(reader, start=2):
        required_values = {
            label: csv_cell(row, *aliases) for label, aliases in MANDATORY_STUDENT_COLUMNS.items()
        }
        missing = [label for label, value in required_values.items() if not value]
        if missing:
            errors.append({'row': i, 'error': f"Missing mandatory field(s): {', '.join(missing)}"})
            continue
        name = required_values['Student_Name']
        cls = required_values['Student_Class']
        sec = required_values['Student_Section']
        adm = required_values['Admission Number']
        phone = required_values['Phone']
        pname = required_values['Parent Name']
        pphone = required_values['Parent Phone']
        transport_value = csv_cell(row, 'Bus route', 'Bus_route', 'Transport Route')
        bus_number = csv_cell(row, 'Bus number', 'Bus_number')
        pickup_stop = csv_cell(row, 'Bus stop', 'Bus_stop', 'Pickup Stop')
        if class_name and (cls != class_name or sec != section):
            errors.append({'row': i, 'error': f'CSV row must use {class_name} - {section}'})
            continue
        if allowed and (cls, sec) not in allowed:
            errors.append({'row': i, 'error': f'{cls} - {sec} is not configured in Academic Setup'})
            continue
        if await db.students.find_one({'admission_no': adm}):
            errors.append({'row': i, 'error': f'Duplicate admission number {adm}'})
            continue
        transport_route = None
        if transport_value:
            transport_route = await db.transport_routes.find_one(branch_scope(branch_id, {'$or': [{'id': transport_value}, {'route_name': transport_value}]}))
            allowed_stops = {str(stop.get('name') or '').strip() for stop in (transport_route or {}).get('stops', [])}
            if transport_route and pickup_stop and pickup_stop not in allowed_stops:
                errors.append({'row': i, 'error': f"Pickup stop '{pickup_stop}' is not part of {transport_route.get('route_name', transport_value)}"})
                continue
        s = Student(
            name=name, class_name=cls, section=sec, academic_year=academic_year or (structure or {}).get('academic_year', '2024-2025'), admission_no=adm,
            dob=csv_cell(row, 'birthday', 'date_of_birth', 'dob'), gender=csv_cell(row, 'sex', 'gender'),
            aadhar=csv_cell(row, 'aadhar_number', 'aadhar'), caste=csv_cell(row, 'caste'),
            subcaste=csv_cell(row, 'subcaste', 'sub_caste'), phone=phone, mobile=phone,
            mother_name=csv_cell(row, 'mother_name', 'Mother Name'), guardian=csv_cell(row, 'guardian', 'Guardian'),
            guardian_name=csv_cell(row, 'guardian', 'Guardian'),
            guardian_address=csv_cell(row, 'address'), address=csv_cell(row, 'Address'),
            father_name=pname, parent_name=pname, parent_phone=pphone,
            transport_route_id=(transport_route or {}).get('id', ''),
            transport_route=(transport_route or {}).get('route_name', transport_value),
            bus_number=bus_number, pickup_stop=pickup_stop,
        )
        doc = s.dict()
        doc['branch_id'] = branch_id
        try:
            await validate_student_transport_assignment(doc, branch_id)
        except HTTPException as exc:
            errors.append({'row': i, 'error': exc.detail})
            continue
        await db.students.insert_one(dict(doc))
        await apply_active_fee_structures(doc)
        inserted += 1
    if inserted:
        await add_event('success', 'Bulk students imported', f"{inserted} students were added via CSV upload.")
    return {'inserted': inserted, 'errors': errors}

# ---------------- Role dashboards ----------------
@api_router.get("/analytics/fee")
async def analytics_fee(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    branch_id = x_branch_id or 'BR-MAIN'
    fees = await db.fees.find(branch_scope(branch_id)).to_list(1000)
    collected = sum(f.get('paid', 0) for f in fees)
    pending = sum(f.get('due', 0) for f in fees)
    total = sum(f.get('total', 0) for f in fees)
    top = sorted([f for f in fees if f.get('due', 0) > 0], key=lambda x: -x.get('due', 0))[:5]
    return {
        'stats': {'collected': collected, 'pending': pending, 'total': total, 'invoices': len(fees)},
        'method_split': [],
        'monthly': [],
        'top_dues': [{'name': f.get('name'), 'due': f.get('due'), 'avatar': f.get('avatar', '')} for f in top],
    }

@api_router.get("/analytics/academic")
async def analytics_academic(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    branch_id = x_branch_id or 'BR-MAIN'
    students = [student for student in await db.students.find(branch_scope(branch_id)).to_list(1000) if student_is_active_on(student)]
    res = await results(role=role, x_branch_id=branch_id)
    ai = await analytics_ai(role=role, x_branch_id=branch_id)
    return {
        'stats': {'pass_rate': res.get('pass_rate', 0), 'avg': res.get('class_average', 0),
                  'attendance': None, 'students': len(students)},
        'attendance_trend': [],
        'subject_scores': ai['subject_scores'],
        'results_top': res.get('rows', [])[:5],
    }

# ---------------- Seeding ----------------
SEED_STUDENTS = [
    {'id': 'EP-2024-0812', 'name': 'Arjun Reddy', 'class_name': 'Class 11', 'section': 'Section B', 'roll': '042', 'status': 'Active', 'balance': 11450, 'parent_name': 'Lakshmi Reddy', 'parent_phone': '9876543210', 'father_name': 'Srinivas Reddy', 'address': '12 Lake View Road, Hyderabad', 'avatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces'},
    {'id': 'ADM-2024-0892', 'name': 'Aarav Sharma', 'class_name': 'Class 10', 'section': 'Section B', 'roll': '018', 'status': 'Active', 'balance': 0, 'avatar': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=faces'},
    {'id': 'EP-2024-0455', 'name': 'Ananya Iyer', 'class_name': 'Class 10', 'section': 'Section A', 'roll': '021', 'status': 'Active', 'balance': 18000, 'avatar': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=faces'},
    {'id': 'EP-2024-0311', 'name': 'Diya Patel', 'class_name': 'Class 10', 'section': 'Section A', 'roll': '009', 'status': 'Active', 'balance': 0, 'avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces'},
    {'id': 'EP-2024-0790', 'name': 'Rohan Reddy', 'class_name': 'Class 10', 'section': 'Section A', 'roll': '012', 'status': 'Inactive', 'balance': 20000, 'avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces'},
]
SEED_FEES = [
    {'id': 'F1', 'student_id': 'EP-2024-0812', 'name': 'Arjun Reddy', 'total': 45000, 'paid': 33550, 'due': 11450, 'status': 'Partial', 'avatar': SEED_STUDENTS[0]['avatar']},
    {'id': 'F2', 'student_id': 'ADM-2024-0892', 'name': 'Aarav Sharma', 'total': 42000, 'paid': 42000, 'due': 0, 'status': 'Paid', 'avatar': SEED_STUDENTS[1]['avatar']},
    {'id': 'F3', 'student_id': 'EP-2024-0455', 'name': 'Ananya Iyer', 'total': 48000, 'paid': 30000, 'due': 18000, 'status': 'Overdue', 'avatar': SEED_STUDENTS[2]['avatar']},
    {'id': 'F4', 'student_id': 'EP-2024-0311', 'name': 'Diya Patel', 'total': 45000, 'paid': 45000, 'due': 0, 'status': 'Paid', 'avatar': SEED_STUDENTS[3]['avatar']},
    {'id': 'F5', 'student_id': 'EP-2024-0790', 'name': 'Rohan Reddy', 'total': 40000, 'paid': 20000, 'due': 20000, 'status': 'Overdue', 'avatar': SEED_STUDENTS[4]['avatar']},
]
SEED_EXAMS = [
    {'id': 'X1', 'title': 'Mid-Term 2025', 'class_name': 'Class 10-A', 'subject': 'Mathematics', 'date': 'Aug 12, 2025', 'room': 'Hall B2', 'status': 'Scheduled'},
    {'id': 'X2', 'title': 'Unit Test 3', 'class_name': 'Class 9-B', 'subject': 'Science', 'date': 'Aug 18, 2025', 'room': 'Room 204', 'status': 'Scheduled'},
    {'id': 'X3', 'title': 'Half-Yearly Examination', 'class_name': 'Class 11-B', 'subject': 'Physics', 'date': 'Sep 02, 2025', 'room': 'Auditorium', 'status': 'Draft'},
    {'id': 'X4', 'title': 'Unit Test 2', 'class_name': 'Class 8-A', 'subject': 'English', 'date': 'Aug 08, 2025', 'room': 'Room 101', 'status': 'Completed'},
]
SEED_LEAVES = [
    {'id': 'L1', 'name': 'Ravi Kumar', 'leave_type': 'Medical', 'from_date': '01 Oct 2025', 'to_date': '03 Oct 2025', 'days': 3, 'status': 'Approved', 'avatar': 'https://i.pravatar.cc/80?img=12'},
    {'id': 'L2', 'name': 'Meena Pillai', 'leave_type': 'Casual', 'from_date': '28 Sep 2025', 'to_date': '28 Sep 2025', 'days': 1, 'status': 'Rejected', 'avatar': 'https://i.pravatar.cc/80?img=45'},
    {'id': 'L3', 'name': 'Kavitha Rao', 'leave_type': 'Maternity', 'from_date': '15 Aug 2025', 'to_date': '15 Nov 2025', 'days': 92, 'status': 'Approved', 'avatar': 'https://i.pravatar.cc/80?img=32'},
    {'id': 'L4', 'name': 'Suresh Babu', 'leave_type': 'Annual', 'from_date': '10 Sep 2025', 'to_date': '15 Sep 2025', 'days': 6, 'status': 'Pending', 'avatar': 'https://i.pravatar.cc/80?img=15'},
    {'id': 'L5', 'name': 'Imran Khan', 'leave_type': 'Sick', 'from_date': '05 Sep 2025', 'to_date': '07 Sep 2025', 'days': 3, 'status': 'Approved', 'avatar': 'https://i.pravatar.cc/80?img=13'},
    {'id': 'L6', 'name': 'Fatima Sheikh', 'leave_type': 'Casual', 'from_date': '01 Sep 2025', 'to_date': '01 Sep 2025', 'days': 1, 'status': 'Rejected', 'avatar': 'https://i.pravatar.cc/80?img=47'},
]
SEED_TEACHERS = [
    {'id': 'TCH-001', 'name': 'Dr. Anita Rao', 'subject': 'Physics', 'classes': 'Class 11, 12', 'phone': '+91 98765 10001', 'status': 'Active', 'avatar': 'https://i.pravatar.cc/80?img=32'},
    {'id': 'TCH-002', 'name': 'Vikram Nair', 'subject': 'Mathematics', 'classes': 'Class 9, 10', 'phone': '+91 98765 10002', 'status': 'Active', 'avatar': 'https://i.pravatar.cc/80?img=12'},
    {'id': 'TCH-003', 'name': 'Sneha Kapoor', 'subject': 'English', 'classes': 'Class 6, 7, 8', 'phone': '+91 98765 10003', 'status': 'On Leave', 'avatar': 'https://i.pravatar.cc/80?img=45'},
    {'id': 'TCH-004', 'name': 'Rahul Menon', 'subject': 'Chemistry', 'classes': 'Class 11', 'phone': '+91 98765 10004', 'status': 'Active', 'avatar': 'https://i.pravatar.cc/80?img=15'},
    {'id': 'TCH-005', 'name': 'Priya Das', 'subject': 'Biology', 'classes': 'Class 10, 12', 'phone': '+91 98765 10005', 'status': 'Active', 'avatar': 'https://i.pravatar.cc/80?img=47'},
    {'id': 'TCH-006', 'name': 'Arjun Sethi', 'subject': 'Computer Science', 'classes': 'Class 8, 9', 'phone': '+91 98765 10006', 'status': 'Active', 'avatar': 'https://i.pravatar.cc/80?img=13'},
]

async def seed():
    # Never retain the legacy demonstration exams in the real examination register.
    await db.exams.delete_many({'id': {'$in': [item['id'] for item in SEED_EXAMS]}})
    # Do not retain sample leave records once real school records are being used.
    await db.leaves.delete_many({'id': {'$in': [item['id'] for item in SEED_LEAVES]}})
    # Once a school chooses to remove demo data, never recreate it on restart.
    state = await db.system_state.find_one({'id': 'demo-data-state'})
    if state and state.get('demo_data_removed'):
        logger.info('Demo data seeding is disabled for this school')
        return
    seeds = [
        ('students', SEED_STUDENTS), ('fees', SEED_FEES), ('teachers', SEED_TEACHERS),
    ]
    for coll, data in seeds:
        count = await db[coll].count_documents({})
        if count == 0:
            await db[coll].insert_many([dict(x) for x in data])
            logger.info(f"Seeded {coll} with {len(data)} docs")
    # Backfill the showcase family so the parent OTP flow works even when these
    # students were created by an older build.
    await db.students.update_many(
        {'id': {'$in': ['EP-2024-0812', 'EP-2024-0790']}},
        {'$set': {
            'parent_name': 'Lakshmi Reddy',
            'parent_phone': '9876543210',
            'father_name': 'Srinivas Reddy',
        }},
    )
    if await db.marks_sets.count_documents({}) == 0:
        await db.marks_sets.insert_one({
            'id': 'MS1', 'exam_title': 'Mid-Term 2025', 'class_name': 'Class 10', 'section': 'Section A',
            'subject': 'Mathematics', 'max_written': 70, 'max_practical': 30, 'total_max': 100,
            'created': datetime.utcnow().isoformat(),
            'rows': [
                {'roll': '#102401', 'name': 'Rohan Reddy', 'written': 62, 'practical': 28, 'total': 90},
                {'roll': '#102402', 'name': 'Ananya Iyer', 'written': 55, 'practical': 24, 'total': 79},
                {'roll': '#102403', 'name': 'Diya Patel', 'written': 68, 'practical': 29, 'total': 97},
                {'roll': '#102404', 'name': 'Arjun Reddy', 'written': 60, 'practical': 22, 'total': 82},
                {'roll': '#102405', 'name': 'Aarav Sharma', 'written': 58, 'practical': 25, 'total': 83},
            ],
        })
        logger.info("Seeded marks_sets")
    if await db.events.count_documents({}) == 0:
        base = datetime.utcnow()
        evs = [
            {'type': 'info', 'title': 'Exam scheduled', 'body': 'Mid-Term 2025 for Class 10-A on Aug 12.', 'mins': 180},
            {'type': 'info', 'title': 'New transport route', 'body': 'Route added for Sector 9 pickups.', 'mins': 1440},
            {'type': 'success', 'title': 'Fees reconciled', 'body': 'July fee collection reconciled successfully.', 'mins': 2880},
        ]
        for e in evs:
            await db.events.insert_one({'id': str(uuid.uuid4()), 'type': e['type'], 'title': e['title'],
                                        'body': e['body'], 'unread': False,
                                        'created': (base - timedelta(minutes=e['mins'])).isoformat()})
        logger.info("Seeded events")
    now = datetime.utcnow()
    parent_center_seeds = {
        'parent_notices': [
            {
                'id': 'NTC-WELCOME-01',
                'title': 'Parent–Teacher Meeting this Saturday',
                'body': 'Class 11 parents can meet all subject teachers between 9:00 AM and 12:30 PM in the Senior Wing.',
                'category': 'Events', 'priority': 'Urgent',
                'issuer': 'Academic Coordinator', 'target_type': 'Class',
                'class_name': 'Class 11', 'section': 'Section B',
                'student_ids': [], 'status': 'Published',
                'created': now.isoformat(), 'published_at': now.isoformat(),
            },
            {
                'id': 'NTC-EXAM-01',
                'title': 'Unit Test III schedule published',
                'body': 'The complete subject schedule is now available under Hall Tickets and Exams.',
                'category': 'Academics', 'priority': 'Important',
                'issuer': 'Examination Cell', 'target_type': 'All',
                'class_name': '', 'section': '', 'student_ids': [],
                'status': 'Published',
                'created': (now - timedelta(days=1)).isoformat(),
                'published_at': (now - timedelta(days=1)).isoformat(),
            },
        ],
        'payment_proofs': [{
            'id': 'PAY-DEMO-1042', 'fee_id': 'F1',
            'student_id': 'EP-2024-0812', 'student_name': 'Arjun Reddy',
            'class_name': 'Class 11', 'section': 'Section B',
            'parent_id': 'PAR-DEMO', 'parent_name': 'Lakshmi Reddy',
            'parent_mobile': '9876543210', 'amount': 2000,
            'transaction_id': 'UPI2608181042', 'proof_name': 'upi-payment.png',
            'proof_url': '', 'status': 'Pending Review',
            'submitted_at': now.isoformat(),
        }],
        'help_requests': [
            {
                'id': 'CB-DEMO-42', 'kind': 'School callback',
                'category': 'Academics & performance',
                'description': 'Would like guidance on improving English before Unit Test III.',
                'priority': 'Normal', 'preferred_time': '4:00 PM – 6:00 PM',
                'student_id': 'EP-2024-0812', 'student_name': 'Arjun Reddy',
                'parent_id': 'PAR-DEMO', 'parent_name': 'Lakshmi Reddy',
                'mobile': '9876543210', 'status': 'Pending Callback',
                'created_at': now.isoformat(), 'assigned_to': '', 'resolution': '',
            },
            {
                'id': 'APP-DEMO-18', 'kind': 'App support',
                'category': 'Payment & receipts',
                'description': 'Receipt preview was slow to open on the parent phone.',
                'priority': 'Normal', 'preferred_time': '12:00 PM – 3:00 PM',
                'student_id': 'EP-2024-0812', 'student_name': 'Arjun Reddy',
                'parent_id': 'PAR-DEMO', 'parent_name': 'Lakshmi Reddy',
                'mobile': '9876543210', 'status': 'Open',
                'created_at': (now - timedelta(hours=5)).isoformat(),
                'assigned_to': '', 'resolution': '',
            },
        ],
        'hall_tickets': [{
            'id': 'HALL-DEMO-UT3', 'title': 'Unit Test III',
            'class_name': 'Class 11', 'section': 'Section B',
            'venue': 'Senior Wing · Hall B',
            'instructions': 'Report 20 minutes early with the student identity card.',
            'papers': [
                {'date': '2026-09-18', 'subject': 'Mathematics', 'time': '09:00 – 10:30 AM'},
                {'date': '2026-09-19', 'subject': 'English', 'time': '09:00 – 10:30 AM'},
                {'date': '2026-09-20', 'subject': 'Science', 'time': '09:00 – 10:30 AM'},
            ],
            'status': 'Published', 'block_on_fee_due': True,
            'created': now.isoformat(), 'published_at': now.isoformat(),
        }],
        'homework_completions': [{
            'id': 'HWC-DEMO-01', 'student_id': 'EP-2024-0812',
            'student_name': 'Arjun Reddy', 'homework_id': 'HW-DEMO-MATH',
            'subject': 'Mathematics', 'completed': True,
            'completed_at': (now - timedelta(hours=2)).isoformat(),
            'updated_by_parent': 'Lakshmi Reddy',
            'updated': (now - timedelta(hours=2)).isoformat(),
        }],
        'transport_routes': [{
            'id': 'ROUTE-12', 'route_name': 'Route 12 · Jubilee Hills',
            'bus_number': 'TS 09 AB 2042', 'driver_name': 'Ramesh Kumar',
            'driver_mobile': '9988776655', 'attendant_name': 'Lakshmi Devi',
            'student_ids': ['EP-2024-0812'], 'class_name': '', 'section': '',
            'stops': [
                {'name': 'School bus depot', 'time': '06:50'},
                {'name': 'Jubilee Hills Check Post', 'time': '07:02'},
                {'name': 'Central Park Stop', 'time': '07:18'},
                {'name': 'Orison School Campus', 'time': '08:05'},
            ],
            'status': 'Active', 'updated': now.isoformat(),
        }],
        'transport_trips': [{
            'id': 'TRIP-ROUTE12-AM', 'route_id': 'ROUTE-12',
            'route_name': 'Route 12 · Jubilee Hills', 'journey': 'Morning pickup',
            'status': 'On Route', 'current_stop': 'Lake View Junction',
            'next_stop': 'Central Park Stop', 'eta_minutes': 8,
            'latitude': 17.4312, 'longitude': 78.4071,
            'started_at': (now - timedelta(minutes=24)).isoformat(),
            'updated': now.isoformat(),
        }],
    }
    for collection_name, rows in parent_center_seeds.items():
        if await db[collection_name].count_documents({}) == 0:
            await db[collection_name].insert_many([dict(row) for row in rows])
            logger.info(f"Seeded {collection_name} with {len(rows)} docs")

async def ensure_indexes():
    """Keep parent-facing lookups responsive without assuming a migration tool."""
    await db.students.create_index([('id', 1)])
    await db.students.create_index([('parent_phone', 1)])
    await db.parent_accounts.create_index([('id', 1)])
    await db.parent_accounts.create_index([('mobile', 1)])
    await db.parent_otp_sessions.create_index([('mobile', 1), ('created', -1)])
    await db.payment_proofs.create_index([('transaction_id', 1)])
    await db.payment_proofs.create_index([('status', 1), ('submitted_at', -1)])
    await db.help_requests.create_index([('status', 1), ('created_at', -1)])
    await db.parent_notices.create_index([('status', 1), ('published_at', -1)])
    await db.hall_tickets.create_index([('class_name', 1), ('section', 1), ('created', -1)])
    await db.homework_completions.create_index([('student_id', 1), ('homework_id', 1)])
    await db.parent_notice_reads.create_index([('parent_id', 1), ('student_id', 1), ('notice_id', 1)])
    await db.transport_trips.create_index([('route_id', 1), ('updated', -1)])

@app.on_event("startup")
async def startup():
    await ensure_indexes()
    await seed()

@api_router.get("/")
async def root():
    return {"message": "Orison API"}

# School academic structure: academic year -> classes -> sections -> subjects.
@api_router.get("/academic-structure")
async def get_academic_structure(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    structure = await attendance_academic_structure(x_branch_id or 'BR-MAIN')
    if not structure:
        return {'academic_year': '', 'board': '', 'terms': [], 'working_days': [], 'grading_scale': '', 'classes': []}
    return clean(structure)

@api_router.get("/academic-structure/impact")
async def academic_structure_impact(class_name: str, section: str = '', subject: str = '', role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    query = {'class_name': class_name}
    if section:
        query['section'] = section
    if subject:
        query['subject'] = subject
    student_query = {'class_name': class_name}
    if section:
        student_query['section'] = section
    counts = {
        'students': await db.students.count_documents(branch_scope(branch_id, student_query)),
        'teacher_allocations': await db.teacher_allocations.count_documents(branch_scope(branch_id, query)),
        'timetable_periods': await db.timetable_periods.count_documents(branch_scope(branch_id, query)),
        'curriculum_chapters': await db.curriculum_units.count_documents(branch_scope(branch_id, query)),
        'homework_records': await db.homework.count_documents(branch_scope(branch_id, query)),
        'exam_records': await db.exams.count_documents(branch_scope(branch_id, query)),
    }
    counts['total_connections'] = sum(counts.values())
    return counts

@api_router.post("/academic-structure/rename")
async def rename_academic_structure(payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    item_type = str(payload.get('type') or '')
    class_name = str(payload.get('class_name') or '').strip()
    section = str(payload.get('section') or '').strip()
    subject = str(payload.get('subject') or '').strip()
    new_name = str(payload.get('new_name') or '').strip()
    if item_type not in {'class', 'section', 'subject'} or not class_name or not new_name:
        raise HTTPException(status_code=422, detail='Choose a valid item and enter its new name.')
    structure = await attendance_academic_structure(branch_id)
    classes = structure.get('classes') or []
    found = False
    for class_item in classes:
        if class_item.get('name') != class_name:
            continue
        if item_type == 'class':
            class_item['name'] = new_name
            found = True
        for section_item in class_item.get('sections') or []:
            if item_type == 'section' and section_item.get('name') == section:
                section_item['name'] = new_name
                found = True
            if item_type == 'subject' and section_item.get('name') == section and subject in (section_item.get('subjects') or []):
                section_item['subjects'] = [new_name if name == subject else name for name in section_item.get('subjects') or []]
                found = True
    if not found:
        raise HTTPException(status_code=404, detail='The academic setup item was not found.')
    structure_collection = db.academic_structure if branch_id == 'BR-MAIN' else db.branch_academic_structures
    structure_query = {'id': 'school-structure'} if branch_id == 'BR-MAIN' else {'branch_id': branch_id}
    await structure_collection.update_one(structure_query, {'$set': {'classes': classes, 'updated': datetime.utcnow().isoformat(), 'updated_by': ROLE_CONFIG[role]['name']}}, upsert=True)
    collections = [db.students, db.teacher_allocations, db.timetable_periods, db.curriculum_units, db.homework, db.exams, db.marks_sets, db.attendance]
    if item_type == 'class':
        for collection in collections:
            await collection.update_many(branch_scope(branch_id, {'class_name': class_name}), {'$set': {'class_name': new_name}})
    elif item_type == 'section':
        for collection in collections:
            await collection.update_many(branch_scope(branch_id, {'class_name': class_name, 'section': section}), {'$set': {'section': new_name}})
    else:
        for collection in [db.teacher_allocations, db.timetable_periods, db.curriculum_units, db.homework, db.marks_sets]:
            await collection.update_many(branch_scope(branch_id, {'class_name': class_name, 'section': section, 'subject': subject}), {'$set': {'subject': new_name}})
        await db.exams.update_many(branch_scope(branch_id, {'class_name': class_name, 'section': section, 'subjects': subject}), {'$set': {'subjects.$': new_name}})
    await add_event('info', 'Academic setup renamed', f"{item_type.title()} {class_name} {section} {subject} was renamed to {new_name} by {ROLE_CONFIG[role]['name']}.", branch_id)
    return {'ok': True}

@api_router.get('/settings')
async def get_school_settings(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    settings_id = f"school-settings:{x_branch_id or 'BR-MAIN'}"
    record = await db.school_settings.find_one({'id': settings_id})
    return clean(record) if record else {'id': settings_id, 'branch_id': x_branch_id or 'BR-MAIN', 'settings': {}, 'toggles': {}, 'updated': '', 'audit_history': []}

@api_router.put('/settings')
async def save_school_settings(payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin'})
    settings = payload.get('settings') if isinstance(payload.get('settings'), dict) else {}
    toggles = payload.get('toggles') if isinstance(payload.get('toggles'), dict) else {}
    allowed_settings = {'schoolName','legalName','schoolCode','board','affiliation','email','phone','website','address','timezone','language','currency','dateFormat','academicYear','yearStart','yearEnd','weekStart','attendanceClose','attendanceRule','holidayDates','studentPrefix','employeePrefix','receiptPrefix','invoicePrefix','feeDueDay','graceDays','lateFeeAmount','rounding','receiptFooter','smsSender','smsLimit','replyTo','retention','sessionTimeout','passwordExpiry','backupRegion','schoolLogo','brandColor'}
    allowed_toggles = {'parentApp','teacherApp','email','sms','push','twofa','approval','autoReceipt','lateFee','audit','backup','maintenance','singleSession','restrictExports'}
    clean_settings = {key: str(value)[:500000 if key == 'schoolLogo' else 1000] for key, value in settings.items() if key in allowed_settings}
    clean_toggles = {key: bool(value) for key, value in toggles.items() if key in allowed_toggles}
    settings_id = f"school-settings:{x_branch_id or 'BR-MAIN'}"
    previous = await db.school_settings.find_one({'id': settings_id}) or {}
    previous_settings, previous_toggles = previous.get('settings', {}), previous.get('toggles', {})
    changed = sorted({key for key in set(clean_settings) | set(clean_toggles) if clean_settings.get(key, clean_toggles.get(key)) != previous_settings.get(key, previous_toggles.get(key))})
    now = datetime.utcnow().isoformat()
    audit = {'at': now, 'by': ROLE_CONFIG[role]['name'], 'branch_id': x_branch_id or 'BR-MAIN', 'changed_fields': changed}
    record = {'id': settings_id, 'branch_id': x_branch_id or 'BR-MAIN', 'settings': clean_settings, 'toggles': clean_toggles, 'updated': now, 'updated_by': ROLE_CONFIG[role]['name']}
    await db.school_settings.update_one({'id': settings_id}, {'$set': record, '$push': {'audit_history': {'$each': [audit], '$slice': -100}}}, upsert=True)
    await add_event('success', 'School settings updated', f"{len(changed)} branch setting(s) were updated by {ROLE_CONFIG[role]['name']}.")
    return record

@api_router.put("/academic-structure")
async def save_academic_structure(payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    academic_year = str(payload.get('academic_year') or '').strip()
    classes = payload.get('classes') or []
    if not academic_year:
        raise HTTPException(status_code=422, detail='Academic year is required.')
    existing = await attendance_academic_structure(branch_id)
    if existing and existing.get('academic_year') and existing.get('academic_year') != academic_year:
        raise HTTPException(status_code=409, detail='The Academic Year is locked after setup. Submit a change request for Director approval.')
    sanitized = []
    for item in classes:
        name = str(item.get('name') or '').strip()
        if not name:
            continue
        sections = []
        for section in item.get('sections') or []:
            section_name = str(section.get('name') or '').strip()
            if section_name:
                sections.append({'name': section_name, 'subjects': [str(x).strip() for x in section.get('subjects') or [] if str(x).strip()]})
        sanitized.append({'id': item.get('id') or str(uuid.uuid4()), 'name': name, 'sections': sections})
    terms = list(dict.fromkeys(str(item).strip() for item in payload.get('terms') or [] if str(item).strip()))[:12]
    working_days = [day for day in payload.get('working_days') or [] if day in {'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'}]
    document = {
        'id': 'school-structure' if branch_id == 'BR-MAIN' else f'branch-structure:{branch_id}',
        'branch_id': branch_id, 'academic_year': academic_year,
        'board': str(payload.get('board') or '').strip()[:100],
        'terms': terms, 'working_days': working_days,
        'grading_scale': str(payload.get('grading_scale') or '').strip()[:100],
        'classes': sanitized, 'updated': datetime.utcnow().isoformat(),
        'updated_by': ROLE_CONFIG[role]['name'],
    }
    if branch_id == 'BR-MAIN':
        await db.academic_structure.update_one({'id': 'school-structure'}, {'$set': document}, upsert=True)
    else:
        await db.branch_academic_structures.update_one({'branch_id': branch_id}, {'$set': document}, upsert=True)
    await db.branches.update_one({'id': branch_id}, {'$set': {'academic_year': academic_year, 'board': document['board'], 'updated': document['updated']}})
    return document

@api_router.get("/academic-year-change-request")
async def get_academic_year_change_request(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    request = await db.academic_year_change_requests.find_one(branch_scope(x_branch_id or 'BR-MAIN', {'status': 'Pending'}), sort=[('created', -1)])
    if not request:
        return None
    response = clean(request)
    # The one-time code is deliberately visible only to the approving authority.
    if role != 'director':
        response.pop('otp', None)
    return response

@api_router.post("/academic-year-change-request")
async def request_academic_year_change(payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    if role != 'admin':
        raise HTTPException(status_code=403, detail='Only an Admin can request an Academic Year change.')
    next_year = str(payload.get('academic_year') or '').strip()
    branch_id = x_branch_id or 'BR-MAIN'
    structure = await attendance_academic_structure(branch_id)
    current_year = (structure or {}).get('academic_year', '')
    if not current_year:
        raise HTTPException(status_code=422, detail='Set the first Academic Year before requesting a change.')
    if not next_year or next_year == current_year:
        raise HTTPException(status_code=422, detail='Enter a different Academic Year to request a change.')
    await db.academic_year_change_requests.update_many(branch_scope(branch_id, {'status': 'Pending'}), {'$set': {'status': 'Superseded'}})
    request = {
        'id': str(uuid.uuid4()), 'current_year': current_year, 'requested_year': next_year,
        'status': 'Pending', 'otp': f"{secrets.randbelow(1000000):06d}",
        'recipients': ['Director'], 'requested_by': 'Admin',
        'created': datetime.utcnow().isoformat(), 'expires_at': (datetime.utcnow() + timedelta(minutes=30)).isoformat(),
        'branch_id': branch_id,
    }
    await db.academic_year_change_requests.insert_one(dict(request))
    await add_event('warning', 'Academic Year change approval required', f"Admin requested a change from {current_year} to {next_year}. Approval code has been sent to the Director.", branch_id)
    return {'id': request['id'], 'current_year': current_year, 'requested_year': next_year, 'status': 'Pending', 'recipients': request['recipients']}

@api_router.post("/academic-year-change-request/{request_id}/confirm")
async def confirm_academic_year_change(request_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    if role != 'admin':
        raise HTTPException(status_code=403, detail='Only the Admin can confirm this change using the Director OTP.')
    branch_id = x_branch_id or 'BR-MAIN'
    request = await db.academic_year_change_requests.find_one(branch_scope(branch_id, {'id': request_id, 'status': 'Pending'}))
    if not request:
        raise HTTPException(status_code=404, detail='No pending Academic Year change request was found.')
    if datetime.fromisoformat(request['expires_at']) < datetime.utcnow():
        await db.academic_year_change_requests.update_one({'id': request_id}, {'$set': {'status': 'Expired'}})
        raise HTTPException(status_code=422, detail='This approval code has expired. Ask the Admin to request a new one.')
    if str(payload.get('otp') or '').strip() != request.get('otp'):
        raise HTTPException(status_code=422, detail='The approval code is incorrect.')
    collection = db.academic_structure if branch_id == 'BR-MAIN' else db.branch_academic_structures
    query = {'id': 'school-structure'} if branch_id == 'BR-MAIN' else {'branch_id': branch_id}
    await collection.update_one(query, {'$set': {'academic_year': request['requested_year'], 'updated': datetime.utcnow().isoformat()}}, upsert=True)
    await db.branches.update_one({'id': branch_id}, {'$set': {'academic_year': request['requested_year']}})
    await db.academic_year_change_requests.update_one({'id': request_id}, {'$set': {'status': 'Approved', 'confirmed_by': 'Admin', 'confirmed_at': datetime.utcnow().isoformat()}})
    await add_event('success', 'Academic Year changed', f"Admin confirmed the Academic Year change from {request['current_year']} to {request['requested_year']} using the Director OTP.", branch_id)
    return {'ok': True, 'academic_year': request['requested_year']}

# Student promotion creates a new annual enrolment. It never replaces the
# previous year's academic, attendance, fee or assessment records.
PROMOTION_DECISIONS = {'promote', 'retain', 'transfer', 'discontinue', 'hold'}

@api_router.get("/student-promotion-request")
async def get_student_promotion_request(role: str = Depends(get_current)):
    request = await db.student_promotion_requests.find_one({'status': 'Pending'}, sort=[('created', -1)])
    if not request:
        return None
    response = clean(request)
    if role != 'director':
        response.pop('otp', None)
    return response

@api_router.post("/student-promotion-request")
async def request_student_promotion(payload: StudentPromotionRequest, role: str = Depends(get_current)):
    if role != 'admin':
        raise HTTPException(status_code=403, detail='Only an Admin can prepare and request a student promotion.')
    source_year = payload.source_year.strip()
    target_year = payload.target_year.strip()
    if not source_year or not target_year or source_year == target_year:
        raise HTTPException(status_code=422, detail='Select different source and target Academic Years.')
    if not payload.entries:
        raise HTTPException(status_code=422, detail='Select at least one student.')

    structure = await db.academic_structure.find_one({'id': 'school-structure'})
    if not structure or structure.get('academic_year') != target_year:
        raise HTTPException(status_code=422, detail='Set and approve the target Academic Year in Academic Setup first.')
    valid_sections = {
        str(item.get('name') or '').strip(): {
            str(section.get('name') or '').strip() for section in item.get('sections') or []
        }
        for item in structure.get('classes') or []
    }

    prepared = []
    counts = {key: 0 for key in PROMOTION_DECISIONS}
    seen = set()
    for entry in payload.entries:
        if entry.student_id in seen:
            continue
        seen.add(entry.student_id)
        decision = entry.decision.strip().lower()
        if decision not in PROMOTION_DECISIONS:
            raise HTTPException(status_code=422, detail='A selected student has an invalid promotion decision.')
        student = await db.students.find_one({'id': entry.student_id})
        if not student:
            raise HTTPException(status_code=404, detail='One of the selected students no longer exists.')
        if str(student.get('academic_year') or '').strip() != source_year:
            raise HTTPException(status_code=422, detail=f"{student.get('name', 'Student')} is not enrolled in {source_year}.")

        target_class = entry.target_class.strip()
        target_section = entry.target_section.strip()
        if decision in ('promote', 'retain'):
            if target_class not in valid_sections or target_section not in valid_sections[target_class]:
                raise HTTPException(status_code=422, detail=f"Choose a valid target Class and Section for {student.get('name', 'Student')}.")
            if decision == 'retain' and target_class != str(student.get('class_name') or '').strip():
                raise HTTPException(status_code=422, detail=f"Retained student {student.get('name', 'Student')} must remain in the same Class.")

        prepared.append({
            'student_id': student['id'], 'name': student.get('name', ''),
            'admission_no': student.get('admission_no', ''), 'decision': decision,
            'source_class': student.get('class_name', ''), 'source_section': student.get('section', ''),
            'target_class': target_class, 'target_section': target_section,
        })
        counts[decision] += 1

    await db.student_promotion_requests.update_many({'status': 'Pending'}, {'$set': {'status': 'Superseded'}})
    request = {
        'id': str(uuid.uuid4()), 'source_year': source_year, 'target_year': target_year,
        'entries': prepared, 'summary': counts, 'status': 'Pending',
        'otp': f"{secrets.randbelow(1000000):06d}", 'otp_attempts': 0,
        'recipients': ['Director'], 'requested_by': 'Admin',
        'created': datetime.utcnow().isoformat(),
        'expires_at': (datetime.utcnow() + timedelta(minutes=30)).isoformat(),
    }
    await db.student_promotion_requests.insert_one(dict(request))
    await add_event(
        'warning', 'Student promotion approval required',
        f"Admin prepared {len(prepared)} student decisions from {source_year} to {target_year}. The approval code is available to the Director."
    )
    return {
        'id': request['id'], 'source_year': source_year, 'target_year': target_year,
        'status': 'Pending', 'summary': counts, 'student_count': len(prepared),
        'recipients': request['recipients'], 'expires_at': request['expires_at'],
    }

@api_router.post("/student-promotion-request/{request_id}/confirm")
async def confirm_student_promotion(request_id: str, payload: StudentPromotionConfirm, role: str = Depends(get_current)):
    if role != 'admin':
        raise HTTPException(status_code=403, detail='Only the Admin can confirm promotion using the Director OTP.')
    request = await db.student_promotion_requests.find_one({'id': request_id, 'status': 'Pending'})
    if not request:
        raise HTTPException(status_code=404, detail='No pending student promotion request was found.')
    if datetime.fromisoformat(request['expires_at']) < datetime.utcnow():
        await db.student_promotion_requests.update_one({'id': request_id}, {'$set': {'status': 'Expired'}})
        raise HTTPException(status_code=422, detail='This approval code has expired. Request a new approval.')
    if payload.otp.strip() != request.get('otp'):
        attempts = int(request.get('otp_attempts') or 0) + 1
        update = {'otp_attempts': attempts}
        if attempts >= 5:
            update['status'] = 'Locked'
        await db.student_promotion_requests.update_one({'id': request_id}, {'$set': update})
        detail = 'Too many incorrect attempts. Prepare a new promotion request.' if attempts >= 5 else 'The approval code is incorrect.'
        raise HTTPException(status_code=422, detail=detail)

    completed = {key: 0 for key in PROMOTION_DECISIONS}
    now = datetime.utcnow().isoformat()
    for entry in request.get('entries') or []:
        student = await db.students.find_one({'id': entry.get('student_id')})
        if not student or str(student.get('academic_year') or '') != request.get('source_year'):
            continue
        student_snapshot = clean(dict(student))
        await db.student_enrollments.update_one(
            {'student_id': student['id'], 'academic_year': request['source_year']},
            {'$setOnInsert': {
                'id': str(uuid.uuid4()), 'student_id': student['id'],
                'academic_year': request['source_year'], 'class_name': student.get('class_name', ''),
                'section': student.get('section', ''), 'status': student.get('status', 'Active'),
                'student_snapshot': student_snapshot, 'archived_at': now,
            }}, upsert=True,
        )

        decision = entry.get('decision')
        if decision in ('promote', 'retain'):
            updates = {
                'academic_year': request['target_year'], 'class_name': entry.get('target_class', ''),
                'section': entry.get('target_section', ''), 'status': 'Active',
                'previous_academic_year': request['source_year'], 'previous_class': entry.get('source_class', ''),
                'previous_section': entry.get('source_section', ''), 'promotion_decision': decision,
                'promoted_at': now,
            }
            await db.students.update_one({'id': student['id']}, {'$set': updates})
            await db.student_enrollments.update_one(
                {'student_id': student['id'], 'academic_year': request['target_year']},
                {'$set': {
                    'id': str(uuid.uuid4()), 'student_id': student['id'],
                    'academic_year': request['target_year'], 'class_name': entry.get('target_class', ''),
                    'section': entry.get('target_section', ''), 'status': 'Active',
                    'source_year': request['source_year'], 'previous_class': entry.get('source_class', ''),
                    'previous_section': entry.get('source_section', ''), 'decision': decision,
                    'created': now,
                }}, upsert=True,
            )
            await apply_active_fee_structures({**student_snapshot, **updates})
        else:
            status = {'transfer': 'Transferred Out', 'discontinue': 'Discontinued', 'hold': 'Promotion Hold'}[decision]
            await db.students.update_one(
                {'id': student['id']},
                {'$set': {'status': status, 'promotion_decision': decision, 'promotion_reviewed_at': now}},
            )
        completed[decision] += 1

    await db.student_promotion_requests.update_one(
        {'id': request_id},
        {'$set': {'status': 'Approved', 'confirmed_by': 'Admin', 'confirmed_at': now, 'completed_summary': completed}},
    )
    await add_event(
        'success', 'Student promotion completed',
        f"Admin completed the approved rollover from {request['source_year']} to {request['target_year']}. Previous-year records remain preserved."
    )
    return {'ok': True, 'source_year': request['source_year'], 'target_year': request['target_year'], 'summary': completed}

@api_router.get("/students/{sid}/academic-history")
async def get_student_academic_history(sid: str, role: str = Depends(get_current)):
    history = await db.student_enrollments.find({'student_id': sid}).sort('academic_year', -1).to_list(100)
    return [clean(item) for item in history]

# Admissions CRM and collection intelligence
@api_router.get("/admission-leads")
async def list_admission_leads(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    branch_id = x_branch_id or 'BR-MAIN'
    leads = await db.admission_leads.find(branch_scope(branch_id)).sort('created', -1).to_list(1000)
    for lead in leads:
        if not lead.get('experience_token'):
            token = secrets.token_urlsafe(18)
            await db.admission_leads.update_one({'_id': lead['_id']}, {'$set': {'experience_token': token}})
            lead['experience_token'] = token
    return [clean(x) for x in leads]

@api_router.post("/admission-leads")
async def create_admission_lead(payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    now = datetime.utcnow()
    parent_name = str(payload.get('name') or '').strip()
    child_name = str(payload.get('child_name') or '').strip()
    phone = ''.join(character for character in str(payload.get('phone') or '') if character.isdigit())
    interested_class = str(payload.get('interested_class') or '').strip()
    next_follow_up = str(payload.get('next_follow_up') or '').strip()
    source = str(payload.get('source') or 'Walk-in').strip()
    is_walk_in = source.lower() == 'walk-in'
    if not parent_name or not child_name or len(phone) < 10 or not interested_class or (not is_walk_in and not next_follow_up):
        raise HTTPException(status_code=422, detail='Parent name, child name, valid phone and interested class are required. Campaign enquiries also need a next follow-up.')
    duplicate = await db.admission_leads.find_one(branch_scope(branch_id, {'phone': phone, 'stage': {'$nin': ['Admitted', 'Lost']}}))
    if duplicate:
        raise HTTPException(status_code=409, detail=f"An active enquiry already exists for this phone under {duplicate.get('child_name') or duplicate.get('name')}.")
    payload['name'] = parent_name; payload['child_name'] = child_name; payload['phone'] = phone
    payload['next_follow_up'] = next_follow_up; payload['source'] = source
    payload['branch_id'] = branch_id
    payload.setdefault('id', f"ENQ-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:5].upper()}"); payload.setdefault('stage', 'Visit' if is_walk_in else 'Enquiry'); payload.setdefault('priority', 'Hot' if is_walk_in else 'Warm'); payload.setdefault('created', now.isoformat()); payload.setdefault('last_activity', now.isoformat()); payload.setdefault('experience_token', secrets.token_urlsafe(18))
    if is_walk_in: payload.setdefault('visit_date', now.isoformat())
    payload['activities'] = [{'at': now.isoformat(), 'outcome': 'Walk-in recorded' if is_walk_in else 'Enquiry received', 'notes': str(payload.get('notes') or '').strip(), 'next_follow_up': payload.get('next_follow_up', ''), 'by': ROLE_CONFIG[role]['name']}]
    payload['followups'] = [] if is_walk_in else [{'day': 0, 'task': 'Call parent', 'status': 'Pending'}, {'day': 1, 'task': 'Send school information', 'status': 'Pending'}, {'day': 3, 'task': 'Follow-up call', 'status': 'Pending'}, {'day': 7, 'task': 'Campus visit reminder', 'status': 'Pending'}, {'day': 14, 'task': 'Final follow-up', 'status': 'Pending'}]
    await db.admission_leads.insert_one(dict(payload)); return payload

@api_router.put("/admission-leads/{lead_id}")
async def update_admission_lead(lead_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    record = await db.admission_leads.find_one(branch_scope(branch_id, {'id': lead_id}))
    if not record:
        raise HTTPException(status_code=404, detail='Admission enquiry not found.')
    allowed = {'stage', 'priority', 'interested_class', 'source', 'next_follow_up', 'lost_reason', 'notes', 'visit_date', 'date_of_birth', 'previous_school', 'previous_class', 'residential_area', 'transport_required', 'assessment_conducted', 'assessment_date', 'assessment_score', 'assessment_max_marks', 'assessment_cutoff', 'assessment_result', 'recommended_class', 'parent_experience_status', 'admission_fee', 'tuition_fee_note', 'books_fee_note', 'transport_fee_note', 'fee_quote_mode', 'fee_items', 'fee_quote_total', 'fee_explained_at', 'parent_decision', 'decision_note', 'application_printed_at', 'application_signed', 'admission_fee_paid', 'admission_fee_paid_amount', 'admission_fee_payment_mode', 'admission_fee_receipt_no'}
    changes = {key: value for key, value in payload.items() if key in allowed}
    if changes.get('admission_fee_paid') and float(changes.get('admission_fee_paid_amount') or record.get('admission_fee_paid_amount') or 0) <= 0:
        raise HTTPException(status_code=422, detail='Enter the admission-fee amount received before marking it paid.')
    if changes.get('admission_fee_paid'):
        changes['admission_fee_receipt_no'] = str(changes.get('admission_fee_receipt_no') or record.get('admission_fee_receipt_no') or f"ADM-RCP-{uuid.uuid4().hex[:8].upper()}").strip()
        changes['admission_fee_paid_at'] = datetime.utcnow().isoformat()
    if changes.get('stage') and changes['stage'] not in {'Enquiry', 'Contacted', 'Visit', 'Application', 'Selected', 'Admitted', 'Lost'}:
        raise HTTPException(status_code=422, detail='Choose a valid admission stage.')
    changes['last_activity'] = datetime.utcnow().isoformat()
    changes['updated_by'] = ROLE_CONFIG[role]['name']
    await db.admission_leads.update_one(branch_scope(branch_id, {'id': lead_id}), {'$set': changes})
    return clean(await db.admission_leads.find_one(branch_scope(branch_id, {'id': lead_id})))

@api_router.post("/admission-leads/{lead_id}/activities")
async def add_admission_activity(lead_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    record = await db.admission_leads.find_one(branch_scope(branch_id, {'id': lead_id}))
    if not record:
        raise HTTPException(status_code=404, detail='Admission enquiry not found.')
    outcome = str(payload.get('outcome') or '').strip()
    if not outcome:
        raise HTTPException(status_code=422, detail='Choose a follow-up outcome.')
    next_follow_up = str(payload.get('next_follow_up') or '').strip()
    if outcome not in {'Not interested', 'Wrong number'} and not next_follow_up:
        raise HTTPException(status_code=422, detail='Choose the next follow-up date so this family stays in the admission follow-up queue.')
    now = datetime.utcnow()
    activity = {'at': now.isoformat(), 'outcome': outcome, 'notes': str(payload.get('notes') or '').strip(), 'next_follow_up': next_follow_up, 'visit_date': str(payload.get('visit_date') or ''), 'by': ROLE_CONFIG[role]['name']}
    stage_map = {'Parent contacted': 'Contacted', 'Information shared': 'Contacted', 'Campus visit scheduled': 'Visit', 'Application promised': 'Application', 'Not interested': 'Lost'}
    updates = {'last_activity': now.isoformat(), 'last_outcome': outcome, 'next_follow_up': activity['next_follow_up'], 'updated_by': ROLE_CONFIG[role]['name']}
    if outcome in stage_map: updates['stage'] = stage_map[outcome]
    if activity['visit_date']: updates['visit_date'] = activity['visit_date']
    if outcome == 'Not interested': updates['lost_reason'] = str(payload.get('lost_reason') or 'Not interested').strip()
    await db.admission_leads.update_one(branch_scope(branch_id, {'id': lead_id}), {'$set': updates, '$push': {'activities': activity}})
    return clean(await db.admission_leads.find_one(branch_scope(branch_id, {'id': lead_id})))

@api_router.post("/admission-leads/{lead_id}/confirm-admission")
async def confirm_admission_lead(lead_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    lead = await db.admission_leads.find_one(branch_scope(branch_id, {'id': lead_id}))
    if not lead:
        raise HTTPException(status_code=404, detail='Admission application not found.')
    if lead.get('stage') == 'Admitted' and lead.get('student_id'):
        student = await db.students.find_one(branch_scope(branch_id, {'id': lead['student_id']}))
        return {'ok': True, 'student': clean(student), 'lead': clean(lead)}
    if lead.get('stage') != 'Selected':
        raise HTTPException(status_code=422, detail='Mark the application as Selected before confirming admission.')
    if lead.get('parent_decision') != 'Confirmed':
        raise HTTPException(status_code=422, detail='Record the parent decision as Confirmed before enrolment.')
    if not lead.get('admission_fee_paid'):
        raise HTTPException(status_code=422, detail='Record the admission-fee payment before enrolment.')
    documents = lead.get('documents') or {}
    admission_mode = str(payload.get('admission_no_mode') or 'auto').strip().lower()
    admission_no = str(payload.get('admission_no') or '').strip()
    class_name = str(payload.get('class_name') or '').strip()
    section = str(payload.get('section') or '').strip()
    academic_year = str(payload.get('academic_year') or lead.get('academic_year') or '2026-2027').strip()
    if not class_name or not section:
        raise HTTPException(status_code=422, detail='Final class and section are required.')
    if admission_mode == 'auto' or not admission_no:
        year = datetime.utcnow().strftime('%Y')
        sequence = await db.students.count_documents({'admission_no': {'$regex': f'^ADM-{year}-'}}) + 1
        admission_no = f"ADM-{year}-{sequence:04d}"
        while await db.students.find_one({'admission_no': admission_no}):
            sequence += 1
            admission_no = f"ADM-{year}-{sequence:04d}"
    if await db.students.find_one({'admission_no': admission_no}):
        raise HTTPException(status_code=409, detail=f"Admission number '{admission_no}' already exists.")
    structure = await attendance_academic_structure(branch_id)
    if structure and structure.get('classes'):
        allowed = {(item.get('name'), section_item.get('name')) for item in structure.get('classes', []) for section_item in item.get('sections', [])}
        if (class_name, section) not in allowed:
            raise HTTPException(status_code=422, detail='Choose a class and section created in Academic Setup.')
        academic_year = structure.get('academic_year') or academic_year
    quoted_items = lead.get('fee_items') or []
    for item in quoted_items:
        structure_id = str(item.get('structure_id') or '').strip()
        if not structure_id:
            continue
        fee_structure = await db.fee_structures.find_one(branch_scope(branch_id, {'id': structure_id}))
        if not fee_structure:
            raise HTTPException(status_code=422, detail=f"The selected fee '{item.get('name', 'Fee')}' no longer exists in Fee Management. Update the fee quote before admission.")
        applies = any(str(target.get('class_name') or '').strip() == class_name and str(target.get('section') or '').strip() == section for target in fee_structure.get('targets') or [])
        if not applies:
            raise HTTPException(status_code=422, detail=f"The selected fee '{fee_structure.get('name', 'Fee')}' does not apply to {class_name} {section}. Update the fee quote before admission.")
    now = datetime.utcnow().isoformat()
    student = {
        'id': f"EP-{uuid.uuid4().hex[:8].upper()}", 'name': lead.get('child_name') or lead.get('name'),
        'admission_no': admission_no, 'class_name': class_name, 'section': section,
        'roll': str(payload.get('roll') or '').strip(), 'academic_year': academic_year,
        'status': 'Active', 'gender': str(lead.get('gender') or 'Not Specified'),
        'father_name': lead.get('name', ''), 'parent_name': lead.get('name', ''),
        'mobile': lead.get('phone', ''), 'parent_phone': lead.get('phone', ''),
        'admission_source': lead.get('source', ''), 'admission_lead_id': lead_id,
        'document_checklist': {
            'birth_certificate': bool(documents.get('birth_certificate')),
            'previous_record': bool(documents.get('transfer_certificate') or documents.get('bonafide_certificate')),
            'photos': bool(documents.get('student_photo')),
            'address_proof': bool(documents.get('address_proof')),
        },
        'admission_documents': documents,
        'created': datetime.utcnow().isoformat(), 'balance': 0, 'branch_id': branch_id,
    }
    await ensure_branch_capacity(branch_id)
    await db.students.insert_one(dict(student))
    fees_added = 0
    if quoted_items:
        for item in quoted_items:
            amount = float(item.get('amount') or 0)
            if amount <= 0:
                continue
            structure_id = str(item.get('structure_id') or '').strip()
            if structure_id and await db.fees.find_one(branch_scope(branch_id, {'student_id': student['id'], 'structure_id': structure_id})):
                continue
            await db.fees.insert_one({
                'id': f"FEE-{uuid.uuid4().hex[:8].upper()}", 'structure_id': structure_id,
                'student_id': student['id'], 'name': student['name'], 'avatar': student.get('avatar', ''),
                'fee_name': str(item.get('name') or 'School Fee').strip(),
                'category': str(item.get('category') or 'Other').strip(),
                'description': 'Selected during admission processing', 'academic_year': academic_year,
                'due_date': str(item.get('due_date') or now[:10]),
                'total': amount, 'paid': 0, 'discount': 0, 'due': amount, 'status': 'Unpaid',
                'created': datetime.utcnow().isoformat(), 'source': 'Admission Management', 'branch_id': branch_id,
            })
            fees_added += 1
        await sync_student_fee_balance(student['id'], branch_id)
    else:
        fees_added = await apply_active_fee_structures(student)
    paid_amount = float(lead.get('admission_fee_paid_amount') or lead.get('admission_fee') or 0)
    receipt = None
    if paid_amount > 0:
        admission_invoice = await db.fees.find_one(branch_scope(branch_id, {'student_id': student['id'], '$or': [
            {'category': {'$regex': 'admission', '$options': 'i'}},
            {'fee_name': {'$regex': 'admission', '$options': 'i'}},
        ]}))
        if not admission_invoice:
            admission_invoice = {
                'id': f"FEE-{uuid.uuid4().hex[:8].upper()}", 'structure_id': '', 'student_id': student['id'],
                'name': student['name'], 'fee_name': 'Admission Fee', 'category': 'Admission',
                'description': 'Admission fee collected during enrolment', 'academic_year': academic_year,
                'due_date': now[:10], 'total': paid_amount, 'paid': 0, 'discount': 0,
                'due': paid_amount, 'status': 'Unpaid', 'created': now, 'branch_id': branch_id,
            }
            await db.fees.insert_one(dict(admission_invoice)); fees_added += 1
        amount_applied = min(paid_amount, float(admission_invoice.get('due') or paid_amount))
        balance_after = max(0, float(admission_invoice.get('due') or 0) - amount_applied)
        await db.fees.update_one(branch_scope(branch_id, {'id': admission_invoice['id']}), {'$set': {
            'paid': float(admission_invoice.get('paid') or 0) + amount_applied,
            'due': balance_after, 'status': 'Paid' if balance_after <= 0 else 'Partial',
            'method': lead.get('admission_fee_payment_mode', 'Cash'),
        }})
        receipt = {
            'id': str(lead.get('admission_fee_receipt_no') or '').strip() or f"RCP-{uuid.uuid4().hex[:10].upper()}",
            'fee_id': admission_invoice['id'], 'student_id': student['id'], 'student_name': student['name'],
            'fee_name': admission_invoice.get('fee_name', 'Admission Fee'), 'amount': amount_applied,
            'discount': 0, 'method': lead.get('admission_fee_payment_mode', 'Cash'), 'balance_after': balance_after,
            'academic_year': academic_year, 'admission_no': admission_no, 'class_name': class_name,
            'section': section, 'parent_name': student['parent_name'], 'parent_phone': student['parent_phone'],
            'paid_at': now, 'received_by': ROLE_CONFIG[role]['name'], 'source': 'Admission Management', 'branch_id': branch_id,
        }
        if not await db.fee_receipts.find_one(branch_scope(branch_id, {'id': receipt['id']})):
            await db.fee_receipts.insert_one(dict(receipt))
        await sync_student_fee_balance(student['id'], branch_id)
    await db.admission_leads.update_one(branch_scope(branch_id, {'id': lead_id}), {'$set': {'stage': 'Admitted', 'student_id': student['id'], 'admission_no': admission_no, 'confirmed_at': now, 'last_activity': now, 'updated_by': ROLE_CONFIG[role]['name']}, '$push': {'activities': {'at': now, 'outcome': 'Admission confirmed', 'notes': f"Student record {admission_no} created in {class_name} {section}.", 'by': ROLE_CONFIG[role]['name']}}})
    await add_event('success', 'Admission confirmed', f"{student['name']} was admitted to {class_name} {section} with admission number {admission_no}.", branch_id)
    return {'ok': True, 'student': clean(student), 'fees_assigned': fees_added, 'receipt': clean(receipt) if receipt else None, 'lead': clean(await db.admission_leads.find_one(branch_scope(branch_id, {'id': lead_id})))}

@api_router.get('/admission-leads/{lead_id}/application-pdf')
async def download_admission_application(lead_id: str, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    lead = await db.admission_leads.find_one(branch_scope(branch_id, {'id': lead_id}))
    if not lead:
        raise HTTPException(status_code=404, detail='Admission application not found.')
    school = await db.branches.find_one({'id': lead.get('branch_id') or 'BR-MAIN'}) or {}
    content = build_admission_application_pdf(clean(lead), clean(school))
    student_name = re.sub(r'[^A-Za-z0-9_-]+', '-', str(lead.get('child_name') or 'student')).strip('-') or 'student'
    filename = f"admission-application-{student_name}.pdf"
    return StreamingResponse(
        io.BytesIO(content), media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )

@api_router.post('/admission-leads/{lead_id}/documents/{document_type}')
async def upload_admission_document(lead_id: str, document_type: str, file: UploadFile = File(...), role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    lead = await db.admission_leads.find_one(branch_scope(branch_id, {'id': lead_id}))
    if not lead: raise HTTPException(status_code=404, detail='Admission application not found.')
    allowed_types = {'bonafide_certificate', 'transfer_certificate', 'birth_certificate', 'address_proof', 'student_photo', 'signed_admission_application'}
    if document_type not in allowed_types: raise HTTPException(status_code=422, detail='Choose a valid admission document type.')
    content = await file.read()
    if len(content) > 8 * 1024 * 1024: raise HTTPException(status_code=413, detail='Upload a file smaller than 8 MB.')
    extension = Path(file.filename or '').suffix.lower()
    if extension not in {'.pdf', '.png', '.jpg', '.jpeg'}: raise HTTPException(status_code=422, detail='Upload a PDF, PNG or JPG file.')
    if document_type == 'signed_admission_application' and extension != '.pdf':
        raise HTTPException(status_code=422, detail='Upload the signed admission application as a PDF file.')
    stored_name = f"{lead_id}-{document_type}-{uuid.uuid4().hex[:8]}{extension}"
    (ADMISSION_UPLOAD_DIR / stored_name).write_bytes(content)
    document = {'type': document_type, 'name': file.filename, 'url': f'/uploads/admissions/{stored_name}', 'uploaded_at': datetime.utcnow().isoformat(), 'uploaded_by': ROLE_CONFIG[role]['name']}
    changes = {f'documents.{document_type}': document, 'last_activity': datetime.utcnow().isoformat()}
    if document_type == 'signed_admission_application':
        changes['application_signed'] = True
    await db.admission_leads.update_one(branch_scope(branch_id, {'id': lead_id}), {'$set': changes})
    if lead.get('student_id'):
        student_changes = {f'admission_documents.{document_type}': document, 'updated_at': datetime.utcnow().isoformat()}
        await db.students.update_one(branch_scope(branch_id, {'id': lead['student_id']}), {'$set': student_changes})
    return document

@api_router.get('/admission-assessment-rules')
async def get_admission_assessment_rules(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    branch_id = x_branch_id or 'BR-MAIN'
    rules = [clean(item) for item in await db.admission_assessment_rules.find(branch_scope(branch_id)).sort('class_name', 1).to_list(100)]
    if rules: return rules
    structure = await attendance_academic_structure(branch_id)
    return [{'class_name': item.get('name'), 'maximum_marks': 100, 'cutoff_marks': 40, 'approved_by': 'Principal / Academic Coordinator'} for item in structure.get('classes', [])]

@api_router.put('/admission-assessment-rules/{class_name}')
async def save_admission_assessment_rule(class_name: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'director', 'academic_coordinator', 'admin'})
    branch_id = x_branch_id or 'BR-MAIN'
    maximum = float(payload.get('maximum_marks') or 0); cutoff = float(payload.get('cutoff_marks') or 0)
    if maximum <= 0 or cutoff < 0 or cutoff > maximum:
        raise HTTPException(status_code=422, detail='Enter a valid maximum score and cut-off.')
    rule = {'class_name': class_name, 'maximum_marks': maximum, 'cutoff_marks': cutoff, 'academic_year': str(payload.get('academic_year') or ''), 'approved_by': ROLE_CONFIG[role]['name'], 'approved_at': datetime.utcnow().isoformat(), 'branch_id': branch_id}
    await db.admission_assessment_rules.update_one(branch_scope(branch_id, {'class_name': class_name}), {'$set': rule}, upsert=True)
    return rule

@api_router.post('/admission-leads/{lead_id}/academic-decision')
async def save_admission_academic_decision(lead_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'academic_coordinator', 'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    lead = await db.admission_leads.find_one(branch_scope(branch_id, {'id': lead_id}))
    if not lead: raise HTTPException(status_code=404, detail='Admission application not found.')
    structure = await attendance_academic_structure(branch_id)
    class_names = {str(item.get('name') or '').strip() for item in structure.get('classes', [])}
    applied_raw = str(lead.get('interested_class') or '').strip()
    applied_class = next((name for name in class_names if name.lower() == applied_raw.lower()), applied_raw)
    rule = await db.admission_assessment_rules.find_one(branch_scope(branch_id, {'class_name': applied_class})) or {'maximum_marks': 100, 'cutoff_marks': 40, 'approved_by': 'School academic policy'}
    conducted = bool(payload.get('assessment_conducted'))
    maximum = float(rule.get('maximum_marks') or 100); cutoff = float(rule.get('cutoff_marks') or 40)
    score = float(payload.get('assessment_score') or 0) if conducted else None
    if conducted and (score < 0 or score > maximum): raise HTTPException(status_code=422, detail=f'Assessment score must be between 0 and {maximum:g}.')
    recommended_class = str(payload.get('recommended_class') or applied_class).strip()
    if not recommended_class: raise HTTPException(status_code=422, detail='Academic team must choose a recommended class.')
    if class_names and recommended_class not in class_names:
        raise HTTPException(status_code=422, detail='Choose the recommended class from Academic Setup.')
    now = datetime.utcnow().isoformat()
    result = ('Passed' if score >= cutoff else 'Below cut-off') if conducted else 'Not conducted'
    decision = {'assessment_conducted': conducted, 'assessment_date': str(payload.get('assessment_date') or '') if conducted else '', 'assessment_score': score, 'assessment_max_marks': maximum if conducted else None, 'assessment_cutoff': cutoff if conducted else None, 'assessment_result': result, 'recommended_class': recommended_class, 'academic_remarks': str(payload.get('academic_remarks') or '').strip(), 'recommended_by': ROLE_CONFIG[role]['name'], 'recommended_at': now, 'academic_decision_status': 'Class Decided', 'approved_by': ROLE_CONFIG[role]['name'], 'approved_at': now, 'cutoff_approved_by': rule.get('approved_by', '') if conducted else '', 'parent_experience_status': str(payload.get('parent_experience_status') or lead.get('parent_experience_status') or 'Scheduled'), 'stage': 'Selected', 'last_activity': now}
    assessment_note = f"Assessment score {score:g}/{maximum:g}; " if conducted else 'Assessment not conducted; '
    await db.admission_leads.update_one(branch_scope(branch_id, {'id': lead_id}), {'$set': decision, '$unset': {'parent_requested_class': '', 'class_exception_requested': '', 'class_exception_reason': ''}, '$push': {'activities': {'at': now, 'outcome': 'Class decision recorded', 'notes': f"{assessment_note}final class {recommended_class}.", 'by': ROLE_CONFIG[role]['name']}}})
    return clean(await db.admission_leads.find_one(branch_scope(branch_id, {'id': lead_id})))

@api_router.get('/admission-experience/{token}')
async def public_admission_experience(token: str):
    lead = await db.admission_leads.find_one({'experience_token': token})
    if not lead: raise HTTPException(status_code=404, detail='Admission experience link is invalid.')
    settings = await db.settings.find_one({'id': 'school-settings'}) or {}
    return {'school_name': settings.get('schoolName', 'Orison School'), 'child_name': lead.get('child_name', ''), 'interested_class': lead.get('interested_class', ''), 'visit_date': lead.get('visit_date', ''), 'sections': [
        {'title': 'How children learn here', 'body': 'Activity-based teaching, clear explanations, regular practice and individual support.'},
        {'title': 'Curriculum journey', 'body': 'A balanced programme covering academics, communication, creativity, sports and life skills.'},
        {'title': 'What parents can experience', 'body': 'Meet the academic team, understand classroom methods, review the curriculum and ask questions while the child completes the assessment.'},
    ]}

@api_router.get("/admissions-intelligence")
async def admissions_intelligence(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    leads = [clean(x) for x in await db.admission_leads.find(branch_scope(x_branch_id or 'BR-MAIN')).to_list(1000)]
    stages = ['Enquiry', 'Contacted', 'Visit', 'Application', 'Selected', 'Admitted']
    funnel = [{'stage': stage, 'count': len([x for x in leads if x.get('stage') == stage])} for stage in stages]
    stale = []
    for lead in leads:
        try:
            if datetime.utcnow() - datetime.fromisoformat(lead.get('last_activity', lead['created'])) > timedelta(hours=48): stale.append(lead)
        except ValueError: pass
    reasons = {}
    for lead in leads:
        if lead.get('stage') == 'Lost' and lead.get('lost_reason'): reasons[lead['lost_reason']] = reasons.get(lead['lost_reason'], 0) + 1
    total = len(leads)
    today = datetime.utcnow().date().isoformat()
    overdue = [lead for lead in leads if lead.get('next_follow_up') and lead.get('next_follow_up') < today and lead.get('stage') not in {'Admitted', 'Lost'}]
    assessed = [lead for lead in leads if lead.get('assessment_score') is not None]
    passed = [lead for lead in assessed if lead.get('assessment_result') == 'Passed']
    payment_pending = [lead for lead in leads if lead.get('parent_decision') == 'Confirmed' and not lead.get('admission_fee_paid') and lead.get('stage') != 'Lost']
    return {
        'funnel': funnel, 'stale': stale,
        'lost_reasons': [{'reason': k, 'count': v} for k, v in sorted(reasons.items(), key=lambda item: item[1], reverse=True)],
        'conversion': round((funnel[-1]['count'] / total * 100), 1) if total else 0,
        'overdue_followups': len(overdue),
        'assessment': {'assessed': len(assessed), 'passed': len(passed), 'pass_rate': round(len(passed) / len(assessed) * 100, 1) if assessed else 0},
        'payment_pending': len(payment_pending),
        'bottlenecks': [{'stage': stage, 'count': len([lead for lead in leads if lead.get('stage') == stage])} for stage in ['Visit', 'Application', 'Selected']],
    }

@api_router.get("/collections-intelligence")
async def collections_intelligence(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    raw_fees = await db.fees.find(branch_scope(branch_id)).to_list(5000)
    fees = [await fee_with_student(item, branch_id) for item in raw_fees]
    followups = {
        item.get('fee_id'): clean(item)
        for item in await db.collection_followups.find(branch_scope(branch_id)).to_list(5000)
    }
    today_date = datetime.utcnow().date()
    bucket_config = [
        ('Critical', 'More than 60 days overdue', 'Principal / KDM escalation'),
        ('High Priority', '30–60 days overdue', 'Fee manager follow-up'),
        ('Upcoming', 'Due within 15 days', 'Send payment reminder'),
        ('Current Dues', 'Other active dues', 'Monitor payment status'),
    ]
    buckets = {name: {'label': name, 'rule': rule, 'default_action': action, 'amount': 0, 'count': 0} for name, rule, action in bucket_config}
    cases = []
    promises_due_today = 0
    missed_followups = 0
    closed_cases = []

    for fee in fees:
        due = float(fee.get('due') or 0)
        followup = followups.get(fee.get('id'), {})
        if due <= 0:
            if followup:
                closed_cases.append({
                    **fee, 'fee_id': fee.get('id'), 'student_name': fee.get('name', ''),
                    'closed_at': followup.get('closed_at') or followup.get('updated_at') or '',
                    'case_status': 'Paid', 'owner': followup.get('owner') or 'Unassigned',
                    'history': followup.get('history') or [], 'payment_plan': followup.get('payment_plan') or [],
                })
            continue
        due_date = None
        try:
            due_date = datetime.fromisoformat(str(fee.get('due_date') or '')).date()
        except ValueError:
            pass
        days_overdue = max(0, (today_date - due_date).days) if due_date and due_date < today_date else 0
        days_until_due = (due_date - today_date).days if due_date and due_date >= today_date else None
        if days_overdue > 60:
            bucket = 'Critical'
        elif days_overdue >= 30:
            bucket = 'High Priority'
        elif days_until_due is not None and days_until_due <= 15:
            bucket = 'Upcoming'
        else:
            bucket = 'Current Dues'

        next_follow_up = str(followup.get('next_follow_up') or '')
        promise_date = str(followup.get('promise_date') or '')
        case_status = followup.get('case_status') or 'Open'
        if promise_date == today_date.isoformat() and case_status not in {'Closed', 'Paid'}:
            promises_due_today += 1
        if next_follow_up and next_follow_up < today_date.isoformat() and case_status not in {'Closed', 'Paid'}:
            missed_followups += 1
        buckets[bucket]['amount'] += due
        buckets[bucket]['count'] += 1
        cases.append({
            'id': fee.get('id'),
            'fee_id': fee.get('id'),
            'student_id': fee.get('student_id', ''),
            'student_name': fee.get('name', ''),
            'admission_no': fee.get('admission_no', ''),
            'parent_name': fee.get('parent_name', ''),
            'parent_phone': fee.get('parent_phone', ''),
            'class_name': fee.get('class_name', ''),
            'section': fee.get('section', ''),
            'fee_name': fee.get('fee_name', 'School Fee'),
            'academic_year': fee.get('academic_year', ''),
            'due': due,
            'due_date': fee.get('due_date', ''),
            'days_overdue': days_overdue,
            'bucket': bucket,
            'status': fee.get('status', 'Unpaid'),
            'owner': followup.get('owner') or 'Unassigned',
            'last_contact': followup.get('last_contact') or '',
            'parent_response': followup.get('parent_response') or '',
            'next_follow_up': next_follow_up,
            'promise_amount': float(followup.get('promise_amount') or 0),
            'promise_date': promise_date,
            'case_status': case_status,
            'default_action': buckets[bucket]['default_action'],
            'history': followup.get('history') or [],
            'payment_plan': followup.get('payment_plan') or [],
            'escalation_level': 'Director / KDM' if days_overdue > 60 or (promise_date and promise_date < today_date.isoformat()) else ('Accounts Head' if days_overdue >= 30 or (next_follow_up and next_follow_up < today_date.isoformat()) else ''),
        })

    cases.sort(key=lambda item: ({'Critical': 0, 'High Priority': 1, 'Upcoming': 2, 'Current Dues': 3}[item['bucket']], -item['due']))
    expected = sum(float(item.get('total') or 0) for item in fees)
    discounts = sum(float(item.get('discount') or 0) for item in fees)
    collected = sum(float(item.get('paid') or 0) for item in fees)
    outstanding = sum(float(item.get('due') or 0) for item in fees)
    fee_breakdown = {}
    for fee in fees:
        fee_name = str(fee.get('fee_name') or fee.get('category') or 'Uncategorised Fee').strip()
        item = fee_breakdown.setdefault(fee_name, {
            'fee_name': fee_name, 'category': str(fee.get('category') or '').strip(),
            'expected': 0, 'discounts': 0, 'collected': 0, 'outstanding': 0, 'fee_dues': 0,
        })
        item['expected'] += float(fee.get('total') or 0)
        item['discounts'] += float(fee.get('discount') or 0)
        item['collected'] += float(fee.get('paid') or 0)
        item['outstanding'] += float(fee.get('due') or 0)
        if float(fee.get('due') or 0) > 0:
            item['fee_dues'] += 1
    fee_breakdown_rows = []
    for item in fee_breakdown.values():
        collectible = max(0, item['expected'] - item['discounts'])
        item['collection_rate'] = round((item['collected'] / max(1, collectible)) * 100, 1)
        for key in ('expected', 'discounts', 'collected', 'outstanding'):
            item[key] = round(item[key], 2)
        fee_breakdown_rows.append(item)
    fee_breakdown_rows.sort(key=lambda item: (-item['outstanding'], item['fee_name'].lower()))
    return {
        'expected': expected,
        'approved_adjustments': discounts,
        'collectible': max(0, expected - discounts),
        'collected': collected,
        'outstanding': outstanding,
        'efficiency': round((collected / max(1, expected - discounts)) * 100, 1),
        'buckets': list(buckets.values()),
        'fee_breakdown': fee_breakdown_rows,
        'cases': cases,
        'closed_cases': sorted(closed_cases, key=lambda item: item.get('closed_at', ''), reverse=True),
        'accounts': cases,
        'today': {'promises_due': promises_due_today, 'missed_followups': missed_followups, 'critical': buckets['Critical']['count']},
        'reconciliation': {'expected': expected, 'adjustments': discounts, 'collectible': max(0, expected - discounts), 'collected': collected, 'outstanding': outstanding},
    }

@api_router.get('/collections-intelligence-owners')
async def collection_intelligence_owners(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    staff = await db.staff.find(branch_scope(x_branch_id or 'BR-MAIN', {'status': {'$ne': 'Inactive'}})).sort('name', 1).to_list(1000)
    return [{'id': item.get('id'), 'name': item.get('name', ''), 'department': item.get('department', ''), 'designation': item.get('designation', '')} for item in staff]

@api_router.post("/collections-intelligence/{fee_id}/follow-up")
async def save_collection_follow_up(fee_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    fee = await db.fees.find_one(branch_scope(branch_id, {'id': fee_id}))
    if not fee:
        raise HTTPException(status_code=404, detail='Fee account not found.')
    allowed = {'owner', 'last_contact', 'parent_response', 'next_follow_up', 'promise_amount', 'promise_date', 'case_status'}
    update = {key: payload.get(key) for key in allowed if key in payload}
    update['fee_id'] = fee_id
    update['updated_at'] = datetime.utcnow().isoformat()
    update['updated_by'] = ROLE_CONFIG[role]['name']
    update['branch_id'] = branch_id
    history_entry = {
        'at': update['updated_at'], 'by': ROLE_CONFIG[role]['name'],
        'outcome': str(payload.get('case_status') or 'Follow-up updated'),
        'notes': str(payload.get('parent_response') or ''),
        'next_follow_up': str(payload.get('next_follow_up') or ''),
        'promise_amount': float(payload.get('promise_amount') or 0),
        'promise_date': str(payload.get('promise_date') or ''),
    }
    await db.collection_followups.update_one(branch_scope(branch_id, {'fee_id': fee_id}), {'$set': update, '$push': {'history': history_entry}, '$setOnInsert': {'id': f'COL-{uuid.uuid4().hex[:10].upper()}', 'created_at': datetime.utcnow().isoformat()}}, upsert=True)
    await add_event('info', 'Collection follow-up updated', f"{ROLE_CONFIG[role]['name']} updated the collection follow-up for {fee.get('name', 'a student')}.")
    return clean(await db.collection_followups.find_one(branch_scope(branch_id, {'fee_id': fee_id})))

@api_router.post('/collections-intelligence/{fee_id}/reminder')
async def send_collection_reminder(fee_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    fee = await db.fees.find_one(branch_scope(branch_id, {'id': fee_id}))
    if not fee: raise HTTPException(status_code=404, detail='Fee account not found.')
    student = await db.students.find_one(branch_scope(branch_id, {'id': fee.get('student_id')})) or {}
    channel = str(payload.get('channel') or 'Parent App')
    message = str(payload.get('message') or f"Fee reminder: ₹{float(fee.get('due') or 0):,.2f} is pending for {fee.get('fee_name', 'School Fee')}.").strip()
    notification = {'id': f'PAR-COL-{uuid.uuid4().hex[:10].upper()}', 'student_id': fee.get('student_id'), 'student_name': student.get('name', fee.get('name', '')), 'parent_name': student.get('parent_name') or student.get('father_name') or 'Parent', 'parent_phone': student.get('parent_phone') or student.get('mobile') or student.get('phone') or '', 'channel': channel, 'message': message, 'status': 'Queued', 'fee_id': fee_id, 'created': datetime.utcnow().isoformat(), 'branch_id': branch_id}
    await db.parent_notifications.insert_one(notification)
    entry = {'at': notification['created'], 'by': ROLE_CONFIG[role]['name'], 'outcome': f'{channel} reminder queued', 'notes': message}
    await db.collection_followups.update_one(branch_scope(branch_id, {'fee_id': fee_id}), {'$push': {'history': entry}, '$set': {'last_reminder_status': 'Queued', 'last_reminder_channel': channel, 'updated_at': notification['created'], 'branch_id': branch_id}, '$setOnInsert': {'id': f'COL-{uuid.uuid4().hex[:10].upper()}', 'created_at': notification['created']}}, upsert=True)
    return clean(notification)

@api_router.put('/collections-intelligence/{fee_id}/parent-contact')
async def update_collection_parent_contact(fee_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director', 'fee_manager'})
    branch_id = x_branch_id or 'BR-MAIN'
    fee = await db.fees.find_one(branch_scope(branch_id, {'id': fee_id}))
    if not fee: raise HTTPException(status_code=404, detail='Fee account not found.')
    phone = str(payload.get('phone') or '').strip()
    if len(''.join(ch for ch in phone if ch.isdigit())) < 10: raise HTTPException(status_code=422, detail='Enter a valid parent mobile number.')
    await db.students.update_one(branch_scope(branch_id, {'id': fee.get('student_id')}), {'$set': {'parent_phone': phone}})
    await add_event('info', 'Parent contact corrected', f"Parent contact was updated for {fee.get('name', 'student')} from Collection Intelligence.")
    return {'ok': True, 'phone': phone}

@api_router.post('/collections-intelligence/{fee_id}/payment-plan')
async def save_collection_payment_plan(fee_id: str, payload: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, {'admin', 'director'})
    branch_id = x_branch_id or 'BR-MAIN'
    fee = await db.fees.find_one(branch_scope(branch_id, {'id': fee_id}))
    if not fee: raise HTTPException(status_code=404, detail='Fee account not found.')
    installments = payload.get('installments') or []
    if not installments or abs(sum(float(item.get('amount') or 0) for item in installments) - float(fee.get('due') or 0)) > 0.01:
        raise HTTPException(status_code=422, detail='Installment amounts must equal the current outstanding balance.')
    now = datetime.utcnow().isoformat()
    plan = [{'amount': float(item.get('amount') or 0), 'due_date': str(item.get('due_date') or ''), 'status': 'Scheduled'} for item in installments]
    await db.collection_followups.update_one(branch_scope(branch_id, {'fee_id': fee_id}), {'$set': {'payment_plan': plan, 'case_status': 'Payment Plan', 'updated_at': now, 'updated_by': ROLE_CONFIG[role]['name'], 'branch_id': branch_id}, '$push': {'history': {'at': now, 'by': ROLE_CONFIG[role]['name'], 'outcome': 'Payment plan approved', 'notes': f'{len(plan)} installment(s) approved.'}}, '$setOnInsert': {'id': f'COL-{uuid.uuid4().hex[:10].upper()}', 'created_at': now}}, upsert=True)
    return {'ok': True, 'payment_plan': plan}

# Academic improvement engine: data -> risk -> action -> result
async def detect_academic_risks(create_cases: bool = False, branch_id: str = 'BR-MAIN'):
    """Evaluate saved marks and operational signals, optionally opening deduplicated cases."""
    students = [clean(x) for x in await db.students.find(branch_scope(branch_id)).to_list(1000) if student_is_active_on(x)]
    signals = {x['student_id']: clean(x) for x in await db.academic_signals.find(branch_scope(branch_id)).to_list(1000)}
    marks_sets = await db.marks_sets.find(branch_scope(branch_id)).sort('created', 1).to_list(1000)
    histories = {}
    for mark_set in marks_sets:
        maximum = mark_set.get('total_max') or 100
        subject = mark_set.get('subject') or 'Subject'
        for row in mark_set.get('rows', []):
            name = (row.get('name') or '').strip().lower()
            if name and maximum:
                histories.setdefault(name, {}).setdefault(subject, []).append(round((row.get('total', 0) / maximum) * 100, 1))
    risks, created, existing = [], 0, 0
    for student in students:
        signal = signals.get(student['id'], {})
        attendance, homework = signal.get('attendance_percent', 100), signal.get('homework_percent', 100)
        issues, low_subjects = [], []
        if attendance < 75: issues.append(f"Attendance {attendance}%")
        if homework < 60: issues.append(f"Homework {homework}%")
        for subject, scores in histories.get(student['name'].lower(), {}).items():
            latest = scores[-1]
            if latest < 50:
                issues.append(f"{subject} score {latest}%"); low_subjects.append(subject)
            if len(scores) > 1 and latest - scores[-2] <= -10:
                issues.append(f"{subject} declined {abs(round(latest - scores[-2], 1))} points"); low_subjects.append(subject)
        if not issues:
            continue
        severity = 'High' if attendance < 65 or any('score ' in item and float(item.rsplit(' ', 1)[-1].strip('%')) < 40 for item in issues if 'score ' in item) or len(issues) >= 3 else 'Medium'
        concern = '; '.join(issues)
        risk = {'student_id': student['id'], 'student_name': student['name'], 'class_name': f"{student.get('class_name','')} {student.get('section','')}".strip(), 'indicators': issues, 'severity': severity, 'recommendation': 'Parent meeting, targeted practice, and reassessment' if severity == 'High' else 'Teacher follow-up and reassessment'}
        risks.append(risk)
        if create_cases:
            open_case = await db.interventions.find_one(branch_scope(branch_id, {'student_id': student['id'], 'status': {'$ne': 'Completed'}}))
            if open_case:
                existing += 1
            else:
                case = {'id': str(uuid.uuid4()), 'student_id': student['id'], 'student_name': student['name'], 'concern': concern, 'recommended_action': risk['recommendation'], 'owner': 'Academic Coordinator', 'deadline': (datetime.utcnow() + timedelta(days=7)).date().isoformat(), 'status': 'Open', 'auto_generated': True, 'created': datetime.utcnow().isoformat(), 'branch_id': branch_id}
                await db.interventions.insert_one(case)
                await add_event('warning', 'Academic intervention created', f"{student['name']} was flagged: {concern}.")
                created += 1
    return {'risks': risks, 'created': created, 'existing': existing}

@api_router.get("/academic-intelligence")
async def academic_intelligence(role: str = Depends(get_current)):
    risks = (await detect_academic_risks())['risks']
    units = [clean(x) for x in await db.curriculum_units.find().to_list(1000)]
    cases = [clean(x) for x in await db.interventions.find().to_list(1000)]
    mark_sets = [clean(x) for x in await db.marks_sets.find().sort('created', 1).to_list(5000)]
    attendance_records = [clean(x) for x in await db.attendance_records.find({'attendance_role': 'student'}).to_list(20000)]
    academic_signals = [clean(x) for x in await db.academic_signals.find().to_list(5000)]
    classroom_observations = [clean(x) for x in await db.classroom_observations.find().to_list(5000)]
    today = datetime.utcnow().date().isoformat()
    behind = [x for x in units if x.get('status') == 'Overdue' or (x.get('target_date') and x.get('target_date') < today and x.get('status') != 'Completed')]
    open_cases = [x for x in cases if x.get('status') != 'Completed']

    def clamp(value):
        return round(max(0, min(100, float(value))), 1)

    # One assessment can contain several subjects. Combine them before comparing
    # the latest exam with the previous two exams so subjects are not double-counted.
    assessments = {}
    student_assessments = {}
    for mark_set in mark_sets:
        created = str(mark_set.get('created') or '')
        exam_title = str(mark_set.get('exam_title') or 'Assessment')
        key = f"{exam_title}|{created[:10]}"
        assessment = assessments.setdefault(key, {'created': created, 'scores': []})
        maximum = float(mark_set.get('total_max') or (float(mark_set.get('max_written') or 0) + float(mark_set.get('max_practical') or 0)) or 100)
        for row in mark_set.get('rows', []):
            name = str(row.get('name') or '').strip().lower()
            if not name or maximum <= 0:
                continue
            score = clamp((float(row.get('total') or 0) / maximum) * 100)
            assessment['scores'].append(score)
            student_assessments.setdefault(name, {}).setdefault(key, []).append(score)

    ordered_assessments = sorted(assessments.items(), key=lambda item: item[1]['created'])
    latest_assessment = ordered_assessments[-1][1] if ordered_assessments else None
    exam_performance = round(sum(latest_assessment['scores']) / len(latest_assessment['scores']), 1) if latest_assessment and latest_assessment['scores'] else None

    maintaining_or_improving = []
    ordered_keys = [item[0] for item in ordered_assessments]
    for exam_scores in student_assessments.values():
        history = []
        for key in ordered_keys:
            values = exam_scores.get(key, [])
            if values:
                history.append(sum(values) / len(values))
        if len(history) >= 3:
            previous_baseline = (history[-2] + history[-3]) / 2
            maintaining_or_improving.append(history[-1] >= previous_baseline)
    exam_improvement = round((sum(1 for item in maintaining_or_improving if item) / len(maintaining_or_improving)) * 100, 1) if maintaining_or_improving else None

    attendance_value = None
    if attendance_records:
        attended = len([item for item in attendance_records if item.get('status') in ('Present', 'Late')])
        attendance_value = round((attended / len(attendance_records)) * 100, 1)

    completed_on_schedule = []
    for unit in units:
        if unit.get('status') != 'Completed':
            completed_on_schedule.append(False)
            continue
        completed_date = str(unit.get('completed_at') or '')[:10]
        target_date = str(unit.get('target_date') or '')[:10]
        completed_on_schedule.append(not target_date or (completed_date and completed_date <= target_date))
    syllabus_value = round((sum(1 for item in completed_on_schedule if item) / len(completed_on_schedule)) * 100, 1) if completed_on_schedule else None

    participation_values = [float(item.get('participation_percent')) for item in academic_signals if item.get('participation_percent') is not None]
    participation_values.extend([
        (float(item.get('engagement_score')) / 5) * 100
        for item in classroom_observations if item.get('engagement_score') is not None
    ])
    participation_value = round(sum(participation_values) / len(participation_values), 1) if participation_values else None

    intervention_value = None
    if cases:
        completed_cases = len([item for item in cases if item.get('status') == 'Completed'])
        intervention_value = round((completed_cases / len(cases)) * 100, 1)

    indicator_definitions = [
        ('exam_performance', 'Latest exam performance', 30, exam_performance, 'Enter marks for the latest scheduled exam.', '/marks/add'),
        ('exam_improvement', 'Progress across the previous two exams', 20, exam_improvement, 'Review declining students and create subject support plans.', '/marks/results'),
        ('attendance', 'Student attendance', 15, attendance_value, 'Complete daily attendance and follow up recurring absence.', '/attendance/add'),
        ('syllabus', 'Syllabus completed on schedule', 15, syllabus_value, 'Reassign support or revise overdue chapter timelines.', '/academics/syllabus'),
        ('participation', 'Classroom participation', 10, participation_value, 'Record classroom participation and plan engagement support.', '/academics/interventions'),
        ('interventions', 'Academic interventions resolved', 10, intervention_value, 'Close completed cases and assign owners to open cases.', '/academics/interventions'),
    ]
    indicators = []
    available_weight = 0
    weighted_total = 0
    for key, label, weight, value, action, path in indicator_definitions:
        available = value is not None
        if available:
            available_weight += weight
            weighted_total += float(value) * weight
        indicators.append({'key': key, 'label': label, 'weight': weight, 'value': value, 'available': available, 'suggested_action': action, 'path': path})

    coverage = available_weight
    # Exam evidence is mandatory and at least half of the weighted evidence must
    # exist. Until then the ERP reports Awaiting data instead of manufacturing 0.
    health_score = round(weighted_total / available_weight, 1) if exam_performance is not None and available_weight >= 50 else None
    if health_score is None:
        health_status = 'Awaiting data'
    elif health_score >= 80:
        health_status = 'Healthy'
    elif health_score >= 65:
        health_status = 'Needs attention'
    else:
        health_status = 'Critical'
    available_indicators = [item for item in indicators if item['available']]
    weakest = min(available_indicators, key=lambda item: item['value']) if available_indicators else None
    academic_health = {
        'score': health_score,
        'status': health_status,
        'coverage': coverage,
        'indicators': indicators,
        'weakest_indicator': weakest,
        'method': 'Available indicators are reweighted to 100%. A latest exam and at least 50% data coverage are required.',
    }
    # Today's queue is driven by the same six indicators as the health score.
    # Missing evidence is actionable too because it prevents an accurate score.
    actions = []
    for indicator in indicators:
        value = indicator['value']
        if indicator['available'] and value >= 80:
            continue
        missing = not indicator['available']
        gap = 100 if missing else max(0, 80 - float(value))
        impact = round((gap * indicator['weight']) / 100, 1)
        actions.append({
            'indicator': indicator['label'],
            'title': indicator['suggested_action'],
            'reason': 'Required evidence has not been recorded.' if missing else f"Current result is {value}% against the 80% healthy benchmark.",
            'current_value': value,
            'weight': indicator['weight'],
            'potential_impact': impact,
            'status': 'Data required' if missing else ('Critical' if value < 65 else 'Needs attention'),
            'path': indicator['path'],
        })
    actions.sort(key=lambda item: (-item['potential_impact'], -item['weight'], item['indicator']))
    return {'school_academic_score': health_score, 'academic_health': academic_health,
            'at_risk_students': len(risks), 'syllabus_behind': len(behind), 'interventions_open': len(open_cases),
            'risks': risks, 'actions': actions, 'syllabus': units}

@api_router.post("/academic-intelligence/run")
async def run_academic_intelligence(role: str = Depends(get_current)):
    return await detect_academic_risks(create_cases=True)

@api_router.get("/academic-signals")
async def list_academic_signals(role: str = Depends(get_current)):
    # Never show orphaned/demo signals: only current enrolled students are eligible.
    student_ids = [x['id'] for x in await db.students.find({}, {'id': 1}).to_list(1000)]
    if not student_ids:
        return []
    return [clean(x) for x in await db.academic_signals.find({'student_id': {'$in': student_ids}}).to_list(1000)]

@api_router.post("/academic-signals")
async def save_academic_signal(payload: dict, role: str = Depends(get_current)):
    student_id = str(payload.get('student_id') or '').strip()
    if not student_id or not await db.students.find_one({'id': student_id}):
        raise HTTPException(status_code=422, detail='Choose a currently enrolled student.')
    for field in ('attendance_percent', 'participation_percent'):
        try:
            value = float(payload.get(field))
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail='Enter a real percentage for attendance, homework and participation.')
        if value < 0 or value > 100:
            raise HTTPException(status_code=422, detail='Percentages must be between 0 and 100.')
        payload[field] = value
    if payload.get('homework_percent') not in (None, ''):
        try:
            payload['homework_percent'] = float(payload['homework_percent'])
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail='Homework percentage must be between 0 and 100.')
        if payload['homework_percent'] < 0 or payload['homework_percent'] > 100:
            raise HTTPException(status_code=422, detail='Homework percentage must be between 0 and 100.')
    payload['updated'] = datetime.utcnow().isoformat()
    await db.academic_signals.update_one({'student_id': payload['student_id']}, {'$set': payload}, upsert=True)
    await detect_academic_risks(create_cases=True)
    return payload

@api_router.get("/student-health-dashboard")
async def student_health_dashboard(class_name: str = '', section: str = '', role: str = Depends(get_current)):
    """Real class-section health view. It never invents attendance, activity or assessment scores."""
    query = {}
    if class_name:
        query['class_name'] = class_name
    if section:
        query['section'] = section
    students = [clean(x) for x in await db.students.find(query).sort('name', 1).to_list(1000)]
    student_ids = [student['id'] for student in students]
    signals = {item['student_id']: clean(item) for item in await db.academic_signals.find({'student_id': {'$in': student_ids}}).to_list(1000)} if student_ids else {}
    interventions = [clean(item) for item in await db.interventions.find({'student_id': {'$in': student_ids}}).sort('deadline', 1).to_list(1000)] if student_ids else []
    active_plan_by_student = {}
    for plan in interventions:
        if plan.get('status') != 'Completed' and plan.get('student_id') not in active_plan_by_student:
            active_plan_by_student[plan.get('student_id')] = plan
    attendance_history = {}
    if student_ids:
        records = await db.attendance_records.find({'attendance_role': 'student', 'entity_id': {'$in': student_ids}}).to_list(10000)
        for record in records:
            history = attendance_history.setdefault(record['entity_id'], {'total': 0, 'attended': 0})
            history['total'] += 1
            if record.get('status') in ('Present', 'Late'):
                history['attended'] += 1
    mark_sets = await db.marks_sets.find({
        **({'class_name': class_name} if class_name else {}),
        **({'section': section} if section else {}),
    }).sort('created', 1).to_list(1000)

    assessments = {}
    latest_subject_sets = {}
    for mark_set in mark_sets:
        subject = mark_set.get('subject') or 'Subject'
        created = mark_set.get('created') or ''
        if subject not in latest_subject_sets or created >= latest_subject_sets[subject].get('created', ''):
            latest_subject_sets[subject] = mark_set
        key = f"{mark_set.get('exam_title') or 'Assessment'}|{created[:10]}"
        assessments.setdefault(key, {'title': mark_set.get('exam_title') or 'Assessment', 'created': created, 'by_student': {}})
        maximum = mark_set.get('total_max') or (mark_set.get('max_written', 0) + mark_set.get('max_practical', 0)) or 100
        for row in mark_set.get('rows', []):
            name = (row.get('name') or '').strip().lower()
            student_key = str(row.get('student_id') or '').strip() or (f'name:{name}' if name else '')
            if not student_key or not maximum:
                continue
            score = round((float(row.get('total', 0) or 0) / maximum) * 100, 1)
            assessments[key]['by_student'].setdefault(student_key, []).append(score)

    subject_scores = []
    for subject, mark_set in sorted(latest_subject_sets.items()):
        maximum = mark_set.get('total_max') or (mark_set.get('max_written', 0) + mark_set.get('max_practical', 0)) or 100
        values = [round((float(row.get('total', 0) or 0) / maximum) * 100, 1) for row in mark_set.get('rows', []) if maximum]
        subject_scores.append({'subject': subject, 'average': round(sum(values) / len(values), 1) if values else None, 'assessment': mark_set.get('exam_title') or 'Assessment'})

    ordered_assessments = sorted(assessments.values(), key=lambda item: item.get('created', ''))
    today_text = datetime.utcnow().date().isoformat()
    homework_rows = [clean(item) for item in await db.homework.find({
        **({'class_name': class_name} if class_name else {}), **({'section': section} if section else {}),
        'status': {'$in': ['Published', 'Active']}, 'due_date': {'$lte': today_text},
    }).to_list(5000)]
    homework_ids = [item.get('id') for item in homework_rows if item.get('id')]
    completion_rows = await db.homework_completions.find({'student_id': {'$in': student_ids}, 'homework_id': {'$in': homework_ids}}).to_list(10000) if student_ids and homework_ids else []
    completed_by_student = {}
    for completion in completion_rows:
        if completion.get('workflow_status') in {'Verified', 'Exempted'} or completion.get('completed'):
            completed_by_student.setdefault(completion.get('student_id'), set()).add(completion.get('homework_id'))
    rows = []
    for student in students:
        name = (student.get('name') or '').strip().lower()
        scores = []
        for assessment in ordered_assessments:
            values = assessment['by_student'].get(student['id'], []) or assessment['by_student'].get(f'name:{name}', [])
            if values:
                scores.append({'title': assessment['title'], 'score': round(sum(values) / len(values), 1)})
        latest = scores[-1]['score'] if scores else None
        previous = scores[-2]['score'] if len(scores) >= 2 else None
        two_back = scores[-3]['score'] if len(scores) >= 3 else None
        comparison = round(latest - previous, 1) if latest is not None and previous is not None else None
        if latest is None:
            trend_status, trend_message = 'Awaiting data', 'No exam result recorded yet'
        elif comparison is None:
            trend_status, trend_message = 'Baseline recorded', 'One exam recorded — comparison starts after the next exam'
        elif comparison >= 3:
            trend_status, trend_message = 'Improved', f"Improved by {comparison:g} points since the previous exam"
        elif comparison <= -3:
            trend_status, trend_message = 'Declined', f"Declined by {abs(comparison):g} points since the previous exam"
        else:
            trend_status, trend_message = 'Stable', 'Performance is stable compared with the previous exam'
        signal = signals.get(student['id'], {})
        active_plan = active_plan_by_student.get(student['id'])
        attendance = round((attendance_history[student['id']]['attended'] / attendance_history[student['id']]['total']) * 100, 1) if attendance_history.get(student['id'], {}).get('total') else signal.get('attendance_percent')
        homework_percent = round(len(completed_by_student.get(student['id'], set())) / len(homework_ids) * 100, 1) if homework_ids else signal.get('homework_percent')
        rows.append({
            'student_id': student['id'], 'student_name': student.get('name', ''), 'roll': student.get('roll', ''),
            'attendance_percent': attendance, 'participation_percent': signal.get('participation_percent'),
            'homework_percent': homework_percent,
            'parent_phone': student.get('parent_phone') or student.get('phone') or student.get('guardian_phone') or '',
            'latest_score': latest, 'previous_score': previous, 'two_exams_ago_score': two_back,
            'change_from_previous': comparison,
            'change_from_two_exams': round(latest - two_back, 1) if latest is not None and two_back is not None else None,
            'trend_status': trend_status, 'trend_message': trend_message,
            'assessments_recorded': len(scores),
            'active_plan': ({
                'id': active_plan.get('id'), 'owner': active_plan.get('owner') or 'Unassigned',
                'deadline': active_plan.get('deadline'), 'status': active_plan.get('status') or 'Open',
                'signal': active_plan.get('signal') or active_plan.get('concern') or 'Student support',
            } if active_plan else None),
        })

    attendance_values = [row['attendance_percent'] for row in rows if row['attendance_percent'] is not None]
    participation_values = [row['participation_percent'] for row in rows if row['participation_percent'] is not None]
    latest_values = [row['latest_score'] for row in rows if row['latest_score'] is not None]
    return {
        'class_name': class_name, 'section': section, 'students': rows, 'subject_scores': subject_scores,
        'summary': {
            'student_count': len(rows),
            'overall_performance': round(sum(latest_values) / len(latest_values), 1) if latest_values else None,
            'average_attendance': round(sum(attendance_values) / len(attendance_values), 1) if attendance_values else None,
            'average_participation': round(sum(participation_values) / len(participation_values), 1) if participation_values else None,
            'improving_students': len([row for row in rows if (row['change_from_previous'] or 0) > 0]),
            'needs_attention': len([row for row in rows if (row['latest_score'] is not None and row['latest_score'] < 50) or (row['attendance_percent'] is not None and row['attendance_percent'] < 75)]),
        },
    }

@api_router.get("/curriculum-units")
async def list_curriculum_units(role: str = Depends(get_current)):
    today = datetime.utcnow().date().isoformat()
    units = [clean(x) for x in await db.curriculum_units.find().sort('target_date', 1).to_list(1000)]
    allocations = [clean(x) for x in await db.teacher_allocations.find().to_list(1000)]
    allocation_map = {(row.get('class_name'), row.get('section'), row.get('subject')): row for row in allocations}
    for unit in units:
        allocation = allocation_map.get((unit.get('class_name'), unit.get('section'), unit.get('subject')))
        if allocation and (unit.get('teacher_id') != allocation.get('teacher_id') or unit.get('teacher_name') != allocation.get('teacher_name')):
            unit['teacher_id'] = allocation.get('teacher_id', '')
            unit['teacher_name'] = allocation.get('teacher_name', '')
            if unit.get('status') != 'Completed':
                await db.curriculum_units.update_one({'id': unit['id']}, {'$set': {'teacher_id': unit['teacher_id'], 'teacher_name': unit['teacher_name']}})
        if unit.get('status') != 'Completed' and unit.get('target_date') and unit['target_date'] < today:
            unit['status'] = 'Overdue'
            if not unit.get('overdue_alerted'):
                await add_event('warning', 'Syllabus timeline overdue', f"{unit.get('teacher_name', 'Assigned teacher')} has not completed {unit.get('chapter')} for {unit.get('class_name')} {unit.get('section')} by {unit.get('target_date')}. Alerted: Director and Admin.")
                await db.curriculum_units.update_one({'id': unit['id']}, {'$set': {'status': 'Overdue', 'overdue_alerted': True, 'alert_recipients': ['Director', 'Admin']}})
            else:
                await db.curriculum_units.update_one({'id': unit['id']}, {'$set': {'status': 'Overdue'}})
    return units

@api_router.post("/curriculum-units")
async def save_curriculum_unit(payload: dict, role: str = Depends(get_current)):
    required = ['class_name', 'section', 'subject', 'chapter', 'start_date', 'target_date']
    missing = [key for key in required if not str(payload.get(key) or '').strip()]
    if missing:
        raise HTTPException(status_code=422, detail='Complete class, section, subject, chapter and both timeline dates.')
    structure = await db.academic_structure.find_one({'id': 'school-structure'})
    match = next((item for item in (structure or {}).get('classes', []) if item.get('name') == payload['class_name']), None)
    section = next((item for item in (match or {}).get('sections', []) if item.get('name') == payload['section']), None)
    if not section or payload['subject'] not in section.get('subjects', []):
        raise HTTPException(status_code=422, detail='Choose a subject configured for this class and section in Academic Setup.')
    allocation = await db.teacher_allocations.find_one({'class_name': payload['class_name'], 'section': payload['section'], 'subject': payload['subject']})
    payload.setdefault('id', str(uuid.uuid4()))
    payload['teacher_id'] = (allocation or {}).get('teacher_id', '')
    payload['teacher_name'] = (allocation or {}).get('teacher_name', 'Unassigned — assign a subject teacher')
    payload['completed_progress'] = 0
    payload['status'] = 'Planned'
    payload['created'] = datetime.utcnow().isoformat()
    await db.curriculum_units.insert_one(dict(payload))
    return payload

@api_router.post("/curriculum-units/{unit_id}/complete")
async def complete_curriculum_unit(unit_id: str, role: str = Depends(get_current)):
    unit = await db.curriculum_units.find_one({'id': unit_id})
    if not unit:
        raise HTTPException(status_code=404, detail='Curriculum chapter not found.')
    await db.curriculum_units.update_one({'id': unit_id}, {'$set': {'status': 'Completed', 'completed_progress': 100, 'completed_at': datetime.utcnow().isoformat(), 'overdue_alerted': False}})
    await add_event('success', 'Chapter completed', f"{unit.get('chapter')} was marked complete for {unit.get('class_name')} {unit.get('section')}.")
    return {'ok': True}

@api_router.get("/interventions")
async def list_interventions(role: str = Depends(get_current)):
    rows = [clean(x) for x in await db.interventions.find().to_list(1000)]
    today = datetime.utcnow().date()
    for row in rows:
        if row.get('status') == 'Completed' or not row.get('deadline'):
            continue
        try:
            days_overdue = (today - datetime.strptime(row['deadline'], '%Y-%m-%d').date()).days
        except ValueError:
            continue
        stage = 'Principal escalation' if days_overdue >= 7 else 'Coordinator escalation' if days_overdue >= 2 else 'Owner reminder' if days_overdue >= 0 else ''
        row['days_overdue'] = max(0, days_overdue)
        row['reminder_stage'] = stage
        if stage and row.get('last_reminder_stage') != stage:
            await db.interventions.update_one({'id': row['id']}, {'$set': {'last_reminder_stage': stage, 'last_reminder_at': datetime.utcnow().isoformat()}})
            await add_event('warning', stage, f"{row.get('student_name', 'Student')}'s support plan review is {max(0, days_overdue)} day(s) overdue. Owner: {row.get('owner_name') or row.get('owner') or 'Unassigned'}.")
    return rows

@api_router.get("/intervention-owners")
async def intervention_owners(role: str = Depends(get_current)):
    teachers = [clean(x) for x in await db.teachers.find({'status': {'$ne': 'Inactive'}}).sort('name', 1).to_list(1000)]
    staff = [clean(x) for x in await db.staff.find({'status': {'$ne': 'Inactive'}}).sort('name', 1).to_list(1000)]
    return [{'id': row.get('id'), 'name': row.get('name'), 'role': row.get('designation') or row.get('access_role') or 'Teacher', 'type': 'Teacher'} for row in teachers] + [{'id': row.get('id'), 'name': row.get('name'), 'role': row.get('designation') or row.get('access_role') or 'Staff', 'type': 'Staff'} for row in staff]

@api_router.post("/interventions")
async def save_intervention(payload: dict, role: str = Depends(get_current)):
    student = await db.students.find_one({'id': payload.get('student_id')})
    if not student:
        raise HTTPException(status_code=422, detail='Choose a currently enrolled student.')
    signal = str(payload.get('signal') or '').strip()
    duplicate = await db.interventions.find_one({'student_id': payload.get('student_id'), 'signal': signal, 'status': {'$ne': 'Completed'}})
    if duplicate:
        raise HTTPException(status_code=409, detail='An active support plan already exists for this student and signal. Open and update that plan instead.')
    owner_id = str(payload.get('owner_id') or '').strip()
    owner = (await db.teachers.find_one({'id': owner_id}) or await db.staff.find_one({'id': owner_id})) if owner_id else None
    if not owner:
        raise HTTPException(status_code=422, detail='Assign this plan to a specific active teacher or staff member.')
    payload['owner_name'] = owner.get('name', '')
    payload['owner'] = owner.get('name', '')
    payload.setdefault('id', str(uuid.uuid4())); payload.setdefault('status', 'Open'); payload.setdefault('created', datetime.utcnow().isoformat())
    await db.interventions.insert_one(dict(payload))
    await add_event('info', 'Student support plan assigned', f"{payload['owner_name']} is responsible for {student.get('name')}'s {signal or 'support'} plan by {payload.get('deadline') or 'the review date'}.")
    return payload

@api_router.put("/interventions/{intervention_id}")
async def update_intervention(intervention_id: str, payload: dict, role: str = Depends(get_current)):
    existing = await db.interventions.find_one({'id': intervention_id})
    if not existing:
        raise HTTPException(status_code=404, detail='Academic support plan not found.')
    allowed = {'status', 'owner_id', 'owner_name', 'owner', 'deadline', 'goal', 'recommended_action', 'parent_action', 'review_notes', 'outcome', 'baseline_value', 'review_value', 'review_result', 'next_step', 'next_review_date'}
    changes = {key: value for key, value in payload.items() if key in allowed}
    if changes.get('owner_id'):
        assigned = await db.teachers.find_one({'id': changes['owner_id'], 'status': {'$ne': 'Inactive'}}) or await db.staff.find_one({'id': changes['owner_id'], 'status': {'$ne': 'Inactive'}})
        if not assigned:
            raise HTTPException(status_code=422, detail='Choose an active teacher or staff member as the plan owner.')
        changes['owner_name'] = assigned.get('name', '')
        changes['owner'] = assigned.get('name', '')
    changes['updated'] = datetime.utcnow().isoformat()
    if changes.get('status') == 'Completed':
        changes['completed_at'] = datetime.utcnow().isoformat()
    await db.interventions.update_one({'id': intervention_id}, {'$set': changes})
    return clean(await db.interventions.find_one({'id': intervention_id}))

@api_router.post("/interventions/{intervention_id}/parent-contact")
async def record_intervention_parent_contact(intervention_id: str, payload: dict, role: str = Depends(get_current)):
    plan = await db.interventions.find_one({'id': intervention_id})
    if not plan:
        raise HTTPException(status_code=404, detail='Academic support plan not found.')
    student = await db.students.find_one({'id': plan.get('student_id')}) or {}
    entry = {'id': f"IPC-{uuid.uuid4().hex[:10].upper()}", 'intervention_id': intervention_id, 'student_id': plan.get('student_id'), 'student_name': plan.get('student_name'), 'parent_phone': student.get('parent_phone') or student.get('mobile') or student.get('phone') or '', 'channel': str(payload.get('channel') or 'Phone'), 'status': str(payload.get('status') or 'Contacted'), 'note': str(payload.get('note') or '').strip(), 'created': datetime.utcnow().isoformat()}
    await db.intervention_parent_contacts.insert_one(entry)
    await db.interventions.update_one({'id': intervention_id}, {'$set': {'last_parent_contact': entry['created'], 'parent_contact_status': entry['status']}})
    return clean(entry)

@api_router.get("/interventions/{intervention_id}/parent-contacts")
async def intervention_parent_contacts(intervention_id: str, role: str = Depends(get_current)):
    return [clean(x) for x in await db.intervention_parent_contacts.find({'intervention_id': intervention_id}).sort('created', -1).to_list(200)]

# ---------------- Parent app foundation ----------------
# These routes deliberately live beside the admin API while retaining a separate,
# parent-scoped token and ownership boundary. The Flutter client can adopt them when
# its deployment URL and OTP provider are ready.

PARENT_PHONE_FIELDS = ['parent_phone', 'mobile', 'mobile_alt', 'phone']

def normalize_mobile(value: str) -> str:
    return ''.join(character for character in str(value or '') if character.isdigit())[-10:]

def otp_digest(mobile: str, otp: str) -> str:
    return hashlib.sha256(f'{mobile}:{otp}:{JWT_SECRET}'.encode()).hexdigest()

async def students_for_parent_mobile(mobile: str):
    clauses = [{field: {'$regex': f'{mobile}$'}} for field in PARENT_PHONE_FIELDS]
    return [clean(row) for row in await db.students.find({'$or': clauses}).to_list(100)]

async def parent_session(payload: dict):
    account = await db.parent_accounts.find_one({'id': payload.get('parent_id')})
    if not account or account.get('status', 'Active') != 'Active':
        raise HTTPException(status_code=403, detail='This parent account is not active.')
    return clean(account)

async def owned_student(student_id: str, payload: dict):
    account = await parent_session(payload)
    if student_id not in account.get('student_ids', []):
        raise HTTPException(status_code=403, detail='This student is not linked to your account.')
    student = await db.students.find_one({'id': student_id})
    if not student:
        raise HTTPException(status_code=404, detail='Student not found.')
    return clean(student), account

def parent_notice_query(student: dict):
    return branch_scope(student.get('branch_id') or 'BR-MAIN', {
        'status': 'Published',
        '$or': [
            {'target_type': 'All'},
            {'target_type': 'Student', 'student_ids': student.get('id')},
            {'target_type': 'Class', 'class_name': student.get('class_name', ''), 'section': student.get('section', '')},
        ],
    })

@api_router.post('/parent/auth/request-otp')
async def request_parent_otp(request: ParentOtpRequest):
    mobile = normalize_mobile(request.mobile)
    if len(mobile) != 10:
        raise HTTPException(status_code=422, detail='Enter a valid registered 10-digit mobile number.')
    students = await students_for_parent_mobile(mobile)
    if not students:
        raise HTTPException(status_code=404, detail='No active student is linked to this mobile number.')
    otp = f'{secrets.randbelow(10000):04d}'
    now = datetime.utcnow()
    await db.parent_otp_sessions.update_many({'mobile': mobile, 'used': False}, {'$set': {'used': True}})
    session = {
        'id': f'OTP-{uuid.uuid4().hex[:12].upper()}', 'mobile': mobile,
        'otp_hash': otp_digest(mobile, otp), 'attempts': 0, 'used': False,
        'created': now.isoformat(), 'expires_at': (now + timedelta(minutes=5)).isoformat(),
    }
    await db.parent_otp_sessions.insert_one(session)
    await db.parent_notifications.insert_one({
        'id': f'PAR-AUTH-{uuid.uuid4().hex[:10].upper()}', 'parent_phone': mobile,
        'channel': 'SMS', 'status': 'Queued', 'message_type': 'Parent login OTP',
        'created': now.isoformat(),
    })
    response = {'request_id': session['id'], 'expires_in': 300, 'delivery_status': 'Queued', 'mobile_hint': f'••••••{mobile[-4:]}'}
    if os.environ.get('PARENT_OTP_DEBUG', 'false').lower() == 'true':
        response['debug_otp'] = otp
    return response

@api_router.post('/parent/auth/verify-otp')
async def verify_parent_otp(request: ParentOtpVerify):
    mobile = normalize_mobile(request.mobile)
    session = await db.parent_otp_sessions.find_one({'mobile': mobile, 'used': False}, sort=[('created', -1)])
    if not session:
        raise HTTPException(status_code=401, detail='Request a new OTP and try again.')
    if datetime.fromisoformat(session['expires_at']) < datetime.utcnow():
        await db.parent_otp_sessions.update_one({'id': session['id']}, {'$set': {'used': True}})
        raise HTTPException(status_code=401, detail='This OTP has expired. Request a new one.')
    attempts = int(session.get('attempts', 0)) + 1
    if otp_digest(mobile, request.otp.strip()) != session.get('otp_hash'):
        await db.parent_otp_sessions.update_one({'id': session['id']}, {'$set': {'attempts': attempts, 'used': attempts >= 5}})
        raise HTTPException(status_code=401, detail='The OTP is incorrect.')
    await db.parent_otp_sessions.update_one({'id': session['id']}, {'$set': {'used': True, 'verified_at': datetime.utcnow().isoformat()}})
    students = await students_for_parent_mobile(mobile)
    student_ids = [student['id'] for student in students if student.get('id')]
    existing = await db.parent_accounts.find_one({'mobile': mobile})
    parent_id = (existing or {}).get('id') or f'PAR-{uuid.uuid4().hex[:10].upper()}'
    first = students[0]
    parent = {
        'id': parent_id, 'mobile': mobile,
        'name': (existing or {}).get('name') or first.get('parent_name') or first.get('father_name') or first.get('guardian_name') or 'Parent',
        'email': (existing or {}).get('email', ''), 'relationship': (existing or {}).get('relationship', 'Guardian'),
        'alternate_mobile': (existing or {}).get('alternate_mobile', ''),
        'address': (existing or {}).get('address') or first.get('address', ''),
        'preferred_language': (existing or {}).get('preferred_language', 'English'),
        'push_notifications': (existing or {}).get('push_notifications', True),
        'whatsapp_updates': (existing or {}).get('whatsapp_updates', True),
        'email_updates': (existing or {}).get('email_updates', False),
        'student_ids': student_ids, 'status': 'Active', 'last_login': datetime.utcnow().isoformat(),
    }
    await db.parent_accounts.update_one({'id': parent_id}, {'$set': parent}, upsert=True)
    token = create_token('parent', parent_id=parent_id)
    return {'token': token, 'parent': parent, 'students': students}

@api_router.get('/parent/me')
async def get_parent_profile(payload: dict = Depends(get_parent_current)):
    account = await parent_session(payload)
    students = [clean(row) for row in await db.students.find({'id': {'$in': account.get('student_ids', [])}}).to_list(100)]
    return {'parent': account, 'students': students}

@api_router.put('/parent/me')
async def update_parent_profile(update: dict, payload: dict = Depends(get_parent_current)):
    account = await parent_session(payload)
    allowed = {'name', 'email', 'relationship', 'alternate_mobile', 'address', 'preferred_language', 'push_notifications', 'whatsapp_updates', 'email_updates'}
    changes = {key: update[key] for key in allowed if key in update}
    changes['updated'] = datetime.utcnow().isoformat()
    await db.parent_accounts.update_one({'id': account['id']}, {'$set': changes})
    return clean(await db.parent_accounts.find_one({'id': account['id']}))

@api_router.get('/parent/students')
async def get_parent_students(payload: dict = Depends(get_parent_current)):
    account = await parent_session(payload)
    return [clean(row) for row in await db.students.find({'id': {'$in': account.get('student_ids', [])}}).to_list(100)]

@api_router.get('/parent/students/{student_id}/dashboard')
async def parent_student_dashboard(student_id: str, payload: dict = Depends(get_parent_current)):
    student, _ = await owned_student(student_id, payload)
    fees = [clean(row) for row in await db.fees.find({'student_id': student_id}).to_list(500)]
    attendance = [clean(row) for row in await db.attendance_records.find({'attendance_role': 'student', 'entity_id': student_id}).sort('attendance_date', -1).to_list(500)]
    homework = [clean(row) for row in await db.homework.find({'class_name': student.get('class_name'), 'section': student.get('section')}).sort('created', -1).to_list(100)]
    completed_homework_ids = {
        row.get('homework_id')
        for row in await db.homework_completions.find({'student_id': student_id, 'completed': True}).to_list(500)
    }
    notices = await db.parent_notices.count_documents(parent_notice_query(student))
    unread = notices - await db.parent_notice_reads.count_documents({'parent_id': payload['parent_id'], 'student_id': student_id})
    total_attendance = len(attendance)
    present = len([row for row in attendance if row.get('status') in {'Present', 'Late'}])
    return {
        'student': student,
        'summary': {
            'fee_due': round(sum(float(row.get('due') or 0) for row in fees), 2),
            'attendance_percent': round(present / total_attendance * 100, 1) if total_attendance else None,
            'pending_homework': len([row for row in homework if row.get('id') not in completed_homework_ids]),
            'unread_notices': max(0, unread),
        },
    }

@api_router.get('/parent/students/{student_id}/attendance')
async def parent_student_attendance(student_id: str, month: str = '', date_from: str = '', date_to: str = '', payload: dict = Depends(get_parent_current)):
    await owned_student(student_id, payload)
    if month:
        try:
            month_start = datetime.strptime(month, '%Y-%m')
            next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
            date_from = month_start.date().isoformat()
            date_to = (next_month.date() - timedelta(days=1)).isoformat()
        except ValueError:
            raise HTTPException(status_code=422, detail='Month must use YYYY-MM format.')
    query = {'attendance_role': 'student', 'entity_id': student_id}
    if date_from or date_to:
        query['attendance_date'] = {}
        if date_from: query['attendance_date']['$gte'] = date_from
        if date_to: query['attendance_date']['$lte'] = date_to
    return [clean(row) for row in await db.attendance_records.find(query).sort('attendance_date', -1).to_list(1000)]

@api_router.get('/parent/students/{student_id}/results')
async def parent_student_results(student_id: str, payload: dict = Depends(get_parent_current)):
    await owned_student(student_id, payload)
    card = await report_card(student_id, published_only=True, role='admin')
    signal = clean(await db.academic_signals.find_one({'student_id': student_id})) or {}
    assessments = {}
    for mark in card.get('marks', []):
        title = mark.get('assessment', 'Assessment')
        assessment = assessments.setdefault(title, {'title': title, 'created': mark.get('created', ''), 'subjects': {}})
        assessment['created'] = max(assessment.get('created', ''), mark.get('created', ''))
        assessment['subjects'][mark.get('subject', 'Subject')] = float(mark.get('percent') or 0)
    history = sorted(assessments.values(), key=lambda item: item.get('created', ''))
    comparison = None
    insights = []
    if len(history) >= 2:
        previous, current = history[-2], history[-1]
        subjects = sorted(set(previous['subjects']) | set(current['subjects']))
        subject_rows = []
        for subject in subjects:
            before, after = previous['subjects'].get(subject), current['subjects'].get(subject)
            change = round(after - before, 1) if before is not None and after is not None else None
            subject_rows.append({
                'subject': subject, 'previous': before, 'current': after, 'change': change,
                'trend': 'Improved' if change is not None and change > 0 else ('Needs support' if change is not None and change < 0 else 'Steady'),
            })
        previous_average = round(sum(previous['subjects'].values()) / len(previous['subjects']), 1) if previous['subjects'] else 0
        current_average = round(sum(current['subjects'].values()) / len(current['subjects']), 1) if current['subjects'] else 0
        improved = sorted([row for row in subject_rows if (row.get('change') or 0) > 0], key=lambda row: -row['change'])
        declined = sorted([row for row in subject_rows if (row.get('change') or 0) < 0], key=lambda row: row['change'])
        better_exam = current['title'] if current_average >= previous_average else previous['title']
        insights.append(f"The stronger overall result was {better_exam}.")
        if improved:
            insights.append(f"Best improvement: {improved[0]['subject']} increased by {improved[0]['change']:.1f} points.")
        if declined:
            insights.append(f"Support recommended: {declined[0]['subject']} decreased by {abs(declined[0]['change']):.1f} points.")
        comparison = {
            'previous_exam': previous['title'], 'current_exam': current['title'],
            'previous_average': previous_average, 'current_average': current_average,
            'change': round(current_average - previous_average, 1), 'better_exam': better_exam,
            'subjects': subject_rows,
        }
    participation = signal.get('participation_percent')
    if participation is not None:
        if float(participation) >= 80:
            insights.append('Class participation is a current strength and should be encouraged.')
        elif float(participation) < 60:
            insights.append('More classroom participation would support stronger understanding and confidence.')
    return {
        **card,
        'exam_comparison': comparison,
        'performance_insights': insights,
        'learning_signals': {
            'attendance_percent': signal.get('attendance_percent'),
            'homework_percent': signal.get('homework_percent'),
            'participation_percent': participation,
            'teacher_note': signal.get('teacher_note', ''),
            'updated': signal.get('updated'),
        },
    }

@api_router.get('/parent/students/{student_id}/homework')
async def parent_student_homework(student_id: str, payload: dict = Depends(get_parent_current)):
    student, _ = await owned_student(student_id, payload)
    branch_id = student.get('branch_id') or 'BR-MAIN'
    rows = [clean(row) for row in await db.homework.find(branch_scope(branch_id, {'class_name': student.get('class_name'), 'section': student.get('section'), 'status': {'$in': ['Published', 'Active']}})).sort('created', -1).to_list(500)]
    completions = {row['homework_id']: clean(row) for row in await db.homework_completions.find(branch_scope(branch_id, {'student_id': student_id})).to_list(500)}
    for row in rows:
        completion = completions.get(row['id'], {})
        row['completed'] = bool(completion.get('completed', False))
        row['completed_at'] = completion.get('completed_at')
        row['workflow_status'] = completion.get('workflow_status') or ('Verified' if completion.get('completed') else 'Pending')
        row['submitted_at'] = completion.get('submitted_at')
        row['parent_note'] = completion.get('parent_note', '')
        row['teacher_feedback'] = completion.get('teacher_feedback', '')
        row['evidence'] = completion.get('evidence', [])
    return rows

@api_router.put('/parent/students/{student_id}/homework/{homework_id}/status')
async def update_parent_homework_status(student_id: str, homework_id: str, update: dict, payload: dict = Depends(get_parent_current)):
    student, account = await owned_student(student_id, payload)
    branch_id = student.get('branch_id') or 'BR-MAIN'
    homework = await db.homework.find_one(branch_scope(branch_id, {'id': homework_id, 'class_name': student.get('class_name'), 'section': student.get('section')}))
    if not homework:
        raise HTTPException(status_code=404, detail='Homework was not found for this student.')
    submitted = bool(update.get('completed', True))
    record = {
        'id': f'HWC-{student_id}-{homework_id}', 'student_id': student_id, 'student_name': student.get('name', ''),
        'homework_id': homework_id, 'subject': homework.get('subject', ''), 'completed': False,
        'workflow_status': 'Submitted' if submitted else 'Pending', 'parent_note': str(update.get('note') or '').strip(),
        'completed_at': None, 'submitted_at': datetime.utcnow().isoformat() if submitted else None, 'updated_by_parent': account.get('name', 'Parent'),
        'updated': datetime.utcnow().isoformat(), 'branch_id': branch_id,
    }
    await db.homework_completions.update_one(branch_scope(branch_id, {'student_id': student_id, 'homework_id': homework_id}), {'$set': record}, upsert=True)
    return record

@api_router.post('/parent/students/{student_id}/homework/{homework_id}/evidence')
async def upload_homework_evidence(student_id: str, homework_id: str, file: UploadFile = File(...), payload: dict = Depends(get_parent_current)):
    student, account = await owned_student(student_id, payload)
    branch_id = student.get('branch_id') or 'BR-MAIN'
    homework = await db.homework.find_one(branch_scope(branch_id, {'id': homework_id, 'class_name': student.get('class_name'), 'section': student.get('section')}))
    if not homework: raise HTTPException(status_code=404, detail='Homework was not found for this student.')
    content = await file.read()
    if not content or len(content) > 15 * 1024 * 1024: raise HTTPException(status_code=422, detail='Evidence must be a file smaller than 15 MB.')
    safe_name = Path(file.filename or 'evidence').name; stored_name = f"evidence_{uuid.uuid4().hex}_{safe_name}"
    (HOMEWORK_UPLOAD_DIR / stored_name).write_bytes(content)
    evidence = {'name': safe_name, 'url': f'http://localhost:8001/uploads/homework/{stored_name}', 'content_type': file.content_type or 'application/octet-stream', 'uploaded_at': datetime.utcnow().isoformat(), 'uploaded_by': account.get('name', 'Parent')}
    await db.homework_completions.update_one(branch_scope(branch_id, {'student_id': student_id, 'homework_id': homework_id}), {'$set': {'id': f'HWC-{student_id}-{homework_id}', 'student_id': student_id, 'student_name': student.get('name', ''), 'homework_id': homework_id, 'subject': homework.get('subject', ''), 'workflow_status': 'Submitted', 'completed': False, 'submitted_at': evidence['uploaded_at'], 'updated': evidence['uploaded_at'], 'branch_id': branch_id}, '$push': {'evidence': evidence}}, upsert=True)
    return evidence

@api_router.get('/parent/students/{student_id}/timetable')
async def parent_student_timetable(student_id: str, date: str = '', payload: dict = Depends(get_parent_current)):
    student, _ = await owned_student(student_id, payload)
    query = {'class_name': student.get('class_name'), 'section': student.get('section')}
    if date:
        try:
            query['day'] = datetime.strptime(date, '%Y-%m-%d').strftime('%A')
        except ValueError:
            raise HTTPException(status_code=422, detail='Date must use YYYY-MM-DD format.')
    return [clean(row) for row in await db.timetable_periods.find(branch_scope(student.get('branch_id') or 'BR-MAIN', query)).sort('start_time', 1).to_list(1000)]

@api_router.get('/parent/students/{student_id}/fees')
async def parent_student_fees(student_id: str, payload: dict = Depends(get_parent_current)):
    student, _ = await owned_student(student_id, payload)
    branch_id = student.get('branch_id') or 'BR-MAIN'
    fees = [await fee_with_student(row, branch_id) for row in await db.fees.find(branch_scope(branch_id, {'student_id': student_id})).to_list(500)]
    receipts = [clean(row) for row in await db.fee_receipts.find(branch_scope(branch_id, {'student_id': student_id})).sort('paid_at', -1).to_list(500)]
    return {'fees': fees, 'receipts': receipts}

@api_router.post('/parent/fees/{fee_id}/razorpay-order')
async def create_parent_razorpay_order(fee_id: str, request: dict, payload: dict = Depends(get_parent_current)):
    account = await parent_session(payload)
    fee_record = await db.fees.find_one({'id': fee_id, 'student_id': {'$in': account.get('student_ids', [])}})
    branch_id = (fee_record or {}).get('branch_id') or 'BR-MAIN'
    fee = await db.fees.find_one(branch_scope(branch_id, {'id': fee_id, 'student_id': {'$in': account.get('student_ids', [])}}))
    if not fee:
        raise HTTPException(status_code=404, detail='Fee invoice not found.')
    amount = float(request.get('amount') or 0)
    if amount <= 0 or amount > float(fee.get('due') or 0):
        raise HTTPException(status_code=422, detail='Enter a valid payment amount.')
    key_id, key_secret = os.environ.get('RAZORPAY_KEY_ID', ''), os.environ.get('RAZORPAY_KEY_SECRET', '')
    if not key_id or not key_secret:
        raise HTTPException(status_code=503, detail='Razorpay has not been configured by the school.')
    receipt = f"fee_{fee_id}_{uuid.uuid4().hex[:10]}"
    gateway_payload = {'amount': round(amount * 100), 'currency': 'INR', 'receipt': receipt,
        'notes': {'fee_id': fee_id, 'student_id': fee.get('student_id', ''), 'parent_id': account['id']}}
    def send_order():
        token = base64.b64encode(f'{key_id}:{key_secret}'.encode()).decode()
        req = urllib.request.Request('https://api.razorpay.com/v1/orders', data=json.dumps(gateway_payload).encode(),
            headers={'Authorization': f'Basic {token}', 'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode())
    try:
        gateway_order = await asyncio.to_thread(send_order)
    except (urllib.error.URLError, ValueError):
        raise HTTPException(status_code=502, detail='Razorpay could not create the payment order.')
    student = await db.students.find_one(branch_scope(branch_id, {'id': fee.get('student_id')})) or {}
    record = {
        'id': f'RPY-{uuid.uuid4().hex[:10].upper()}', 'fee_id': fee_id,
        'student_id': fee.get('student_id'), 'student_name': fee.get('name', ''),
        'fee_name': fee.get('fee_name', 'School Fee'),
        'class_name': student.get('class_name', ''), 'section': student.get('section', ''),
        'parent_id': account['id'], 'parent_name': account.get('name', ''), 'parent_mobile': account.get('mobile', ''),
        'amount': amount, 'amount_paise': round(amount * 100), 'currency': 'INR',
        'order_id': gateway_order['id'], 'payment_id': '', 'status': 'Created',
        'created_at': datetime.utcnow().isoformat(), 'updated_at': datetime.utcnow().isoformat(),
        'updated_by': 'Parent App · Razorpay Checkout', 'branch_id': branch_id,
    }
    await db.razorpay_payments.insert_one(record)
    return {'key_id': key_id, 'order_id': record['order_id'], 'amount': record['amount_paise'], 'currency': 'INR', 'name': 'Orison International School', 'description': record['fee_name']}

@api_router.post('/parent/payments/orders/{order_id}/verify')
async def verify_parent_razorpay_payment(order_id: str, request: dict, payload: dict = Depends(get_parent_current)):
    account = await parent_session(payload)
    record = await db.razorpay_payments.find_one({'order_id': order_id, 'parent_id': account['id']})
    if not record:
        raise HTTPException(status_code=404, detail='Razorpay order not found.')
    payment_id, signature = str(request.get('payment_id') or ''), str(request.get('signature') or '')
    expected = hmac.new(os.environ.get('RAZORPAY_KEY_SECRET', '').encode(), f'{order_id}|{payment_id}'.encode(), hashlib.sha256).hexdigest()
    now = datetime.utcnow().isoformat()
    if not payment_id or not signature or not hmac.compare_digest(expected, signature):
        await db.razorpay_payments.update_one({'order_id': order_id}, {'$set': {'payment_id': payment_id, 'status': 'Failed', 'failure_reason': 'Gateway signature mismatch', 'updated_at': now, 'updated_by': 'Server signature verification'}})
        raise HTTPException(status_code=422, detail='Razorpay signature verification failed.')
    if record.get('status') == 'Verified':
        return clean(record)
    branch_id = record.get('branch_id') or 'BR-MAIN'
    paid = await pay_fee(record['fee_id'], PayReq(method='Razorpay', amount=float(record['amount']), transaction_reference=payment_id), 'fee_manager', branch_id)
    changes = {'payment_id': payment_id, 'signature_verified': True, 'status': 'Verified', 'receipt_id': (paid.get('receipt') or {}).get('id'), 'updated_at': now, 'updated_by': 'Server signature verification'}
    await db.razorpay_payments.update_one({'order_id': order_id}, {'$set': changes})
    await add_event('success', 'Razorpay payment verified', f"₹{record['amount']:,.0f} verified automatically for {record['student_name']}.")
    return clean(await db.razorpay_payments.find_one({'order_id': order_id}))

@api_router.get('/payments/razorpay')
async def list_razorpay_payments(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_FINANCE_ROLES)
    return [clean(row) for row in await db.razorpay_payments.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('updated_at', -1).to_list(5000)]

@api_router.post('/parent/students/{student_id}/leave')
async def submit_parent_leave(student_id: str, request: dict, payload: dict = Depends(get_parent_current)):
    student, account = await owned_student(student_id, payload)
    branch_id = student.get('branch_id') or 'BR-MAIN'
    from_date, to_date = str(request.get('from_date') or ''), str(request.get('to_date') or '')
    try:
        start, end = datetime.strptime(from_date, '%Y-%m-%d').date(), datetime.strptime(to_date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=422, detail='Choose valid leave dates.')
    if end < start:
        raise HTTPException(status_code=422, detail='The end date cannot be before the start date.')
    overlap = await db.leaves.find_one(branch_scope(branch_id, {
        'person_type': 'Student', 'person_id': student_id, 'status': {'$in': ['Pending', 'Approved']},
        'from_date': {'$lte': to_date}, 'to_date': {'$gte': from_date},
    }))
    if overlap:
        raise HTTPException(status_code=409, detail='A pending or approved leave request already covers these dates.')
    duration = str(request.get('duration') or 'Full Day')
    if duration not in {'Full Day', 'First Half', 'Second Half'}: raise HTTPException(status_code=422, detail='Choose a valid leave duration.')
    if duration != 'Full Day' and start != end: raise HTTPException(status_code=422, detail='Half-day leave must use the same date.')
    now = datetime.utcnow().isoformat()
    record = {
        'id': f'LEV-{uuid.uuid4().hex[:10].upper()}', 'name': student.get('name', ''),
        'leave_type': str(request.get('leave_type') or 'Personal leave'), 'from_date': from_date, 'to_date': to_date,
        'person_type': 'Student', 'person_id': student_id, 'class_name': student.get('class_name', ''),
        'section': student.get('section', ''), 'days': 0.5 if duration != 'Full Day' else (end - start).days + 1, 'duration': duration,
        'reason': str(request.get('reason') or ''), 'status': 'Pending',
        'attachment_name': str(request.get('attachment_name') or ''), 'attachment_url': str(request.get('attachment_url') or ''),
        'submitted_at': now, 'submitted_by': f"Parent · {account.get('name', '')}",
        'request_source': 'Parent App',
        'branch_id': branch_id,
        'audit_history': [{'at': now, 'by': f"Parent · {account.get('name', '')}", 'action': 'Leave request submitted'}],
    }
    await db.leaves.insert_one(record)
    await add_event('info', 'Parent leave request', f"{student.get('name', '')} requested {record['leave_type']}.")
    return record

async def hall_ticket_fee_status(student_id: str, branch_id: str = 'BR-MAIN'):
    unpaid = [clean(row) for row in await db.fees.find(branch_scope(branch_id, {'student_id': student_id, 'due': {'$gt': 0}})).to_list(500)]
    today = datetime.utcnow().date(); blocking_fees = []; overdue_days = 0
    for fee in unpaid:
        label = ' '.join(str(fee.get(field) or '') for field in ('fee_name', 'category', 'description')).lower()
        if 'tuition' not in label: continue
        try:
            days_late = (today - datetime.strptime(str(fee.get('due_date') or ''), '%Y-%m-%d').date()).days
            if days_late >= 0: blocking_fees.append(fee); overdue_days = max(overdue_days, days_late)
        except ValueError: blocking_fees.append(fee)
    return {'eligible': not blocking_fees, 'fee_due': sum(float(row.get('due') or 0) for row in blocking_fees), 'overdue_days': overdue_days}

@api_router.get('/parent/students/{student_id}/hall-tickets')
async def parent_hall_tickets(student_id: str, payload: dict = Depends(get_parent_current)):
    student, _ = await owned_student(student_id, payload)
    branch_id = student.get('branch_id') or 'BR-MAIN'
    tickets = [clean(row) for row in await db.hall_tickets.find(branch_scope(branch_id, {'class_name': student.get('class_name'), 'section': student.get('section'), 'status': 'Published'})).sort('created', -1).to_list(100)]
    fee = await hall_ticket_fee_status(student_id, branch_id)
    available = [ticket for ticket in tickets if not ticket.get('block_on_fee_due') or fee['eligible']]
    now = datetime.utcnow().isoformat()
    for ticket in available:
        await db.hall_ticket_delivery.update_one(branch_scope(branch_id, {'ticket_id': ticket['id'], 'student_id': student_id}), {'$setOnInsert': {'id': f"HD-{uuid.uuid4().hex[:10].upper()}", 'ticket_id': ticket['id'], 'student_id': student_id, 'student_name': student.get('name', ''), 'delivered_at': now, 'branch_id': branch_id}, '$set': {'viewed_at': now, 'status': 'Viewed'}}, upsert=True)
    return {**fee, 'tickets': available, 'blocked_tickets': len(tickets) - len(available)}

@api_router.post('/parent/students/{student_id}/hall-tickets/{ticket_id}/downloaded')
async def parent_hall_ticket_downloaded(student_id: str, ticket_id: str, payload: dict = Depends(get_parent_current)):
    student, _ = await owned_student(student_id, payload); now = datetime.utcnow().isoformat()
    branch_id = student.get('branch_id') or 'BR-MAIN'
    ticket = await db.hall_tickets.find_one(branch_scope(branch_id, {'id': ticket_id, 'class_name': student.get('class_name'), 'section': student.get('section'), 'status': 'Published'}))
    if not ticket:
        raise HTTPException(status_code=404, detail='Hall ticket not found for this student.')
    await db.hall_ticket_delivery.update_one(branch_scope(branch_id, {'ticket_id': ticket_id, 'student_id': student_id}), {'$set': {'status': 'Downloaded', 'downloaded_at': now, 'student_name': student.get('name', ''), 'branch_id': branch_id}}, upsert=True)
    return {'ok': True, 'downloaded_at': now}

@api_router.get('/parent/students/{student_id}/transport')
async def parent_student_transport(student_id: str, payload: dict = Depends(get_parent_current)):
    student, _ = await owned_student(student_id, payload)
    route_filters = [{'student_ids': student_id}]
    if student.get('transport_route_id'):
        route_filters.append({'id': student.get('transport_route_id')})
    if student.get('transport_route'):
        route_filters.extend([{'id': student.get('transport_route')}, {'route_name': student.get('transport_route')}])
    branch_id = student.get('branch_id') or 'BR-MAIN'
    route = await db.transport_routes.find_one(branch_scope(branch_id, {'$or': route_filters, 'status': {'$ne': 'Inactive'}}))
    if not route:
        return {'assigned': False, 'route': None, 'trip': None}
    trip = await db.transport_trips.find_one(branch_scope(branch_id, {'route_id': route.get('id'), 'status': {'$in': ['Boarding', 'On Route', 'Delayed']}}), sort=[('updated', -1)])
    return {'assigned': True, 'route': clean(route), 'trip': clean(trip) if trip else None}

@api_router.get('/parent/students/{student_id}/notices')
async def parent_student_notices(student_id: str, payload: dict = Depends(get_parent_current)):
    student, _ = await owned_student(student_id, payload)
    rows = [clean(row) for row in await db.parent_notices.find(parent_notice_query(student)).sort('published_at', -1).to_list(500)]
    read_ids = {row.get('notice_id') for row in await db.parent_notice_reads.find({'parent_id': payload['parent_id'], 'student_id': student_id}).to_list(1000)}
    for row in rows:
        row['unread'] = row.get('id') not in read_ids
    return rows

@api_router.put('/parent/students/{student_id}/notices/{notice_id}/read')
async def mark_parent_notice_read(student_id: str, notice_id: str, payload: dict = Depends(get_parent_current)):
    student, _ = await owned_student(student_id, payload)
    if not await db.parent_notices.find_one({'id': notice_id, **parent_notice_query(student)}):
        raise HTTPException(status_code=404, detail='Notice not found.')
    record = {'parent_id': payload['parent_id'], 'student_id': student_id, 'notice_id': notice_id, 'read_at': datetime.utcnow().isoformat()}
    await db.parent_notice_reads.update_one({'parent_id': payload['parent_id'], 'student_id': student_id, 'notice_id': notice_id}, {'$set': record}, upsert=True)
    return {'ok': True}

@api_router.post('/parent/students/{student_id}/help-requests')
async def submit_parent_help_request(student_id: str, request: dict, payload: dict = Depends(get_parent_current)):
    student, account = await owned_student(student_id, payload)
    kind = str(request.get('kind') or 'School callback')
    record = {
        'id': f"{'CB' if kind == 'School callback' else 'APP'}-{uuid.uuid4().hex[:10].upper()}",
        'kind': kind, 'category': str(request.get('category') or 'General'),
        'description': str(request.get('description') or '').strip(), 'priority': str(request.get('priority') or 'Normal'),
        'preferred_time': request.get('preferred_time'), 'attachment_name': request.get('attachment_name'),
        'student_id': student_id, 'student_name': student.get('name', ''),
        'parent_id': account['id'], 'parent_name': request.get('parent_name') or account.get('name', ''),
        'mobile': normalize_mobile(request.get('mobile') or account.get('mobile', '')),
        'status': 'Pending Callback' if kind == 'School callback' else 'Open',
        'created_at': datetime.utcnow().isoformat(), 'assigned_to': '', 'resolution': '',
    }
    if not record['description']:
        raise HTTPException(status_code=422, detail='Describe the concern or app problem.')
    await db.help_requests.insert_one(record)
    await add_event('info', 'New parent support request', f"{record['kind']} received from {record['parent_name']}.")
    return record

@api_router.post('/parent/uploads/{category}')
async def upload_parent_file(category: str, file: UploadFile = File(...), payload: dict = Depends(get_parent_current)):
    if category not in {'payment-proof', 'leave', 'help'}:
        raise HTTPException(status_code=422, detail='Unsupported upload category.')
    content = await file.read()
    if not file.filename or len(content) > 12 * 1024 * 1024:
        raise HTTPException(status_code=422, detail='Choose a file smaller than 12 MB.')
    safe_name = Path(file.filename).name
    stored_name = f"{payload['parent_id']}_{uuid.uuid4().hex}_{safe_name}"
    (PARENT_UPLOAD_DIR / stored_name).write_bytes(content)
    return {'name': safe_name, 'url': f'/uploads/parent/{stored_name}', 'size': len(content)}

# ---------------- Parent app admin control center ----------------

@api_router.get('/parent-center/summary')
async def parent_center_summary(role: str = Depends(get_current)):
    require_roles(role, PARENT_CENTER_ROLES)
    active_accounts = await db.parent_accounts.count_documents({'status': 'Active'})
    linked_mobiles = {
        normalize_mobile(value)
        for value in await db.students.distinct('parent_phone')
        if normalize_mobile(value)
    }
    return {
        'parents': max(active_accounts, len(linked_mobiles)),
        'pending_payments': await db.payment_proofs.count_documents({'status': 'Pending Review'}),
        'open_tickets': await db.help_requests.count_documents({'status': {'$nin': ['Resolved', 'Closed']}}),
        'published_notices': await db.parent_notices.count_documents({'status': 'Published'}),
        'published_hall_tickets': await db.hall_tickets.count_documents({'status': 'Published'}),
        'homework_updates': await db.homework_completions.count_documents({}),
        'active_trips': await db.transport_trips.count_documents({'status': {'$in': ['Boarding', 'On Route', 'Delayed']}}),
        'queued_notifications': await db.parent_notifications.count_documents({'status': 'Queued'}),
    }

@api_router.get('/parent-center/payment-proofs')
async def admin_payment_proofs(role: str = Depends(get_current)):
    require_roles(role, PARENT_FINANCE_ROLES)
    return [clean(row) for row in await db.payment_proofs.find().sort('submitted_at', -1).to_list(2000)]

@api_router.put('/parent-center/payment-proofs/{proof_id}/status')
async def review_payment_proof(proof_id: str, update: dict, role: str = Depends(get_current)):
    require_roles(role, PARENT_FINANCE_ROLES)
    proof = await db.payment_proofs.find_one({'id': proof_id})
    if not proof:
        raise HTTPException(status_code=404, detail='Payment proof not found.')
    status = str(update.get('status') or '')
    if status not in {'Approved', 'Rejected'}:
        raise HTTPException(status_code=422, detail='Choose Approved or Rejected.')
    if proof.get('status') != 'Pending Review':
        raise HTTPException(status_code=409, detail='This proof has already been reviewed.')
    receipt_id = None
    if status == 'Approved':
        paid = await pay_fee(proof['fee_id'], PayReq(method='UPI proof', amount=float(proof.get('amount') or 0)), role)
        receipt_id = (paid.get('receipt') or {}).get('id')
    changes = {
        'status': status, 'review_note': str(update.get('review_note') or ''),
        'reviewed_by': ROLE_CONFIG[role]['name'], 'reviewed_at': datetime.utcnow().isoformat(),
        'receipt_id': receipt_id,
    }
    await db.payment_proofs.update_one({'id': proof_id}, {'$set': changes})
    await db.parent_notifications.insert_one({
        'id': f'PAR-PAY-{uuid.uuid4().hex[:10].upper()}', 'student_id': proof.get('student_id'),
        'parent_phone': proof.get('parent_mobile', ''), 'channel': 'Parent App', 'status': 'Queued',
        'message': f"Payment proof {proof_id} was {status.lower()}.", 'created': datetime.utcnow().isoformat(),
    })
    return clean(await db.payment_proofs.find_one({'id': proof_id}))

@api_router.get('/parent-center/help-requests')
async def admin_help_requests(role: str = Depends(get_current)):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    return [clean(row) for row in await db.help_requests.find().sort('created_at', -1).to_list(2000)]

@api_router.put('/parent-center/help-requests/{request_id}')
async def update_help_request(request_id: str, update: dict, role: str = Depends(get_current)):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    if not await db.help_requests.find_one({'id': request_id}):
        raise HTTPException(status_code=404, detail='Support request not found.')
    allowed = {'status', 'assigned_to', 'scheduled_for', 'resolution', 'internal_note'}
    changes = {key: update[key] for key in allowed if key in update}
    changes.update({'updated_at': datetime.utcnow().isoformat(), 'updated_by': ROLE_CONFIG[role]['name']})
    await db.help_requests.update_one({'id': request_id}, {'$set': changes})
    return clean(await db.help_requests.find_one({'id': request_id}))

@api_router.get('/parent-center/notices')
async def admin_parent_notices(role: str = Depends(get_current)):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    return [clean(row) for row in await db.parent_notices.find().sort('created', -1).to_list(2000)]

@api_router.post('/parent-center/notices')
async def create_parent_notice(notice: dict, role: str = Depends(get_current)):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    title, body = str(notice.get('title') or '').strip(), str(notice.get('body') or '').strip()
    if not title or not body:
        raise HTTPException(status_code=422, detail='Enter a notice title and message.')
    status = str(notice.get('status') or 'Draft')
    record = {
        'id': f'NTC-{uuid.uuid4().hex[:10].upper()}', 'title': title, 'body': body,
        'category': str(notice.get('category') or 'General'), 'priority': str(notice.get('priority') or 'Normal'),
        'issuer': str(notice.get('issuer') or ROLE_CONFIG[role]['name']),
        'target_type': str(notice.get('target_type') or 'All'), 'class_name': str(notice.get('class_name') or ''),
        'section': str(notice.get('section') or ''), 'student_ids': notice.get('student_ids') or [],
        'attachment_name': notice.get('attachment_name'), 'attachment_url': notice.get('attachment_url'),
        'status': status, 'created': datetime.utcnow().isoformat(), 'created_by': ROLE_CONFIG[role]['name'],
        'published_at': datetime.utcnow().isoformat() if status == 'Published' else None,
    }
    await db.parent_notices.insert_one(record)
    return record

@api_router.put('/parent-center/notices/{notice_id}')
async def update_parent_notice(notice_id: str, update: dict, role: str = Depends(get_current)):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    if not await db.parent_notices.find_one({'id': notice_id}):
        raise HTTPException(status_code=404, detail='Notice not found.')
    allowed = {'title', 'body', 'category', 'priority', 'issuer', 'target_type', 'class_name', 'section', 'student_ids', 'attachment_name', 'attachment_url', 'status'}
    changes = {key: update[key] for key in allowed if key in update}
    if changes.get('status') == 'Published': changes['published_at'] = datetime.utcnow().isoformat()
    changes.update({'updated': datetime.utcnow().isoformat(), 'updated_by': ROLE_CONFIG[role]['name']})
    await db.parent_notices.update_one({'id': notice_id}, {'$set': changes})
    return clean(await db.parent_notices.find_one({'id': notice_id}))

@api_router.get('/parent-center/hall-tickets')
async def admin_hall_tickets(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    return [clean(row) for row in await db.hall_tickets.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('created', -1).to_list(1000)]

@api_router.get('/parent-center/hall-tickets/readiness')
async def hall_ticket_readiness(class_name: str, section: str, block_on_fee_due: bool = True, ticket_id: str = '', role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    students = [clean(row) for row in await db.students.find(branch_scope(branch_id, {'class_name': class_name, 'section': section})).sort('name', 1).to_list(2000)]
    rows = []
    for student in students:
        active = student_is_active_on(student)
        fee = await hall_ticket_fee_status(student['id'], branch_id) if active and block_on_fee_due else {'eligible': True, 'fee_due': 0, 'overdue_days': 0}
        eligible = active and fee['eligible']
        rows.append({'student_id': student['id'], 'student_name': student.get('name', ''), 'admission_no': student.get('admission_no', ''), 'active': active, 'eligible': eligible, 'fee_blocked': active and not fee['eligible'], 'fee_due': fee['fee_due'], 'photo_missing': not bool(student.get('avatar')), 'avatar': student.get('avatar', '')})
    delivery = await db.hall_ticket_delivery.find(branch_scope(branch_id, {'ticket_id': ticket_id})).to_list(3000) if ticket_id else []
    return {'total': len(rows), 'eligible': len([r for r in rows if r['eligible']]), 'fee_blocked': len([r for r in rows if r['fee_blocked']]), 'inactive': len([r for r in rows if not r['active']]), 'missing_photo': len([r for r in rows if r['photo_missing']]), 'viewed': len([r for r in delivery if r.get('viewed_at')]), 'downloaded': len([r for r in delivery if r.get('downloaded_at')]), 'rows': rows}

@api_router.post('/parent-center/hall-tickets')
async def create_hall_ticket(ticket: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    exam_id = str(ticket.get('exam_id') or '').strip()
    exam = await db.exams.find_one(branch_scope(branch_id, {'id': exam_id})) if exam_id else None
    if not exam:
        raise HTTPException(status_code=422, detail='Select an exam created by the school.')
    if exam.get('class_name') != ticket.get('class_name') or exam.get('section') != ticket.get('section'):
        raise HTTPException(status_code=422, detail='Hall ticket Class and Section must match the selected exam.')
    required = ['title', 'class_name', 'section', 'venue']
    if any(not str(ticket.get(field) or '').strip() for field in required) or not ticket.get('papers'):
        raise HTTPException(status_code=422, detail='Enter exam, class, section, venue and at least one paper.')
    if str(ticket.get('status') or 'Draft') == 'Published' and any(not str(paper.get(field) or '').strip() for paper in ticket.get('papers', []) for field in ('subject', 'date', 'time')):
        raise HTTPException(status_code=422, detail='Every paper needs a Subject, Date and Time before publishing.')
    now = datetime.utcnow().isoformat()
    record = {
        'id': f'HALL-{uuid.uuid4().hex[:10].upper()}', 'exam_id': exam_id, 'title': str(ticket['title']).strip(),
        'class_name': str(ticket['class_name']).strip(), 'section': str(ticket['section']).strip(),
        'venue': str(ticket['venue']).strip(), 'instructions': str(ticket.get('instructions') or ''),
        'papers': ticket['papers'], 'status': str(ticket.get('status') or 'Draft'),
        'block_on_fee_due': bool(ticket.get('block_on_fee_due', True)),
        'created': now, 'created_by': ROLE_CONFIG[role]['name'],
        'branch_id': branch_id,
        'audit_history': [{'at': now, 'by': ROLE_CONFIG[role]['name'], 'action': f"Hall ticket {str(ticket.get('status') or 'Draft').lower()}"}],
    }
    if record['status'] == 'Published':
        record['published_at'] = now
        students = await db.students.find(branch_scope(branch_id, {'class_name': record['class_name'], 'section': record['section']})).to_list(2000)
        students = [student for student in students if student_is_active_on(student)]
        for student in students:
            fee = await hall_ticket_fee_status(student['id'], branch_id) if record['block_on_fee_due'] else {'eligible': True}
            if fee['eligible']:
                await db.parent_notifications.insert_one({'id': f"PAR-HALL-{uuid.uuid4().hex[:10].upper()}", 'student_id': student['id'], 'student_name': student.get('name', ''), 'channel': 'Parent App', 'status': 'Queued', 'hall_ticket_id': record['id'], 'message': f"{record['title']} hall ticket is now available.", 'created': now, 'branch_id': branch_id})
                await db.hall_ticket_delivery.update_one(branch_scope(branch_id, {'ticket_id': record['id'], 'student_id': student['id']}), {'$setOnInsert': {'id': f"HD-{uuid.uuid4().hex[:10].upper()}", 'ticket_id': record['id'], 'student_id': student['id'], 'student_name': student.get('name', ''), 'status': 'Delivered', 'delivered_at': now, 'branch_id': branch_id}}, upsert=True)
    await db.hall_tickets.replace_one(branch_scope(branch_id, {'exam_id': exam_id}), record, upsert=True)
    return record

@api_router.put('/parent-center/hall-tickets/{ticket_id}')
async def update_hall_ticket(ticket_id: str, update: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    existing = await db.hall_tickets.find_one(branch_scope(branch_id, {'id': ticket_id}))
    if not existing:
        raise HTTPException(status_code=404, detail='Hall ticket not found.')
    allowed = {'exam_id', 'title', 'venue', 'instructions', 'papers', 'status', 'block_on_fee_due'}
    changes = {key: update[key] for key in allowed if key in update}
    reason = str(update.get('change_reason') or '').strip()
    if existing.get('status') == 'Published' and not reason: raise HTTPException(status_code=422, detail='Add a correction reason before changing a published hall ticket.')
    papers = changes.get('papers', existing.get('papers', []))
    if changes.get('status') == 'Published' and any(not str(paper.get(field) or '').strip() for paper in papers for field in ('subject', 'date', 'time')): raise HTTPException(status_code=422, detail='Every paper needs a Subject, Date and Time before publishing.')
    now = datetime.utcnow().isoformat()
    if changes.get('status') == 'Published': changes['published_at'] = now
    changes['updated'] = now
    await db.hall_tickets.update_one(branch_scope(branch_id, {'id': ticket_id}), {'$set': changes, '$push': {'audit_history': {'at': now, 'by': ROLE_CONFIG[role]['name'], 'action': 'Hall ticket updated', 'reason': reason, 'previous_status': existing.get('status')}}})
    if changes.get('status') == 'Published' and existing.get('status') != 'Published':
        current = {**existing, **changes}
        students = await db.students.find(branch_scope(branch_id, {'class_name': current.get('class_name'), 'section': current.get('section')})).to_list(2000)
        students = [student for student in students if student_is_active_on(student)]
        for student in students:
            fee = await hall_ticket_fee_status(student['id'], branch_id) if current.get('block_on_fee_due') else {'eligible': True}
            if fee['eligible']:
                await db.parent_notifications.insert_one({'id': f"PAR-HALL-{uuid.uuid4().hex[:10].upper()}", 'student_id': student['id'], 'student_name': student.get('name', ''), 'channel': 'Parent App', 'status': 'Queued', 'hall_ticket_id': ticket_id, 'message': f"{current.get('title')} hall ticket is now available.", 'created': now, 'branch_id': branch_id})
                await db.hall_ticket_delivery.update_one(branch_scope(branch_id, {'ticket_id': ticket_id, 'student_id': student['id']}), {'$setOnInsert': {'id': f"HD-{uuid.uuid4().hex[:10].upper()}", 'ticket_id': ticket_id, 'student_id': student['id'], 'student_name': student.get('name', ''), 'status': 'Delivered', 'delivered_at': now, 'branch_id': branch_id}}, upsert=True)
    return clean(await db.hall_tickets.find_one(branch_scope(branch_id, {'id': ticket_id})))

@api_router.get('/parent-center/homework-completions')
async def admin_homework_completions(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_ACADEMIC_ROLES)
    return [clean(row) for row in await db.homework_completions.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('updated', -1).to_list(5000)]

@api_router.get('/parent-center/transport/routes')
async def admin_transport_routes(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_TRANSPORT_ROLES)
    return [clean(row) for row in await db.transport_routes.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('route_name', 1).to_list(1000)]

async def queue_transport_parent_alert(route: dict, trip: dict, branch_id: str):
    status = str(trip.get('status') or '')
    if status not in {'Boarding', 'On Route', 'Delayed', 'Completed'}:
        return
    alert_key = f"{trip.get('id')}:{status}:{trip.get('current_stop', '')}:{trip.get('next_stop', '')}"
    if await db.transport_alerts.find_one(branch_scope(branch_id, {'alert_key': alert_key})):
        return
    route_id, route_name = route.get('id'), route.get('route_name', '')
    students = await db.students.find(branch_scope(branch_id, {'$or': [{'transport_route_id': route_id}, {'transport_route': route_id}, {'transport_route': route_name}]})).to_list(5000)
    students = [student for student in students if student_is_active_on(student)]
    message = f"{route_name}: {status}."
    if status == 'Delayed' and trip.get('eta_minutes') is not None: message += f" Updated ETA is approximately {trip.get('eta_minutes')} minutes."
    elif status == 'On Route': message += f" Next stop: {trip.get('next_stop') or 'updating shortly'}."
    elif status == 'Completed': message += ' The trip has been completed.'
    rows = [{'id': f"PAR-TRN-{uuid.uuid4().hex[:10].upper()}", 'student_id': student.get('id'), 'student_name': student.get('name', ''), 'title': 'School transport update', 'message': message, 'channel': 'Parent App', 'status': 'Queued', 'trip_id': trip.get('id'), 'created': datetime.utcnow().isoformat(), 'branch_id': branch_id} for student in students]
    if rows: await db.parent_notifications.insert_many(rows)
    await db.transport_alerts.insert_one({'id': f"TAL-{uuid.uuid4().hex[:10].upper()}", 'alert_key': alert_key, 'route_id': route_id, 'trip_id': trip.get('id'), 'status': status, 'recipients_count': len(rows), 'created': datetime.utcnow().isoformat(), 'branch_id': branch_id})

@api_router.post('/parent-center/transport/routes')
async def save_transport_route(route: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_TRANSPORT_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    route_name = str(route.get('route_name') or '').strip()
    if not route_name or not route.get('stops'):
        raise HTTPException(status_code=422, detail='Enter a route name and at least one stop.')
    route.setdefault('id', f'ROUTE-{uuid.uuid4().hex[:8].upper()}')
    capacity = int(route.get('vehicle_capacity') or 0)
    if capacity < 1: raise HTTPException(status_code=422, detail='Vehicle capacity must be at least one seat.')
    driver_id, attendant_id = str(route.get('driver_id') or '').strip(), str(route.get('attendant_id') or '').strip()
    if driver_id and not await db.staff.find_one(branch_scope(branch_id, {'id': driver_id, 'status': {'$ne': 'Inactive'}})):
        raise HTTPException(status_code=422, detail='Choose an active driver from this branch staff directory.')
    if attendant_id and not await db.staff.find_one(branch_scope(branch_id, {'id': attendant_id, 'status': {'$ne': 'Inactive'}})):
        raise HTTPException(status_code=422, detail='Choose an active attendant from this branch staff directory.')
    if driver_id and driver_id == attendant_id: raise HTTPException(status_code=422, detail='Driver and attendant must be different staff members.')
    duplicate_name = await db.transport_routes.find_one(branch_scope(branch_id, {'id': {'$ne': route['id']}, 'route_name': {'$regex': f'^{re.escape(route_name)}$', '$options': 'i'}}))
    if duplicate_name: raise HTTPException(status_code=409, detail='A route with this name already exists in the selected branch.')
    device_id = str(route.get('tracker_device_id') or '').strip()
    if device_id and await db.transport_routes.find_one({'id': {'$ne': route['id']}, 'tracker_device_id': device_id}):
        raise HTTPException(status_code=409, detail='This GPS tracker device is already linked to another route.')
    today_value = datetime.utcnow().date().isoformat()
    if str(route.get('status') or 'Active') == 'Active':
        required = ['bus_number', 'driver_name', 'driver_mobile', 'attendant_name', 'attendant_mobile', 'insurance_expiry', 'fitness_expiry', 'permit_expiry']
        if any(not str(route.get(field) or '').strip() for field in required): raise HTTPException(status_code=422, detail='Complete the vehicle, crew and document details before making this route Active.')
        if any(str(route.get(field) or '') < today_value for field in ('insurance_expiry', 'fitness_expiry', 'permit_expiry')): raise HTTPException(status_code=422, detail='An expired vehicle document cannot be used on an Active route.')
    route.update({'route_name': route_name, 'vehicle_capacity': capacity, 'status': route.get('status', 'Active'), 'updated': datetime.utcnow().isoformat(), 'updated_by': ROLE_CONFIG[role]['name'], 'branch_id': branch_id})
    await db.transport_routes.update_one(branch_scope(branch_id, {'id': route['id']}), {'$set': route}, upsert=True)
    return route

@api_router.get('/parent-center/transport/trips')
async def admin_transport_trips(role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_TRANSPORT_ROLES)
    return [clean(row) for row in await db.transport_trips.find(branch_scope(x_branch_id or 'BR-MAIN')).sort('updated', -1).to_list(1000)]

@api_router.post('/parent-center/transport/trips')
async def save_transport_trip(trip: dict, role: str = Depends(get_current), x_branch_id: str = Header(default='BR-MAIN')):
    require_roles(role, PARENT_TRANSPORT_ROLES)
    branch_id = x_branch_id or 'BR-MAIN'
    route = await db.transport_routes.find_one(branch_scope(branch_id, {'id': trip.get('route_id')}))
    if not route:
        raise HTTPException(status_code=422, detail='Choose an existing transport route.')
    trip.setdefault('id', f'TRIP-{uuid.uuid4().hex[:10].upper()}')
    if route.get('status') != 'Active': raise HTTPException(status_code=422, detail='Only an Active and ready route can start a trip.')
    trip.update({'route_name': route.get('route_name', ''), 'updated': datetime.utcnow().isoformat(), 'updated_by': ROLE_CONFIG[role]['name'], 'branch_id': branch_id})
    await db.transport_trips.update_one(branch_scope(branch_id, {'id': trip['id']}), {'$set': trip}, upsert=True)
    await queue_transport_parent_alert(route, trip, branch_id)
    return trip

@api_router.post('/transport/tracker/webhook')
async def transport_tracker_webhook(payload: dict, x_tracker_key: Optional[str] = Header(default=None)):
    """Receive automatic GPS updates from the school's tracking partner."""
    expected_key = os.environ.get('TRANSPORT_TRACKER_KEY', '').strip()
    if not expected_key:
        raise HTTPException(status_code=503, detail='Transport tracker integration is not configured.')
    if not x_tracker_key or not hmac.compare_digest(x_tracker_key, expected_key):
        raise HTTPException(status_code=401, detail='Invalid tracker integration key.')
    device_id = str(payload.get('device_id') or '').strip()
    if not device_id:
        raise HTTPException(status_code=422, detail='device_id is required.')
    route = await db.transport_routes.find_one({'tracker_device_id': device_id, 'status': {'$ne': 'Inactive'}})
    if not route:
        raise HTTPException(status_code=404, detail='No active route is linked to this tracker device.')
    now = datetime.utcnow().isoformat()
    try:
        latitude, longitude = float(payload.get('latitude')), float(payload.get('longitude'))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail='Valid latitude and longitude are required.')
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise HTTPException(status_code=422, detail='GPS coordinates are outside the valid range.')
    recorded_at = str(payload.get('recorded_at') or now)
    status = str(payload.get('status') or ('On Route' if payload.get('ignition_on') else 'Stopped')).strip()
    trip_id = f"TRACKER-{route['id']}"
    existing_trip = await db.transport_trips.find_one(branch_scope(route.get('branch_id') or 'BR-MAIN', {'id': trip_id}))
    if existing_trip and str(existing_trip.get('recorded_at') or '') > recorded_at:
        raise HTTPException(status_code=409, detail='This GPS update is older than the latest recorded position.')
    trip = {
        'id': trip_id, 'route_id': route['id'], 'route_name': route.get('route_name', ''),
        'journey': str(payload.get('journey') or 'Automatic GPS feed'), 'status': status,
        'latitude': latitude, 'longitude': longitude,
        'speed_kmph': payload.get('speed_kmph'), 'heading': payload.get('heading'),
        'current_stop': str(payload.get('current_stop') or '').strip(),
        'next_stop': str(payload.get('next_stop') or '').strip(),
        'eta_minutes': payload.get('eta_minutes', 0),
        'recorded_at': recorded_at, 'updated': now,
        'updated_by': f"GPS partner · {route.get('tracker_provider') or 'provider'}",
        'branch_id': route.get('branch_id') or 'BR-MAIN',
    }
    await db.transport_trips.update_one(branch_scope(route.get('branch_id') or 'BR-MAIN', {'id': trip_id}), {'$set': trip}, upsert=True)
    await db.transport_routes.update_one(branch_scope(route.get('branch_id') or 'BR-MAIN', {'id': route['id']}), {'$set': {'tracker_status': 'Connected', 'tracker_last_seen': now}})
    await queue_transport_parent_alert(route, trip, route.get('branch_id') or 'BR-MAIN')
    return {'ok': True, 'route_id': route['id'], 'received_at': now}

@app.middleware('http')
async def enforce_branch_boundary(request, call_next):
    """Apply the selected-campus boundary before a staff endpoint is executed."""
    path = request.url.path
    _request_ctx.set((path, request.method))
    if request.method == 'OPTIONS' or not path.startswith('/api/') or path.startswith('/api/auth/'):
        return await call_next(request)
    authorization = request.headers.get('authorization')
    if not authorization or not authorization.startswith('Bearer '):
        return await call_next(request)
    try:
        payload = jwt.decode(authorization.split(' ', 1)[1], JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        return await call_next(request)
    role = payload.get('role')
    if role not in ROLE_CONFIG:
        return await call_next(request)

    branch_id = request.headers.get('x-branch-id') or 'BR-MAIN'
    if role not in BRANCH_VIEW_ROLES:
        allowed = await get_role_branch_ids(role)
        if branch_id not in allowed:
            return JSONResponse(status_code=403, content={'detail': 'This login is not assigned to the selected branch. Ask Admin to update Branch Access.'})

    network_paths = ('/api/branches', '/api/branch-access-assignments')
    if path.startswith(network_paths):
        return await call_next(request)
    branch = await db.branches.find_one({'id': branch_id})
    if branch and branch.get('status') == 'Suspended':
        return JSONResponse(status_code=423, content={'detail': f"{branch.get('name', 'This branch')} is suspended. Admin must reactivate it before operations continue."})
    if branch and branch.get('status') == 'Setup':
        setup_paths = (
            '/api/academic-structure', '/api/academic-year-change-request', '/api/teachers',
            '/api/staff', '/api/teacher-allocations', '/api/fee-structures', '/api/settings',
            '/api/search',
        )
        if not path.startswith(setup_paths):
            return JSONResponse(status_code=409, content={'detail': f"{branch.get('name', 'This branch')} is still in Setup mode. Complete branch readiness and activate it before daily operations."})
    return await call_next(request)

app.include_router(api_router)

from fastapi import Request as _Request

@app.exception_handler(Exception)
async def unhandled_error(request: _Request, exc: Exception):
    # Return a normal JSON error (with CORS headers added by the middleware) instead of a bare
    # 500, so one failing endpoint does not make the browser think the whole server is offline.
    logger.exception('Unhandled error on %s', request.url.path)
    return JSONResponse(status_code=500, content={'detail': 'Something went wrong on the server. Please try again.'})
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[origin.strip() for origin in os.environ.get(
        'ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000'
    ).split(',') if origin.strip()],
    allow_methods=["*"], allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
