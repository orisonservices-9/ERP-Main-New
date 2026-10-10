import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ViewStudents from './pages/ViewStudents';
import StudentProfile from './pages/StudentProfile';
import AddStudent from './pages/AddStudent';
import AddStudentsList from './pages/AddStudentsList';
import CreateExam from './pages/CreateExam';
import AddMarks from './pages/AddMarks';
import LeaveManagement from './pages/LeaveManagement';
import { PromoteStudent, TransferStudent } from './pages/modules/StudentOps';
import { AttendanceManagement } from './pages/modules/AcademicsAttendance';
import { AcademicActionCenter, CurriculumSyllabus, StudentHealthSignals, AcademicInterventions } from './pages/modules/AcademicImprovement';
import AcademicStructure from './pages/modules/AcademicStructure';
import { AdmissionsCRM, CollectionIntelligence } from './pages/modules/BusinessIntelligence';
import ManagementActionCenter from './pages/modules/ManagementActionCenter';
import { AddStaff, ViewStaff } from './pages/modules/StaffDirectory';
import { AddTeacher, ViewTeachers, AssignTeachers, ViewAllocations } from './pages/modules/TeacherManagement';
import { CollectFee, CreateFees, FeeReceiptsArchive, ViewCollections, RazorpayVerification } from './pages/modules/FeeMgmt';
import { ViewExam, Results, ReportCard } from './pages/modules/ExamsMarks';
import { HomeworkManagement, TimetableManagement } from './pages/modules/Operations1';
import { InventoryManagement, ExpensesManagement } from './pages/modules/Operations2';
import { Notifications, Communications } from './pages/modules/Comms';
import VisitorManagement, { PublicVisitorPass } from './pages/modules/VisitorManagement';
import Transport from './pages/modules/TransportManagement';
import { QuestionBank, LeaveReports } from './pages/modules/Academics2';
import { BiometricManagement } from './pages/modules/HR';
import { HRPayroll } from './pages/modules/HRPayrollLive';
import { MultiBranch, SettingsPage } from './pages/modules/System';
import HallTicketsManagement from './pages/HallTicketsManagement';

const AccessDenied = () => (
  <Layout>
    <div data-testid="access-denied" className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5"><ShieldOff className="w-8 h-8 text-[#4F46E5]" /></div>
      <h2 className="font-poppins text-[22px] font-bold text-[#1a1a1a]">Access Denied</h2>
      <p className="text-[13px] text-[#8a8a8a] mt-2 max-w-sm">You don't have permission to view this page with your current role.</p>
      <a href="/dashboard" data-testid="access-denied-back-btn" className="mt-5 inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13px] font-medium rounded-lg px-5 py-2.5">Back to Dashboard</a>
    </div>
  </Layout>
);

const Protected = ({ requiredKey, children }) => {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/" replace />;
  const menu = auth.role === 'academic_coordinator'
    ? ['dashboard', 'academics', 'notifications']
    : auth.menu; // null = admin (all)
  if (menu && requiredKey && !menu.includes(requiredKey)) return <AccessDenied />;
  return children;
};

const P = (el, key) => <Protected requiredKey={key}>{el}</Protected>;

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/visitor-pass/:token" element={<PublicVisitorPass />} />
      <Route path="/dashboard" element={P(<Dashboard />, 'dashboard')} />
      <Route path="/management/action-center" element={P(<ManagementActionCenter />, 'management')} />

      <Route path="/students/add" element={P(<AddStudentsList />, 'student')} />
      <Route path="/students/add/new" element={P(<AddStudent />, 'student')} />
      <Route path="/students/view" element={P(<ViewStudents />, 'student')} />
      <Route path="/students/profile" element={P(<StudentProfile />, 'student')} />
      <Route path="/students/promote" element={P(<PromoteStudent />, 'student')} />
      <Route path="/students/transfer" element={P(<TransferStudent />, 'student')} />
      <Route path="/admissions" element={P(<AdmissionsCRM />, 'student')} />

      <Route path="/exams/create" element={P(<CreateExam />, 'exams')} />
      <Route path="/exams/view" element={P(<ViewExam />, 'exams')} />
      <Route path="/marks/add" element={P(<AddMarks />, 'marks')} />
      <Route path="/marks/results" element={P(<Results />, 'marks')} />
      <Route path="/marks/report-card" element={P(<ReportCard />, 'marks')} />

      <Route path="/leave/apply" element={P(<LeaveManagement mode="apply" />, 'leave')} />
      <Route path="/leave/requests" element={P(<LeaveManagement mode="requests" />, 'leave')} />
      <Route path="/leave/reports" element={P(<LeaveReports />, 'leave')} />

      <Route path="/academics" element={P(<AcademicStructure />, 'academics')} />
      <Route path="/academics/action-center" element={P(<AcademicActionCenter />, 'academics')} />
      <Route path="/academics/syllabus" element={P(<CurriculumSyllabus />, 'academics')} />
      <Route path="/academics/student-health" element={P(<StudentHealthSignals />, 'academics')} />
      <Route path="/academics/interventions" element={P(<AcademicInterventions />, 'academics')} />
      <Route path="/attendance" element={P(<Navigate to="/attendance/add" replace />, 'attendance')} />
      <Route path="/attendance/add" element={P(<AttendanceManagement />, 'attendance')} />
      <Route path="/attendance/view" element={P(<AttendanceManagement />, 'attendance')} />
      <Route path="/attendance/reports" element={P(<AttendanceManagement />, 'attendance')} />
      <Route path="/teachers" element={P(<Navigate to="/teachers/view" replace />, 'teachers')} />
      <Route path="/teachers/add" element={P(<AddTeacher />, 'teachers')} />
      <Route path="/teachers/view" element={P(<ViewTeachers />, 'teachers')} />
      <Route path="/teachers/assign" element={P(<AssignTeachers />, 'teachers')} />
      <Route path="/teachers/allocations" element={P(<ViewAllocations />, 'teachers')} />
      <Route path="/teaching/setup" element={P(<Navigate to="/teachers/assign" replace />, 'teachers')} />
      <Route path="/teaching/observations" element={P(<Navigate to="/academics/interventions" replace />, 'academics')} />
      <Route path="/teaching/performance" element={P(<Navigate to="/academics/interventions" replace />, 'academics')} />
      <Route path="/staff" element={P(<Navigate to="/staff/view" replace />, 'staff')} />
      <Route path="/staff/add" element={P(<AddStaff />, 'staff')} />
      <Route path="/staff/view" element={P(<ViewStaff />, 'staff')} />
      <Route path="/fee" element={P(<Navigate to="/fee/collections" replace />, 'fee')} />
      <Route path="/fee/create" element={P(<CreateFees />, 'fee')} />
      <Route path="/fee/collect" element={P(<CollectFee />, 'fee')} />
      <Route path="/fee/collections" element={P(<ViewCollections />, 'fee')} />
      <Route path="/fee/receipts" element={P(<FeeReceiptsArchive />, 'fee')} />
      <Route path="/fee/payment-verification" element={P(<RazorpayVerification />, 'fee')} />
      <Route path="/collections" element={P(<CollectionIntelligence />, 'collections')} />
      <Route path="/homework" element={P(<Navigate to="/homework/add" replace />, 'homework')} />
      <Route path="/homework/add" element={P(<HomeworkManagement mode="add" />, 'homework')} />
      <Route path="/homework/reports" element={P(<HomeworkManagement mode="reports" />, 'homework')} />
      <Route path="/hall-tickets" element={P(<Navigate to="/hall-tickets/create" replace />, 'hall_tickets')} />
      <Route path="/hall-tickets/create" element={P(<HallTicketsManagement mode="create" />, 'hall_tickets')} />
      <Route path="/hall-tickets/view" element={P(<HallTicketsManagement mode="view" />, 'hall_tickets')} />
      <Route path="/timetable" element={P(<Navigate to="/timetable/create" replace />, 'timetable')} />
      <Route path="/timetable/create" element={P(<TimetableManagement mode="create" />, 'timetable')} />
      <Route path="/timetable/view" element={P(<TimetableManagement mode="view" />, 'timetable')} />
      <Route path="/timetable/reports" element={P(<TimetableManagement mode="reports" />, 'timetable')} />
      <Route path="/inventory" element={P(<InventoryManagement mode="overview" />, 'inventory')} />
      <Route path="/inventory/purchase" element={P(<InventoryManagement mode="purchase" />, 'inventory')} />
      <Route path="/inventory/parent-issue" element={P(<InventoryManagement mode="parent-issue" />, 'inventory')} />
      <Route path="/inventory/register" element={P(<InventoryManagement mode="register" />, 'inventory')} />
      <Route path="/inventory/movement" element={P(<InventoryManagement mode="movement" />, 'inventory')} />
      <Route path="/inventory/reports" element={P(<InventoryManagement mode="reports" />, 'inventory')} />
      <Route path="/expenses" element={P(<ExpensesManagement mode="overview" />, 'expenses')} />
      <Route path="/expenses/record" element={P(<ExpensesManagement mode="record" />, 'expenses')} />
      <Route path="/expenses/register" element={P(<ExpensesManagement mode="register" />, 'expenses')} />
      <Route path="/expenses/reports" element={P(<ExpensesManagement mode="reports" />, 'expenses')} />
      <Route path="/notifications" element={P(<Notifications mode="dashboard" />, 'notifications')} />
      <Route path="/notifications/send" element={P(<Notifications mode="send" />, 'notifications')} />
      <Route path="/notifications/rules" element={<Navigate to="/notifications" replace />} />
      <Route path="/notifications/history" element={<Navigate to="/notifications" replace />} />
      <Route path="/transport" element={P(<Transport mode="overview" />, 'transport')} />
      <Route path="/transport/routes" element={P(<Transport mode="routes" />, 'transport')} />
      <Route path="/transport/assignments" element={<Navigate to="/students/view" replace />} />
      <Route path="/transport/live" element={<Navigate to="/transport" replace />} />
      <Route path="/transport/safety" element={<Navigate to="/transport" replace />} />
      <Route path="/communications" element={P(<Communications />, 'communications')} />
      <Route path="/visitor" element={P(<VisitorManagement mode="overview" />, 'visitor')} />
      <Route path="/visitor/register" element={P(<VisitorManagement mode="register" />, 'visitor')} />
      <Route path="/visitor/log" element={P(<VisitorManagement mode="log" />, 'visitor')} />
      <Route path="/question-bank" element={P(<QuestionBank />, 'question')} />
      <Route path="/hr-payroll" element={P(<HRPayroll />, 'hr')} />
      <Route path="/biometric" element={P(<BiometricManagement />, 'biometric')} />
      <Route path="/multi-branch" element={<Navigate to="/multi-branch/overview" replace />} />
      <Route path="/multi-branch/overview" element={P(<MultiBranch mode="overview" />, 'multibranch')} />
      <Route path="/multi-branch/directory" element={P(<MultiBranch mode="directory" />, 'multibranch')} />
      <Route path="/multi-branch/reports" element={P(<MultiBranch mode="reports" />, 'multibranch')} />
      <Route path="/settings" element={P(<SettingsPage />, 'settings')} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
