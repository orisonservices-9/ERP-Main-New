from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File
from fastapi.responses import PlainTextResponse
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
from datetime import datetime, timedelta
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret')
JWT_ALGO = 'HS256'

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------- Role config ----------------
ROLE_CONFIG = {
    'admin': {
        'name': 'Admin',
        'menu': None,  # None = all
    },
    'principal': {
        'name': 'Principal',
        'menu': ['dashboard', 'student', 'academics', 'attendance', 'teachers', 'staff',
                 'exams', 'marks', 'homework', 'leave', 'timetable', 'notifications',
                 'transport', 'communications', 'visitor', 'question', 'ai', 'settings'],
    },
    'fee_manager': {
        'name': 'Fee Manager',
        'menu': ['dashboard', 'student', 'fee', 'expenses', 'notifications',
                 'communications', 'ai', 'settings'],
    },
}

# ---------------- Models ----------------
class LoginReq(BaseModel):
    role: str

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
    caste: str = ""
    subcaste: str = ""
    phone: str = ""
    parent_id: str = ""
    guardian: str = ""
    address: str = ""
    password: str = ""
    parent_name: str = ""
    parent_phone: str = ""
    balance: float = 0.0
    avatar: str = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces"

class Exam(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    class_name: str = "Grade 10"
    section: str = "Section A"
    subject: str = "Mathematics"
    date: str = ""
    room: str = ""
    start_time: str = ""
    end_time: str = ""
    max_marks: int = 100
    passing_marks: int = 40
    status: str = "Draft"

class Leave(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    leave_type: str
    from_date: str
    to_date: str
    days: int = 1
    reason: str = ""
    status: str = "Pending"
    avatar: str = "https://i.pravatar.cc/80?img=12"

class PayReq(BaseModel):
    method: str = "Cash"
    amount: Optional[float] = None

# ---------------- Auth helpers ----------------
def create_token(role: str):
    payload = {'role': role, 'exp': datetime.utcnow() + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(' ', 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    role = payload.get('role')
    if role not in ROLE_CONFIG:
        raise HTTPException(status_code=401, detail="Invalid role")
    return role

def clean(doc):
    if doc and '_id' in doc:
        doc.pop('_id', None)
    return doc

async def add_event(etype: str, title: str, body: str):
    await db.events.insert_one({
        'id': str(uuid.uuid4()), 'type': etype, 'title': title, 'body': body,
        'unread': True, 'created': datetime.utcnow().isoformat(),
    })

# ---------------- Auth routes ----------------
@api_router.post("/auth/login")
async def login(req: LoginReq):
    role = req.role
    if role not in ROLE_CONFIG:
        raise HTTPException(status_code=400, detail="Unknown role")
    cfg = ROLE_CONFIG[role]
    return {
        'token': create_token(role),
        'role': role,
        'name': cfg['name'],
        'menu': cfg['menu'],
    }

@api_router.get("/auth/me")
async def me(role: str = Depends(get_current)):
    cfg = ROLE_CONFIG[role]
    return {'role': role, 'name': cfg['name'], 'menu': cfg['menu']}

# ---------------- Students ----------------
@api_router.get("/students")
async def list_students(role: str = Depends(get_current)):
    docs = await db.students.find().to_list(1000)
    return [clean(d) for d in docs]

@api_router.get("/students/{sid}")
async def get_student(sid: str, role: str = Depends(get_current)):
    doc = await db.students.find_one({'id': sid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return clean(doc)

REQUIRED_STUDENT_FIELDS = {
    'name': 'Student Name', 'admission_no': 'Admission Number', 'class_name': 'Class',
    'section': 'Section', 'academic_year': 'Academic Year', 'gender': 'Gender',
    'father_name': 'Father/Guardian Name', 'mobile': 'Mobile Number',
}

@api_router.post("/students")
async def create_student(s: Student, role: str = Depends(get_current)):
    doc = s.dict()
    missing = [label for k, label in REQUIRED_STUDENT_FIELDS.items() if not str(doc.get(k) or '').strip()]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required field(s): {', '.join(missing)}")
    adm = str(doc.get('admission_no') or '').strip()
    if await db.students.find_one({'admission_no': adm}):
        raise HTTPException(status_code=409, detail=f"A student with admission number '{adm}' already exists.")
    await db.students.insert_one(dict(doc))
    # auto-create a fee record for the new student
    fee = {'id': f"FEE-{uuid.uuid4().hex[:8]}", 'student_id': doc['id'], 'name': doc['name'],
           'total': 45000, 'paid': 0, 'due': 45000, 'status': 'Overdue', 'avatar': doc.get('avatar', '')}
    await db.fees.insert_one(dict(fee))
    await add_event('success', 'New admission approved', f"{doc['name']} has been enrolled in {doc.get('class_name','')} {doc.get('section','')}.".strip())
    return doc

@api_router.put("/students/{sid}")
async def update_student(sid: str, s: Student, role: str = Depends(get_current)):
    doc = s.dict()
    doc['id'] = sid
    await db.students.update_one({'id': sid}, {'$set': doc}, upsert=True)
    return doc

@api_router.delete("/students/{sid}")
async def delete_student(sid: str, role: str = Depends(get_current)):
    await db.students.delete_one({'id': sid})
    await db.fees.delete_many({'student_id': sid})
    return {'ok': True}

# ---------------- Fees ----------------
@api_router.get("/fees")
async def list_fees(role: str = Depends(get_current)):
    docs = await db.fees.find().to_list(1000)
    return [clean(d) for d in docs]

@api_router.get("/fees/summary")
async def fees_summary(role: str = Depends(get_current)):
    docs = await db.fees.find().to_list(1000)
    total = sum(d.get('total', 0) for d in docs)
    paid = sum(d.get('paid', 0) for d in docs)
    due = sum(d.get('due', 0) for d in docs)
    return {
        'collected': paid, 'pending': due, 'total': total,
        'invoices': len(docs),
    }

@api_router.post("/fees/{fid}/pay")
async def pay_fee(fid: str, req: PayReq, role: str = Depends(get_current)):
    doc = await db.fees.find_one({'id': fid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    current_due = doc.get('due', 0)
    amt = req.amount if req.amount is not None else current_due
    amt = max(0, min(amt, current_due))
    doc['paid'] = doc.get('paid', 0) + amt
    doc['due'] = current_due - amt
    doc['status'] = 'Paid' if doc['due'] <= 0 else 'Partial'
    doc['method'] = req.method
    await db.fees.update_one({'id': fid}, {'$set': doc})
    # keep student balance in sync
    if doc.get('student_id'):
        await db.students.update_one({'id': doc['student_id']}, {'$set': {'balance': doc['due']}})
    await add_event('success', 'Fee collected', f"\u20b9{amt:,.0f} collected from {doc.get('name','student')} via {req.method}.")
    return clean(doc)

# ---------------- Exams ----------------
@api_router.get("/exams")
async def list_exams(role: str = Depends(get_current)):
    docs = await db.exams.find().to_list(1000)
    return [clean(d) for d in docs]

@api_router.post("/exams")
async def create_exam(e: Exam, role: str = Depends(get_current)):
    doc = e.dict()
    if doc.get('status') != 'Draft' and not doc.get('status'):
        doc['status'] = 'Scheduled'
    await db.exams.insert_one(dict(doc))
    return doc

@api_router.put("/exams/{eid}")
async def update_exam(eid: str, e: Exam, role: str = Depends(get_current)):
    doc = e.dict(); doc['id'] = eid
    await db.exams.update_one({'id': eid}, {'$set': doc}, upsert=True)
    return doc

# ---------------- Leaves ----------------
@api_router.get("/leaves")
async def list_leaves(role: str = Depends(get_current)):
    docs = await db.leaves.find().to_list(1000)
    return [clean(d) for d in docs]

@api_router.get("/leaves/summary")
async def leaves_summary(role: str = Depends(get_current)):
    docs = await db.leaves.find().to_list(1000)
    def cnt(s): return len([d for d in docs if d.get('status') == s])
    return {'total': len(docs), 'approved': cnt('Approved'),
            'rejected': cnt('Rejected'), 'pending': cnt('Pending')}

@api_router.post("/leaves")
async def create_leave(l: Leave, role: str = Depends(get_current)):
    doc = l.dict()
    await db.leaves.insert_one(dict(doc))
    await add_event('info', 'New leave request', f"{doc['name']} requested {doc['leave_type']} ({doc['from_date']} - {doc['to_date']}).")
    return doc

@api_router.put("/leaves/{lid}/status")
async def set_leave_status(lid: str, status: str, role: str = Depends(get_current)):
    await db.leaves.update_one({'id': lid}, {'$set': {'status': status}})
    doc = await db.leaves.find_one({'id': lid})
    return clean(doc)

# ---------------- Teachers ----------------
@api_router.get("/teachers")
async def list_teachers(role: str = Depends(get_current)):
    docs = await db.teachers.find().to_list(1000)
    return [clean(d) for d in docs]

# ---------------- Global Search ----------------
@api_router.get("/search")
async def search(q: str = "", role: str = Depends(get_current)):
    q = (q or "").strip()
    if not q:
        return {'students': [], 'teachers': [], 'classes': []}
    rx = {'$regex': q, '$options': 'i'}
    students = await db.students.find({'$or': [{'name': rx}, {'id': rx}, {'class_name': rx}]}).to_list(8)
    teachers = await db.teachers.find({'$or': [{'name': rx}, {'subject': rx}]}).to_list(8)
    # classes derived from students
    all_students = await db.students.find().to_list(1000)
    classes = sorted({s.get('class_name', '') for s in all_students if q.lower() in s.get('class_name', '').lower() and s.get('class_name')})
    return {
        'students': [{'id': s['id'], 'name': s['name'], 'class_name': s.get('class_name', ''), 'avatar': s.get('avatar', '')} for s in students],
        'teachers': [{'id': t['id'], 'name': t['name'], 'subject': t.get('subject', ''), 'avatar': t.get('avatar', '')} for t in teachers],
        'classes': [{'name': c} for c in classes],
    }

# ---------------- Analytics ----------------
@api_router.get("/analytics/dashboard")
async def analytics_dashboard(role: str = Depends(get_current)):
    students = await db.students.find().to_list(1000)
    teachers = await db.teachers.find().to_list(1000)
    fees = await db.fees.find().to_list(1000)
    collected = sum(f.get('paid', 0) for f in fees)
    return {
        'stats': {
            'students': len(students),
            'teachers': len(teachers),
            'fees_collected': collected,
            'attendance': 94.2,
        },
        'attendance_trend': [
            {'month': 'Feb', 'rate': 89}, {'month': 'Mar', 'rate': 91},
            {'month': 'Apr', 'rate': 90}, {'month': 'May', 'rate': 92},
            {'month': 'Jun', 'rate': 93}, {'month': 'Jul', 'rate': 94.2},
        ],
        'fees_trend': [
            {'month': 'Feb', 'amount': 320000}, {'month': 'Mar', 'amount': 410000},
            {'month': 'Apr', 'amount': 380000}, {'month': 'May', 'amount': 450000},
            {'month': 'Jun', 'amount': 470000}, {'month': 'Jul', 'amount': 480000},
        ],
    }

@api_router.get("/analytics/ai")
async def analytics_ai(role: str = Depends(get_current)):
    # subject scores derived from saved marks sets (fallback to defaults)
    sets = await db.marks_sets.find().to_list(100)
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
        subject_scores = [
            {'subject': 'Math', 'score': 82}, {'subject': 'Physics', 'score': 78},
            {'subject': 'Chem', 'score': 74}, {'subject': 'Bio', 'score': 80},
            {'subject': 'English', 'score': 85}, {'subject': 'CS', 'score': 88},
        ]
    return {
        'kpis': {'pass_rate': 96.4, 'at_risk': 18, 'engagement': 8.6, 'forecast_revenue': '\u20b928.1L'},
        'performance_trend': [
            {'term': 'T1 2023', 'avg': 78}, {'term': 'T2 2023', 'avg': 80},
            {'term': 'T1 2024', 'avg': 82}, {'term': 'T2 2024', 'avg': 81},
            {'term': 'T1 2025', 'avg': 85},
        ],
        'subject_scores': subject_scores,
        'risk_distribution': [
            {'name': 'Safe', 'value': 1180}, {'name': 'Watch', 'value': 86}, {'name': 'At-Risk', 'value': 18},
        ],
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
    if not rows:
        seed = sum(ord(c) for c in sid)
        base = 82 + seed % 12
        for i, subj in enumerate(DEFAULT_SUBJECTS):
            total = min(99, base + ((seed + i * 7) % 15) - 5)
            internal = round(total * 0.28)
            rows.append({'subject': subj, 'internal': internal, 'external': total - internal,
                         'total': total, 'grade': grade_for(total)})
    return rows

@api_router.get("/students/{sid}/detail")
async def student_detail(sid: str, role: str = Depends(get_current)):
    student = await db.students.find_one({'id': sid})
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
        'gpa': {'cgpa': f"{cgpa}", 'grade': grade_for(marks[0]['total'] if marks else 0) + ' (Excellent)',
                'credits': '24 / 24', 'standing': 'First Class with Distinction'},
        'standing': {'rank': f"{(seed % 40) + 1:02d} / 45 Students", 'percentile': f"{88 + seed % 11}.0% Percentile"},
        'attendance': att,
    }

# ---------------- Marks & Results ----------------
class MarksSet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    exam_title: str
    class_name: str = ""
    section: str = ""
    subject: str = ""
    max_written: int = 70
    max_practical: int = 30
    rows: List[dict] = []
    created: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

@api_router.post("/marks")
async def save_marks(ms: MarksSet, role: str = Depends(get_current)):
    doc = ms.dict()
    total_max = doc['max_written'] + doc['max_practical']
    for r in doc['rows']:
        r['total'] = (r.get('written', 0) or 0) + (r.get('practical', 0) or 0)
    doc['total_max'] = total_max
    await db.marks_sets.insert_one(dict(doc))
    await add_event('info', 'Marks submitted', f"{doc['subject']} marks for {doc['class_name']} {doc['section']} were finalized.")
    return clean(doc)

@api_router.get("/results")
async def results(role: str = Depends(get_current)):
    latest = await db.marks_sets.find().sort('created', -1).to_list(1)
    if not latest:
        return {'exam_title': '\u2014', 'rows': [], 'class_average': 0, 'highest': 0, 'pass_rate': 0, 'students': 0}
    ms = latest[0]
    total_max = ms.get('total_max', 100)
    rows = []
    for r in ms.get('rows', []):
        total = r.get('total', 0)
        pct = round(total / total_max * 100, 1) if total_max else 0
        rows.append({'roll': r.get('roll', ''), 'name': r.get('name', ''), 'total': total,
                     'percent': pct, 'grade': grade_for(pct)})
    rows.sort(key=lambda x: x['total'], reverse=True)
    for i, r in enumerate(rows):
        r['rank'] = i + 1
    pcts = [r['percent'] for r in rows] or [0]
    passed = len([p for p in pcts if p >= 40])
    return {
        'exam_title': ms.get('exam_title', ''), 'class': f"{ms.get('class_name','')} - {ms.get('section','')}",
        'subject': ms.get('subject', ''), 'rows': rows,
        'class_average': round(sum(pcts) / len(pcts), 1), 'highest': max(pcts),
        'pass_rate': round(passed / len(pcts) * 100), 'students': len(rows),
    }

# ---------------- Notifications ----------------
@api_router.get("/notifications")
async def notifications(role: str = Depends(get_current)):
    events = await db.events.find().sort('created', -1).to_list(50)
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
    overdue = await db.fees.find({'status': 'Overdue'}).to_list(100)
    if overdue:
        names = ', '.join([o['name'] for o in overdue[:3]])
        out.insert(0, {'title': 'Fee payment overdue', 'body': f"{len(overdue)} students have overdue dues ({names}...).",
                       'time': 'live', 'type': 'warning', 'unread': True})
    return out

@api_router.post("/notifications/read-all")
async def read_all(role: str = Depends(get_current)):
    await db.events.update_many({}, {'$set': {'unread': False}})
    return {'ok': True}

# ---------------- Bulk upload ----------------
CSV_HEADERS = ['student_name', 'Student_Class', 'Student_Section', 'Admission Number', 'birthday', 'sex',
               'aadhar_number', 'caste', 'subcaste', 'phone', 'parent_id', 'mother_name', 'guardian',
               'address', 'password', 'Parent Name', 'Parent Phone', 'Address']
SAMPLE_ROW = ['K.Tapasvi', 'VIII', 'A', '123', '12/6/2005', 'Female', '24543657', 'Hindu', 'OC',
              '9876345908', 'K.Manasvi', '', 'J.Raghu', 'Himyathnagar, Hyderabad', '', 'K. Srikar',
              '9876345908', 'Himyathnagar, Hyderabad']

@api_router.get("/students-template")
async def students_template(role: str = Depends(get_current)):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(CSV_HEADERS)
    w.writerow(SAMPLE_ROW)
    return PlainTextResponse(buf.getvalue(), media_type='text/csv',
                             headers={'Content-Disposition': 'attachment; filename=students_template.csv'})

@api_router.post("/students/bulk")
async def bulk_upload(file: UploadFile = File(...), role: str = Depends(get_current)):
    content = (await file.read()).decode('utf-8', errors='ignore')
    reader = csv.DictReader(io.StringIO(content))
    inserted, errors = 0, []
    for i, row in enumerate(reader, start=2):
        name = (row.get('student_name') or '').strip()
        cls = (row.get('Student_Class') or '').strip()
        sec = (row.get('Student_Section') or '').strip()
        adm = (row.get('Admission Number') or '').strip()
        pid = (row.get('parent_id') or '').strip()
        pname = (row.get('Parent Name') or '').strip()
        pphone = (row.get('Parent Phone') or '').strip()
        if not name or not cls or not sec or not adm or not pname or not pphone:
            errors.append({'row': i, 'error': 'Missing mandatory field(s)'})
            continue
        if await db.students.find_one({'admission_no': adm}):
            errors.append({'row': i, 'error': f'Duplicate admission number {adm}'})
            continue
        s = Student(
            name=name, class_name=cls, section=sec, admission_no=adm,
            dob=(row.get('birthday') or '').strip(), gender=(row.get('sex') or '').strip(),
            aadhar=(row.get('aadhar_number') or '').strip(), caste=(row.get('caste') or '').strip(),
            subcaste=(row.get('subcaste') or '').strip(), phone=(row.get('phone') or '').strip(),
            mobile=(row.get('phone') or '').strip(), parent_id=pid,
            mother_name=(row.get('mother_name') or '').strip(), guardian=(row.get('guardian') or '').strip(),
            guardian_name=(row.get('guardian') or '').strip(),
            address=(row.get('address') or row.get('Address') or '').strip(),
            father_name=pname, parent_name=pname, parent_phone=pphone,
        )
        doc = s.dict()
        await db.students.insert_one(dict(doc))
        await db.fees.insert_one({'id': f"FEE-{uuid.uuid4().hex[:8]}", 'student_id': doc['id'], 'name': name,
                                  'total': 45000, 'paid': 0, 'due': 45000, 'status': 'Overdue', 'avatar': doc['avatar']})
        inserted += 1
    if inserted:
        await add_event('success', 'Bulk students imported', f"{inserted} students were added via CSV upload.")
    return {'inserted': inserted, 'errors': errors}

# ---------------- Role dashboards ----------------
@api_router.get("/analytics/fee")
async def analytics_fee(role: str = Depends(get_current)):
    fees = await db.fees.find().to_list(1000)
    collected = sum(f.get('paid', 0) for f in fees)
    pending = sum(f.get('due', 0) for f in fees)
    total = sum(f.get('total', 0) for f in fees)
    top = sorted([f for f in fees if f.get('due', 0) > 0], key=lambda x: -x.get('due', 0))[:5]
    return {
        'stats': {'collected': collected, 'pending': pending, 'total': total, 'invoices': len(fees)},
        'method_split': [{'name': 'Cash', 'value': 45}, {'name': 'Card', 'value': 30}, {'name': 'Online', 'value': 25}],
        'monthly': [
            {'month': 'Feb', 'amount': 320000}, {'month': 'Mar', 'amount': 410000},
            {'month': 'Apr', 'amount': 380000}, {'month': 'May', 'amount': 450000},
            {'month': 'Jun', 'amount': 470000}, {'month': 'Jul', 'amount': 480000},
        ],
        'top_dues': [{'name': f.get('name'), 'due': f.get('due'), 'avatar': f.get('avatar', '')} for f in top],
    }

@api_router.get("/analytics/academic")
async def analytics_academic(role: str = Depends(get_current)):
    students = await db.students.find().to_list(1000)
    res = await results(role)
    ai = await analytics_ai(role)
    return {
        'stats': {'pass_rate': res.get('pass_rate', 96), 'avg': res.get('class_average', 85),
                  'attendance': 94.2, 'students': len(students)},
        'attendance_trend': [
            {'month': 'Feb', 'rate': 89}, {'month': 'Mar', 'rate': 91}, {'month': 'Apr', 'rate': 90},
            {'month': 'May', 'rate': 92}, {'month': 'Jun', 'rate': 93}, {'month': 'Jul', 'rate': 94.2},
        ],
        'subject_scores': ai['subject_scores'],
        'results_top': res.get('rows', [])[:5],
    }

# ---------------- Seeding ----------------
SEED_STUDENTS = [
    {'id': 'EP-2024-0812', 'name': 'Marcus Thorne', 'class_name': 'Grade 11', 'section': 'Section B', 'roll': '042', 'status': 'Active', 'balance': 11450, 'avatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces'},
    {'id': 'ADM-2024-0892', 'name': 'Aarav Sharma', 'class_name': 'Class 10', 'section': 'Section B', 'roll': '018', 'status': 'Active', 'balance': 0, 'avatar': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=faces'},
    {'id': 'EP-2024-0455', 'name': 'Sophia Martinez', 'class_name': 'Grade 10', 'section': 'Section A', 'roll': '021', 'status': 'Active', 'balance': 18000, 'avatar': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=faces'},
    {'id': 'EP-2024-0311', 'name': 'Elara Vance', 'class_name': 'Grade 10', 'section': 'Section A', 'roll': '009', 'status': 'Active', 'balance': 0, 'avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces'},
    {'id': 'EP-2024-0790', 'name': 'Benjamin Thorne', 'class_name': 'Grade 10', 'section': 'Section A', 'roll': '012', 'status': 'Inactive', 'balance': 20000, 'avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces'},
]
SEED_FEES = [
    {'id': 'F1', 'student_id': 'EP-2024-0812', 'name': 'Marcus Thorne', 'total': 45000, 'paid': 33550, 'due': 11450, 'status': 'Partial', 'avatar': SEED_STUDENTS[0]['avatar']},
    {'id': 'F2', 'student_id': 'ADM-2024-0892', 'name': 'Aarav Sharma', 'total': 42000, 'paid': 42000, 'due': 0, 'status': 'Paid', 'avatar': SEED_STUDENTS[1]['avatar']},
    {'id': 'F3', 'student_id': 'EP-2024-0455', 'name': 'Sophia Martinez', 'total': 48000, 'paid': 30000, 'due': 18000, 'status': 'Overdue', 'avatar': SEED_STUDENTS[2]['avatar']},
    {'id': 'F4', 'student_id': 'EP-2024-0311', 'name': 'Elara Vance', 'total': 45000, 'paid': 45000, 'due': 0, 'status': 'Paid', 'avatar': SEED_STUDENTS[3]['avatar']},
    {'id': 'F5', 'student_id': 'EP-2024-0790', 'name': 'Benjamin Thorne', 'total': 40000, 'paid': 20000, 'due': 20000, 'status': 'Overdue', 'avatar': SEED_STUDENTS[4]['avatar']},
]
SEED_EXAMS = [
    {'id': 'X1', 'title': 'Mid-Term 2025', 'class_name': 'Grade 10-A', 'subject': 'Mathematics', 'date': 'Aug 12, 2025', 'room': 'Hall B2', 'status': 'Scheduled'},
    {'id': 'X2', 'title': 'Unit Test 3', 'class_name': 'Grade 9-B', 'subject': 'Science', 'date': 'Aug 18, 2025', 'room': 'Room 204', 'status': 'Scheduled'},
    {'id': 'X3', 'title': 'First Semester Final', 'class_name': 'Grade 11-B', 'subject': 'Physics', 'date': 'Sep 02, 2025', 'room': 'Auditorium', 'status': 'Draft'},
    {'id': 'X4', 'title': 'Weekly Quiz', 'class_name': 'Grade 8-A', 'subject': 'English', 'date': 'Aug 08, 2025', 'room': 'Room 101', 'status': 'Completed'},
]
SEED_LEAVES = [
    {'id': 'L1', 'name': 'Cody Fisher', 'leave_type': 'Medical', 'from_date': '01 Oct 2025', 'to_date': '03 Oct 2025', 'days': 3, 'status': 'Approved', 'avatar': 'https://i.pravatar.cc/80?img=12'},
    {'id': 'L2', 'name': 'Esther Howard', 'leave_type': 'Casual', 'from_date': '28 Sep 2025', 'to_date': '28 Sep 2025', 'days': 1, 'status': 'Rejected', 'avatar': 'https://i.pravatar.cc/80?img=45'},
    {'id': 'L3', 'name': 'Jenny Wilson', 'leave_type': 'Maternity', 'from_date': '15 Aug 2025', 'to_date': '15 Nov 2025', 'days': 92, 'status': 'Approved', 'avatar': 'https://i.pravatar.cc/80?img=32'},
    {'id': 'L4', 'name': 'Guy Hawkins', 'leave_type': 'Annual', 'from_date': '10 Sep 2025', 'to_date': '15 Sep 2025', 'days': 6, 'status': 'Pending', 'avatar': 'https://i.pravatar.cc/80?img=15'},
    {'id': 'L5', 'name': 'Marvin McKinney', 'leave_type': 'Sick', 'from_date': '05 Sep 2025', 'to_date': '07 Sep 2025', 'days': 3, 'status': 'Approved', 'avatar': 'https://i.pravatar.cc/80?img=13'},
    {'id': 'L6', 'name': 'Bessie Cooper', 'leave_type': 'Casual', 'from_date': '01 Sep 2025', 'to_date': '01 Sep 2025', 'days': 1, 'status': 'Rejected', 'avatar': 'https://i.pravatar.cc/80?img=47'},
]
SEED_TEACHERS = [
    {'id': 'TCH-001', 'name': 'Dr. Anita Rao', 'subject': 'Physics', 'classes': 'Grade 11, 12', 'phone': '+91 98765 10001', 'status': 'Active', 'avatar': 'https://i.pravatar.cc/80?img=32'},
    {'id': 'TCH-002', 'name': 'Vikram Nair', 'subject': 'Mathematics', 'classes': 'Grade 9, 10', 'phone': '+91 98765 10002', 'status': 'Active', 'avatar': 'https://i.pravatar.cc/80?img=12'},
    {'id': 'TCH-003', 'name': 'Sneha Kapoor', 'subject': 'English', 'classes': 'Grade 6, 7, 8', 'phone': '+91 98765 10003', 'status': 'On Leave', 'avatar': 'https://i.pravatar.cc/80?img=45'},
    {'id': 'TCH-004', 'name': 'Rahul Menon', 'subject': 'Chemistry', 'classes': 'Grade 11', 'phone': '+91 98765 10004', 'status': 'Active', 'avatar': 'https://i.pravatar.cc/80?img=15'},
    {'id': 'TCH-005', 'name': 'Priya Das', 'subject': 'Biology', 'classes': 'Grade 10, 12', 'phone': '+91 98765 10005', 'status': 'Active', 'avatar': 'https://i.pravatar.cc/80?img=47'},
    {'id': 'TCH-006', 'name': 'Arjun Sethi', 'subject': 'Computer Science', 'classes': 'Grade 8, 9', 'phone': '+91 98765 10006', 'status': 'Active', 'avatar': 'https://i.pravatar.cc/80?img=13'},
]

async def seed():
    seeds = [
        ('students', SEED_STUDENTS), ('fees', SEED_FEES), ('exams', SEED_EXAMS),
        ('leaves', SEED_LEAVES), ('teachers', SEED_TEACHERS),
    ]
    for coll, data in seeds:
        count = await db[coll].count_documents({})
        if count == 0:
            await db[coll].insert_many([dict(x) for x in data])
            logger.info(f"Seeded {coll} with {len(data)} docs")
    if await db.marks_sets.count_documents({}) == 0:
        await db.marks_sets.insert_one({
            'id': 'MS1', 'exam_title': 'Mid-Term 2025', 'class_name': 'Grade 10', 'section': 'Section A',
            'subject': 'Mathematics', 'max_written': 70, 'max_practical': 30, 'total_max': 100,
            'created': datetime.utcnow().isoformat(),
            'rows': [
                {'roll': '#102401', 'name': 'Benjamin Thorne', 'written': 62, 'practical': 28, 'total': 90},
                {'roll': '#102402', 'name': 'Sophia Martinez', 'written': 55, 'practical': 24, 'total': 79},
                {'roll': '#102403', 'name': 'Elara Vance', 'written': 68, 'practical': 29, 'total': 97},
                {'roll': '#102404', 'name': 'Marcus Thorne', 'written': 60, 'practical': 22, 'total': 82},
                {'roll': '#102405', 'name': 'Aarav Sharma', 'written': 58, 'practical': 25, 'total': 83},
            ],
        })
        logger.info("Seeded marks_sets")
    if await db.events.count_documents({}) == 0:
        base = datetime.utcnow()
        evs = [
            {'type': 'info', 'title': 'Exam scheduled', 'body': 'Mid-Term 2025 for Grade 10-A on Aug 12.', 'mins': 180},
            {'type': 'info', 'title': 'New transport route', 'body': 'Route added for Sector 9 pickups.', 'mins': 1440},
            {'type': 'success', 'title': 'Fees reconciled', 'body': 'July fee collection reconciled successfully.', 'mins': 2880},
        ]
        for e in evs:
            await db.events.insert_one({'id': str(uuid.uuid4()), 'type': e['type'], 'title': e['title'],
                                        'body': e['body'], 'unread': False,
                                        'created': (base - timedelta(minutes=e['mins'])).isoformat()})
        logger.info("Seeded events")

@app.on_event("startup")
async def startup():
    await seed()

@api_router.get("/")
async def root():
    return {"message": "Orison API"}

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware, allow_credentials=True, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
