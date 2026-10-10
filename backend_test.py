#!/usr/bin/env python3
"""
Comprehensive backend API tests for Orison School Management System
Tests all endpoints as per the review request specification
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Base URL from environment
BASE_URL = "https://recursing-napier-4.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

class TestRunner:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.admin_token = None
        self.principal_token = None
        self.fee_manager_token = None
        self.test_student_id = None
        self.test_exam_id = None
        self.test_leave_id = None
        
    def log(self, message: str, color: str = Colors.RESET):
        print(f"{color}{message}{Colors.RESET}")
    
    def test(self, name: str, condition: bool, details: str = ""):
        if condition:
            self.passed += 1
            self.log(f"✅ PASS: {name}", Colors.GREEN)
            if details:
                self.log(f"   {details}", Colors.BLUE)
        else:
            self.failed += 1
            self.log(f"❌ FAIL: {name}", Colors.RED)
            if details:
                self.log(f"   {details}", Colors.YELLOW)
    
    def summary(self):
        total = self.passed + self.failed
        self.log(f"\n{'='*60}", Colors.BLUE)
        self.log(f"TEST SUMMARY", Colors.BLUE)
        self.log(f"{'='*60}", Colors.BLUE)
        self.log(f"Total: {total} | Passed: {self.passed} | Failed: {self.failed}")
        if self.failed == 0:
            self.log(f"🎉 ALL TESTS PASSED!", Colors.GREEN)
        else:
            self.log(f"⚠️  {self.failed} TEST(S) FAILED", Colors.RED)
        self.log(f"{'='*60}\n", Colors.BLUE)
        return self.failed == 0

    # ============ AUTH TESTS ============
    
    def test_auth_login_admin(self):
        """Test 1: POST /api/auth/login with role=admin"""
        self.log("\n[TEST 1] Auth Login - Admin Role", Colors.BLUE)
        try:
            resp = requests.post(f"{BASE_URL}/auth/login", json={"role": "admin"}, timeout=10)
            data = resp.json()
            
            self.test("Admin login returns 200", resp.status_code == 200)
            self.test("Admin login returns token", "token" in data and len(data["token"]) > 0)
            self.test("Admin login returns role=admin", data.get("role") == "admin")
            self.test("Admin login returns name", "name" in data and len(data["name"]) > 0, 
                     f"Name: {data.get('name')}")
            self.test("Admin login returns menu=null", data.get("menu") is None,
                     "Admin should see all menus (menu=null)")
            
            if "token" in data:
                self.admin_token = data["token"]
                self.log(f"   Admin token saved for subsequent tests", Colors.BLUE)
        except Exception as e:
            self.test("Admin login request", False, f"Exception: {str(e)}")
    
    def test_auth_login_principal(self):
        """Test 2a: POST /api/auth/login with role=principal"""
        self.log("\n[TEST 2a] Auth Login - Principal Role", Colors.BLUE)
        try:
            resp = requests.post(f"{BASE_URL}/auth/login", json={"role": "principal"}, timeout=10)
            data = resp.json()
            
            self.test("Principal login returns 200", resp.status_code == 200)
            self.test("Principal login returns token", "token" in data and len(data["token"]) > 0)
            self.test("Principal login returns role=principal", data.get("role") == "principal")
            self.test("Principal login returns menu array", 
                     isinstance(data.get("menu"), list) and len(data.get("menu", [])) > 0,
                     f"Menu items: {len(data.get('menu', []))}")
            
            if "token" in data:
                self.principal_token = data["token"]
        except Exception as e:
            self.test("Principal login request", False, f"Exception: {str(e)}")
    
    def test_auth_login_fee_manager(self):
        """Test 2b: POST /api/auth/login with role=fee_manager"""
        self.log("\n[TEST 2b] Auth Login - Fee Manager Role", Colors.BLUE)
        try:
            resp = requests.post(f"{BASE_URL}/auth/login", json={"role": "fee_manager"}, timeout=10)
            data = resp.json()
            
            self.test("Fee manager login returns 200", resp.status_code == 200)
            self.test("Fee manager login returns token", "token" in data and len(data["token"]) > 0)
            self.test("Fee manager login returns role=fee_manager", data.get("role") == "fee_manager")
            self.test("Fee manager login returns menu array", 
                     isinstance(data.get("menu"), list) and len(data.get("menu", [])) > 0,
                     f"Menu items: {len(data.get('menu', []))}")
            
            if "token" in data:
                self.fee_manager_token = data["token"]
        except Exception as e:
            self.test("Fee manager login request", False, f"Exception: {str(e)}")
    
    def test_auth_login_invalid_role(self):
        """Test 2c: POST /api/auth/login with invalid role"""
        self.log("\n[TEST 2c] Auth Login - Invalid Role", Colors.BLUE)
        try:
            resp = requests.post(f"{BASE_URL}/auth/login", json={"role": "hacker"}, timeout=10)
            
            self.test("Invalid role returns 400", resp.status_code == 400,
                     f"Got status: {resp.status_code}")
        except Exception as e:
            self.test("Invalid role login request", False, f"Exception: {str(e)}")
    
    def test_auth_me_with_token(self):
        """Test 3a: GET /api/auth/me with valid admin token"""
        self.log("\n[TEST 3a] Auth Me - With Valid Token", Colors.BLUE)
        if not self.admin_token:
            self.test("Auth me with token", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Auth me returns 200", resp.status_code == 200)
            self.test("Auth me returns role", "role" in data)
            self.test("Auth me returns name", "name" in data)
            self.test("Auth me returns menu", "menu" in data)
        except Exception as e:
            self.test("Auth me request", False, f"Exception: {str(e)}")
    
    def test_auth_me_without_token(self):
        """Test 3b: GET /api/auth/me without token"""
        self.log("\n[TEST 3b] Auth Me - Without Token", Colors.BLUE)
        try:
            resp = requests.get(f"{BASE_URL}/auth/me", timeout=10)
            
            self.test("Auth me without token returns 401", resp.status_code == 401,
                     f"Got status: {resp.status_code}")
        except Exception as e:
            self.test("Auth me without token request", False, f"Exception: {str(e)}")
    
    def test_auth_me_invalid_token(self):
        """Test 3c: GET /api/auth/me with invalid token"""
        self.log("\n[TEST 3c] Auth Me - With Invalid Token", Colors.BLUE)
        try:
            headers = {"Authorization": "Bearer invalid-token-12345"}
            resp = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
            
            self.test("Auth me with invalid token returns 401", resp.status_code == 401,
                     f"Got status: {resp.status_code}")
        except Exception as e:
            self.test("Auth me with invalid token request", False, f"Exception: {str(e)}")
    
    # ============ STUDENTS TESTS ============
    
    def test_students_list(self):
        """Test 4: GET /api/students - should return seeded list"""
        self.log("\n[TEST 4] Students List", Colors.BLUE)
        if not self.admin_token:
            self.test("Students list", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/students", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Students list returns 200", resp.status_code == 200)
            self.test("Students list returns array", isinstance(data, list))
            self.test("Students list has >=5 students", len(data) >= 5,
                     f"Found {len(data)} students")
            
            # Check for Marcus Thorne
            marcus = next((s for s in data if "Marcus Thorne" in s.get("name", "")), None)
            self.test("Students list includes Marcus Thorne", marcus is not None,
                     f"Marcus ID: {marcus.get('id') if marcus else 'Not found'}")
        except Exception as e:
            self.test("Students list request", False, f"Exception: {str(e)}")
    
    def test_students_create(self):
        """Test 5: POST /api/students - create new student"""
        self.log("\n[TEST 5] Students Create", Colors.BLUE)
        if not self.admin_token:
            self.test("Students create", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            payload = {
                "name": "Test Kid",
                "class_name": "Grade 9",
                "section": "Section A",
                "status": "Active"
            }
            resp = requests.post(f"{BASE_URL}/students", json=payload, headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Students create returns 200", resp.status_code == 200)
            self.test("Students create returns id", "id" in data and len(data["id"]) > 0)
            self.test("Students create returns correct name", data.get("name") == "Test Kid")
            self.test("Students create returns correct class", data.get("class_name") == "Grade 9")
            
            if "id" in data:
                self.test_student_id = data["id"]
                self.log(f"   Created student ID: {self.test_student_id}", Colors.BLUE)
        except Exception as e:
            self.test("Students create request", False, f"Exception: {str(e)}")
    
    def test_students_get_by_id(self):
        """Test 6a: GET /api/students/{id} - get created student"""
        self.log("\n[TEST 6a] Students Get By ID", Colors.BLUE)
        if not self.admin_token or not self.test_student_id:
            self.test("Students get by id", False, "No admin token or test student ID")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/students/{self.test_student_id}", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Students get by id returns 200", resp.status_code == 200)
            self.test("Students get by id returns correct id", data.get("id") == self.test_student_id)
            self.test("Students get by id returns correct name", data.get("name") == "Test Kid")
        except Exception as e:
            self.test("Students get by id request", False, f"Exception: {str(e)}")
    
    def test_students_get_bogus_id(self):
        """Test 6b: GET /api/students/{id} with bogus id - should return 404"""
        self.log("\n[TEST 6b] Students Get Bogus ID", Colors.BLUE)
        if not self.admin_token:
            self.test("Students get bogus id", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/students/BOGUS-ID-999", headers=headers, timeout=10)
            
            self.test("Students get bogus id returns 404", resp.status_code == 404,
                     f"Got status: {resp.status_code}")
        except Exception as e:
            self.test("Students get bogus id request", False, f"Exception: {str(e)}")
    
    def test_students_update(self):
        """Test 7: PUT /api/students/{id} - update student name"""
        self.log("\n[TEST 7] Students Update", Colors.BLUE)
        if not self.admin_token or not self.test_student_id:
            self.test("Students update", False, "No admin token or test student ID")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            payload = {
                "id": self.test_student_id,
                "name": "Test Kid Updated",
                "class_name": "Grade 9",
                "section": "Section A",
                "status": "Active"
            }
            resp = requests.put(f"{BASE_URL}/students/{self.test_student_id}", 
                               json=payload, headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Students update returns 200", resp.status_code == 200)
            self.test("Students update returns updated name", data.get("name") == "Test Kid Updated")
            
            # Verify with GET
            resp_get = requests.get(f"{BASE_URL}/students/{self.test_student_id}", 
                                   headers=headers, timeout=10)
            data_get = resp_get.json()
            self.test("Students update persisted", data_get.get("name") == "Test Kid Updated")
        except Exception as e:
            self.test("Students update request", False, f"Exception: {str(e)}")
    
    def test_students_delete(self):
        """Test 8: DELETE /api/students/{id} - delete student"""
        self.log("\n[TEST 8] Students Delete", Colors.BLUE)
        if not self.admin_token or not self.test_student_id:
            self.test("Students delete", False, "No admin token or test student ID")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.delete(f"{BASE_URL}/students/{self.test_student_id}", 
                                  headers=headers, timeout=10)
            
            self.test("Students delete returns 200", resp.status_code == 200)
            
            # Verify with GET - should return 404
            resp_get = requests.get(f"{BASE_URL}/students/{self.test_student_id}", 
                                   headers=headers, timeout=10)
            self.test("Students delete verified (404 on GET)", resp_get.status_code == 404,
                     f"Got status: {resp_get.status_code}")
        except Exception as e:
            self.test("Students delete request", False, f"Exception: {str(e)}")
    
    # ============ FEES TESTS ============
    
    def test_fees_list(self):
        """Test 9a: GET /api/fees - should return seeded list"""
        self.log("\n[TEST 9a] Fees List", Colors.BLUE)
        if not self.admin_token:
            self.test("Fees list", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/fees", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Fees list returns 200", resp.status_code == 200)
            self.test("Fees list returns array", isinstance(data, list))
            self.test("Fees list has >=5 records", len(data) >= 5,
                     f"Found {len(data)} fee records")
        except Exception as e:
            self.test("Fees list request", False, f"Exception: {str(e)}")
    
    def test_fees_summary_before_payment(self):
        """Test 9b: GET /api/fees/summary - before payment"""
        self.log("\n[TEST 9b] Fees Summary - Before Payment", Colors.BLUE)
        if not self.admin_token:
            self.test("Fees summary", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/fees/summary", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Fees summary returns 200", resp.status_code == 200)
            self.test("Fees summary has collected", "collected" in data and isinstance(data["collected"], (int, float)))
            self.test("Fees summary has pending", "pending" in data and isinstance(data["pending"], (int, float)))
            self.test("Fees summary has total", "total" in data and isinstance(data["total"], (int, float)))
            self.test("Fees summary has invoices", "invoices" in data and isinstance(data["invoices"], int))
            
            # Store pending for later comparison
            self.pending_before = data.get("pending", 0)
            self.log(f"   Pending before payment: {self.pending_before}", Colors.BLUE)
        except Exception as e:
            self.test("Fees summary request", False, f"Exception: {str(e)}")
    
    def test_fees_pay(self):
        """Test 10: POST /api/fees/F1/pay - pay fee"""
        self.log("\n[TEST 10] Fees Pay", Colors.BLUE)
        if not self.admin_token:
            self.test("Fees pay", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            payload = {"method": "Cash"}
            resp = requests.post(f"{BASE_URL}/fees/F1/pay", json=payload, headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Fees pay returns 200", resp.status_code == 200)
            self.test("Fees pay sets due=0", data.get("due") == 0,
                     f"Due: {data.get('due')}")
            self.test("Fees pay sets status=Paid", data.get("status") == "Paid",
                     f"Status: {data.get('status')}")
            self.test("Fees pay sets method", data.get("method") == "Cash")
        except Exception as e:
            self.test("Fees pay request", False, f"Exception: {str(e)}")
    
    def test_fees_summary_after_payment(self):
        """Test 11: GET /api/fees/summary - after payment (pending should reduce)"""
        self.log("\n[TEST 11] Fees Summary - After Payment", Colors.BLUE)
        if not self.admin_token:
            self.test("Fees summary after payment", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/fees/summary", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Fees summary after payment returns 200", resp.status_code == 200)
            
            pending_after = data.get("pending", 0)
            self.log(f"   Pending after payment: {pending_after}", Colors.BLUE)
            
            if hasattr(self, 'pending_before'):
                self.test("Fees summary pending reduced", pending_after < self.pending_before,
                         f"Before: {self.pending_before}, After: {pending_after}")
            else:
                self.log("   Skipping pending comparison (no before value)", Colors.YELLOW)
        except Exception as e:
            self.test("Fees summary after payment request", False, f"Exception: {str(e)}")
    
    # ============ EXAMS TESTS ============
    
    def test_exams_list(self):
        """Test 12a: GET /api/exams - should return seeded list"""
        self.log("\n[TEST 12a] Exams List", Colors.BLUE)
        if not self.admin_token:
            self.test("Exams list", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/exams", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Exams list returns 200", resp.status_code == 200)
            self.test("Exams list returns array", isinstance(data, list))
            self.test("Exams list has >=4 records", len(data) >= 4,
                     f"Found {len(data)} exam records")
        except Exception as e:
            self.test("Exams list request", False, f"Exception: {str(e)}")
    
    def test_exams_create(self):
        """Test 12b: POST /api/exams - create new exam"""
        self.log("\n[TEST 12b] Exams Create", Colors.BLUE)
        if not self.admin_token:
            self.test("Exams create", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            payload = {
                "title": "API Test Exam",
                "class_name": "Grade 10",
                "subject": "Mathematics",
                "status": "Scheduled"
            }
            resp = requests.post(f"{BASE_URL}/exams", json=payload, headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Exams create returns 200", resp.status_code == 200)
            self.test("Exams create returns id", "id" in data and len(data["id"]) > 0)
            self.test("Exams create returns correct title", data.get("title") == "API Test Exam")
            self.test("Exams create returns correct status", data.get("status") == "Scheduled")
            
            if "id" in data:
                self.test_exam_id = data["id"]
                self.log(f"   Created exam ID: {self.test_exam_id}", Colors.BLUE)
        except Exception as e:
            self.test("Exams create request", False, f"Exception: {str(e)}")
    
    def test_exams_list_includes_new(self):
        """Test 12c: GET /api/exams - verify new exam appears"""
        self.log("\n[TEST 12c] Exams List Includes New", Colors.BLUE)
        if not self.admin_token or not self.test_exam_id:
            self.test("Exams list includes new", False, "No admin token or test exam ID")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/exams", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Exams list returns 200", resp.status_code == 200)
            
            # Check for our created exam
            test_exam = next((e for e in data if e.get("id") == self.test_exam_id), None)
            self.test("Exams list includes API Test Exam", test_exam is not None,
                     f"Found: {test_exam.get('title') if test_exam else 'Not found'}")
        except Exception as e:
            self.test("Exams list includes new request", False, f"Exception: {str(e)}")
    
    # ============ LEAVES TESTS ============
    
    def test_leaves_list(self):
        """Test 13a: GET /api/leaves - should return seeded list"""
        self.log("\n[TEST 13a] Leaves List", Colors.BLUE)
        if not self.admin_token:
            self.test("Leaves list", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/leaves", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Leaves list returns 200", resp.status_code == 200)
            self.test("Leaves list returns array", isinstance(data, list))
            self.test("Leaves list has >=6 records", len(data) >= 6,
                     f"Found {len(data)} leave records")
        except Exception as e:
            self.test("Leaves list request", False, f"Exception: {str(e)}")
    
    def test_leaves_summary(self):
        """Test 13b: GET /api/leaves/summary - should return counts"""
        self.log("\n[TEST 13b] Leaves Summary", Colors.BLUE)
        if not self.admin_token:
            self.test("Leaves summary", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/leaves/summary", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Leaves summary returns 200", resp.status_code == 200)
            self.test("Leaves summary has total", "total" in data and isinstance(data["total"], int))
            self.test("Leaves summary has approved", "approved" in data and isinstance(data["approved"], int))
            self.test("Leaves summary has rejected", "rejected" in data and isinstance(data["rejected"], int))
            self.test("Leaves summary has pending", "pending" in data and isinstance(data["pending"], int))
        except Exception as e:
            self.test("Leaves summary request", False, f"Exception: {str(e)}")
    
    def test_leaves_create(self):
        """Test 13c: POST /api/leaves - create new leave"""
        self.log("\n[TEST 13c] Leaves Create", Colors.BLUE)
        if not self.admin_token:
            self.test("Leaves create", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            payload = {
                "name": "Tester",
                "leave_type": "Sick",
                "from_date": "01 Nov",
                "to_date": "02 Nov",
                "days": 2
            }
            resp = requests.post(f"{BASE_URL}/leaves", json=payload, headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Leaves create returns 200", resp.status_code == 200)
            self.test("Leaves create returns id", "id" in data and len(data["id"]) > 0)
            self.test("Leaves create returns correct name", data.get("name") == "Tester")
            self.test("Leaves create status is Pending", data.get("status") == "Pending")
            
            if "id" in data:
                self.test_leave_id = data["id"]
                self.log(f"   Created leave ID: {self.test_leave_id}", Colors.BLUE)
        except Exception as e:
            self.test("Leaves create request", False, f"Exception: {str(e)}")
    
    def test_leaves_update_status(self):
        """Test 13d: PUT /api/leaves/{id}/status - approve leave"""
        self.log("\n[TEST 13d] Leaves Update Status", Colors.BLUE)
        if not self.admin_token or not self.test_leave_id:
            self.test("Leaves update status", False, "No admin token or test leave ID")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.put(f"{BASE_URL}/leaves/{self.test_leave_id}/status?status=Approved", 
                               headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Leaves update status returns 200", resp.status_code == 200)
            self.test("Leaves update status changed to Approved", data.get("status") == "Approved",
                     f"Status: {data.get('status')}")
        except Exception as e:
            self.test("Leaves update status request", False, f"Exception: {str(e)}")
    
    # ============ TEACHERS TESTS ============
    
    def test_teachers_list(self):
        """Test 14: GET /api/teachers - should return seeded list"""
        self.log("\n[TEST 14] Teachers List", Colors.BLUE)
        if not self.admin_token:
            self.test("Teachers list", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/teachers", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Teachers list returns 200", resp.status_code == 200)
            self.test("Teachers list returns array", isinstance(data, list))
            self.test("Teachers list has >=6 records", len(data) >= 6,
                     f"Found {len(data)} teacher records")
        except Exception as e:
            self.test("Teachers list request", False, f"Exception: {str(e)}")
    
    # ============ SEARCH TESTS ============
    
    def test_search_marcus(self):
        """Test 15a: GET /api/search?q=marc - should find Marcus Thorne"""
        self.log("\n[TEST 15a] Search - Marcus", Colors.BLUE)
        if not self.admin_token:
            self.test("Search marcus", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/search?q=marc", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Search marcus returns 200", resp.status_code == 200)
            self.test("Search marcus has students array", "students" in data and isinstance(data["students"], list))
            
            # Check for Marcus Thorne
            marcus = next((s for s in data.get("students", []) if "Marcus Thorne" in s.get("name", "")), None)
            self.test("Search marcus finds Marcus Thorne", marcus is not None,
                     f"Found: {marcus.get('name') if marcus else 'Not found'}")
        except Exception as e:
            self.test("Search marcus request", False, f"Exception: {str(e)}")
    
    def test_search_vikram(self):
        """Test 15b: GET /api/search?q=vikram - should find Vikram Nair"""
        self.log("\n[TEST 15b] Search - Vikram", Colors.BLUE)
        if not self.admin_token:
            self.test("Search vikram", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/search?q=vikram", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Search vikram returns 200", resp.status_code == 200)
            self.test("Search vikram has teachers array", "teachers" in data and isinstance(data["teachers"], list))
            
            # Check for Vikram Nair
            vikram = next((t for t in data.get("teachers", []) if "Vikram Nair" in t.get("name", "")), None)
            self.test("Search vikram finds Vikram Nair", vikram is not None,
                     f"Found: {vikram.get('name') if vikram else 'Not found'}")
        except Exception as e:
            self.test("Search vikram request", False, f"Exception: {str(e)}")
    
    def test_search_grade(self):
        """Test 15c: GET /api/search?q=grade - should find classes"""
        self.log("\n[TEST 15c] Search - Grade", Colors.BLUE)
        if not self.admin_token:
            self.test("Search grade", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/search?q=grade", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Search grade returns 200", resp.status_code == 200)
            self.test("Search grade has classes array", "classes" in data and isinstance(data["classes"], list))
            self.test("Search grade finds classes", len(data.get("classes", [])) > 0,
                     f"Found {len(data.get('classes', []))} classes")
        except Exception as e:
            self.test("Search grade request", False, f"Exception: {str(e)}")
    
    def test_search_empty(self):
        """Test 15d: GET /api/search?q= - empty query should return empty arrays"""
        self.log("\n[TEST 15d] Search - Empty Query", Colors.BLUE)
        if not self.admin_token:
            self.test("Search empty", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/search?q=", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Search empty returns 200", resp.status_code == 200)
            self.test("Search empty students array is empty", len(data.get("students", [])) == 0)
            self.test("Search empty teachers array is empty", len(data.get("teachers", [])) == 0)
            self.test("Search empty classes array is empty", len(data.get("classes", [])) == 0)
        except Exception as e:
            self.test("Search empty request", False, f"Exception: {str(e)}")
    
    # ============ ANALYTICS TESTS ============
    
    def test_analytics_dashboard(self):
        """Test 16: GET /api/analytics/dashboard"""
        self.log("\n[TEST 16] Analytics Dashboard", Colors.BLUE)
        if not self.admin_token:
            self.test("Analytics dashboard", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/analytics/dashboard", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Analytics dashboard returns 200", resp.status_code == 200)
            self.test("Analytics dashboard has stats", "stats" in data and isinstance(data["stats"], dict))
            
            if "stats" in data:
                stats = data["stats"]
                self.test("Analytics dashboard stats has students", "students" in stats)
                self.test("Analytics dashboard stats has teachers", "teachers" in stats)
                self.test("Analytics dashboard stats has fees_collected", "fees_collected" in stats)
                self.test("Analytics dashboard stats has attendance", "attendance" in stats)
            
            self.test("Analytics dashboard has attendance_trend", 
                     "attendance_trend" in data and isinstance(data["attendance_trend"], list))
            self.test("Analytics dashboard has fees_trend", 
                     "fees_trend" in data and isinstance(data["fees_trend"], list))
        except Exception as e:
            self.test("Analytics dashboard request", False, f"Exception: {str(e)}")
    
    def test_analytics_ai(self):
        """Test 17: GET /api/analytics/ai"""
        self.log("\n[TEST 17] Analytics AI", Colors.BLUE)
        if not self.admin_token:
            self.test("Analytics ai", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/analytics/ai", headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Analytics ai returns 200", resp.status_code == 200)
            self.test("Analytics ai has kpis", "kpis" in data and isinstance(data["kpis"], dict))
            self.test("Analytics ai has performance_trend", 
                     "performance_trend" in data and isinstance(data["performance_trend"], list))
            self.test("Analytics ai has subject_scores", 
                     "subject_scores" in data and isinstance(data["subject_scores"], list))
            self.test("Analytics ai has risk_distribution", 
                     "risk_distribution" in data and isinstance(data["risk_distribution"], list))
        except Exception as e:
            self.test("Analytics ai request", False, f"Exception: {str(e)}")
    
    # ============ RUN ALL TESTS ============
    
    def test_partial_payments_regression(self):
        """Regression test for partial payment feature"""
        self.log("\n[REGRESSION TEST] Partial Payments Feature", Colors.BLUE)
        if not self.admin_token:
            self.test("Partial payments", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Scenario 1: Setup - find or create a fee with due>0
        self.log("\n  Scenario 1: Setup - Find/Create fee with due>0", Colors.BLUE)
        try:
            resp = requests.get(f"{BASE_URL}/fees", headers=headers, timeout=10)
            fees = resp.json()
            
            # Find a fee with due>0 (prefer F3 - Sophia Martinez)
            test_fee = None
            for f in fees:
                if f.get('id') == 'F3' and f.get('due', 0) > 0:
                    test_fee = f
                    break
            
            if not test_fee:
                # Find any fee with due>0
                for f in fees:
                    if f.get('due', 0) > 0:
                        test_fee = f
                        break
            
            # If no fee with due>0, create a new student (auto-creates fee)
            if not test_fee:
                self.log("   No fee with due>0 found, creating PayTest Kid student", Colors.YELLOW)
                student_payload = {
                    "name": "PayTest Kid",
                    "class_name": "Grade 10",
                    "section": "Section A"
                }
                resp = requests.post(f"{BASE_URL}/students", json=student_payload, headers=headers, timeout=10)
                student = resp.json()
                student_id = student.get('id')
                
                # Get fees again to find the auto-created fee
                resp = requests.get(f"{BASE_URL}/fees", headers=headers, timeout=10)
                fees = resp.json()
                for f in fees:
                    if f.get('name') == 'PayTest Kid':
                        test_fee = f
                        break
                
                self.test("Setup: Created student and auto-created fee", test_fee is not None,
                         f"Student ID: {student_id}, Fee ID: {test_fee.get('id') if test_fee else 'None'}")
            else:
                self.test("Setup: Found existing fee with due>0", True,
                         f"Fee ID: {test_fee.get('id')}, Name: {test_fee.get('name')}, Due: {test_fee.get('due')}")
            
            if not test_fee:
                self.test("Setup failed", False, "Could not find or create fee with due>0")
                return
            
            fee_id = test_fee['id']
            initial_total = test_fee.get('total', 0)
            initial_paid = test_fee.get('paid', 0)
            initial_due = test_fee.get('due', 0)
            
            self.log(f"   Initial state: Total={initial_total}, Paid={initial_paid}, Due={initial_due}", Colors.BLUE)
            
        except Exception as e:
            self.test("Setup: Find/Create fee", False, f"Exception: {str(e)}")
            return
        
        # Scenario 2: PARTIAL payment
        self.log("\n  Scenario 2: Partial payment (5000)", Colors.BLUE)
        try:
            partial_amount = 5000
            payload = {"amount": partial_amount, "method": "Cash"}
            resp = requests.post(f"{BASE_URL}/fees/{fee_id}/pay", json=payload, headers=headers, timeout=10)
            data = resp.json()
            
            expected_paid = initial_paid + partial_amount
            expected_due = initial_due - partial_amount
            
            self.test("Partial payment returns 200", resp.status_code == 200)
            self.test("Partial payment: paid increased correctly", data.get('paid') == expected_paid,
                     f"Expected: {expected_paid}, Got: {data.get('paid')}")
            self.test("Partial payment: due decreased correctly", data.get('due') == expected_due,
                     f"Expected: {expected_due}, Got: {data.get('due')}")
            self.test("Partial payment: status is 'Partial'", data.get('status') == 'Partial',
                     f"Status: {data.get('status')}")
            self.test("Partial payment: method is 'Cash'", data.get('method') == 'Cash')
            
            # Update state for next scenario
            current_paid = data.get('paid', 0)
            current_due = data.get('due', 0)
            
        except Exception as e:
            self.test("Partial payment", False, f"Exception: {str(e)}")
            return
        
        # Scenario 3: Second partial payment (pay exact remaining)
        self.log("\n  Scenario 3: Second partial payment (exact remaining)", Colors.BLUE)
        try:
            remaining_amount = current_due
            payload = {"amount": remaining_amount, "method": "Online"}
            resp = requests.post(f"{BASE_URL}/fees/{fee_id}/pay", json=payload, headers=headers, timeout=10)
            data = resp.json()
            
            self.test("Second partial payment returns 200", resp.status_code == 200)
            self.test("Second partial: due is 0", data.get('due') == 0,
                     f"Due: {data.get('due')}")
            self.test("Second partial: status is 'Paid'", data.get('status') == 'Paid',
                     f"Status: {data.get('status')}")
            self.test("Second partial: method is 'Online'", data.get('method') == 'Online')
            self.test("Second partial: paid equals total", data.get('paid') == initial_total,
                     f"Paid: {data.get('paid')}, Total: {initial_total}")
            
        except Exception as e:
            self.test("Second partial payment", False, f"Exception: {str(e)}")
        
        # Scenario 4: Over-payment guard
        self.log("\n  Scenario 4: Over-payment guard", Colors.BLUE)
        try:
            # Find or create another fee with due>0
            resp = requests.get(f"{BASE_URL}/fees", headers=headers, timeout=10)
            fees = resp.json()
            
            overpay_fee = None
            for f in fees:
                if f.get('due', 0) > 0:
                    overpay_fee = f
                    break
            
            if not overpay_fee:
                # Create another student
                student_payload = {
                    "name": "OverpayTest Student",
                    "class_name": "Grade 9",
                    "section": "Section B"
                }
                resp = requests.post(f"{BASE_URL}/students", json=student_payload, headers=headers, timeout=10)
                
                # Get fees again
                resp = requests.get(f"{BASE_URL}/fees", headers=headers, timeout=10)
                fees = resp.json()
                for f in fees:
                    if f.get('name') == 'OverpayTest Student':
                        overpay_fee = f
                        break
            
            if overpay_fee:
                overpay_fee_id = overpay_fee['id']
                overpay_initial_total = overpay_fee.get('total', 0)
                overpay_initial_paid = overpay_fee.get('paid', 0)
                overpay_initial_due = overpay_fee.get('due', 0)
                
                self.log(f"   Overpay test fee: ID={overpay_fee_id}, Due={overpay_initial_due}", Colors.BLUE)
                
                # Try to pay 99999999 (far exceeds due)
                payload = {"amount": 99999999, "method": "Cash"}
                resp = requests.post(f"{BASE_URL}/fees/{overpay_fee_id}/pay", json=payload, headers=headers, timeout=10)
                data = resp.json()
                
                self.test("Over-payment returns 200", resp.status_code == 200)
                self.test("Over-payment: due is 0", data.get('due') == 0,
                         f"Due: {data.get('due')}")
                self.test("Over-payment: status is 'Paid'", data.get('status') == 'Paid',
                         f"Status: {data.get('status')}")
                self.test("Over-payment: paid increased by only remaining due (not 99999999)", 
                         data.get('paid') == overpay_initial_paid + overpay_initial_due,
                         f"Expected: {overpay_initial_paid + overpay_initial_due}, Got: {data.get('paid')}")
                self.test("Over-payment: paid equals total", data.get('paid') == overpay_initial_total,
                         f"Paid: {data.get('paid')}, Total: {overpay_initial_total}")
            else:
                self.log("   Could not find/create fee for overpay test", Colors.YELLOW)
                
        except Exception as e:
            self.test("Over-payment guard", False, f"Exception: {str(e)}")
        
        # Scenario 5: No amount = full pay (back-compat)
        self.log("\n  Scenario 5: No amount field = full pay", Colors.BLUE)
        try:
            # Find or create another fee with due>0
            resp = requests.get(f"{BASE_URL}/fees", headers=headers, timeout=10)
            fees = resp.json()
            
            fullpay_fee = None
            for f in fees:
                if f.get('due', 0) > 0:
                    fullpay_fee = f
                    break
            
            if not fullpay_fee:
                # Create another student
                student_payload = {
                    "name": "FullPayTest Student",
                    "class_name": "Grade 8",
                    "section": "Section A"
                }
                resp = requests.post(f"{BASE_URL}/students", json=student_payload, headers=headers, timeout=10)
                
                # Get fees again
                resp = requests.get(f"{BASE_URL}/fees", headers=headers, timeout=10)
                fees = resp.json()
                for f in fees:
                    if f.get('name') == 'FullPayTest Student':
                        fullpay_fee = f
                        break
            
            if fullpay_fee:
                fullpay_fee_id = fullpay_fee['id']
                fullpay_initial_total = fullpay_fee.get('total', 0)
                fullpay_initial_due = fullpay_fee.get('due', 0)
                
                self.log(f"   Full pay test fee: ID={fullpay_fee_id}, Due={fullpay_initial_due}", Colors.BLUE)
                
                # Pay without amount field
                payload = {"method": "Cash"}
                resp = requests.post(f"{BASE_URL}/fees/{fullpay_fee_id}/pay", json=payload, headers=headers, timeout=10)
                data = resp.json()
                
                self.test("Full pay (no amount) returns 200", resp.status_code == 200)
                self.test("Full pay: due is 0", data.get('due') == 0,
                         f"Due: {data.get('due')}")
                self.test("Full pay: status is 'Paid'", data.get('status') == 'Paid',
                         f"Status: {data.get('status')}")
                self.test("Full pay: paid equals total", data.get('paid') == fullpay_initial_total,
                         f"Paid: {data.get('paid')}, Total: {fullpay_initial_total}")
            else:
                self.log("   Could not find/create fee for full pay test", Colors.YELLOW)
                
        except Exception as e:
            self.test("Full pay (no amount)", False, f"Exception: {str(e)}")
        
        # Scenario 6: Student balance sync
        self.log("\n  Scenario 6: Student balance sync", Colors.BLUE)
        try:
            # Get a fee with student_id
            resp = requests.get(f"{BASE_URL}/fees", headers=headers, timeout=10)
            fees = resp.json()
            
            sync_fee = None
            for f in fees:
                if f.get('student_id') and f.get('due', 0) > 0:
                    sync_fee = f
                    break
            
            if not sync_fee:
                # Create a student to test sync
                student_payload = {
                    "name": "SyncTest Student",
                    "class_name": "Grade 7",
                    "section": "Section A"
                }
                resp = requests.post(f"{BASE_URL}/students", json=student_payload, headers=headers, timeout=10)
                sync_student = resp.json()
                sync_student_id = sync_student.get('id')
                
                # Get the auto-created fee
                resp = requests.get(f"{BASE_URL}/fees", headers=headers, timeout=10)
                fees = resp.json()
                for f in fees:
                    if f.get('name') == 'SyncTest Student':
                        sync_fee = f
                        break
            
            if sync_fee and sync_fee.get('student_id'):
                sync_fee_id = sync_fee['id']
                sync_student_id = sync_fee['student_id']
                sync_initial_due = sync_fee.get('due', 0)
                
                # Make a partial payment
                partial_amt = min(10000, sync_initial_due - 1000) if sync_initial_due > 1000 else sync_initial_due // 2
                payload = {"amount": partial_amt, "method": "Cash"}
                resp = requests.post(f"{BASE_URL}/fees/{sync_fee_id}/pay", json=payload, headers=headers, timeout=10)
                fee_data = resp.json()
                
                remaining_due = fee_data.get('due', 0)
                
                # Get student and check balance
                resp = requests.get(f"{BASE_URL}/students/{sync_student_id}", headers=headers, timeout=10)
                student_data = resp.json()
                
                self.test("Student balance sync: GET student returns 200", resp.status_code == 200)
                self.test("Student balance equals fee remaining due", student_data.get('balance') == remaining_due,
                         f"Student balance: {student_data.get('balance')}, Fee due: {remaining_due}")
            else:
                self.log("   Could not find/create fee with student_id for sync test", Colors.YELLOW)
                
        except Exception as e:
            self.test("Student balance sync", False, f"Exception: {str(e)}")
        
        # Scenario 7: Summary + notifications reflect payments
        self.log("\n  Scenario 7: Summary and notifications", Colors.BLUE)
        try:
            # Get fees summary
            resp = requests.get(f"{BASE_URL}/fees/summary", headers=headers, timeout=10)
            summary = resp.json()
            
            self.test("Fees summary returns 200", resp.status_code == 200)
            self.test("Fees summary has 'collected' field", 'collected' in summary,
                     f"Collected: {summary.get('collected')}")
            self.test("Fees summary has 'pending' field", 'pending' in summary,
                     f"Pending: {summary.get('pending')}")
            
            # Get notifications
            resp = requests.get(f"{BASE_URL}/notifications", headers=headers, timeout=10)
            notifications = resp.json()
            
            self.test("Notifications returns 200", resp.status_code == 200)
            self.test("Notifications is an array", isinstance(notifications, list))
            
            # Check for 'Fee collected' notification
            fee_collected_found = False
            for notif in notifications:
                if 'Fee collected' in notif.get('title', ''):
                    fee_collected_found = True
                    self.log(f"   Found notification: {notif.get('title')} - {notif.get('body')}", Colors.BLUE)
                    break
            
            self.test("Notifications include 'Fee collected' event", fee_collected_found)
            
        except Exception as e:
            self.test("Summary and notifications", False, f"Exception: {str(e)}")
        
        # Scenario 8: Student detail exposes fee_id and due
        self.log("\n  Scenario 8: Student detail exposes fee_id and due", Colors.BLUE)
        try:
            # Get a student with a fee
            resp = requests.get(f"{BASE_URL}/fees", headers=headers, timeout=10)
            fees = resp.json()
            
            detail_fee = None
            for f in fees:
                if f.get('student_id'):
                    detail_fee = f
                    break
            
            if detail_fee:
                detail_student_id = detail_fee['student_id']
                detail_fee_id = detail_fee['id']
                detail_fee_due = detail_fee.get('due', 0)
                
                # Get student detail
                resp = requests.get(f"{BASE_URL}/students/{detail_student_id}/detail", headers=headers, timeout=10)
                detail_data = resp.json()
                
                self.test("Student detail returns 200", resp.status_code == 200)
                self.test("Student detail has 'fees' object", 'fees' in detail_data)
                
                if 'fees' in detail_data:
                    fees_obj = detail_data['fees']
                    self.test("Student detail fees has 'fee_id' field", 'fee_id' in fees_obj,
                             f"fee_id: {fees_obj.get('fee_id')}")
                    self.test("Student detail fees 'fee_id' is not null", fees_obj.get('fee_id') is not None,
                             f"fee_id: {fees_obj.get('fee_id')}")
                    self.test("Student detail fees has 'due' field (number)", 'due' in fees_obj,
                             f"due: {fees_obj.get('due')}")
                    self.test("Student detail fees 'due' is a number", isinstance(fees_obj.get('due'), (int, float)),
                             f"due type: {type(fees_obj.get('due'))}, value: {fees_obj.get('due')}")
            else:
                self.log("   Could not find fee with student_id for detail test", Colors.YELLOW)
                
        except Exception as e:
            self.test("Student detail fee_id and due", False, f"Exception: {str(e)}")

    def run_all(self):
        """Run all tests in sequence"""
        self.log("\n" + "="*60, Colors.BLUE)
        self.log("ORISON SCHOOL MANAGEMENT - BACKEND API TESTS", Colors.BLUE)
        self.log("="*60, Colors.BLUE)
        self.log(f"Base URL: {BASE_URL}\n", Colors.BLUE)
        
        # Auth tests
        self.test_auth_login_admin()
        self.test_auth_login_principal()
        self.test_auth_login_fee_manager()
        self.test_auth_login_invalid_role()
        self.test_auth_me_with_token()
        self.test_auth_me_without_token()
        self.test_auth_me_invalid_token()
        
        # Students tests
        self.test_students_list()
        self.test_students_create()
        self.test_students_get_by_id()
        self.test_students_get_bogus_id()
        self.test_students_update()
        self.test_students_delete()
        
        # Fees tests
        self.test_fees_list()
        self.test_fees_summary_before_payment()
        self.test_fees_pay()
        self.test_fees_summary_after_payment()
        
        # Partial payments regression test
        self.test_partial_payments_regression()
        
        # Exams tests
        self.test_exams_list()
        self.test_exams_create()
        self.test_exams_list_includes_new()
        
        # Leaves tests
        self.test_leaves_list()
        self.test_leaves_summary()
        self.test_leaves_create()
        self.test_leaves_update_status()
        
        # Teachers tests
        self.test_teachers_list()
        
        # Search tests
        self.test_search_marcus()
        self.test_search_vikram()
        self.test_search_grade()
        self.test_search_empty()
        
        # Analytics tests
        self.test_analytics_dashboard()
        self.test_analytics_ai()
        
        # Summary
        return self.summary()

if __name__ == "__main__":
    runner = TestRunner()
    success = runner.run_all()
    sys.exit(0 if success else 1)
