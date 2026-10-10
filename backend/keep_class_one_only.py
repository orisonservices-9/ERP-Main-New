"""Keep only Class 1 data, as requested by the school administrator."""
import asyncio
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).parent
load_dotenv(ROOT / '.env')


def is_class_one(value):
    normalized = re.sub(r'[^a-z0-9]', '', str(value or '').lower())
    return normalized in {'class1', 'grade1', '1stclass', 'classone', 'gradeone', 'i'}


async def main():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    students = await db.students.find().to_list(5000)
    structure = await db.academic_structure.find_one({'id': 'school-structure'})
    class_one_students = [item for item in students if is_class_one(item.get('class_name'))]
    class_one_classes = [item for item in (structure or {}).get('classes', []) if is_class_one(item.get('name'))]
    if not class_one_students and not class_one_classes:
        raise RuntimeError('Safety stop: no Class 1 students or Class 1 academic setup was found.')

    keep_ids = [item['id'] for item in class_one_students]
    removed_student_ids = [item['id'] for item in students if item['id'] not in keep_ids]
    results = {}
    results['students'] = (await db.students.delete_many({'id': {'$in': removed_student_ids}})).deleted_count
    results['fees'] = (await db.fees.delete_many({'student_id': {'$in': removed_student_ids}})).deleted_count
    results['academic_signals'] = (await db.academic_signals.delete_many({'student_id': {'$in': removed_student_ids}})).deleted_count
    results['interventions'] = (await db.interventions.delete_many({'student_id': {'$in': removed_student_ids}})).deleted_count
    results['teachers'] = (await db.teachers.delete_many({})).deleted_count
    results['teacher_allocations'] = (await db.teacher_allocations.delete_many({})).deleted_count
    results['classroom_observations'] = (await db.classroom_observations.delete_many({})).deleted_count
    results['marks_sets'] = (await db.marks_sets.delete_many({'class_name': {'$not': {'$regex': r'^(Class|Grade)\s*1$', '$options': 'i'}}})).deleted_count

    if structure:
        structure['classes'] = class_one_classes
        await db.academic_structure.update_one({'id': 'school-structure'}, {'$set': structure})

    print(f'Class 1 students kept: {len(class_one_students)}')
    print(f'Class 1 setup entries kept: {len(class_one_classes)}')
    for collection, count in results.items():
        print(f'{collection}: {count} removed')
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
