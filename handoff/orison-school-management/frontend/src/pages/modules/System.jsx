import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, Field } from '../../components/Shared';
import { BRANCHES } from '../../mock2';
import { Building2, Users, Briefcase, MapPin, Plus, BrainCircuit, TrendingUp, TrendingDown, AlertTriangle, Sparkles, User, Bell, Shield, CreditCard } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../api';

export const MultiBranch = () => (
  <Layout>
    <PageTitle title="Multi Branch Management" subtitle="Oversee all Orison campuses from one place."
      actions={<Btn icon={Plus}>Add Branch</Btn>} />
    <StatCards items={[
      { label: 'Total Branches', value: '4', icon: Building2 },
      { label: 'Total Students', value: '3,179', icon: Users, tint: 'bg-blue-50 text-blue-600' },
      { label: 'Total Staff', value: '238', icon: Briefcase, tint: 'bg-green-50 text-green-600' },
      { label: 'Cities', value: '4', icon: MapPin, tint: 'bg-amber-50 text-amber-600' },
    ]} />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {BRANCHES.map((b) => (
        <Card key={b.name} pad="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center"><Building2 className="w-5 h-5 text-[#C4141B]" /></span>
              <div>
                <h3 className="font-poppins text-[15px] font-bold text-[#1a1a1a]">{b.name}</h3>
                <p className="text-[12px] text-[#888] flex items-center gap-1"><MapPin className="w-3 h-3" />{b.city}</p>
              </div>
            </div>
            <Badge color={b.status==='Active'?'green':'amber'}>{b.status}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl bg-[#fafafa] p-3"><p className="text-[18px] font-poppins font-bold text-[#1a1a1a]">{b.students}</p><p className="text-[11px] text-[#888]">Students</p></div>
            <div className="rounded-xl bg-[#fafafa] p-3"><p className="text-[18px] font-poppins font-bold text-[#1a1a1a]">{b.staff}</p><p className="text-[11px] text-[#888]">Staff</p></div>
          </div>
        </Card>
      ))}
    </div>
  </Layout>
);

export const AIAnalytics = () => {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/analytics/ai').then(({ data }) => setData(data)).catch(() => {}); }, []);
  const insights = [
    { icon: TrendingUp, tint: 'bg-green-50 text-green-600', title: 'Attendance improving', body: 'Overall attendance rose 4.2% this month, led by Grade 11-B.' },
    { icon: AlertTriangle, tint: 'bg-amber-50 text-amber-600', title: 'At-risk students', body: '18 students show a declining score trend across 3 subjects.' },
    { icon: TrendingDown, tint: 'bg-red-50 text-[#C4141B]', title: 'Fee collection dip', body: 'Transport fee collection is 12% below target this quarter.' },
    { icon: Sparkles, tint: 'bg-blue-50 text-blue-600', title: 'Top performing subject', body: 'Computer Science leads with an 88% average score.' },
  ];
  const k = data?.kpis;
  const PIE = ['#22c55e', '#f59e0b', '#C4141B'];
  return (
    <Layout>
      <PageTitle title="AI Analytics" subtitle="Smart insights and predictions for your school."
        actions={<Btn icon={BrainCircuit}>Generate Report</Btn>} />
      <StatCards items={[
        { label: 'Predicted Pass Rate', value: k ? `${k.pass_rate}%` : '—', icon: TrendingUp, tint: 'bg-green-50 text-green-600' },
        { label: 'At-Risk Students', value: k ? k.at_risk : '—', icon: AlertTriangle, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Engagement Score', value: k ? `${k.engagement}/10` : '—', icon: Sparkles, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Forecast Revenue', value: k ? k.forecast_revenue : '—', icon: BrainCircuit, tint: 'bg-purple-50 text-purple-600' },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card title="Performance Trend" subtitle="Term-wise average score" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data?.performance_trend || []} margin={{ left: -20, right: 10, top: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="term" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <YAxis domain={[70, 90]} tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
              <Line type="monotone" dataKey="avg" stroke="#C4141B" strokeWidth={2.5} dot={{ r: 4, fill: '#C4141B' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Student Risk Distribution">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data?.risk_distribution || []} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                {(data?.risk_distribution || []).map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {(data?.risk_distribution || []).map((e, i) => (
              <span key={i} className="flex items-center gap-1.5 text-[11px] text-[#888]"><span className="w-2 h-2 rounded-full" style={{ background: PIE[i % PIE.length] }} /> {e.name}</span>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Subject-wise Average Scores" className="mb-6">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data?.subject_scores || []} margin={{ left: -10, right: 10, top: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="subject" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }} />
            <Bar dataKey="score" fill="#C4141B" radius={[6, 6, 0, 0]} barSize={34} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="AI-Generated Insights" subtitle="Updated just now">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((it, i) => {
            const Icon = it.icon;
            return (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-100 p-4 hover:bg-[#fafafa] transition">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${it.tint}`}><Icon className="w-5 h-5" /></span>
                <div><p className="text-[14px] font-semibold text-[#1a1a1a]">{it.title}</p><p className="text-[13px] text-[#666] mt-0.5">{it.body}</p></div>
              </div>
            );
          })}
        </div>
      </Card>
    </Layout>
  );
};

export const SettingsPage = () => {
  const [tab, setTab] = useState('Profile');
  const tabs = [{ k: 'Profile', icon: User }, { k: 'Notifications', icon: Bell }, { k: 'Security', icon: Shield }, { k: 'Billing', icon: CreditCard }];
  const [toggles, setToggles] = useState({ email: true, sms: false, push: true, twofa: true });
  const t = (k) => setToggles((s) => ({ ...s, [k]: !s[k] }));
  const Toggle = ({ on, onClick }) => (
    <button onClick={onClick} className={`w-11 h-6 rounded-full transition relative ${on ? 'bg-[#C4141B]' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
  return (
    <Layout>
      <PageTitle title="Settings" subtitle="Manage your account and preferences." />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card pad="p-3" className="self-start">
          {tabs.map((x) => {
            const Icon = x.icon;
            return (
              <button key={x.k} onClick={() => setTab(x.k)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition ${tab===x.k?'bg-red-50 text-[#C4141B]':'text-[#555] hover:bg-gray-50'}`}>
                <Icon className="w-4 h-4" /> {x.k}
              </button>
            );
          })}
        </Card>
        <div className="lg:col-span-3">
          {tab === 'Profile' && (
            <Card title="Profile Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Full Name" value="School Administrator" />
                <Field label="Email" value="admin@orison.edu" />
                <Field label="Phone" value="+91 98765 00000" />
                <Field label="Role" value="Admin" select options={['Principal','Fee Manager']} />
              </div>
              <div className="flex justify-end mt-6"><Btn>Save Changes</Btn></div>
            </Card>
          )}
          {tab === 'Notifications' && (
            <Card title="Notification Preferences">
              {[['email','Email notifications'],['sms','SMS alerts'],['push','Push notifications']].map(([k,label]) => (
                <div key={k} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <span className="text-[13px] text-[#333]">{label}</span><Toggle on={toggles[k]} onClick={() => t(k)} />
                </div>
              ))}
            </Card>
          )}
          {tab === 'Security' && (
            <Card title="Security">
              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <div><p className="text-[13px] font-medium text-[#333]">Two-Factor Authentication</p><p className="text-[12px] text-[#888]">Add an extra layer of security.</p></div>
                <Toggle on={toggles.twofa} onClick={() => t('twofa')} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                <Field label="New Password" type="password" placeholder="••••••••" />
                <Field label="Confirm Password" type="password" placeholder="••••••••" />
              </div>
              <div className="flex justify-end mt-6"><Btn>Update Password</Btn></div>
            </Card>
          )}
          {tab === 'Billing' && (
            <Card title="Billing & Plan">
              <div className="rounded-xl bg-[#fcf3ec] p-5 flex items-center justify-between">
                <div><p className="text-[14px] font-semibold text-[#1a1a1a]">Enterprise Plan</p><p className="text-[12px] text-[#a07a6a]">Unlimited students • All modules</p></div>
                <p className="text-[20px] font-poppins font-bold text-[#C4141B]">₹24,999<span className="text-[12px] font-normal">/mo</span></p>
              </div>
              <div className="flex justify-end mt-6"><Btn variant="outline">Manage Subscription</Btn></div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};
