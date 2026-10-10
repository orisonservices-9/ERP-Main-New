import React from 'react';
import StudentCard from '../../components/StudentCard';
import { Download, Award, TrendingUp } from 'lucide-react';

const AcademicsTab = ({ detail }) => {
  const grades = detail.marks || [];
  const gpa = detail.gpa;
  const standing = detail.standing;
  const max = 100;
  return (
    <div className="space-y-6">
      <StudentCard student={detail.student} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a]">Grade Sheet — Term 1</h3>
              <button className="flex items-center gap-2 text-[12px] text-[#555] border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"><Download className="w-3.5 h-3.5" /> Export Report Card</button>
            </div>
            <table className="w-full">
              <thead><tr className="text-[11px] text-[#a0a0a0] border-b border-gray-100"><th className="py-2.5 text-left font-medium">Subject</th><th className="py-2.5 text-center font-medium">Internal (30)</th><th className="py-2.5 text-center font-medium">External (70)</th><th className="py-2.5 text-center font-medium">Total (100)</th><th className="py-2.5 text-center font-medium">Grade</th></tr></thead>
              <tbody>
                {grades.map((g, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 text-[13px] font-medium text-[#333]">{g.subject}</td>
                    <td className="py-3 text-center text-[13px] text-[#666]">{g.internal}</td>
                    <td className="py-3 text-center text-[13px] text-[#666]">{g.external}</td>
                    <td className="py-3 text-center text-[13px] font-bold text-[#1a1a1a]">{g.total}</td>
                    <td className="py-3 text-center"><span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-600">{g.grade}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a] mb-5">Subject Wise Performance Trend</h3>
            <div className="flex items-end justify-between gap-4 h-48">
              {grades.map((g, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[11px] font-semibold text-[#666]">{g.total}%</span>
                  <div className="w-full rounded-t-md bg-[#C4141B]" style={{ height: `${(g.total / max) * 150}px` }} />
                  <span className="text-[10px] text-[#999] text-center leading-tight truncate w-full">{g.subject}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-6 self-start">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-poppins text-[15px] font-bold text-[#1a1a1a] mb-4">GPA Summary</h3>
            <div className="rounded-xl bg-[#fcf3ec] py-5 text-center mb-5"><p className="text-[36px] font-poppins font-extrabold text-[#C4141B]">{gpa.cgpa}</p><p className="text-[12px] text-[#a07a6a]">Cumulative GPA (CGPA)</p></div>
            <div className="space-y-3 text-[13px]">
              {[['Overall Grade', gpa.grade], ['Total Credits Earned', gpa.credits], ['Academic Standing', gpa.standing]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between pb-2 border-b border-gray-50 last:border-0"><span className="text-[#888]">{k}</span><span className="font-semibold text-[#333] text-right">{v}</span></div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-poppins text-[15px] font-bold text-[#1a1a1a] mb-4">Class Standings</h3>
            <div className="flex items-center gap-3 mb-4"><span className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center"><Award className="w-5 h-5 text-amber-500" /></span><div><p className="text-[10px] uppercase tracking-wide text-[#a0a0a0]">Class Rank</p><p className="text-[15px] font-poppins font-bold text-[#1a1a1a]">{standing.rank}</p></div></div>
            <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-blue-500" /></span><div><p className="text-[10px] uppercase tracking-wide text-[#a0a0a0]">Percentile</p><p className="text-[15px] font-poppins font-bold text-[#1a1a1a]">{standing.percentile}</p></div></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcademicsTab;
