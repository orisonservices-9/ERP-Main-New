import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Users, Wallet, CalendarCheck, GraduationCap, ArrowUpRight, TrendingUp, AlertTriangle, Receipt, Award, Percent, RefreshCw } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const fmtL = (n) => `₹${(n / 100000).toFixed(1)}L`;
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const PIE = ['#C4141B', '#f59e0b', '#3b82f6'];

const useAnalytics = (url) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setLoading(true); setError(false);
    api.get(url)
      .then(({ data }) => { setData(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [url]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
};

const StatSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
    <div className="w-11 h-11 rounded-xl bg-gray-100" />
    <div className="h-7 w-24 bg-gray-100 rounded mt-4" />
    <div className="h-3 w-20 bg-gray-100 rounded mt-2.5" />
  </div>
);

const StatGrid = ({ items, loading }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
    {loading
      ? [0, 1, 2, 3].map((i) => <StatSkeleton key={i} />)
      : items.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.tint}`}><Icon className="w-5 h-5" /></span>
                {s.delta && <span className="flex items-center gap-1 text-[12px] font-semibold text-green-600"><TrendingUp className="w-3.5 h-3.5" /> {s.delta}</span>}
              </div>
              <p className="text-[26px] font-poppins font-bold text-[#1a1a1a] mt-4">{s.value}</p>
              <p className="text-[13px] text-[#8a8a8a]">{s.label}</p>
            </div>
          );
        })}
  </div>
);

const ErrorState = ({ onRetry }) => (
  <div data-testid="dashboard-error" className="bg-white rounded-2xl border border-red-100 shadow-sm p-12 text-center">
    <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-7 h-7 text-[#C4141B]" /></div>
    <p className="text-[15px] font-semibold text-[#1a1a1a]">Couldn't load dashboard data</p>
    <p className="text-[13px] text-[#8a8a8a] mt-1">Please check your connection and try again.</p>
    <button onClick={onRetry} data-testid="dashboard-retry-btn" className="mt-5 inline-flex items-center gap-2 bg-[#C4141B] hover:bg-[#a91116] text-white text-[13px] font-medium rounded-lg px-5 py-2.5">
      <RefreshCw className="w-4 h-4" /> Retry
    </button>
  </div>
);

const ChartCard = ({ title, loading, empty, emptyText, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
    <h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a] mb-4">{title}</h3>
    {loading ? (
      <div className="h-[220px] rounded-xl bg-gray-50 animate-pulse" />
    ) : empty ? (
      <div className="h-[220px] flex items-center justify-center text-[13px] text-[#999]">{emptyText || 'No data yet.'}</div>
    ) : children}
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAnalytics('/analytics/dashboard');
  const quick = [
    { label: 'Add Student', path: '/students/add' }, { label: 'Create Exam', path: '/exams/create' },
    { label: 'Add Marks', path: '/marks/add' }, { label: 'Leave Requests', path: '/leave/requests' },
    { label: 'Student Profile', path: '/students/view' },
  ];
  if (error) return <ErrorState onRetry={reload} />;
  return (
    <>
      <StatGrid loading={loading} items={data ? [
        { label: 'Total Students', value: data.stats.students.toLocaleString(), delta: '+4.2%', icon: Users, tint: 'bg-red-50 text-[#E01E26]' },
        { label: 'Fees Collected', value: fmtL(data.stats.fees_collected), delta: '+8.1%', icon: Wallet, tint: 'bg-green-50 text-green-600' },
        { label: 'Attendance Today', value: `${data.stats.attendance}%`, delta: '+1.3%', icon: CalendarCheck, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Active Teachers', value: data.stats.teachers, delta: '+2', icon: GraduationCap, tint: 'bg-amber-50 text-amber-600' },
      ] : []} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
        <ChartCard title="Attendance Trend" loading={loading} empty={!!data && !data.attendance_trend?.length}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data?.attendance_trend || []} margin={{ left: -20, right: 10, top: 5 }}>
              <defs><linearGradient id="att" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C4141B" stopOpacity={0.25} /><stop offset="100%" stopColor="#C4141B" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 100]} tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
              <Area type="monotone" dataKey="rate" stroke="#C4141B" strokeWidth={2.5} fill="url(#att)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Fee Collection (Monthly)" loading={loading} empty={!!data && !data.fees_trend?.length}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.fees_trend || []} margin={{ left: -10, right: 10, top: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v / 100000}L`} tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtL(v)} contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
              <Bar dataKey="amount" fill="#C4141B" radius={[6, 6, 0, 0]} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6">
        <h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a] mb-4">Quick Access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {quick.map((q) => (
            <button key={q.path} onClick={() => navigate(q.path)} className="group flex items-center justify-between rounded-xl border border-gray-100 bg-[#fafafa] hover:bg-red-50 hover:border-red-100 px-4 py-4 text-left transition">
              <span className="text-[13px] font-medium text-[#333] group-hover:text-[#C4141B]">{q.label}</span>
              <ArrowUpRight className="w-4 h-4 text-[#bbb] group-hover:text-[#E01E26]" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

const FeeDashboard = () => {
  const { data, loading, error, reload } = useAnalytics('/analytics/fee');
  if (error) return <ErrorState onRetry={reload} />;
  return (
    <>
      <StatGrid loading={loading} items={data ? [
        { label: 'Total Collected', value: fmtL(data.stats.collected), delta: '+8.1%', icon: Wallet, tint: 'bg-green-50 text-green-600' },
        { label: 'Pending Dues', value: fmt(data.stats.pending), icon: AlertTriangle, tint: 'bg-red-50 text-[#C4141B]' },
        { label: 'Total Billed', value: fmtL(data.stats.total), icon: TrendingUp, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Invoices', value: data.stats.invoices, icon: Receipt, tint: 'bg-amber-50 text-amber-600' },
      ] : []} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        <ChartCard title="Monthly Collections" loading={loading} empty={!!data && !data.monthly?.length}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data?.monthly || []} margin={{ left: -10, right: 10, top: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v / 100000}L`} tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtL(v)} contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
              <Bar dataKey="amount" fill="#C4141B" radius={[6, 6, 0, 0]} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Payment Method Split" loading={loading} empty={!!data && !data.method_split?.length}>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={data?.method_split || []} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                {(data?.method_split || []).map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-1">
            {(data?.method_split || []).map((e, i) => <span key={i} className="flex items-center gap-1.5 text-[11px] text-[#888]"><span className="w-2 h-2 rounded-full" style={{ background: PIE[i % PIE.length] }} /> {e.name}</span>)}
          </div>
        </ChartCard>
        <ChartCard title="Top Outstanding Dues" loading={loading} empty={!!data && !data.top_dues?.length} emptyText="No pending dues 🎉">
          <div className="space-y-3">
            {(data?.top_dues || []).map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3"><img src={d.avatar} alt="" className="w-8 h-8 rounded-full object-cover" /><span className="text-[13px] font-medium text-[#333]">{d.name}</span></div>
                <span className="text-[13px] font-bold text-[#C4141B]">{fmt(d.due)}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </>
  );
};

const PrincipalDashboard = () => {
  const { data, loading, error, reload } = useAnalytics('/analytics/academic');
  if (error) return <ErrorState onRetry={reload} />;
  return (
    <>
      <StatGrid loading={loading} items={data ? [
        { label: 'Pass Rate', value: `${data.stats.pass_rate}%`, delta: '+1.2%', icon: Award, tint: 'bg-green-50 text-green-600' },
        { label: 'Class Average', value: `${data.stats.avg}%`, icon: Percent, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Attendance', value: `${data.stats.attendance}%`, delta: '+1.3%', icon: CalendarCheck, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Students', value: data.stats.students, icon: Users, tint: 'bg-red-50 text-[#E01E26]' },
      ] : []} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
        <ChartCard title="Attendance Trend" loading={loading} empty={!!data && !data.attendance_trend?.length}>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={data?.attendance_trend || []} margin={{ left: -20, right: 10, top: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 100]} tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
              <Line type="monotone" dataKey="rate" stroke="#C4141B" strokeWidth={2.5} dot={{ r: 4, fill: '#C4141B' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Subject-wise Scores" loading={loading} empty={!!data && !data.subject_scores?.length}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data?.subject_scores || []} margin={{ left: -10, right: 10, top: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="subject" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
              <Bar dataKey="score" fill="#C4141B" radius={[6, 6, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6">
        <h3 className="font-poppins text-[16px] font-bold text-[#1a1a1a] mb-4">Top Performers</h3>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-50 animate-pulse" />)}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {(data?.results_top || []).map((r, i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-[#fafafa] p-4 text-center">
                <p className="text-[11px] text-[#a0a0a0]">Rank #{r.rank}</p>
                <p className="text-[13px] font-semibold text-[#1a1a1a] mt-1 truncate">{r.name}</p>
                <p className="text-[16px] font-poppins font-bold text-[#C4141B] mt-1">{r.percent}%</p>
              </div>
            ))}
            {(!data || !data.results_top?.length) && <p className="text-[13px] text-[#999] col-span-5 text-center py-4">No results published yet.</p>}
          </div>
        )}
      </div>
    </>
  );
};

const Dashboard = () => {
  const { auth } = useAuth();
  const role = auth?.role;
  return (
    <Layout>
      {role === 'fee_manager' ? <FeeDashboard /> : role === 'principal' ? <PrincipalDashboard /> : <AdminDashboard />}
    </Layout>
  );
};

export default Dashboard;
