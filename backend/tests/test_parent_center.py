import os

import requests


BASE_URL = os.environ.get('PARENT_API_BASE_URL', 'http://127.0.0.1:8001/api')


def token_for(role):
    response = requests.post(f'{BASE_URL}/auth/login', json={'role': role}, timeout=10)
    response.raise_for_status()
    return response.json()['token']


def headers_for(role):
    return {'Authorization': f'Bearer {token_for(role)}'}


def test_admin_can_load_parent_center_workflows():
    headers = headers_for('admin')
    for path in (
        'summary', 'payment-proofs', 'help-requests', 'notices',
        'hall-tickets', 'homework-completions', 'transport/routes',
        'transport/trips',
    ):
        response = requests.get(
            f'{BASE_URL}/parent-center/{path}', headers=headers, timeout=10,
        )
        assert response.status_code == 200, (path, response.text)


def test_parent_center_enforces_staff_responsibility():
    finance_headers = headers_for('fee_manager')
    academic_headers = headers_for('academic_coordinator')

    assert requests.get(
        f'{BASE_URL}/parent-center/payment-proofs',
        headers=finance_headers,
        timeout=10,
    ).status_code == 200
    assert requests.get(
        f'{BASE_URL}/parent-center/notices',
        headers=finance_headers,
        timeout=10,
    ).status_code == 403
    assert requests.get(
        f'{BASE_URL}/parent-center/notices',
        headers=academic_headers,
        timeout=10,
    ).status_code == 200
    assert requests.get(
        f'{BASE_URL}/parent-center/payment-proofs',
        headers=academic_headers,
        timeout=10,
    ).status_code == 403


def test_parent_otp_only_accepts_registered_family_mobile():
    registered = requests.post(
        f'{BASE_URL}/parent/auth/request-otp',
        json={'mobile': '9876543210'},
        timeout=10,
    )
    unknown = requests.post(
        f'{BASE_URL}/parent/auth/request-otp',
        json={'mobile': '9000000000'},
        timeout=10,
    )
    assert registered.status_code == 200
    assert unknown.status_code == 404


def test_verified_parent_can_only_load_owned_student_services():
    requested = requests.post(
        f'{BASE_URL}/parent/auth/request-otp',
        json={'mobile': '9876543210'},
        timeout=10,
    )
    requested.raise_for_status()
    otp = requested.json().get('debug_otp')
    if not otp:
        return
    verified = requests.post(
        f'{BASE_URL}/parent/auth/verify-otp',
        json={'mobile': '9876543210', 'otp': otp},
        timeout=10,
    )
    verified.raise_for_status()
    token = verified.json()['token']
    student_id = verified.json()['students'][0]['id']
    headers = {'Authorization': f'Bearer {token}'}
    paths = (
        f'parent/students/{student_id}/dashboard',
        f'parent/students/{student_id}/attendance?month=2026-08',
        f'parent/students/{student_id}/results',
        f'parent/students/{student_id}/homework',
        f'parent/students/{student_id}/timetable?date=2026-08-19',
        f'parent/students/{student_id}/fees',
        f'parent/students/{student_id}/hall-tickets',
        f'parent/students/{student_id}/transport',
        f'parent/students/{student_id}/notices',
    )
    for path in paths:
        response = requests.get(f'{BASE_URL}/{path}', headers=headers, timeout=10)
        assert response.status_code == 200, (path, response.text)
    forbidden = requests.get(
        f'{BASE_URL}/parent/students/NOT-OWNED/dashboard',
        headers=headers,
        timeout=10,
    )
    assert forbidden.status_code == 403
