// ===== Orison School Management - Mock Data =====
import {
  LayoutDashboard, Users, GraduationCap, CalendarCheck, UserCog, Briefcase,
  Wallet, FileText, ClipboardList, BookOpen, CalendarDays, Boxes, Receipt,
  Bell, Bus, MessageSquare, UserCheck, HelpCircle, BadgeDollarSign,
  Fingerprint, Building2, BrainCircuit, Settings
} from 'lucide-react';

// Sidebar navigation config
export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    key: 'student', label: 'Student Management', icon: Users,
    children: [
      { label: 'Add Students', path: '/students/add' },
      { label: 'View Students', path: '/students/view' },
      { label: 'Promote Student', path: '/students/promote' },
      { label: 'Transfer Student', path: '/students/transfer' },
    ],
  },
  { key: 'academics', label: 'Academics Management', icon: GraduationCap, path: '/academics' },
  { key: 'attendance', label: 'Attendance Management', icon: CalendarCheck, path: '/attendance' },
  { key: 'teachers', label: 'Teachers Management', icon: UserCog, path: '/teachers' },
  { key: 'staff', label: 'Staff Management', icon: Briefcase, path: '/staff' },
  { key: 'fee', label: 'Fee Management', icon: Wallet, path: '/fee' },
  {
    key: 'exams', label: 'Exams Management', icon: FileText,
    children: [
      { label: 'Create Exam', path: '/exams/create' },
      { label: 'View Exam', path: '/exams/view' },
    ],
  },
  {
    key: 'marks', label: 'Marks Management', icon: ClipboardList,
    children: [
      { label: 'Add Marks', path: '/marks/add' },
      { label: 'Results', path: '/marks/results' },
      { label: 'Report Card', path: '/marks/report-card' },
    ],
  },
  { key: 'homework', label: 'Homework Management', icon: BookOpen, path: '/homework' },
  {
    key: 'leave', label: 'Leave Management', icon: CalendarDays,
    children: [
      { label: 'Apply Leave', path: '/leave/apply' },
      { label: 'Leave Requests', path: '/leave/requests' },
      { label: 'Reports', path: '/leave/reports' },
    ],
  },
  { key: 'timetable', label: 'Timetable Management', icon: CalendarDays, path: '/timetable' },
  { key: 'inventory', label: 'Inventory Management', icon: Boxes, path: '/inventory' },
  { key: 'expenses', label: 'Expenses Management', icon: Receipt, path: '/expenses' },
  { key: 'notifications', label: 'Notifications', icon: Bell, path: '/notifications' },
  { key: 'transport', label: 'Transport', icon: Bus, path: '/transport' },
  { key: 'communications', label: 'Communications', icon: MessageSquare, path: '/communications' },
  { key: 'visitor', label: 'Visitor Management', icon: UserCheck, path: '/visitor' },
  { key: 'question', label: 'Question Bank', icon: HelpCircle, path: '/question-bank' },
  { key: 'hr', label: 'HR & Payroll', icon: BadgeDollarSign, path: '/hr-payroll' },
  { key: 'biometric', label: 'Biometric Management', icon: Fingerprint, path: '/biometric' },
  { key: 'multibranch', label: 'Multi Branch Management', icon: Building2, path: '/multi-branch' },
  { key: 'ai', label: 'AI Analytics', icon: BrainCircuit, path: '/ai-analytics' },
  { key: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

// Current student for profile pages
export const STUDENT = {
  name: 'Marcus Thorne',
  id: 'EP-2024-0812',
  className: 'Grade 11 - Section B',
  roll: '042',
  balance: '₹11,450.00',
  status: 'Active',
  avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces',
};

// Attendance calendar - July 2025. status: present|absent|late|null(weekend/none)
export const ATTENDANCE_MONTH = 'July 2025';
export const ATTENDANCE_DAYS = [
  // week 1
  { day: null }, { day: null }, { day: 1, status: 'late' }, { day: 2, status: 'present' }, { day: 3, status: 'absent' }, { day: 4, status: 'present' }, { day: 5, status: 'weekend' },
  // week 2
  { day: 6, status: 'weekend' }, { day: 7, status: 'present' }, { day: 8, status: 'late' }, { day: 9, status: 'present' }, { day: 10, status: 'absent' }, { day: 11, status: 'present' }, { day: 12, status: 'weekend' },
  // week 3
  { day: 13, status: 'weekend' }, { day: 14, status: 'present' }, { day: 15, status: 'present' }, { day: 16, status: 'late' }, { day: 17, status: 'present' }, { day: 18, status: 'present' }, { day: 19, status: 'weekend' },
  // week 4
  { day: 20, status: 'weekend' }, { day: 21, status: 'present' }, { day: 22, status: 'present' }, { day: 23, status: 'present' }, { day: 24, status: 'present' }, { day: 25, status: 'present' }, { day: 26, status: 'weekend' },
  // week 5
  { day: 27, status: 'weekend' }, { day: 28, status: 'present' }, { day: 29, status: 'present' }, { day: 30, status: 'present' }, { day: 31, status: 'present' }, { day: null }, { day: null },
];

export const ATTENDANCE_STATS = {
  rate: '91.3%',
  totalWorking: '23 days',
  totalPresent: '19 days',
  lateArrivals: '2 days',
  absentDays: '2 days',
};

export const ATTENDANCE_LOGS = [
  { date: 'Jul 31, 2025', status: 'Present', in: '08:14 AM', out: '02:30 PM' },
  { date: 'Jul 30, 2025', status: 'Present', in: '08:10 AM', out: '02:35 PM' },
  { date: 'Jul 29, 2025', status: 'Present', in: '08:15 AM', out: '02:32 PM' },
  { date: 'Jul 28, 2025', status: 'Present', in: '08:20 AM', out: '02:30 PM' },
  { date: 'Jul 25, 2025', status: 'Absent', in: '--', out: '--' },
  { date: 'Jul 24, 2025', status: 'Present', in: '08:12 AM', out: '02:31 PM' },
];

// Fees
export const PENDING_DUES = [
  { checked: true, desc: 'Tuition Fee - Quarter 2', sub: 'Standard term tuition', due: 'Oct 15, 2024', amount: '₹11,200.00', status: 'OVERDUE' },
  { checked: true, desc: 'Library Membership', sub: 'Annual digital & physical access', due: 'Nov 01, 2024', amount: '₹150.00', status: 'PENDING' },
  { checked: false, desc: 'Lab Resources Fee', sub: 'Physics & Chemistry supplies', due: 'Nov 01, 2024', amount: '₹100.00', status: 'PENDING' },
];
export const LAST_YEAR_DUES = [
  { desc: 'Library Fee', sub: 'Previous year carryover', amount: '₹500.00', status: 'OVERDUE' },
  { desc: 'Lab Fee', sub: 'Previous year carryover', amount: '₹300.00', status: 'OVERDUE' },
  { desc: 'Sports Fee', sub: 'Previous year carryover', amount: '₹200.00', status: 'OVERDUE' },
];

// Academics
export const GRADE_SHEET = [
  { subject: 'Mathematics', internal: 22, external: 74, total: 96, grade: 'A+' },
  { subject: 'Science', internal: 24, external: 71, total: 95, grade: 'A+' },
  { subject: 'English', internal: 19, external: 68, total: 87, grade: 'A' },
  { subject: 'Hindi', internal: 20, external: 65, total: 85, grade: 'A' },
  { subject: 'Social Studies', internal: 21, external: 70, total: 91, grade: 'A+' },
  { subject: 'Computer Science', internal: 25, external: 72, total: 97, grade: 'A+' },
];
export const GPA_SUMMARY = { cgpa: '9.42', grade: 'A+ (Excellent)', credits: '24 / 24', standing: 'First Class with Distinction' };
export const CLASS_STANDING = { rank: '03 / 45 Students', percentile: '93.3% Percentile' };

// Add Students - class list
export const CLASS_LIST = [
  'Nursery.csv', 'LKG', 'UKG', '1st class', '2nd class', '3rd class', '4th class',
  '5th class', '6th class', '7th class', '8th class', '9th class', '10th class',
];

// View Students list
export const STUDENTS = [
  { id: 'EP-2024-0812', name: 'Marcus Thorne', className: 'Grade 11 - B', roll: '042', status: 'Active', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces' },
  { id: 'ADM-2024-0892', name: 'Aarav Sharma', className: 'Class 10 - B', roll: '018', status: 'Active', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=faces' },
  { id: 'EP-2024-0455', name: 'Sophia Martinez', className: 'Grade 10 - A', roll: '021', status: 'Active', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=faces' },
  { id: 'EP-2024-0311', name: 'Elara Vance', className: 'Grade 10 - A', roll: '009', status: 'Active', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces' },
  { id: 'EP-2024-0790', name: 'Benjamin Thorne', className: 'Grade 10 - A', roll: '012', status: 'Inactive', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces' },
];

// Marks
export const MARKS_ROWS = [
  { roll: '#102401', name: 'Benjamin Thorne', attendance: 'P', written: 62, practical: 28, total: 90 },
  { roll: '#102402', name: 'Sophia Martinez', attendance: 'P', written: 55, practical: 24, total: 79 },
  { roll: '#102404', name: 'Elara Vance', attendance: 'A', written: 0, practical: 29, total: 97 },
];

// Leave Management
export const PENDING_LEAVES = [
  { name: 'Robert Fox', detail: 'Sick Leave • 12 Oct – 14 Oct' },
  { name: 'Arlene McCoy', detail: 'Casual Leave • 15 Oct' },
  { name: 'Jerome Bell', detail: 'Annual Leave • 20 Oct – 25 Oct' },
];
export const LEAVE_HISTORY = [
  { name: 'Cody Fisher', type: 'Medical', from: '01 Oct 2025', to: '03 Oct 2025', days: 3, status: 'Approved', avatar: 'https://i.pravatar.cc/80?img=12' },
  { name: 'Esther Howard', type: 'Casual', from: '28 Sep 2025', to: '28 Sep 2025', days: 1, status: 'Rejected', avatar: 'https://i.pravatar.cc/80?img=45' },
  { name: 'Jenny Wilson', type: 'Maternity', from: '15 Aug 2025', to: '15 Nov 2025', days: 92, status: 'Approved', avatar: 'https://i.pravatar.cc/80?img=32' },
  { name: 'Guy Hawkins', type: 'Annual', from: '10 Sep 2025', to: '15 Sep 2025', days: 6, status: 'Pending', avatar: 'https://i.pravatar.cc/80?img=15' },
  { name: 'Marvin McKinney', type: 'Sick', from: '05 Sep 2025', to: '07 Sep 2025', days: 3, status: 'Approved', avatar: 'https://i.pravatar.cc/80?img=13' },
  { name: 'Bessie Cooper', type: 'Casual', from: '01 Sep 2025', to: '01 Sep 2025', days: 1, status: 'Rejected', avatar: 'https://i.pravatar.cc/80?img=47' },
];

// Exam quick summary
export const EXAM_SUMMARY = { status: 'DRAFT', capacity: '120 Students', duration: '2 Hours' };
