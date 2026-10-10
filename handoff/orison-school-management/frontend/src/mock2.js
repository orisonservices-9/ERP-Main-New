// Extended mock data for all Orison modules
export const TEACHERS = [
  { id: 'TCH-001', name: 'Dr. Anita Rao', subject: 'Physics', classes: 'Grade 11, 12', phone: '+91 98765 10001', status: 'Active', avatar: 'https://i.pravatar.cc/80?img=32' },
  { id: 'TCH-002', name: 'Vikram Nair', subject: 'Mathematics', classes: 'Grade 9, 10', phone: '+91 98765 10002', status: 'Active', avatar: 'https://i.pravatar.cc/80?img=12' },
  { id: 'TCH-003', name: 'Sneha Kapoor', subject: 'English', classes: 'Grade 6, 7, 8', phone: '+91 98765 10003', status: 'On Leave', avatar: 'https://i.pravatar.cc/80?img=45' },
  { id: 'TCH-004', name: 'Rahul Menon', subject: 'Chemistry', classes: 'Grade 11', phone: '+91 98765 10004', status: 'Active', avatar: 'https://i.pravatar.cc/80?img=15' },
  { id: 'TCH-005', name: 'Priya Das', subject: 'Biology', classes: 'Grade 10, 12', phone: '+91 98765 10005', status: 'Active', avatar: 'https://i.pravatar.cc/80?img=47' },
  { id: 'TCH-006', name: 'Arjun Sethi', subject: 'Computer Science', classes: 'Grade 8, 9', phone: '+91 98765 10006', status: 'Active', avatar: 'https://i.pravatar.cc/80?img=13' },
];

export const STAFF = [
  { id: 'STF-101', name: 'Ramesh Kumar', role: 'Accountant', dept: 'Finance', phone: '+91 90000 20001', status: 'Active', avatar: 'https://i.pravatar.cc/80?img=51' },
  { id: 'STF-102', name: 'Lakshmi Iyer', role: 'Librarian', dept: 'Library', phone: '+91 90000 20002', status: 'Active', avatar: 'https://i.pravatar.cc/80?img=44' },
  { id: 'STF-103', name: 'Suresh Pillai', role: 'Lab Assistant', dept: 'Science', phone: '+91 90000 20003', status: 'Active', avatar: 'https://i.pravatar.cc/80?img=53' },
  { id: 'STF-104', name: 'Meena Joshi', role: 'Receptionist', dept: 'Admin', phone: '+91 90000 20004', status: 'On Leave', avatar: 'https://i.pravatar.cc/80?img=26' },
  { id: 'STF-105', name: 'Gopal Verma', role: 'Security Head', dept: 'Security', phone: '+91 90000 20005', status: 'Active', avatar: 'https://i.pravatar.cc/80?img=59' },
];

export const EXAMS = [
  { title: 'Mid-Term 2025', class: 'Grade 10-A', subject: 'Mathematics', date: 'Aug 12, 2025', room: 'Hall B2', status: 'Scheduled' },
  { title: 'Unit Test 3', class: 'Grade 9-B', subject: 'Science', date: 'Aug 18, 2025', room: 'Room 204', status: 'Scheduled' },
  { title: 'First Semester Final', class: 'Grade 11-B', subject: 'Physics', date: 'Sep 02, 2025', room: 'Auditorium', status: 'Draft' },
  { title: 'Weekly Quiz', class: 'Grade 8-A', subject: 'English', date: 'Aug 08, 2025', room: 'Room 101', status: 'Completed' },
];

export const RESULTS = [
  { roll: '#102401', name: 'Benjamin Thorne', total: 456, percent: 91.2, grade: 'A+', rank: 1 },
  { roll: '#102402', name: 'Sophia Martinez', total: 421, percent: 84.2, grade: 'A', rank: 3 },
  { roll: '#102403', name: 'Elara Vance', total: 438, percent: 87.6, grade: 'A', rank: 2 },
  { roll: '#102404', name: 'Marcus Thorne', total: 402, percent: 80.4, grade: 'A', rank: 5 },
  { roll: '#102405', name: 'Aarav Sharma', total: 410, percent: 82.0, grade: 'A', rank: 4 },
];

export const HOMEWORK = [
  { subject: 'Mathematics', title: 'Algebra Worksheet 4', class: 'Grade 10-A', due: 'Aug 10, 2025', assigned: 42, submitted: 30, status: 'Active' },
  { subject: 'Science', title: 'Chapter 6 Notes', class: 'Grade 9-B', due: 'Aug 09, 2025', assigned: 38, submitted: 38, status: 'Closed' },
  { subject: 'English', title: 'Essay: My Hero', class: 'Grade 8-A', due: 'Aug 12, 2025', assigned: 40, submitted: 12, status: 'Active' },
  { subject: 'History', title: 'Timeline Project', class: 'Grade 7-C', due: 'Aug 15, 2025', assigned: 36, submitted: 5, status: 'Active' },
];

export const TIMETABLE = {
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  periods: ['08:00', '09:00', '10:00', '11:15', '12:15', '01:30'],
  grid: {
    '08:00': ['Mathematics', 'English', 'Physics', 'Chemistry', 'Biology'],
    '09:00': ['Physics', 'Mathematics', 'English', 'Computer Sc.', 'Mathematics'],
    '10:00': ['English', 'Chemistry', 'Mathematics', 'Physics', 'English'],
    '11:15': ['Biology', 'Computer Sc.', 'Chemistry', 'Mathematics', 'Physics'],
    '12:15': ['Chemistry', 'Physics', 'Biology', 'English', 'Computer Sc.'],
    '01:30': ['Sports', 'Library', 'Sports', 'Arts', 'Music'],
  },
};

export const INVENTORY = [
  { item: 'Whiteboard Markers', category: 'Stationery', stock: 240, unit: 'pcs', status: 'In Stock' },
  { item: 'Chemistry Lab Kits', category: 'Lab Equipment', stock: 18, unit: 'sets', status: 'Low Stock' },
  { item: 'Student Desks', category: 'Furniture', stock: 512, unit: 'units', status: 'In Stock' },
  { item: 'Projectors', category: 'Electronics', stock: 4, unit: 'units', status: 'Low Stock' },
  { item: 'A4 Paper Reams', category: 'Stationery', stock: 0, unit: 'reams', status: 'Out of Stock' },
  { item: 'Football Kits', category: 'Sports', stock: 26, unit: 'sets', status: 'In Stock' },
];

export const EXPENSES = [
  { date: 'Aug 01, 2025', category: 'Utilities', desc: 'Electricity Bill - July', amount: '₹42,300', method: 'Bank Transfer', status: 'Paid' },
  { date: 'Aug 03, 2025', category: 'Salaries', desc: 'Support staff advance', amount: '₹15,000', method: 'Cash', status: 'Paid' },
  { date: 'Aug 05, 2025', category: 'Maintenance', desc: 'AC servicing (Block A)', amount: '₹8,500', method: 'UPI', status: 'Pending' },
  { date: 'Aug 06, 2025', category: 'Supplies', desc: 'Lab chemicals restock', amount: '₹21,750', method: 'Card', status: 'Paid' },
  { date: 'Aug 07, 2025', category: 'Transport', desc: 'Bus diesel refill', amount: '₹12,400', method: 'Cash', status: 'Pending' },
];

export const NOTIFICATIONS = [
  { title: 'New admission approved', body: 'Aarav Sharma has been enrolled in Class 10-B.', time: '10 min ago', type: 'success', unread: true },
  { title: 'Fee payment overdue', body: '3 students have pending Quarter 2 tuition dues.', time: '1 hour ago', type: 'warning', unread: true },
  { title: 'Exam scheduled', body: 'Mid-Term 2025 for Grade 10-A on Aug 12.', time: '3 hours ago', type: 'info', unread: false },
  { title: 'Leave request', body: 'Robert Fox requested sick leave (12-14 Oct).', time: 'Yesterday', type: 'info', unread: false },
  { title: 'Inventory alert', body: 'A4 Paper Reams are out of stock.', time: '2 days ago', type: 'warning', unread: false },
];

export const TRANSPORT = [
  { route: 'Route 01 - North', driver: 'Manoj Singh', bus: 'KA-01-AB-1234', students: 34, stops: 8, status: 'On Route' },
  { route: 'Route 02 - East', driver: 'Deepak Rao', bus: 'KA-01-CD-5678', students: 28, stops: 6, status: 'Idle' },
  { route: 'Route 03 - Sector 9', driver: 'Anil Kumar', bus: 'KA-01-EF-9012', students: 41, stops: 10, status: 'On Route' },
  { route: 'Route 04 - West', driver: 'Sunil Yadav', bus: 'KA-01-GH-3456', students: 22, stops: 5, status: 'Maintenance' },
];

export const VISITORS = [
  { name: 'Rajesh Sharma', purpose: 'Parent Meeting', host: 'Class 10-B Teacher', in: '09:15 AM', out: '10:00 AM', status: 'Checked Out', avatar: 'https://i.pravatar.cc/80?img=68' },
  { name: 'Sales Rep - EduBooks', purpose: 'Vendor', host: 'Admin Office', in: '11:30 AM', out: '--', status: 'Inside', avatar: 'https://i.pravatar.cc/80?img=33' },
  { name: 'Sunita Sharma', purpose: 'Fee Payment', host: 'Accounts', in: '12:05 PM', out: '12:20 PM', status: 'Checked Out', avatar: 'https://i.pravatar.cc/80?img=48' },
  { name: 'Municipal Inspector', purpose: 'Inspection', host: 'Principal', in: '02:00 PM', out: '--', status: 'Inside', avatar: 'https://i.pravatar.cc/80?img=60' },
];

export const QUESTIONS = [
  { q: 'State Newton’s second law of motion.', subject: 'Physics', type: 'Short Answer', marks: 3, difficulty: 'Easy' },
  { q: 'Solve: 2x² - 5x + 3 = 0', subject: 'Mathematics', type: 'Numerical', marks: 5, difficulty: 'Medium' },
  { q: 'Explain photosynthesis with a diagram.', subject: 'Biology', type: 'Long Answer', marks: 10, difficulty: 'Medium' },
  { q: 'Define an isotope. Give one example.', subject: 'Chemistry', type: 'Short Answer', marks: 2, difficulty: 'Easy' },
  { q: 'Write a program to reverse a string.', subject: 'Computer Science', type: 'Coding', marks: 8, difficulty: 'Hard' },
];

export const PAYROLL = [
  { name: 'Dr. Anita Rao', role: 'Teacher', gross: '₹85,000', deductions: '₹8,500', net: '₹76,500', status: 'Paid', avatar: 'https://i.pravatar.cc/80?img=32' },
  { name: 'Vikram Nair', role: 'Teacher', gross: '₹72,000', deductions: '₹7,200', net: '₹64,800', status: 'Paid', avatar: 'https://i.pravatar.cc/80?img=12' },
  { name: 'Ramesh Kumar', role: 'Accountant', gross: '₹55,000', deductions: '₹5,000', net: '₹50,000', status: 'Processing', avatar: 'https://i.pravatar.cc/80?img=51' },
  { name: 'Lakshmi Iyer', role: 'Librarian', gross: '₹42,000', deductions: '₹3,800', net: '₹38,200', status: 'Pending', avatar: 'https://i.pravatar.cc/80?img=44' },
];

export const BIOMETRIC = [
  { name: 'Dr. Anita Rao', id: 'TCH-001', in: '08:02 AM', out: '04:10 PM', device: 'Gate-01', status: 'Present', avatar: 'https://i.pravatar.cc/80?img=32' },
  { name: 'Vikram Nair', id: 'TCH-002', in: '08:15 AM', out: '04:05 PM', device: 'Gate-01', status: 'Present', avatar: 'https://i.pravatar.cc/80?img=12' },
  { name: 'Ramesh Kumar', id: 'STF-101', in: '09:00 AM', out: '--', device: 'Gate-02', status: 'Present', avatar: 'https://i.pravatar.cc/80?img=51' },
  { name: 'Sneha Kapoor', id: 'TCH-003', in: '--', out: '--', device: '--', status: 'Absent', avatar: 'https://i.pravatar.cc/80?img=45' },
];

export const BRANCHES = [
  { name: 'Orison Central Campus', city: 'Bengaluru', students: 1284, staff: 96, status: 'Active' },
  { name: 'Orison North Branch', city: 'Hyderabad', students: 842, staff: 61, status: 'Active' },
  { name: 'Orison East Branch', city: 'Chennai', students: 638, staff: 48, status: 'Active' },
  { name: 'Orison West Branch', city: 'Pune', students: 415, staff: 33, status: 'Setup' },
];

export const CONVERSATIONS = [
  { name: 'Grade 10-B Parents Group', last: 'Reminder: PTM this Saturday at 10 AM.', time: '09:20', unread: 2, avatar: 'https://i.pravatar.cc/80?img=5' },
  { name: 'Staff Announcements', last: 'Holiday declared on Aug 15.', time: 'Yesterday', unread: 0, avatar: 'https://i.pravatar.cc/80?img=7' },
  { name: 'Vikram Nair (Maths)', last: 'Shared the revised test schedule.', time: 'Mon', unread: 1, avatar: 'https://i.pravatar.cc/80?img=12' },
  { name: 'Transport Coordinators', last: 'Route 04 under maintenance today.', time: 'Sun', unread: 0, avatar: 'https://i.pravatar.cc/80?img=8' },
];

export const PROMOTE_STUDENTS = [
  { roll: '01', name: 'Marcus Thorne', current: 'Grade 10-B', result: 'Pass', percent: '91%', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=faces' },
  { roll: '02', name: 'Sophia Martinez', current: 'Grade 10-B', result: 'Pass', percent: '84%', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=faces' },
  { roll: '03', name: 'Elara Vance', current: 'Grade 10-B', result: 'Pass', percent: '88%', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces' },
  { roll: '04', name: 'Benjamin Thorne', current: 'Grade 10-B', result: 'Detained', percent: '38%', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces' },
];
