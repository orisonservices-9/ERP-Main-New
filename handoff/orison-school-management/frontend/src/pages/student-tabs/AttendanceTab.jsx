import React from 'react';
import StudentCard from '../../components/StudentCard';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const cellStyle = (status) => {
  switch (status) {
    case 'present': return 'bg-[#eef6ef] text-[#4a5a4b]';
    case 'absent': return 'bg-[#fbecec] text-[#8a5a5a]';
    case 'late': return 'bg-[#f7f0d8] text-[#7a6a3a]';
    case 'weekend': return 'bg-[#eef0f2] text-[#9aa0a6]';
    default: return 'bg-transparent text-transparent';
  }
};

const Legend = ({ color, label }) => (
  <span className="flex items-center gap-1.5 text-[11px] text-[#888]"><span className={`w-2 h-2 rounded-full ${color}`} /> {label}</span>
);

const AttendanceTab = ({ detail }) => {
  const att = detail.attendance;
  const st = att.stats;
  return (
    <div className="space-y-6">
      <StudentCard student={detail.student} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a]">{att.month}</h3>
            <div className="flex items-center gap-4"><Legend color="bg-green-400" label="Present" /><Legend color="bg-red-400" label="Absent" /><Legend color="bg-yellow-400" label="Late" /></div>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-2">{DOW.map((d) => <div key={d} className="text-center text-[11px] text-[#a0a0a0] font-medium">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-2">
            {att.days.map((c, i) => (
              <div key={i} className={`h-12 rounded-lg flex items-center justify-center text-[12px] font-medium ${cellStyle(c.status)}`}>{c.day || ''}</div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-poppins text-[15px] font-bold text-[#1a1a1a] mb-4">Attendance Statistics</h3>
          <div className="rounded-xl bg-[#eef6ef] py-5 text-center mb-5">
            <p className="text-[34px] font-poppins font-extrabold text-[#2f6b34]">{st.rate}</p>
            <p className="text-[12px] text-[#6a7a6b]">Overall Attendance Rate</p>
          </div>
          <div className="space-y-3">
            {[['Total Working Days', st.totalWorking], ['Total Present Days', st.totalPresent], ['Late Arrivals', st.lateArrivals], ['Absent Days', st.absentDays]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-[13px] pb-2 border-b border-gray-50 last:border-0"><span className="text-[#888]">{k}</span><span className="font-semibold text-[#333]">{v}</span></div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a] mb-4">Recent Attendance Logs</h3>
        <table className="w-full">
          <thead><tr className="text-[11px] uppercase tracking-wide text-[#a0a0a0] border-b border-gray-100"><th className="py-2.5 text-left font-medium">Date</th><th className="py-2.5 text-center font-medium">Status</th><th className="py-2.5 text-center font-medium">Check-In</th><th className="py-2.5 text-center font-medium">Check-Out</th></tr></thead>
          <tbody>
            {att.logs.map((l, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                <td className="py-3 text-[13px] text-[#444]">{l.date}</td>
                <td className="py-3 text-center"><span className={`text-[12px] font-medium ${l.status === 'Present' ? 'text-green-600' : 'text-red-500'}`}>{l.status}</span></td>
                <td className="py-3 text-center text-[13px] text-[#666]">{l.in}</td>
                <td className="py-3 text-center text-[13px] text-[#666]">{l.out}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceTab;
