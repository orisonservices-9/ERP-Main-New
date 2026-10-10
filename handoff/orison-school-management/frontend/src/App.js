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
import { AcademicsManagement, AttendanceManagement } from './pages/modules/AcademicsAttendance';
import { TeachersManagement, StaffManagement } from './pages/modules/PeopleMgmt';
import { FeeManagement } from './pages/modules/FeeMgmt';
import { ViewExam, Results, ReportCard } from './pages/modules/ExamsMarks';
import { HomeworkManagement, TimetableManagement } from './pages/modules/Operations1';
import { InventoryManagement, ExpensesManagement } from './pages/modules/Operations2';
import { Notifications, Communications } from './pages/modules/Comms';
import { Transport, VisitorManagement } from './pages/modules/Facilities';
import { QuestionBank, LeaveReports } from './pages/modules/Academics2';
import { HRPayroll, BiometricManagement } from './pages/modules/HR';
import { MultiBranch, AIAnalytics, SettingsPage } from './pages/modules/System';

const AccessDenied = () => (
  <Layout>
    <div data-testid="access-denied" className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-5"><ShieldOff className="w-8 h-8 text-[#C4141B]" /></div>
      <h2 className="font-poppins text-[22px] font-bold text-[#1a1a1a]">Access Denied</h2>
      <p className="text-[13px] text-[#8a8a8a] mt-2 max-w-sm">You don't have permission to view this page with your current role.</p>
      <a href="/dashboard" data-testid="access-denied-back-btn" className="mt-5 inline-flex items-center gap-2 bg-[#C4141B] hover:bg-[#a91116] text-white text-[13px] font-medium rounded-lg px-5 py-2.5">Back to Dashboard</a>
    </div>
  </Layout>
);

const Protected = ({ requiredKey, children }) => {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/" replace />;
  const menu = auth.menu; // null = admin (all)
  if (menu && requiredKey && !menu.includes(requiredKey)) return <AccessDenied />;
  return children;
};

const P = (el, key) => <Protected requiredKey={key}>{el}</Protected>;

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={P(<Dashboard />, 'dashboard')} />

      <Route path="/students/add" element={P(<AddStudentsList />, 'student')} />
      <Route path="/students/add/new" element={P(<AddStudent />, 'student')} />
      <Route path="/students/view" element={P(<ViewStudents />, 'student')} />
      <Route path="/students/profile" element={P(<StudentProfile />, 'student')} />
      <Route path="/students/promote" element={P(<PromoteStudent />, 'student')} />
      <Route path="/students/transfer" element={P(<TransferStudent />, 'student')} />

      <Route path="/exams/create" element={P(<CreateExam />, 'exams')} />
      <Route path="/exams/view" element={P(<ViewExam />, 'exams')} />
      <Route path="/marks/add" element={P(<AddMarks />, 'marks')} />
      <Route path="/marks/results" element={P(<Results />, 'marks')} />
      <Route path="/marks/report-card" element={P(<ReportCard />, 'marks')} />

      <Route path="/leave/apply" element={P(<LeaveManagement />, 'leave')} />
      <Route path="/leave/requests" element={P(<LeaveManagement />, 'leave')} />
      <Route path="/leave/reports" element={P(<LeaveReports />, 'leave')} />

      <Route path="/academics" element={P(<AcademicsManagement />, 'academics')} />
      <Route path="/attendance" element={P(<AttendanceManagement />, 'attendance')} />
      <Route path="/teachers" element={P(<TeachersManagement />, 'teachers')} />
      <Route path="/staff" element={P(<StaffManagement />, 'staff')} />
      <Route path="/fee" element={P(<FeeManagement />, 'fee')} />
      <Route path="/homework" element={P(<HomeworkManagement />, 'homework')} />
      <Route path="/timetable" element={P(<TimetableManagement />, 'timetable')} />
      <Route path="/inventory" element={P(<InventoryManagement />, 'inventory')} />
      <Route path="/expenses" element={P(<ExpensesManagement />, 'expenses')} />
      <Route path="/notifications" element={P(<Notifications />, 'notifications')} />
      <Route path="/transport" element={P(<Transport />, 'transport')} />
      <Route path="/communications" element={P(<Communications />, 'communications')} />
      <Route path="/visitor" element={P(<VisitorManagement />, 'visitor')} />
      <Route path="/question-bank" element={P(<QuestionBank />, 'question')} />
      <Route path="/hr-payroll" element={P(<HRPayroll />, 'hr')} />
      <Route path="/biometric" element={P(<BiometricManagement />, 'biometric')} />
      <Route path="/multi-branch" element={P(<MultiBranch />, 'multibranch')} />
      <Route path="/ai-analytics" element={P(<AIAnalytics />, 'ai')} />
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
