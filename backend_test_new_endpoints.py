#!/usr/bin/env python3
"""
Test NEW Orison backend endpoints as per review request
Tests: Student Detail, Marks->Results pipeline, AI Analytics, Notifications, Bulk Upload, Role Dashboards
"""

import requests
import json
import sys
import io
from typing import Dict, Any

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
        self.failures = []
        
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
            self.failures.append(f"{name}: {details}")
            self.log(f"❌ FAIL: {name}", Colors.RED)
            if details:
                self.log(f"   {details}", Colors.YELLOW)
    
    def summary(self):
        total = self.passed + self.failed
        self.log(f"\n{'='*70}", Colors.BLUE)
        self.log(f"TEST SUMMARY - NEW ENDPOINTS", Colors.BLUE)
        self.log(f"{'='*70}", Colors.BLUE)
        self.log(f"Total: {total} | Passed: {self.passed} | Failed: {self.failed}")
        if self.failed == 0:
            self.log(f"🎉 ALL NEW ENDPOINT TESTS PASSED!", Colors.GREEN)
        else:
            self.log(f"⚠️  {self.failed} TEST(S) FAILED", Colors.RED)
            self.log(f"\nFailed Tests:", Colors.RED)
            for failure in self.failures:
                self.log(f"  - {failure}", Colors.YELLOW)
        self.log(f"{'='*70}\n", Colors.BLUE)
        return self.failed == 0

    # ============ SETUP - GET ADMIN TOKEN ============
    
    def setup_auth(self):
        """Get admin token for testing"""
        self.log("\n[SETUP] Getting admin token...", Colors.BLUE)
        try:
            resp = requests.post(f"{BASE_URL}/auth/login", json={"role": "admin"}, timeout=10)
            data = resp.json()
            if resp.status_code == 200 and "token" in data:
                self.admin_token = data["token"]
                self.log("✅ Admin token obtained", Colors.GREEN)
                return True
            else:
                self.log("❌ Failed to get admin token", Colors.RED)
                return False
        except Exception as e:
            self.log(f"❌ Exception getting admin token: {str(e)}", Colors.RED)
            return False
    
    def setup_principal_token(self):
        """Get principal token for role menu testing"""
        try:
            resp = requests.post(f"{BASE_URL}/auth/login", json={"role": "principal"}, timeout=10)
            data = resp.json()
            if resp.status_code == 200 and "token" in data:
                self.principal_token = data["token"]
                return data.get("menu", [])
            return None
        except Exception:
            return None
    
    def setup_fee_manager_token(self):
        """Get fee_manager token for role menu testing"""
        try:
            resp = requests.post(f"{BASE_URL}/auth/login", json={"role": "fee_manager"}, timeout=10)
            data = resp.json()
            if resp.status_code == 200 and "token" in data:
                self.fee_manager_token = data["token"]
                return data.get("menu", [])
            return None
        except Exception:
            return None

    # ============ TEST 1: STUDENT DETAIL ============
    
    def test_student_detail_ep_2024_0812(self):
        """Test 1a: GET /api/students/EP-2024-0812/detail - returns complete student detail"""
        self.log("\n[TEST 1a] Student Detail - EP-2024-0812", Colors.BLUE)
        if not self.admin_token:
            self.test("Student detail EP-2024-0812", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/students/EP-2024-0812/detail", headers=headers, timeout=10)
            
            self.test("Student detail returns 200", resp.status_code == 200, f"Status: {resp.status_code}")
            
            if resp.status_code != 200:
                return
            
            data = resp.json()
            
            # Check top-level keys
            required_keys = ['student', 'fees', 'marks', 'gpa', 'standing', 'attendance']
            for key in required_keys:
                self.test(f"Student detail has '{key}' key", key in data, f"Missing: {key}")
            
            # Check student object
            if 'student' in data:
                student = data['student']
                student_keys = ['name', 'id', 'className', 'roll', 'balance', 'status', 'avatar', 'raw']
                for key in student_keys:
                    self.test(f"Student object has '{key}'", key in student, f"Missing: {key}")
            
            # Check fees object
            if 'fees' in data:
                fees = data['fees']
                self.test("Fees has 'pending' array", 'pending' in fees and isinstance(fees['pending'], list))
                self.test("Fees has 'total'", 'total' in fees)
            
            # Check marks array
            if 'marks' in data:
                marks = data['marks']
                self.test("Marks is array", isinstance(marks, list))
                if len(marks) > 0:
                    mark = marks[0]
                    mark_keys = ['subject', 'internal', 'external', 'total', 'grade']
                    for key in mark_keys:
                        self.test(f"Mark object has '{key}'", key in mark, f"Missing: {key}")
            
            # Check gpa object
            if 'gpa' in data:
                gpa = data['gpa']
                gpa_keys = ['cgpa', 'grade', 'credits', 'standing']
                for key in gpa_keys:
                    self.test(f"GPA has '{key}'", key in gpa, f"Missing: {key}")
            
            # Check standing object
            if 'standing' in data:
                standing = data['standing']
                self.test("Standing has 'rank'", 'rank' in standing)
                self.test("Standing has 'percentile'", 'percentile' in standing)
            
            # Check attendance object
            if 'attendance' in data:
                att = data['attendance']
                att_keys = ['month', 'days', 'stats', 'logs']
                for key in att_keys:
                    self.test(f"Attendance has '{key}'", key in att, f"Missing: {key}")
                
                if 'days' in att:
                    self.test("Attendance days is array", isinstance(att['days'], list))
                if 'logs' in att:
                    self.test("Attendance logs is array", isinstance(att['logs'], list))
            
        except Exception as e:
            self.test("Student detail EP-2024-0812 request", False, f"Exception: {str(e)}")
    
    def test_student_detail_bogus_id(self):
        """Test 1b: GET /api/students/BOGUS-999/detail - should return 404"""
        self.log("\n[TEST 1b] Student Detail - Bogus ID", Colors.BLUE)
        if not self.admin_token:
            self.test("Student detail bogus ID", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/students/BOGUS-999/detail", headers=headers, timeout=10)
            
            self.test("Student detail bogus ID returns 404", resp.status_code == 404, 
                     f"Status: {resp.status_code}")
        except Exception as e:
            self.test("Student detail bogus ID request", False, f"Exception: {str(e)}")
    
    def test_student_detail_ep_2024_0455(self):
        """Test 1c: GET /api/students/EP-2024-0455/detail - different student (deterministic)"""
        self.log("\n[TEST 1c] Student Detail - EP-2024-0455 (deterministic)", Colors.BLUE)
        if not self.admin_token:
            self.test("Student detail EP-2024-0455", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/students/EP-2024-0455/detail", headers=headers, timeout=10)
            
            self.test("Student detail EP-2024-0455 returns 200", resp.status_code == 200, 
                     f"Status: {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                self.test("EP-2024-0455 has different attendance/marks", 
                         'attendance' in data and 'marks' in data,
                         "Deterministic data based on student ID")
        except Exception as e:
            self.test("Student detail EP-2024-0455 request", False, f"Exception: {str(e)}")

    # ============ TEST 2: MARKS -> RESULTS PIPELINE ============
    
    def test_results_initial(self):
        """Test 2a: GET /api/results - should return seeded marks set"""
        self.log("\n[TEST 2a] Results - Initial (seeded)", Colors.BLUE)
        if not self.admin_token:
            self.test("Results initial", False, "No admin token")
            return None
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/results", headers=headers, timeout=10)
            
            self.test("Results returns 200", resp.status_code == 200, f"Status: {resp.status_code}")
            
            if resp.status_code != 200:
                return None
            
            data = resp.json()
            
            # Check structure
            result_keys = ['exam_title', 'rows', 'class_average', 'highest', 'pass_rate', 'students']
            for key in result_keys:
                self.test(f"Results has '{key}'", key in data, f"Missing: {key}")
            
            # Check rows have rank and are sorted
            if 'rows' in data and len(data['rows']) > 0:
                rows = data['rows']
                self.test("Results rows is array", isinstance(rows, list))
                
                # Check first row has required fields
                if len(rows) > 0:
                    row = rows[0]
                    row_keys = ['rank', 'roll', 'name', 'total']
                    for key in row_keys:
                        self.test(f"Result row has '{key}'", key in row, f"Missing: {key}")
                    
                    # Check rows are sorted by total desc
                    if len(rows) > 1:
                        sorted_check = all(rows[i]['total'] >= rows[i+1]['total'] for i in range(len(rows)-1))
                        self.test("Results rows sorted by total desc", sorted_check)
                    
                    # Check rank field exists
                    self.test("Results rows have rank field", 'rank' in rows[0])
            
            return data
        except Exception as e:
            self.test("Results initial request", False, f"Exception: {str(e)}")
            return None
    
    def test_marks_post(self):
        """Test 2b: POST /api/marks - save new marks set"""
        self.log("\n[TEST 2b] Marks - POST new marks set", Colors.BLUE)
        if not self.admin_token:
            self.test("Marks POST", False, "No admin token")
            return None
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            payload = {
                "exam_title": "API Term",
                "class_name": "Grade 9",
                "section": "Section B",
                "subject": "Physics",
                "max_written": 70,
                "max_practical": 30,
                "rows": [
                    {"roll": "#1", "name": "Zed One", "written": 60, "practical": 25},
                    {"roll": "#2", "name": "Yara Two", "written": 40, "practical": 20}
                ]
            }
            resp = requests.post(f"{BASE_URL}/marks", json=payload, headers=headers, timeout=10)
            
            self.test("Marks POST returns 200", resp.status_code == 200, f"Status: {resp.status_code}")
            
            if resp.status_code != 200:
                return None
            
            data = resp.json()
            
            # Check returned data
            self.test("Marks POST returns exam_title", data.get('exam_title') == "API Term")
            self.test("Marks POST returns subject", data.get('subject') == "Physics")
            self.test("Marks POST returns rows", 'rows' in data and isinstance(data['rows'], list))
            
            # Check totals are computed
            if 'rows' in data and len(data['rows']) >= 2:
                row1 = data['rows'][0]
                row2 = data['rows'][1]
                self.test("Marks POST row1 total computed", row1.get('total') == 85, 
                         f"Expected 85, got {row1.get('total')}")
                self.test("Marks POST row2 total computed", row2.get('total') == 60, 
                         f"Expected 60, got {row2.get('total')}")
            
            return data
        except Exception as e:
            self.test("Marks POST request", False, f"Exception: {str(e)}")
            return None
    
    def test_results_after_marks_post(self):
        """Test 2c: GET /api/results - should return latest posted marks"""
        self.log("\n[TEST 2c] Results - After Marks POST (latest)", Colors.BLUE)
        if not self.admin_token:
            self.test("Results after marks POST", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/results", headers=headers, timeout=10)
            
            self.test("Results after POST returns 200", resp.status_code == 200, f"Status: {resp.status_code}")
            
            if resp.status_code != 200:
                return
            
            data = resp.json()
            
            # Check it's the latest set (API Term)
            self.test("Results shows latest exam_title", data.get('exam_title') == "API Term",
                     f"Expected 'API Term', got '{data.get('exam_title')}'")
            
            # Check Zed One is rank 1
            if 'rows' in data and len(data['rows']) > 0:
                rows = data['rows']
                zed = next((r for r in rows if 'Zed One' in r.get('name', '')), None)
                self.test("Results has Zed One", zed is not None)
                if zed:
                    self.test("Zed One is rank 1", zed.get('rank') == 1, 
                             f"Expected rank 1, got {zed.get('rank')}")
                    self.test("Zed One total is 85", zed.get('total') == 85,
                             f"Expected 85, got {zed.get('total')}")
        except Exception as e:
            self.test("Results after marks POST request", False, f"Exception: {str(e)}")

    # ============ TEST 3: AI ANALYTICS REFLECTS MARKS ============
    
    def test_ai_analytics_reflects_marks(self):
        """Test 3: GET /api/analytics/ai - subject_scores should include Physics"""
        self.log("\n[TEST 3] AI Analytics - Reflects Posted Marks", Colors.BLUE)
        if not self.admin_token:
            self.test("AI analytics reflects marks", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/analytics/ai", headers=headers, timeout=10)
            
            self.test("AI analytics returns 200", resp.status_code == 200, f"Status: {resp.status_code}")
            
            if resp.status_code != 200:
                return
            
            data = resp.json()
            
            # Check subject_scores exists
            self.test("AI analytics has subject_scores", 'subject_scores' in data and isinstance(data['subject_scores'], list))
            
            if 'subject_scores' in data:
                subject_scores = data['subject_scores']
                self.test("AI analytics subject_scores non-empty", len(subject_scores) > 0,
                         f"Found {len(subject_scores)} subjects")
                
                # Check each subject has required fields
                if len(subject_scores) > 0:
                    subj = subject_scores[0]
                    self.test("Subject score has 'subject' field", 'subject' in subj)
                    self.test("Subject score has 'score' field", 'score' in subj)
                
                # Check if Physics is included (from our posted marks)
                physics = next((s for s in subject_scores if 'Physics' in s.get('subject', '')), None)
                self.test("AI analytics includes Physics subject", physics is not None,
                         f"Subjects: {[s.get('subject') for s in subject_scores]}")
        except Exception as e:
            self.test("AI analytics reflects marks request", False, f"Exception: {str(e)}")

    # ============ TEST 4: NOTIFICATIONS ============
    
    def test_notifications_get(self):
        """Test 4a: GET /api/notifications - should include overdue fee warning"""
        self.log("\n[TEST 4a] Notifications - GET", Colors.BLUE)
        if not self.admin_token:
            self.test("Notifications GET", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/notifications", headers=headers, timeout=10)
            
            self.test("Notifications returns 200", resp.status_code == 200, f"Status: {resp.status_code}")
            
            if resp.status_code != 200:
                return
            
            data = resp.json()
            
            self.test("Notifications returns array", isinstance(data, list))
            
            if isinstance(data, list) and len(data) > 0:
                # Check first item structure
                notif = data[0]
                notif_keys = ['title', 'body', 'time', 'type', 'unread']
                for key in notif_keys:
                    self.test(f"Notification has '{key}'", key in notif, f"Missing: {key}")
                
                # Check for overdue fee warning (should be first due to insert(0))
                overdue = next((n for n in data if 'Fee payment overdue' in n.get('title', '')), None)
                self.test("Notifications includes 'Fee payment overdue'", overdue is not None,
                         f"First notification: {data[0].get('title') if len(data) > 0 else 'None'}")
        except Exception as e:
            self.test("Notifications GET request", False, f"Exception: {str(e)}")
    
    def test_notifications_after_student_create(self):
        """Test 4b: POST /api/students then GET /api/notifications - should include admission event"""
        self.log("\n[TEST 4b] Notifications - After Student Create", Colors.BLUE)
        if not self.admin_token:
            self.test("Notifications after student create", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Create a new student
            student_payload = {
                "name": "Notify Kid",
                "class_name": "Grade 8",
                "section": "Section A",
                "status": "Active"
            }
            resp_create = requests.post(f"{BASE_URL}/students", json=student_payload, headers=headers, timeout=10)
            self.test("Student create for notification returns 200", resp_create.status_code == 200)
            
            # Get notifications
            resp_notif = requests.get(f"{BASE_URL}/notifications", headers=headers, timeout=10)
            self.test("Notifications after create returns 200", resp_notif.status_code == 200)
            
            if resp_notif.status_code == 200:
                data = resp_notif.json()
                
                # Check for admission event mentioning Notify Kid
                admission = next((n for n in data if 'New admission approved' in n.get('title', '') 
                                 and 'Notify Kid' in n.get('body', '')), None)
                self.test("Notifications includes 'New admission approved' for Notify Kid", 
                         admission is not None,
                         f"Found: {admission.get('body') if admission else 'Not found'}")
        except Exception as e:
            self.test("Notifications after student create request", False, f"Exception: {str(e)}")
    
    def test_notifications_read_all(self):
        """Test 4c: POST /api/notifications/read-all"""
        self.log("\n[TEST 4c] Notifications - Read All", Colors.BLUE)
        if not self.admin_token:
            self.test("Notifications read all", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.post(f"{BASE_URL}/notifications/read-all", headers=headers, timeout=10)
            
            self.test("Notifications read-all returns 200", resp.status_code == 200, 
                     f"Status: {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                self.test("Notifications read-all returns ok", data.get('ok') == True)
        except Exception as e:
            self.test("Notifications read-all request", False, f"Exception: {str(e)}")

    # ============ TEST 5: BULK UPLOAD + TEMPLATE ============
    
    def test_students_template(self):
        """Test 5a: GET /api/students-template - returns CSV with header and sample"""
        self.log("\n[TEST 5a] Students Template - GET", Colors.BLUE)
        if not self.admin_token:
            self.test("Students template", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/students-template", headers=headers, timeout=10)
            
            self.test("Students template returns 200", resp.status_code == 200, 
                     f"Status: {resp.status_code}")
            
            if resp.status_code == 200:
                content = resp.text
                self.test("Students template returns CSV text", len(content) > 0)
                
                # Check for header row
                self.test("Students template has 'student_name' header", 'student_name' in content)
                
                # Check for sample row (K.Tapasvi)
                self.test("Students template has sample row (K.Tapasvi)", 'K.Tapasvi' in content)
        except Exception as e:
            self.test("Students template request", False, f"Exception: {str(e)}")
    
    def test_students_bulk_upload(self):
        """Test 5b: POST /api/students/bulk - upload CSV with 1 valid and 1 invalid row"""
        self.log("\n[TEST 5b] Students Bulk Upload - POST", Colors.BLUE)
        if not self.admin_token:
            self.test("Students bulk upload", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Create CSV with 1 valid and 1 invalid row
            csv_content = """student_name,Student_Class,Student_Section,Admission Number,birthday,sex,aadhar_number,caste,subcaste,phone,parent_id,mother_name,guardian,address,password,Parent Name,Parent Phone,Address
R.Kiran,IX,B,777,01/01/2010,Male,111122223333,Hindu,OC,9998887776,R.Latha,,R.Ravi,Hyderabad,,R.Ravi,9998887776,Hyderabad
Invalid Student,X,A,888,02/02/2011,Female,222233334444,Hindu,OC,8887776665,,,,,,,
"""
            
            files = {'file': ('students.csv', csv_content, 'text/csv')}
            resp = requests.post(f"{BASE_URL}/students/bulk", files=files, headers=headers, timeout=10)
            
            self.test("Bulk upload returns 200", resp.status_code == 200, f"Status: {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                
                self.test("Bulk upload has 'inserted' field", 'inserted' in data)
                self.test("Bulk upload has 'errors' field", 'errors' in data)
                
                # Check 1 inserted, 1 error
                self.test("Bulk upload inserted 1 student", data.get('inserted') == 1,
                         f"Expected 1, got {data.get('inserted')}")
                self.test("Bulk upload has 1 error", len(data.get('errors', [])) == 1,
                         f"Expected 1 error, got {len(data.get('errors', []))}")
                
                # Check error structure
                if len(data.get('errors', [])) > 0:
                    error = data['errors'][0]
                    self.test("Bulk upload error has 'row' field", 'row' in error)
                    self.test("Bulk upload error has 'error' field", 'error' in error)
        except Exception as e:
            self.test("Students bulk upload request", False, f"Exception: {str(e)}")
    
    def test_students_list_includes_bulk(self):
        """Test 5c: GET /api/students - should include R.Kiran"""
        self.log("\n[TEST 5c] Students List - Includes Bulk Upload", Colors.BLUE)
        if not self.admin_token:
            self.test("Students list includes bulk", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/students", headers=headers, timeout=10)
            
            self.test("Students list returns 200", resp.status_code == 200)
            
            if resp.status_code == 200:
                data = resp.json()
                
                # Check for R.Kiran
                kiran = next((s for s in data if 'R.Kiran' in s.get('name', '')), None)
                self.test("Students list includes R.Kiran", kiran is not None,
                         f"Found: {kiran.get('name') if kiran else 'Not found'}")
        except Exception as e:
            self.test("Students list includes bulk request", False, f"Exception: {str(e)}")
    
    def test_fees_list_includes_bulk(self):
        """Test 5d: GET /api/fees - should include fee for R.Kiran (auto-created)"""
        self.log("\n[TEST 5d] Fees List - Includes Bulk Upload Student", Colors.BLUE)
        if not self.admin_token:
            self.test("Fees list includes bulk", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/fees", headers=headers, timeout=10)
            
            self.test("Fees list returns 200", resp.status_code == 200)
            
            if resp.status_code == 200:
                data = resp.json()
                
                # Check for R.Kiran fee
                kiran_fee = next((f for f in data if 'R.Kiran' in f.get('name', '')), None)
                self.test("Fees list includes R.Kiran fee (auto-created)", kiran_fee is not None,
                         f"Found: {kiran_fee.get('name') if kiran_fee else 'Not found'}")
        except Exception as e:
            self.test("Fees list includes bulk request", False, f"Exception: {str(e)}")

    # ============ TEST 6: ROLE DASHBOARDS ============
    
    def test_analytics_fee_dashboard(self):
        """Test 6a: GET /api/analytics/fee - fee manager dashboard"""
        self.log("\n[TEST 6a] Analytics Fee Dashboard", Colors.BLUE)
        if not self.admin_token:
            self.test("Analytics fee dashboard", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/analytics/fee", headers=headers, timeout=10)
            
            self.test("Analytics fee returns 200", resp.status_code == 200, f"Status: {resp.status_code}")
            
            if resp.status_code != 200:
                return
            
            data = resp.json()
            
            # Check structure
            self.test("Analytics fee has 'stats'", 'stats' in data and isinstance(data['stats'], dict))
            self.test("Analytics fee has 'method_split'", 'method_split' in data and isinstance(data['method_split'], list))
            self.test("Analytics fee has 'monthly'", 'monthly' in data and isinstance(data['monthly'], list))
            self.test("Analytics fee has 'top_dues'", 'top_dues' in data and isinstance(data['top_dues'], list))
            
            # Check stats fields
            if 'stats' in data:
                stats = data['stats']
                stats_keys = ['collected', 'pending', 'total', 'invoices']
                for key in stats_keys:
                    self.test(f"Analytics fee stats has '{key}'", key in stats, f"Missing: {key}")
        except Exception as e:
            self.test("Analytics fee dashboard request", False, f"Exception: {str(e)}")
    
    def test_analytics_academic_dashboard(self):
        """Test 6b: GET /api/analytics/academic - principal dashboard"""
        self.log("\n[TEST 6b] Analytics Academic Dashboard", Colors.BLUE)
        if not self.admin_token:
            self.test("Analytics academic dashboard", False, "No admin token")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(f"{BASE_URL}/analytics/academic", headers=headers, timeout=10)
            
            self.test("Analytics academic returns 200", resp.status_code == 200, f"Status: {resp.status_code}")
            
            if resp.status_code != 200:
                return
            
            data = resp.json()
            
            # Check structure
            self.test("Analytics academic has 'stats'", 'stats' in data and isinstance(data['stats'], dict))
            self.test("Analytics academic has 'attendance_trend'", 'attendance_trend' in data and isinstance(data['attendance_trend'], list))
            self.test("Analytics academic has 'subject_scores'", 'subject_scores' in data and isinstance(data['subject_scores'], list))
            self.test("Analytics academic has 'results_top'", 'results_top' in data and isinstance(data['results_top'], list))
            
            # Check stats fields
            if 'stats' in data:
                stats = data['stats']
                stats_keys = ['pass_rate', 'avg', 'attendance', 'students']
                for key in stats_keys:
                    self.test(f"Analytics academic stats has '{key}'", key in stats, f"Missing: {key}")
        except Exception as e:
            self.test("Analytics academic dashboard request", False, f"Exception: {str(e)}")

    # ============ TEST 7: ROLE MENUS ============
    
    def test_role_menu_principal(self):
        """Test 7a: Principal login - menu excludes 'fee', 'hr', 'inventory'"""
        self.log("\n[TEST 7a] Role Menu - Principal", Colors.BLUE)
        
        menu = self.setup_principal_token()
        
        if menu is None:
            self.test("Principal menu", False, "Failed to get principal token/menu")
            return
        
        self.test("Principal menu is array", isinstance(menu, list))
        self.test("Principal menu excludes 'fee'", 'fee' not in menu,
                 f"Menu: {menu}")
        self.test("Principal menu excludes 'hr'", 'hr' not in menu,
                 f"Menu: {menu}")
        self.test("Principal menu excludes 'inventory'", 'inventory' not in menu,
                 f"Menu: {menu}")
    
    def test_role_menu_fee_manager(self):
        """Test 7b: Fee manager login - menu includes 'fee'"""
        self.log("\n[TEST 7b] Role Menu - Fee Manager", Colors.BLUE)
        
        menu = self.setup_fee_manager_token()
        
        if menu is None:
            self.test("Fee manager menu", False, "Failed to get fee_manager token/menu")
            return
        
        self.test("Fee manager menu is array", isinstance(menu, list))
        self.test("Fee manager menu includes 'fee'", 'fee' in menu,
                 f"Menu: {menu}")

    # ============ RUN ALL TESTS ============
    
    def run_all(self):
        """Run all NEW endpoint tests in sequence"""
        self.log("\n" + "="*70, Colors.BLUE)
        self.log("ORISON - NEW BACKEND ENDPOINTS TESTS", Colors.BLUE)
        self.log("="*70, Colors.BLUE)
        self.log(f"Base URL: {BASE_URL}\n", Colors.BLUE)
        
        # Setup
        if not self.setup_auth():
            self.log("❌ Failed to setup auth. Aborting tests.", Colors.RED)
            return False
        
        # Test 1: Student Detail
        self.test_student_detail_ep_2024_0812()
        self.test_student_detail_bogus_id()
        self.test_student_detail_ep_2024_0455()
        
        # Test 2: Marks -> Results Pipeline
        self.test_results_initial()
        self.test_marks_post()
        self.test_results_after_marks_post()
        
        # Test 3: AI Analytics Reflects Marks
        self.test_ai_analytics_reflects_marks()
        
        # Test 4: Notifications
        self.test_notifications_get()
        self.test_notifications_after_student_create()
        self.test_notifications_read_all()
        
        # Test 5: Bulk Upload + Template
        self.test_students_template()
        self.test_students_bulk_upload()
        self.test_students_list_includes_bulk()
        self.test_fees_list_includes_bulk()
        
        # Test 6: Role Dashboards
        self.test_analytics_fee_dashboard()
        self.test_analytics_academic_dashboard()
        
        # Test 7: Role Menus
        self.test_role_menu_principal()
        self.test_role_menu_fee_manager()
        
        # Summary
        return self.summary()

if __name__ == "__main__":
    runner = TestRunner()
    success = runner.run_all()
    sys.exit(0 if success else 1)
