import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { AlertTriangle, CalendarDays, Check, CheckCircle2, Clock3, FileText, Loader2, Search, Sparkles, UserRoundCheck, UsersRound, X } from 'lucide-react';
import api from '../api';

const statusStyle = {
  Approved: 'bg-green-50 text-green-700',
  Rejected: 'bg-indigo-50 text-indigo-700',
  Pending: 'bg-amber-50 text-amber-700',
};

const initialForm = {
  person_type: 'Teacher', person_id: '', leave_type: 'Sick Leave', from_date: '', to_date: '', reason: '', attachment_name: '', attachment_url: '', attachment_type: '',
};

const readableError = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => item?.msg || 'Please check the entered information.').join(' ');
  return fallback;
};

const LeaveManagement = ({ mode = 'apply' }) => {
  const [leaves, setLeaves] = useState([]);
  const [people, setPeople] = useState({ Teacher: [], Staff: [] });
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [leaveRes, teacherRes, staffRes] = await Promise.all([
        api.get('/leaves'), api.get('/teachers'), api.get('/staff'),
      ]);
      setLeaves(Array.isArray(leaveRes.data) ? leaveRes.data : []);
      setPeople({
        Teacher: Array.isArray(teacherRes.data) ? teacherRes.data : [],
        Staff: Array.isArray(staffRes.data) ? staffRes.data : [],
      });
    } catch (error) {
      setNotice(readableError(error, 'Could not load leave information. Please make sure the backend is running.'));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const selectedPeople = people[form.person_type] || [];
  const updateForm = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => key === 'person_type'
      ? { ...current, person_type: value, person_id: '' }
      : { ...current, [key]: value });
  };

  const submit = async (event) => {
    event.preventDefault();
    setNotice('');
    if (!form.person_id || !form.from_date || !form.to_date || !form.reason.trim()) {
      setNotice('Select a person, choose both dates, and add a reason before submitting.');
      return;
    }
    if (form.to_date < form.from_date) { setNotice('The end date cannot be before the start date.'); return; }
    setSubmitting(true);
    try {
      await api.post('/leaves', form);
      setForm(initialForm);
      setNotice('Leave request created and sent for approval.');
      await load();
    } catch (error) {
      setNotice(readableError(error, 'Unable to create this leave request.'));
    } finally { setSubmitting(false); }
  };

  const review = async (id, status) => {
    try {
      await api.put(`/leaves/${id}/status`, null, { params: { status } });
      setNotice(`Leave request ${status.toLowerCase()}.`);
      await load();
      if (selectedLeave && selectedLeave.id === id) {
        setSelectedLeave((current) => (current ? { ...current, status } : current));
      }
    } catch (error) { setNotice(readableError(error, 'Unable to update this leave request.')); }
  };

  const handleAttachmentUpload = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      setUploadingAttachment(true);
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/leaves/attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((current) => ({
        ...current,
        attachment_name: data.name,
        attachment_url: data.url,
        attachment_type: data.content_type || 'application/octet-stream',
      }));
      setNotice('Attachment uploaded successfully.');
    } catch (error) {
      setNotice(readableError(error, 'Unable to upload the leave attachment.'));
    } finally {
      setUploadingAttachment(false);
      event.target.value = '';
    }
  };

  const adminLeaves = useMemo(() => leaves.filter((leave) => leave.person_type !== 'Student'), [leaves]);

  const filteredLeaves = useMemo(() => adminLeaves.filter((leave) => {
    const matchesRole = roleFilter === 'All' || leave.person_type === roleFilter;
    const matchesStatus = statusFilter === 'All' || leave.status === statusFilter;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [leave.name, leave.leave_type, leave.class_name, leave.section]
      .filter(Boolean).join(' ').toLowerCase().includes(term);
    return matchesRole && matchesStatus && matchesSearch;
  }), [adminLeaves, roleFilter, statusFilter, search]);

  const counts = {
    total: adminLeaves.length,
    pending: adminLeaves.filter((leave) => leave.status === 'Pending').length,
    approved: adminLeaves.filter((leave) => leave.status === 'Approved').length,
    rejected: adminLeaves.filter((leave) => leave.status === 'Rejected').length,
  };

  const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '—';

  const selectedLeaveDays = selectedLeave ? Number(selectedLeave.days || ((new Date(selectedLeave.to_date) - new Date(selectedLeave.from_date)) / 86400000 + 1)) : 0;
  const isApplyPage = mode === 'apply';
  const requestedDays = form.from_date && form.to_date && form.to_date >= form.from_date ? Math.round((new Date(form.to_date) - new Date(form.from_date)) / 86400000) + 1 : 0;
  const today = new Date().toISOString().slice(0, 10);
  const awayToday = adminLeaves.filter((leave) => leave.status === 'Approved' && leave.from_date <= today && leave.to_date >= today).length;

  return (
    <Layout>
      <div className="mb-6 overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-7 text-white shadow-[0_24px_60px_rgba(49,46,129,.24)]"><div className="flex flex-col justify-between gap-7 xl:flex-row xl:items-end"><div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-indigo-100"><Sparkles className="h-3.5 w-3.5"/>{isApplyPage?'Planned absence':'Approval control'}</span><h2 className="mt-4 font-poppins text-[28px] font-bold">{isApplyPage?'Create a complete leave request':'Make informed leave decisions'}</h2><p className="mt-2 max-w-xl text-[12px] leading-5 text-indigo-100/70">{isApplyPage?'Choose a real teacher or staff member, confirm the dates and attach supporting evidence when required.':'Review duration, reason, evidence and today’s staffing impact before approving or rejecting.'}</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(isApplyPage?[[CalendarDays,'Requested days',requestedDays||'—'],[UsersRound,'Teachers',people.Teacher.length],[UserRoundCheck,'Staff',people.Staff.length],[FileText,'Evidence',form.attachment_url?'Attached':'Optional']]:[[Clock3,'Pending',counts.pending],[CheckCircle2,'Approved',counts.approved],[AlertTriangle,'Away today',awayToday],[UsersRound,'Total requests',counts.total]]).map(([Icon,label,value])=><div key={label} className="min-w-[116px] rounded-2xl border border-white/10 bg-white/[.08] p-4"><Icon className="mb-3 h-4 w-4 text-indigo-200"/><p className="font-poppins text-[20px] font-bold">{value}</p><p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-indigo-100/55">{label}</p></div>)}</div></div></div>

      {notice && <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800"><span>{notice}</span><button onClick={() => setNotice('')}><X className="h-4 w-4" /></button></div>}

      <div className={isApplyPage ? 'mx-auto max-w-4xl' : 'grid grid-cols-1 gap-6'}>
        {isApplyPage && <form onSubmit={submit} className="overflow-hidden rounded-[26px] border border-white bg-white shadow-[0_16px_45px_rgba(15,23,42,.08)] ring-1 ring-slate-100">
          <div className="border-b border-gray-100 px-6 py-4"><h3 className="font-poppins text-[18px] font-semibold text-[#1a1a1a]">Create leave request</h3><p className="mt-1 text-[12px] text-[#909090]">Choose a person from the current school records.</p></div>
          <div className="grid gap-5 p-6 md:grid-cols-2">
            <div><label className="mb-1.5 block text-[12px] font-medium text-[#555]">Person type</label><select value={form.person_type} onChange={updateForm('person_type')} className="h-11 w-full rounded-lg border border-gray-200 bg-[#f8f8f9] px-3 text-[13px] text-[#444] outline-none focus:border-indigo-300"><option>Teacher</option><option>Staff</option></select></div>
            <div><label className="mb-1.5 block text-[12px] font-medium text-[#555]">Select person</label><select value={form.person_id} onChange={updateForm('person_id')} className="h-11 w-full rounded-lg border border-gray-200 bg-[#f8f8f9] px-3 text-[13px] text-[#444] outline-none focus:border-indigo-300"><option value="">Select {form.person_type.toLowerCase()}</option>{selectedPeople.map((person) => <option key={person.id} value={person.id}>{person.name || person.full_name}{person.class_name ? ` — ${person.class_name}${person.section ? ` / ${person.section}` : ''}` : ''}</option>)}</select></div>
            <div><label className="mb-1.5 block text-[12px] font-medium text-[#555]">Leave type</label><select value={form.leave_type} onChange={updateForm('leave_type')} className="h-11 w-full rounded-lg border border-gray-200 bg-[#f8f8f9] px-3 text-[13px] text-[#444] outline-none focus:border-indigo-300"><option>Sick Leave</option><option>Casual Leave</option><option>Medical Leave</option><option>Personal Leave</option><option>Annual Leave</option><option>Emergency Leave</option></select></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="mb-1.5 block text-[12px] font-medium text-[#555]">From date</label><input type="date" value={form.from_date} onChange={updateForm('from_date')} className="h-11 w-full rounded-lg border border-gray-200 bg-[#f8f8f9] px-3 text-[13px] text-[#444] outline-none focus:border-indigo-300" /></div><div><label className="mb-1.5 block text-[12px] font-medium text-[#555]">To date</label><input type="date" value={form.to_date} onChange={updateForm('to_date')} className="h-11 w-full rounded-lg border border-gray-200 bg-[#f8f8f9] px-3 text-[13px] text-[#444] outline-none focus:border-indigo-300" /></div></div>
            <div className="md:col-span-2"><label className="mb-1.5 block text-[12px] font-medium text-[#555]">Reason</label><textarea value={form.reason} onChange={updateForm('reason')} placeholder="Explain the leave request clearly for the approving officer" rows={4} className="w-full resize-none rounded-lg border border-gray-200 bg-[#f8f8f9] px-3 py-3 text-[13px] text-[#444] outline-none focus:border-indigo-300" /></div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-[12px] font-medium text-[#555]">Attachment (optional)</label>
              <label className="flex h-11 w-full cursor-pointer items-center justify-between rounded-lg border border-dashed border-gray-200 bg-[#f8f8f9] px-3 text-[13px] text-[#444]">
                <span className="truncate">{form.attachment_name || 'Upload image, PDF or document'}</span>
                <span className="ml-3 rounded bg-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700">Browse</span>
                <input type="file" accept="image/*,.pdf,.doc,.docx,.txt,.rtf,.odt" onChange={handleAttachmentUpload} className="hidden" />
              </label>
              {uploadingAttachment && <div className="mt-2 flex items-center gap-2 text-[12px] text-[#666]"><Loader2 className="h-4 w-4 animate-spin" />Uploading attachment...</div>}
            </div>
            <button disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-[13px] font-semibold text-white shadow-lg hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 md:col-span-2">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}Submit for approval</button>
          </div>
        </form>}

        {!isApplyPage && <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-gray-100 p-6 md:flex-row md:items-center md:justify-between"><div><h3 className="font-poppins text-[18px] font-semibold text-[#1a1a1a]">Leave requests</h3><p className="mt-1 text-[12px] text-[#909090]">Review pending requests or look up leave history.</p></div><button onClick={load} className="text-[13px] font-medium text-[#4F46E5]">Refresh</button></div>
          <div className="grid grid-cols-1 gap-3 border-b border-gray-100 bg-[#fcfcfc] p-4 md:grid-cols-[1fr_150px_150px]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search person, class or leave type" className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-[13px] outline-none focus:border-indigo-300" /></div><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-[#555] outline-none focus:border-indigo-300"><option value="All">All roles</option><option>Teacher</option><option>Staff</option></select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-[#555] outline-none focus:border-indigo-300"><option value="All">All statuses</option><option>Pending</option><option>Approved</option><option>Rejected</option></select></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[810px]"><thead><tr className="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wide text-[#999]"><th className="px-5 py-4">Person</th><th className="px-3 py-4">Type</th><th className="px-3 py-4">Dates</th><th className="px-3 py-4">Days</th><th className="px-3 py-4">Reason</th><th className="px-3 py-4">Status</th><th className="px-5 py-4 text-right">Action</th></tr></thead><tbody>
              {loading ? <tr><td colSpan="7" className="py-14 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#4F46E5]" /></td></tr> : filteredLeaves.length === 0 ? <tr><td colSpan="7" className="py-14 text-center text-[13px] text-[#999]">No leave requests match these filters.</td></tr> : filteredLeaves.map((leave) => <tr key={leave.id} className="border-b border-gray-50 last:border-0 align-top"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-[#4F46E5]">{initials(leave.name)}</span><div><p className="text-[13px] font-semibold text-[#333]">{leave.name}</p><p className="text-[11px] text-[#999]">{leave.person_type}{leave.class_name ? ` · ${leave.class_name}${leave.section ? ` / ${leave.section}` : ''}` : ''}</p></div></div></td><td className="px-3 py-4 text-[12px] text-[#555]">{leave.leave_type}</td><td className="px-3 py-4 text-[12px] text-[#555] whitespace-nowrap">{leave.from_date}<br />to {leave.to_date}</td><td className="px-3 py-4 text-[12px] text-[#555]">{leave.days || 1}</td><td className="max-w-[150px] px-3 py-4 text-[12px] leading-5 text-[#666]">{leave.reason}</td><td className="px-3 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[leave.status] || statusStyle.Pending}`}>{leave.status}</span></td><td className="px-5 py-4 text-right"><div className="inline-flex gap-2"><button type="button" onClick={() => setSelectedLeave(leave)} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50"><FileText className="h-4 w-4" /></button>{leave.status === 'Pending' && <div className="inline-flex gap-2"><button title="Reject" onClick={() => review(leave.id, 'Rejected')} className="rounded-lg border border-indigo-100 p-2 text-indigo-600 hover:bg-indigo-50"><X className="h-4 w-4" /></button><button title="Approve" onClick={() => review(leave.id, 'Approved')} className="rounded-lg bg-green-600 p-2 text-white hover:bg-green-700"><Check className="h-4 w-4" /></button></div>}</div></td></tr>)}</tbody></table>
          </div>
          <div className="flex items-center gap-2 px-5 py-4 text-[12px] text-[#999]"><Clock3 className="h-4 w-4" />Showing {filteredLeaves.length} leave request{filteredLeaves.length === 1 ? '' : 's'}</div>
        </div>}
      </div>

      {selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-poppins text-[22px] font-semibold text-[#1a1a1a]">Leave request details</h3>
                <p className="text-[12px] text-[#8a8a8a]">{selectedLeave.person_type} request</p>
              </div>
              <button type="button" onClick={() => setSelectedLeave(null)} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-4">
                <p className="text-[11px] uppercase tracking-wide text-[#999]">Name</p>
                <p className="mt-1 text-[15px] font-semibold text-[#333]">{selectedLeave.name}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-4">
                <p className="text-[11px] uppercase tracking-wide text-[#999]">Role</p>
                <p className="mt-1 text-[15px] font-semibold text-[#333]">{selectedLeave.person_type}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-4">
                <p className="text-[11px] uppercase tracking-wide text-[#999]">Leave type</p>
                <p className="mt-1 text-[15px] font-semibold text-[#333]">{selectedLeave.leave_type}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-4">
                <p className="text-[11px] uppercase tracking-wide text-[#999]">Total days</p>
                <p className="mt-1 text-[15px] font-semibold text-[#333]">{selectedLeaveDays}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-4">
                <p className="text-[11px] uppercase tracking-wide text-[#999]">From</p>
                <p className="mt-1 text-[15px] font-semibold text-[#333]">{selectedLeave.from_date}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-4">
                <p className="text-[11px] uppercase tracking-wide text-[#999]">To</p>
                <p className="mt-1 text-[15px] font-semibold text-[#333]">{selectedLeave.to_date}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-4 sm:col-span-2">
                <p className="text-[11px] uppercase tracking-wide text-[#999]">Submitted</p>
                <p className="mt-1 text-[15px] font-semibold text-[#333]">{selectedLeave.submitted_at ? new Date(selectedLeave.submitted_at).toLocaleString() : (selectedLeave.created ? new Date(selectedLeave.created).toLocaleString() : 'N/A')}</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-gray-100 bg-[#fafafa] p-4">
              <p className="text-[11px] uppercase tracking-wide text-[#999]">Reason / message</p>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-[#444]">{selectedLeave.reason || 'No reason provided.'}</p>
            </div>

            <div className="mt-5 rounded-xl border border-gray-100 bg-[#fafafa] p-4">
              <p className="text-[11px] uppercase tracking-wide text-[#999]">Attachment</p>
              {selectedLeave.attachment_url ? (
                <div className="mt-3 flex flex-col gap-3">
                  {selectedLeave.attachment_type?.startsWith('image/') ? (
                    <img src={selectedLeave.attachment_url} alt="Leave attachment" className="max-h-64 w-auto rounded-lg border border-gray-200 object-contain" />
                  ) : null}
                  <a href={selectedLeave.attachment_url} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#4F46E5] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#4338CA]">
                    <FileText className="h-4 w-4" />
                    {selectedLeave.attachment_name || 'Download attachment'}
                  </a>
                </div>
              ) : <p className="mt-2 text-[14px] text-[#666]">No attachment uploaded.</p>}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-4">
                <p className="text-[11px] uppercase tracking-wide text-[#999]">Status</p>
                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle[selectedLeave.status] || statusStyle.Pending}`}>{selectedLeave.status}</span>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-4">
                <p className="text-[11px] uppercase tracking-wide text-[#999]">Reviewer</p>
                <p className="mt-1 text-[15px] font-semibold text-[#333]">{selectedLeave.reviewed_by || 'Pending review'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#fafafa] p-4 sm:col-span-2">
                <p className="text-[11px] uppercase tracking-wide text-[#999]">Review time</p>
                <p className="mt-1 text-[15px] font-semibold text-[#333]">{selectedLeave.reviewed_at ? new Date(selectedLeave.reviewed_at).toLocaleString() : 'Not reviewed yet'}</p>
              </div>
            </div>

            {selectedLeave.status === 'Pending' && (
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => review(selectedLeave.id, 'Rejected')} className="flex-1 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-100">Reject</button>
                <button type="button" onClick={() => review(selectedLeave.id, 'Approved')} className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-green-700">Approve</button>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default LeaveManagement;
