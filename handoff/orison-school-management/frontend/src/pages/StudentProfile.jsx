import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import AttendanceTab from './student-tabs/AttendanceTab';
import FeesTab from './student-tabs/FeesTab';
import AcademicsTab from './student-tabs/AcademicsTab';
import ProfileEditTab from './student-tabs/ProfileEditTab';
import DocumentsTab from './student-tabs/DocumentsTab';
import { Loader2 } from 'lucide-react';
import api from '../api';

const TABS = ['Profile', 'Fees', 'Academics', 'Attendance', 'Documents'];

const StudentProfile = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id') || 'EP-2024-0812';
  const [tab, setTab] = useState('Attendance');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setDetail(null);
    api.get(`/students/${id}/detail`).then(({ data }) => setDetail(data)).catch(() => {});
  }, [id]);

  const breadcrumbMap = { Profile: 'Edit Profile', Academics: 'Academics', Fees: 'Fees', Attendance: 'Attendance', Documents: 'Documents' };

  return (
    <Layout>
      <div className="text-[13px] mb-4">
        <span className="text-[#C4141B] cursor-pointer hover:underline" onClick={() => navigate('/students/view')}>View Students</span>
        <span className="text-[#c0c0c0] mx-2">&gt;</span>
        <span className="text-[#C4141B] cursor-pointer">Student Profile</span>
        <span className="text-[#c0c0c0] mx-2">&gt;</span>
        <span className="text-[#888]">{breadcrumbMap[tab]}</span>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <div className="flex items-center gap-8">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative pb-3 text-[14px] transition-colors ${tab === t ? 'text-[#1a1a1a] font-semibold' : 'text-[#9a9a9a] hover:text-[#555]'}`}>
              {t}
              {tab === t && <span className="absolute left-0 -bottom-px h-0.5 w-full bg-[#C4141B] rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {!detail ? (
        <div className="flex items-center justify-center py-24 text-[#999]"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          {tab === 'Profile' && <ProfileEditTab detail={detail} />}
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
