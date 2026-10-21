import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, BarChart3, Bell, BookOpenCheck, Boxes, Building2, Bus,
  CalendarCheck, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, Download, FileText, GraduationCap,
  IndianRupee, Mail, MapPin, MessageCircle, MessageSquare, Phone, Receipt, ScanFace,
  Send, Sparkles, UserCog, Users, WalletCards,
} from 'lucide-react';

const modules = [
  [GraduationCap, 'Student Management', 'Profiles, documents, promotion, transfers and complete student history.', 'bg-violet-50 text-violet-600'],
  [CalendarCheck, 'Attendance Management', 'Daily attendance, absence alerts and class-wise insights.', 'bg-emerald-50 text-emerald-600'],
  [WalletCards, 'Fee Management', 'Fee plans, invoices, receipts, concessions and payment tracking.', 'bg-orange-50 text-orange-600'],
  [FileText, 'Exams & Report Cards', 'Exam setup, marks, hall tickets, results and report cards.', 'bg-blue-50 text-blue-600'],
  [UserCog, 'Teachers & Staff', 'Staff records, allocation, workload and administration.', 'bg-rose-50 text-rose-600'],
  [ClipboardCheck, 'Homework Management', 'Assign, track, review and connect homework to student support.', 'bg-indigo-50 text-indigo-600'],
  [Clock3, 'Timetable Management', 'Create timetables and prevent staff or room conflicts.', 'bg-cyan-50 text-cyan-600'],
  [MessageSquare, 'Parent Communication', 'Notices, reminders and timely WhatsApp updates for families.', 'bg-pink-50 text-pink-600'],
  [Receipt, 'Expenses & Accounts', 'Record expenses, approvals and financial activity.', 'bg-amber-50 text-amber-600'],
  [BarChart3, 'Reports & Analytics', 'Clear, downloadable reports for faster decisions.', 'bg-fuchsia-50 text-fuchsia-600'],
  [Building2, 'Multi-Branch Control', 'Manage campuses separately with one leadership view.', 'bg-sky-50 text-sky-600'],
  [Bell, 'Alerts & Reminders', 'Bring overdue work and follow-ups to the right person.', 'bg-red-50 text-red-600'],
];

const MiniWindow = ({ tone = 'violet', icon: Icon, title, children }) => {
  const tones = {
    violet: 'from-violet-100 via-white to-fuchsia-50 text-violet-600',
    blue: 'from-blue-100 via-white to-cyan-50 text-blue-600',
    orange: 'from-orange-100 via-white to-amber-50 text-orange-600',
    green: 'from-emerald-100 via-white to-teal-50 text-emerald-600',
    rose: 'from-rose-100 via-white to-orange-50 text-rose-600',
    indigo: 'from-indigo-100 via-white to-blue-50 text-indigo-600',
  };
  return (
    <div className={`relative mx-auto w-full max-w-[500px] overflow-hidden rounded-[38px] bg-gradient-to-br ${tones[tone]} p-7 shadow-[0_32px_80px_rgba(15,23,42,0.15)] sm:p-9`}>
      <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/70" />
      <div className="relative rounded-[26px] border border-white/90 bg-white/95 p-6 shadow-xl shadow-slate-200/60">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-current/10"><Icon size={24} /></span>
          <div><p className="text-sm font-bold text-slate-800">{title}</p><p className="mt-0.5 text-[10px] text-slate-400">Orison live workspace</p></div>
          <span className="ml-auto rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-bold text-emerald-600">LIVE</span>
        </div>
        <div className="pt-5">{children}</div>
      </div>
    </div>
  );
};

const Metric = ({ label, value, color = 'bg-violet-500' }) => (
  <div className="rounded-2xl bg-slate-50 p-4">
    <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold text-slate-500">{label}</span><b className="text-xs text-slate-800">{value}</b></div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full w-3/4 rounded-full ${color}`} /></div>
  </div>
);

const Feature = ({ eyebrow, title, copy, points, visual, reverse = false }) => (
  <section className="px-6 py-24 sm:px-10 lg:py-32">
    <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2 lg:gap-28">
      <div className={reverse ? 'lg:order-2' : ''}>
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#ef5a2f]">{eyebrow}</p>
        <h2 className="mt-5 font-poppins text-4xl font-bold leading-[1.06] tracking-[-0.045em] text-slate-950 sm:text-5xl">{title}</h2>
        <p className="mt-6 max-w-xl text-[15px] leading-7 text-slate-500">{copy}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {points.map(point => <div key={point} className="flex min-h-[54px] items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs font-semibold text-slate-700 shadow-sm"><CheckCircle2 size={17} className="shrink-0 text-emerald-500" />{point}</div>)}
        </div>
      </div>
      <div className={reverse ? 'lg:order-1' : ''}>{visual}</div>
    </div>
  </section>
);

const Landing = () => {
  const navigate = useNavigate();
  const [enquirySent, setEnquirySent] = useState(false);
  const goLogin = () => navigate('/login');
  const scrollTo = (id) => {
    const section = document.getElementById(id);
    if (section) window.scrollTo({ top: section.offsetTop - 82, behavior: 'smooth' });
  };
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[84px] max-w-7xl items-center justify-between px-6 sm:px-10">
          <button onClick={() => scrollTo('home')} aria-label="Orison home">
            <img src="/orison-logo.svg" alt="Orison Services Pvt. Ltd." className="h-[54px] w-auto object-contain sm:h-[60px]" />
          </button>
          <nav className="hidden items-center gap-10 md:flex">
            <button onClick={() => scrollTo('home')} className="text-xs font-semibold text-slate-600 hover:text-[#ef5a2f]">Home</button>
            <button onClick={() => scrollTo('features')} className="text-xs font-semibold text-slate-600 hover:text-[#ef5a2f]">Services</button>
            <button onClick={() => scrollTo('about')} className="text-xs font-semibold text-slate-600 hover:text-[#ef5a2f]">About us</button>
            <button onClick={() => scrollTo('contact')} className="text-xs font-semibold text-slate-600 hover:text-[#ef5a2f]">Contact</button>
          </nav>
          <button onClick={goLogin} className="rounded-xl bg-[#ef5a2f] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5">Login</button>
        </div>
      </header>

      <main>
        <section id="home" className="relative flex min-h-[640px] items-center justify-center overflow-hidden px-6 pb-32 pt-40 text-center">
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent via-orange-50/50 to-[#ffd99d]" />
          <div className="relative max-w-5xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ef5a2f]"><Sparkles size={14}/> Complete school operations platform</span>
            <h1 className="mt-9 font-poppins text-5xl font-bold leading-[1.02] tracking-[-0.055em] text-slate-950 sm:text-7xl">Empower Your School.</h1>
            <p className="mt-4 font-poppins text-2xl font-semibold tracking-[-0.04em] text-slate-400 sm:text-4xl">Simplified ERP for Modern Education.</p>
            <p className="mx-auto mt-7 max-w-2xl text-[15px] leading-7 text-slate-500">One connected platform for admissions, academics, collections, people and everyday school operations.</p>
            <a href="#features" className="mt-9 inline-flex items-center gap-2 rounded-full bg-slate-950 px-7 py-3.5 text-xs font-bold text-white shadow-xl">Explore Orison <ArrowRight size={15}/></a>
          </div>
        </section>

        <section id="features" className="bg-gradient-to-b from-[#ffd99d] via-[#ffab6d] to-[#f04e23] px-6 pb-28 pt-10 sm:px-10 lg:pb-36">
          <div className="mx-auto grid max-w-7xl items-end gap-16 lg:grid-cols-2 lg:gap-28">
            <div className="pb-6 text-slate-950">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-900/60">Admissions Management</p>
              <h2 className="mt-5 font-poppins text-4xl font-bold leading-[1.06] tracking-[-0.045em] sm:text-5xl">Welcome Every Family With a Better Admission Experience.</h2>
              <p className="mt-6 max-w-xl text-[15px] leading-7 text-orange-950/70">Centralise enquiries, automate follow-ups, organise applications and turn parent interest into confirmed admissions.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">{['Enquiry CRM','Counsellor follow-ups','WhatsApp updates','Conversion insights'].map(x => <span key={x} className="flex min-h-[52px] items-center rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-xs font-bold text-orange-950 shadow-sm">{x}</span>)}</div>
            </div>
            <MiniWindow icon={Users} title="Admission Pipeline">
              <div className="grid grid-cols-3 gap-3">{[['New','48'],['Follow-up','19'],['Admitted','12']].map(([a,b]) => <div key={a} className="rounded-2xl bg-slate-50 p-3 text-center"><b className="block text-lg text-slate-800">{b}</b><span className="text-[9px] text-slate-400">{a}</span></div>)}</div>
              <div className="mt-4 space-y-2.5">{['Aarav Sharma','Sara Fernandes','Riya Patel'].map((name,i) => <div key={name} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-[9px] font-bold text-violet-600">{name.split(' ').map(n=>n[0]).join('')}</span><span className="text-[10px] font-semibold text-slate-600">{name}</span><span className={`ml-auto rounded-full px-2.5 py-1 text-[8px] font-bold ${i===2?'bg-emerald-50 text-emerald-600':'bg-amber-50 text-amber-600'}`}>{i===2?'Admitted':'Follow-up'}</span></div>)}</div>
            </MiniWindow>
          </div>
        </section>

        <Feature reverse eyebrow="Academic Management" title="See Every Class. Support Every Student." copy="Connect curriculum, marks, attendance, homework and classroom participation so academic teams can identify concerns early and take measurable action." points={['Curriculum & syllabus','Academic health signals','Student support plans','Classroom observations']} visual={<MiniWindow tone="blue" icon={BookOpenCheck} title="Academic Action Center"><div className="grid grid-cols-2 gap-3"><Metric label="Academic health" value="83%" color="bg-blue-500"/><Metric label="Syllabus progress" value="76%" color="bg-violet-500"/></div><div className="mt-4 rounded-2xl bg-blue-50 p-4"><p className="text-[10px] font-bold text-blue-700">3 students need attention</p><p className="mt-1 text-[9px] text-blue-500">Staff and review dates are connected.</p></div></MiniWindow>} />
        <div className="bg-[#fffaf5]"><Feature eyebrow="Collection Intelligence" title="Know What Is Collected—and What Needs Attention." copy="Give management a live view of collections, pending dues and follow-up priorities without searching through lengthy reports." points={['Live collection overview','Pending-fee priorities','Payment verification','Downloadable reports']} visual={<MiniWindow tone="orange" icon={IndianRupee} title="Collection Intelligence"><p className="text-[10px] text-slate-400">Total collected</p><p className="mt-1 text-3xl font-black text-slate-900">₹12,45,000</p><div className="mt-5 space-y-3"><Metric label="Collected" value="82%" color="bg-emerald-500"/><Metric label="Pending" value="14%" color="bg-amber-500"/><Metric label="Overdue" value="4%" color="bg-rose-500"/></div></MiniWindow>} /></div>
        <Feature reverse eyebrow="Inventory & Stock" title="Keep Every School Asset Accounted For." copy="Monitor inventory, purchases, stock movement and item issue history from one organised workspace." points={['Live stock levels','Low-stock alerts','Issue & return history','Asset tracking']} visual={<MiniWindow tone="rose" icon={Boxes} title="Inventory Overview"><div className="grid grid-cols-2 gap-3">{[['Total items','1,248'],['Low stock','14'],['Issued today','36'],['Asset groups','18']].map(([a,b],i)=><div key={a} className="rounded-2xl bg-slate-50 p-4"><span className="text-[9px] text-slate-400">{a}</span><b className={`mt-1 block text-lg ${i===1?'text-rose-500':'text-slate-800'}`}>{b}</b></div>)}</div></MiniWindow>} />
        <div className="bg-[#f8fcfa]"><Feature eyebrow="Transport & Visitor Management" title="Safer Journeys. Better Campus Control." copy="Manage routes, vehicles and student assignments while maintaining a clear record of every campus visitor." points={['Routes & stops','Student transport assignment','Visitor entry & exit','Campus safety records']} visual={<MiniWindow tone="green" icon={Bus} title="School Operations"><div className="rounded-2xl bg-emerald-50 p-4"><div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white"><Bus size={22}/></span><div><p className="text-[11px] font-bold text-slate-800">Route 07 · On time</p><p className="mt-1 text-[9px] text-slate-400">28 students · 6 stops</p></div></div></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Vehicles active" value="12" color="bg-emerald-500"/><Metric label="Visitors today" value="18" color="bg-blue-500"/></div></MiniWindow>} /></div>
        <Feature reverse eyebrow="HR, Payroll & Biometric" title="Support Your People With Connected Workforce Management." copy="Bring employee records, biometric attendance, leave and payroll together for a more accurate HR process." points={['Employee records','Biometric attendance','Leave management','Payroll processing']} visual={<MiniWindow tone="indigo" icon={ScanFace} title="Workforce Today"><div className="flex items-center justify-between rounded-2xl bg-indigo-50 p-4"><div><p className="text-[10px] text-indigo-400">Present today</p><p className="mt-1 text-2xl font-black text-indigo-700">124</p></div><ScanFace size={46} className="text-indigo-300"/></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="On time" value="92%" color="bg-indigo-500"/><Metric label="Payroll ready" value="98%" color="bg-emerald-500"/></div></MiniWindow>} />

        <section id="about" className="overflow-hidden bg-[#fff6e7] px-6 py-24 sm:px-10 lg:py-32">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#ef5a2f]">About Orison</p>
              <h2 className="mt-5 font-poppins text-4xl font-bold leading-[1.06] tracking-[-0.045em] text-slate-950 sm:text-5xl">Built Around the Way a School Actually Works.</h2>
              <p className="mt-6 text-[15px] leading-7 text-slate-600">Orison brings admissions, learning, finance, people and campus operations into one connected school workspace. Every module is designed to reduce repetitive work, surface the next action and help school teams respond faster.</p>
              <button onClick={() => scrollTo('contact')} className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 text-xs font-bold text-white">Talk to our team <ArrowRight size={15}/></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['One connected record', 'Important student, parent, staff and financial information stays connected across departments.'],
                ['Less manual follow-up', 'Timely alerts help teams act on enquiries, dues, attendance and academic concerns.'],
                ['Clear for every role', 'Leadership sees the big picture while each team sees the work relevant to them.'],
                ['Made for daily use', 'Simple actions, clear dashboards and useful reports replace complicated data-heavy screens.'],
              ].map(([title, copy], index) => <div key={title} className={`rounded-[28px] border border-orange-100 bg-white p-7 shadow-[0_18px_45px_rgba(120,53,15,0.08)] ${index % 2 ? 'sm:translate-y-6' : ''}`}><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-sm font-black text-[#ef5a2f]">0{index + 1}</span><h3 className="mt-5 font-poppins text-lg font-bold text-slate-900">{title}</h3><p className="mt-3 text-[13px] leading-6 text-slate-500">{copy}</p></div>)}
            </div>
          </div>
        </section>

        <section className="bg-slate-50 px-6 py-24 sm:px-10 lg:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center"><p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#ef5a2f]">The complete Orison ecosystem</p><h2 className="mt-5 font-poppins text-4xl font-bold tracking-[-0.045em] text-slate-950 sm:text-5xl">Every Important School Operation, Connected.</h2><p className="mt-6 text-[15px] leading-7 text-slate-500">The major strengths are highlighted above. These connected modules complete the everyday work of your school.</p></div>
            <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {modules.map(([Icon,title,copy,tone]) => <article key={title} className="group rounded-[28px] border border-slate-200/80 bg-white p-7 shadow-[0_14px_40px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,23,42,0.11)]"><span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone}`}><Icon size={25}/></span><h3 className="mt-6 font-poppins text-xl font-bold tracking-[-0.025em] text-slate-900">{title}</h3><p className="mt-3 text-[13px] leading-6 text-slate-500">{copy}</p></article>)}
            </div>
          </div>
        </section>

        <section id="contact" className="bg-[#fff5df] px-6 py-24 sm:px-10 lg:py-32">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
            <div className="rounded-[32px] bg-[#f3e8cf] p-7 sm:p-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#ef5a2f]">Book an Orison walkthrough</p>
              <h2 className="mt-4 font-poppins text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">See How Orison Can Work for Your School.</h2>
              <p className="mt-4 text-[13px] leading-6 text-slate-600">Tell us a little about your school and the areas you want to improve. Our team can prepare a focused product walkthrough.</p>
              {enquirySent ? <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm font-semibold text-emerald-700">Thank you. Your enquiry has been recorded for the Orison team.</div> : <form className="mt-8 grid gap-5 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setEnquirySent(true); }}>
                <label className="text-xs font-semibold text-slate-700">Full name *<input required className="mt-2 h-13 w-full rounded-xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-[#ef5a2f]" placeholder="Enter your full name" /></label>
                <label className="text-xs font-semibold text-slate-700">School name *<input required className="mt-2 h-13 w-full rounded-xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-[#ef5a2f]" placeholder="Enter school name" /></label>
                <label className="text-xs font-semibold text-slate-700">Phone number *<input required className="mt-2 h-13 w-full rounded-xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-[#ef5a2f]" placeholder="Enter phone number" /></label>
                <label className="text-xs font-semibold text-slate-700">Email address<input type="email" className="mt-2 h-13 w-full rounded-xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-[#ef5a2f]" placeholder="Enter email address" /></label>
                <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Interested in<select className="mt-2 w-full rounded-xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-[#ef5a2f]"><option>Complete School ERP</option><option>Admissions Management</option><option>Academic Management</option><option>Collection Intelligence</option><option>Operations & Workforce</option></select></label>
                <label className="text-xs font-semibold text-slate-700 sm:col-span-2">What would you like to improve?<textarea className="mt-2 min-h-[120px] w-full rounded-xl border border-orange-100 bg-white p-4 text-sm outline-none focus:border-[#ef5a2f]" placeholder="Tell us about your school and requirements" /></label>
                <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ef5a2f] px-6 py-4 text-xs font-bold text-white sm:col-span-2">Request a consultation <Send size={15}/></button>
              </form>}
            </div>
            <div className="rounded-[32px] border border-[#eadfc8] bg-white p-7 shadow-[0_20px_60px_rgba(120,53,15,0.08)] sm:p-10">
              <h2 className="font-poppins text-4xl font-bold tracking-[-0.04em] text-[#04344c] sm:text-5xl">Get in Touch</h2>
              <div className="mt-10 rounded-[28px] bg-gradient-to-r from-[#f8f8f7] to-[#fffaf0] p-6 sm:p-8">
                <div className="space-y-8">
                  <div className="flex items-start gap-5"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f7f0e4] text-[#9a6818]"><MapPin size={27}/></span><div><p className="text-lg font-bold text-[#04344c]">Office Address</p><p className="mt-2 text-sm leading-6 text-[#476b80]">T-Hub Phase 2<br/>Hyderabad, Telangana - 500081</p></div></div>
                  <div className="flex items-start gap-5"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f7f0e4] text-[#9a6818]"><Mail size={27}/></span><div><p className="text-lg font-bold text-[#04344c]">Email Us</p><a href="mailto:Help@orisonservices.in" className="mt-2 block text-sm text-[#476b80] hover:text-[#ef5a2f]">Help@orisonservices.in</a></div></div>
                  <div className="flex items-start gap-5"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f7f0e4] text-[#9a6818]"><Phone size={27}/></span><div><p className="text-lg font-bold text-[#04344c]">Call Us</p><a href="tel:+919848331551" className="mt-2 block text-sm text-[#476b80] hover:text-[#ef5a2f]">+91 98483 31551</a><a href="tel:+919949458111" className="mt-1 block text-sm text-[#476b80] hover:text-[#ef5a2f]">+91 99494 58111</a></div></div>
                </div>
              </div>
              <div className="mt-7 space-y-4">
                <a href="https://wa.me/919848331551?text=Hello%20Orison%20Services%2C%20I%20would%20like%20to%20know%20more%20about%20Orison%20School%20ERP." target="_blank" rel="noreferrer" className="flex w-full items-center gap-4 rounded-xl bg-[#21cf68] px-6 py-5 text-base font-bold text-white transition hover:bg-[#18bb5b]"><MessageCircle size={23}/>Chat on WhatsApp</a>
                <a href="tel:+919848331551" className="flex w-full items-center gap-4 rounded-xl border border-[#f0dfba] bg-[#fff2d7] px-6 py-5 text-base font-bold text-[#98661b] transition hover:bg-[#fce8bd]"><CalendarDays size={22}/>Schedule a Call</a>
                <a href="/orison-school-erp-brochure.pdf" download className="flex w-full items-center gap-4 rounded-xl border border-[#f0dfba] bg-[#fff2d7] px-6 py-5 text-base font-bold text-[#98661b] transition hover:bg-[#fce8bd]"><Download size={22}/>Download Service Brochure</a>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-950 px-6 py-24 text-white sm:px-10">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_auto]">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-400">Built for schools that dream bigger</p><h2 className="mt-5 max-w-3xl font-poppins text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Let technology manage the process, so your school can focus on progress.</h2><p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">One dependable platform for leadership, teachers, administrators, parents and every child.</p></div>
            <button onClick={goLogin} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ef5a2f] px-8 py-4 text-xs font-bold text-white shadow-xl shadow-orange-950/30">Login to Orison <ArrowRight size={16}/></button>
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-800 bg-slate-950 px-6 pb-8 pt-16 text-white sm:px-10">
        <div className="mx-auto grid max-w-7xl gap-12 border-b border-white/10 pb-14 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="inline-flex rounded-2xl bg-white p-3"><img src="/orison-logo.svg" alt="Orison Services Pvt. Ltd." className="h-14 w-auto" /></div>
            <p className="mt-5 max-w-xs text-xs leading-6 text-slate-400">A connected school ERP built to simplify administration, strengthen decisions and support every child’s journey.</p>
          </div>
          <div><h3 className="text-sm font-bold">Main Solutions</h3><div className="mt-5 space-y-3 text-xs text-slate-400"><button onClick={() => scrollTo('features')} className="block hover:text-white">Admissions Management</button><button onClick={() => scrollTo('features')} className="block hover:text-white">Academic Management</button><button onClick={() => scrollTo('features')} className="block hover:text-white">Collection Intelligence</button><button onClick={() => scrollTo('features')} className="block hover:text-white">School Operations</button></div></div>
          <div><h3 className="text-sm font-bold">Platform</h3><div className="mt-5 space-y-3 text-xs text-slate-400"><button onClick={() => scrollTo('about')} className="block hover:text-white">About Orison</button><button onClick={() => scrollTo('contact')} className="block hover:text-white">Request a walkthrough</button><button onClick={() => scrollTo('contact')} className="block hover:text-white">Contact our team</button><button onClick={goLogin} className="block hover:text-white">School login</button></div></div>
          <div><h3 className="text-sm font-bold">Built for the Whole School</h3><p className="mt-5 text-xs leading-6 text-slate-400">Leadership • Administrators • Teachers • Accounts • HR • Transport teams • Parents</p><button onClick={() => scrollTo('contact')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#ef5a2f] px-5 py-3 text-xs font-bold">Talk to Orison <ArrowRight size={14}/></button></div>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-2 pt-7 text-center text-[10px] text-slate-500 sm:flex-row sm:justify-between sm:text-left"><span>© 2026 Orison Services Pvt. Ltd.</span><span>Empowering your vision. Strengthening your school.</span></div>
      </footer>
    </div>
  );
};

export default Landing;
