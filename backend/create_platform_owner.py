"""Create (or recover) an Orison platform Owner login.

Run from the backend folder, on the server, by a person:

    python create_platform_owner.py

It asks for the email, name and password at the prompt (the password is not shown and is never
written to a file or printed). If the email already exists you can reset its password and its
two-step verification (use this if the Owner loses their phone).
"""
import asyncio
import getpass
import sys
import uuid

from platform_admin import (HTTPException, _iso, check_password_strength, hash_password, pdb,
                            platform_startup, valid_email)


async def main():
    await platform_startup()
    try:
        email = valid_email(input('Owner email: '))
    except HTTPException as exc:
        sys.exit(exc.detail)
    existing = await pdb.platform_users.find_one({'email': email})
    if existing:
        print(f'{email} already exists ({existing.get("role")}).')
        if input('Reset its password and two-step verification? [y/N] ').strip().lower() != 'y':
            return
    else:
        name = input('Full name: ').strip()
        if not name:
            sys.exit('Name is required.')
    password = getpass.getpass('Password (12+ characters, letters and numbers): ')
    if password != getpass.getpass('Repeat password: '):
        sys.exit('The passwords do not match.')
    try:
        check_password_strength(password)
    except HTTPException as exc:
        sys.exit(exc.detail)
    salt, digest = hash_password(password)
    if existing:
        await pdb.platform_users.update_one(
            {'email': email},
            {'$set': {'salt': salt, 'hash': digest, 'active': True, 'role': 'owner', 'totp_enabled': False,
                      'failed_count': 0, 'locked_until': ''},
             '$unset': {'totp_secret': '', 'totp_pending': ''}})
        print('Password and two-step verification were reset. Sign in and set up 2FA again.')
    else:
        await pdb.platform_users.insert_one({
            'id': f'PU-{uuid.uuid4().hex[:8].upper()}', 'email': email, 'name': name, 'role': 'owner', 'active': True,
            'salt': salt, 'hash': digest, 'totp_enabled': False, 'created': _iso(), 'last_login': ''})
        print('Owner created. Sign in at /platform/login and set up two-step verification.')


if __name__ == '__main__':
    asyncio.run(main())
