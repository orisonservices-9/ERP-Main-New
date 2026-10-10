import React from 'react';
import StudentCard from '../../components/StudentCard';
import { Download, Award, TrendingUp, CalendarDays } from 'lucide-react';

const AcademicsTab = ({ detail }) => {
  const grades = detail.marks || [];
  const gpa = detail.gpa;
  const standing = detail.standing;
  const max = 100;
  const fallbackMonth = React.useMemo(() => ({
    key: 'latest', label: 'Latest assessment',
    subjects: grades.map((grade) => ({ subject: grade.subject, score: Number(grade.total) || 0 })),
  }), [grades]);
  const performanceMonths = detail.performance_months?.length ? detail.performance_months : [fallbackMonth];
  const [selectedMonth, setSelectedMonth] = React.useState(performanceMonths[0]?.key || 'latest');
  React.useEffect(() => {
    if (!performanceMonths.some((month) => month.key === selectedMonth)) {
      setSelectedMonth(performanceMonths[0]?.key || 'latest');
    }
  }, [performanceMonths, selectedMonth]);
  const selectedPerformance = performanceMonths.find((month) => month.key === selectedMonth) || performanceMonths[0];
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
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a]">Subject Wise Performance Trend</h3><p className="mt-1 text-[11px] text-[#999]">Compare every subject for the selected previous month.</p></div>
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-[#fafafa] px-3 py-2 text-[11px] font-medium text-[#555]"><CalendarDays className="h-4 w-4 text-[#4F46E5]" /><span>Month</span><select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="bg-transparent font-semibold text-[#333] outline-none">{performanceMonths.map((month) => <option key={month.key} value={month.key}>{month.label}</option>)}</select></label>
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="flex h-52 min-w-[640px] items-end justify-between gap-4 border-b border-gray-100 px-2">
                {(selectedPerformance?.subjects || []).map((item) => {
                  const score = item.score == null ? null : Math.max(0, Math.min(max, Number(item.score)));
                  return <div key={item.subject} className="flex min-w-[64px] flex-1 flex-col items-center gap-2"><span className={`text-[11px] font-semibold ${score == null ? 'text-[#aaa]' : 'text-[#555]'}`}>{score == null ? 'No marks' : `${score}%`}</span><div className="flex h-[150px] w-full items-end rounded-t-lg bg-indigo-50/70"><div className={`w-full rounded-t-lg ${score == null ? 'bg-gray-200' : score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ height: `${score == null ? 4 : Math.max(6, (score / max) * 150)}px` }} /></div><span title={item.subject} className="w-full truncate text-center text-[10px] font-medium text-[#777]">{item.subject}</span></div>;
                })}
              </div>
            </div>
            {!(selectedPerformance?.subjects || []).length && <div className="flex h-40 items-center justify-center rounded-xl bg-gray-50 text-[12px] text-[#999]">No subject marks are available for this month.</div>}
          </div>
        </div>
        <div className="space-y-6 self-start">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-poppins text-[15px] font-bold text-[#1a1a1a] mb-4">GPA Summary</h3>
            <div className="rounded-xl bg-[#fcf3ec] py-5 text-center mb-5"><p className="text-[36px] font-poppins font-extrabold text-[#4F46E5]">{gpa.cgpa}</p><p className="text-[12px] text-[#a07a6a]">Cumulative GPA (CGPA)</p></div>
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
