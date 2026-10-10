"""Backend regression tests for Orison School Management."""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL') or open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].splitlines()[0]
BASE_URL = BASE_URL.rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"role": "admin"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def h(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- Auth ----------
def test_login_admin():
    r = requests.post(f"{API}/auth/login", json={"role": "admin"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["role"] == "admin"
    assert d["menu"] is None
    assert d["token"]


def test_login_fee_manager_menu():
    r = requests.post(f"{API}/auth/login", json={"role": "fee_manager"}, timeout=15)
    assert r.status_code == 200
    menu = r.json()["menu"]
    assert "fee" in menu and "marks" not in menu and "teachers" not in menu


def test_login_principal_menu():
    r = requests.post(f"{API}/auth/login", json={"role": "principal"}, timeout=15)
    assert r.status_code == 200
    menu = r.json()["menu"]
    assert "marks" in menu and "fee" not in menu


# ---------- Students validation ----------
def test_create_student_missing_fields_422(h):
    r = requests.post(f"{API}/students", json={"name": "TEST_OnlyName"}, headers=h, timeout=15)
    assert r.status_code == 422, r.text
    assert "Missing required field" in r.json()["detail"]


def test_create_student_success_and_persist_and_duplicate_and_cleanup(h):
    adm = f"TEST-{uuid.uuid4().hex[:8].upper()}"
    payload = {
        "name": "TEST_Student One", "admission_no": adm, "class_name": "Grade 10",
        "section": "Section A", "academic_year": "2024-2025", "gender": "Male",
        "father_name": "TEST_Father", "mobile": "+91 9876543210",
    }
    r = requests.post(f"{API}/students", json=payload, headers=h, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    sid = d["id"]
    assert d["admission_no"] == adm

    # Verify persistence via GET
    g = requests.get(f"{API}/students/{sid}", headers=h, timeout=15)
    assert g.status_code == 200
    assert g.json()["name"] == "TEST_Student One"

    # Verify fee auto-created
    fees = requests.get(f"{API}/fees", headers=h, timeout=15).json()
    assert any(f.get("student_id") == sid for f in fees), "fee record not created"

    # Duplicate admission -> 409
    dup = requests.post(f"{API}/students", json=payload, headers=h, timeout=15)
    assert dup.status_code == 409
    assert "already exists" in dup.json()["detail"].lower()

    # Cleanup
    dl = requests.delete(f"{API}/students/{sid}", headers=h, timeout=15)
    assert dl.status_code == 200
    # Verify deletion
    g2 = requests.get(f"{API}/students/{sid}", headers=h, timeout=15)
    assert g2.status_code == 404


def test_bulk_upload_dedup(h, admin_token):
    # Create a seed student with known admission
    adm = f"TEST-BULK-{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "name": "TEST_BulkSeed", "admission_no": adm, "class_name": "Grade 10",
        "section": "Section A", "academic_year": "2024-2025", "gender": "Male",
        "father_name": "TEST_F", "mobile": "9876543210",
    }
    r = requests.post(f"{API}/students", json=payload, headers=h, timeout=15)
    assert r.status_code == 200
    sid = r.json()["id"]

    # Build CSV with 2 rows: one duplicate, one new
    new_adm = f"TEST-NEW-{uuid.uuid4().hex[:6].upper()}"
    csv_content = (
        "student_name,Student_Class,Student_Section,Admission Number,birthday,sex,aadhar_number,caste,subcaste,phone,parent_id,mother_name,guardian,address,password,Parent Name,Parent Phone,Address\n"
        f"TEST_Dup,VIII,A,{adm},01/01/2010,Male,,,,9876543210,,,,,,TEST_Par,9876543210,\n"
        f"TEST_NewBulk,VIII,A,{new_adm},01/01/2010,Male,,,,9876543210,,,,,,TEST_Par,9876543210,\n"
    )
    files = {"file": ("students.csv", csv_content, "text/csv")}
    up = requests.post(f"{API}/students/bulk", files=files,
                       headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    assert up.status_code == 200, up.text
    body = up.json()
    assert body["inserted"] == 1
    assert any("Duplicate" in e.get("error", "") for e in body["errors"])

    # Cleanup: delete original + bulk-created
    requests.delete(f"{API}/students/{sid}", headers=h, timeout=15)
    all_students = requests.get(f"{API}/students", headers=h, timeout=15).json()
    for s in all_students:
        if s.get("admission_no") == new_adm:
            requests.delete(f"{API}/students/{s['id']}", headers=h, timeout=15)


def test_create_leave_without_name_for_teacher_works(h):
    teacher = requests.post(
        f"{API}/teachers",
        json={
            "name": "TEST_Teacher Leave",
            "subject": "Mathematics",
            "phone": "9876500001",
            "email": f"teacher.{uuid.uuid4().hex[:6]}@example.com",
            "qualification": "M.Sc.",
            "status": "Active",
        },
        headers=h,
        timeout=15,
    )
    assert teacher.status_code == 200, teacher.text
    teacher_id = teacher.json()["id"]

    leave = requests.post(
        f"{API}/leaves",
        json={
            "person_type": "Teacher",
            "person_id": teacher_id,
            "leave_type": "Sick Leave",
            "from_date": "2026-08-20",
            "to_date": "2026-08-22",
            "reason": "Need rest after illness",
        },
        headers=h,
        timeout=15,
    )
    assert leave.status_code == 200, leave.text
    payload = leave.json()
    assert payload["name"] == "TEST_Teacher Leave"
    assert payload["person_type"] == "Teacher"


# ---------- Analytics ----------
@pytest.mark.parametrize("path", ["/analytics/dashboard", "/analytics/fee", "/analytics/academic"])
def test_analytics_endpoints(h, path):
    r = requests.get(f"{API}{path}", headers=h, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "stats" in d
    assert isinstance(d["stats"], dict) and len(d["stats"]) > 0


def test_analytics_requires_auth():
    r = requests.get(f"{API}/analytics/dashboard", timeout=10)
    assert r.status_code == 401
