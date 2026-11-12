import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import AttendanceTab from './student-tabs/AttendanceTab';
import FeesTab from './student-tabs/FeesTab';
import AcademicsTab from './student-tabs/AcademicsTab';
import ProfileEditTab from './student-tabs/ProfileEditTab';
import DocumentsTab from './student-tabs/DocumentsTab';
import {
  Activity, ArrowUpCircle, BookOpenCheck, Bus, CalendarCheck2,
  CircleDollarSign, ClipboardCheck, GraduationCap, HandHeart, HeartPulse,
  Loader2, MessageCircleMore, UserRoundCheck,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const TABS = ['Profile', 'Journey', 'Fees', 'Academics', 'Attendance', 'Documents'];

const journeyIcons = {
  Admission: UserRoundCheck, Student: GraduationCap, Attendance: CalendarCheck2,
  Fees: CircleDollarSign, Assessment: BookOpenCheck, Support: HandHeart,
  Homework: ClipboardCheck, Communication: MessageCircleMore,
  Transport: Bus, Health: HeartPulse, Promotion: ArrowUpCircle,
};

const JourneyTab = ({ studentId, student }) => {
  const [timeline, setTimeline] = useState(null);
  useEffect(() => {
    setTimeline(null);
    api.get(`/students/${studentId}/timeline`).then(({ data }) => {
      const recorded = data?.events || [];
      setTimeline({ ...data, events: recorded, count: data?.count ?? recorded.length });
    }).catch(() => {
      setTimeline({ events: [], count: 0, failed: true });
    });
  }, [studentId, student]);
  if (!timeline) return <div className="flex justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  return <section className="overflow-hidden rounded-[26px] border border-slate-100 bg-white shadow-[0_18px_50px_rgba(15,23,42,.06)]">
    <header className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 p-6 text-white sm:flex-row sm:items-end sm:justify-between">
      <div><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-indigo-100"><Activity className="h-3.5 w-3.5"/>Connected student journey</span>{timeline.is_preview && <span className="rounded-full bg-amber-300/15 px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-amber-200">Preview data</span>}</div><h2 className="mt-3 font-poppins text-[22px] font-bold">One timeline for every school interaction</h2><p className="mt-1 text-[13px] text-indigo-100/65">Admissions, attendance, fees, assessments, homework, transport, communication and support appear in date order.</p></div>
      <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-center"><b className="text-[22px]">{timeline.count || 0}</b><p className="text-[12px] uppercase tracking-wider text-white/55">Recorded events</p></div>
    </header>
    <div className="p-6">
      {(timeline.events || []).length ? <div className="relative ml-4 border-l border-indigo-100 pl-7">{timeline.events.map((event, index) => { const Icon = journeyIcons[event.type] || Activity; return <article key={`${event.type}-${event.source_id}-${index}`} className="relative pb-7 last:pb-0"><span className="absolute -left-[43px] top-0 flex h-8 w-8 items-center justify-center rounded-xl border-4 border-white bg-indigo-50 text-indigo-600 shadow-sm"><Icon className="h-3.5 w-3.5"/></span><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[12px] font-bold uppercase tracking-wider text-indigo-500">{event.type}</span>{event.status && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-500">{event.status}</span>}</div><h3 className="mt-1 text-[13px] font-bold text-slate-800">{event.title}</h3>{event.detail && <p className="mt-1 max-w-2xl text-[12px] leading-4 text-slate-500">{event.detail}</p>}</div><time className="shrink-0 text-[12px] font-medium text-slate-400">{event.at ? new Date(event.at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : 'Date not recorded'}</time></div></article>; })}</div> : <div className="py-16 text-center"><Activity className="mx-auto h-9 w-9 text-slate-200"/><p className="mt-3 text-[13px] font-semibold text-slate-600">No connected activity yet</p><p className="mt-1 text-[12px] text-slate-400">School actions will appear here automatically.</p></div>}
    </div>
  </section>;
};

const StudentProfile = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [params] = useSearchParams();
  const id = params.get('id') || 'EP-2024-0812';
  const roleTabs = {
    admin: TABS,
    director: ['Journey', 'Fees', 'Academics', 'Attendance'],
    academic_coordinator: ['Academics', 'Attendance'],
    fee_manager: ['Fees'],
    teacher: ['Attendance', 'Academics'],
  };
  const tabs = roleTabs[auth?.role] || ['Attendance'];
  const preferredTab = auth?.role === 'fee_manager' ? 'Fees' : auth?.role === 'academic_coordinator' ? 'Academics' : auth?.role === 'director' ? 'Journey' : 'Attendance';
  const [tab, setTab] = useState(preferredTab);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setDetail(null);
    api.get(`/students/${id}/detail`).then(({ data }) => setDetail(data)).catch(() => {});
  }, [id]);

  const breadcrumbMap = { Profile: 'Edit Profile', Journey: 'Student Journey', Academics: 'Academics', Fees: 'Fees', Attendance: 'Attendance', Documents: 'Documents' };

  return (
    <Layout>
      <div className="text-[14px] mb-4 flex flex-wrap items-center">
        <span className="text-[#4F46E5] cursor-pointer hover:underline" onClick={() => navigate('/students/view')}>View Students</span>
        <span className="text-[#c0c0c0] mx-2">&gt;</span>
        <span className="text-[#4F46E5] cursor-pointer">Student Profile</span>
        <span className="text-[#c0c0c0] mx-2">&gt;</span>
        <span className="text-[#888]">{breadcrumbMap[tab]}</span>
      </div>

      <div className="border-b border-gray-200 mb-6 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="flex w-max items-center gap-6 sm:gap-8">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative shrink-0 whitespace-nowrap pb-3 text-[14px] transition-colors ${tab === t ? 'text-[#1a1a1a] font-semibold' : 'text-[#9a9a9a] hover:text-[#555]'}`}>
              {t}
              {tab === t && <span className="absolute left-0 -bottom-px h-0.5 w-full bg-[#4F46E5] rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {!detail ? (
        <div className="flex items-center justify-center py-24 text-[#999]"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          {tab === 'Profile' && <ProfileEditTab detail={detail} />}
          {tab === 'Journey' && <JourneyTab studentId={id} student={detail.student} />}
          {tab === 'Fees' && <FeesTab detail={detail} />}
          {tab === 'Academics' && <AcademicsTab detail={detail} />}
          {tab === 'Attendance' && <AttendanceTab detail={detail} />}
          {tab === 'Documents' && <DocumentsTab detail={detail} />}
        </>
      )}
    </Layout>
  );
};

export default StudentProfile;
