"""One-time reset requested by the school administrator.

Keeps academic_structure, but permanently removes demo and previously entered
student/teacher data plus the records that depend on them.
"""
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).parent
load_dotenv(ROOT / '.env')


async def main():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    collections = [
        'students', 'teachers', 'fees', 'marks_sets', 'academic_signals',
        'interventions', 'teacher_allocations', 'classroom_observations',
    ]
    deleted = {}
    for collection in collections:
        result = await db[collection].delete_many({})
        deleted[collection] = result.deleted_count
    await db.system_state.update_one(
        {'id': 'demo-data-state'},
        {'$set': {'id': 'demo-data-state', 'demo_data_removed': True}},
        upsert=True,
    )
    print('School data reset completed.')
    for collection, count in deleted.items():
        print(f'{collection}: {count} removed')
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
