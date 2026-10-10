#!/usr/bin/env python3
"""Quick verification of student balance sync"""

import requests
import json

BASE_URL = "https://recursing-napier-4.preview.emergentagent.com/api"

# Login
resp = requests.post(f"{BASE_URL}/auth/login", json={"role": "admin"}, timeout=10)
token = resp.json()['token']
headers = {"Authorization": f"Bearer {token}"}

print("=" * 60)
print("STUDENT BALANCE SYNC VERIFICATION")
print("=" * 60)

# Create a new student (auto-creates fee)
print("\n1. Creating new student 'BalanceSync Test'...")
student_payload = {
    "name": "BalanceSync Test",
    "class_name": "Grade 11",
    "section": "Section A"
}
resp = requests.post(f"{BASE_URL}/students", json=student_payload, headers=headers, timeout=10)
student = resp.json()
student_id = student['id']
print(f"   Created student: {student_id}")

# Get the auto-created fee
print("\n2. Finding auto-created fee...")
resp = requests.get(f"{BASE_URL}/fees", headers=headers, timeout=10)
fees = resp.json()
fee = None
for f in fees:
    if f.get('name') == 'BalanceSync Test':
        fee = f
        break

if not fee:
    print("   ERROR: Could not find auto-created fee")
    exit(1)

fee_id = fee['id']
initial_due = fee['due']
print(f"   Fee ID: {fee_id}, Initial due: {initial_due}")

# Get student before payment
print("\n3. Getting student before payment...")
resp = requests.get(f"{BASE_URL}/students/{student_id}", headers=headers, timeout=10)
if resp.status_code != 200:
    print(f"   ERROR: GET student returned {resp.status_code}")
    exit(1)
student_before = resp.json()
balance_before = student_before.get('balance', 0)
print(f"   Student balance before payment: {balance_before}")

# Make a partial payment
partial_amount = 10000
print(f"\n4. Making partial payment of {partial_amount}...")
payload = {"amount": partial_amount, "method": "Cash"}
resp = requests.post(f"{BASE_URL}/fees/{fee_id}/pay", json=payload, headers=headers, timeout=10)
if resp.status_code != 200:
    print(f"   ERROR: Payment returned {resp.status_code}")
    exit(1)
fee_after = resp.json()
remaining_due = fee_after['due']
print(f"   Payment successful. Remaining due: {remaining_due}")

# Get student after payment
print("\n5. Getting student after payment...")
resp = requests.get(f"{BASE_URL}/students/{student_id}", headers=headers, timeout=10)
if resp.status_code != 200:
    print(f"   ERROR: GET student returned {resp.status_code}")
    exit(1)
student_after = resp.json()
balance_after = student_after.get('balance', 0)
print(f"   Student balance after payment: {balance_after}")

# Verify sync
print("\n6. Verification:")
if balance_after == remaining_due:
    print(f"   ✅ PASS: Student balance ({balance_after}) equals fee remaining due ({remaining_due})")
else:
    print(f"   ❌ FAIL: Student balance ({balance_after}) does NOT equal fee remaining due ({remaining_due})")

print("\n" + "=" * 60)
