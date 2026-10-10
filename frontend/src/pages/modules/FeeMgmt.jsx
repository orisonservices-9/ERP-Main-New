import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { Badge, Btn, Card, PageTitle, StatCards, Table } from '../../components/Shared';
import { CheckCircle2, CreditCard, Download, Edit3, FileText, IndianRupee, Landmark, LockKeyhole, Printer, Receipt, RefreshCw, Search, ShieldCheck, Wallet, X } from 'lucide-react';
import api from '../../api';
import { downloadCSV, printPage } from '../../utils';
import { useAuth } from '../../context/AuthContext';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const input = 'mt-1 h-10 w-full rounded-lg border border-gray-200 bg-[#f7f8f9] px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-100';
const feeTypes = ['Tuition', 'Admission', 'Transport', 'Exam', 'Library', 'Laboratory', 'Activity', 'Other'];
const colour = (status) => status === 'Paid' ? 'green' : status === 'Partial' ? 'amber' : status === 'Overdue' ? 'red' : 'gray';

function useFees() {
  const [invoices, setInvoices] = useState([]); const [students, setStudents] = useState([]); const [structure, setStructure] = useState({ academic_year: '', classes: [] }); const [summary, setSummary] = useState({}); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { const [fees, learners, setup, totals] = await Promise.all([api.get('/fees'), api.get('/students'), api.get('/academic-structure'), api.get('/fees/summary')]); setInvoices(fees.data); setStudents(learners.data); setStructure(setup.data || { academic_year: '', classes: [] }); setSummary(totals.data || {}); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]); return { invoices, students, structure, summary, loading, load };
}

const GroupFilters = ({ structure, value, onChange, allowAllSections = false }) => {
  const sections = structure.classes.find((item) => item.name === value.class_name)?.sections || [];
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><label className="text-[12px] font-medium text-[#555]">Select class<select className={input} value={value.class_name} onChange={(event) => onChange({ class_name: event.target.value, section: '' })}><option value="">Select class</option>{structure.classes.map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}</select></label><label className="text-[12px] font-medium text-[#555]">Select section<select className={input} disabled={!value.class_name} value={value.section} onChange={(event) => onChange({ ...value, section: event.target.value })}><option value="">{allowAllSections ? 'All Sections' : 'Select section'}</option>{sections.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label></div>;
};

export const CreateFees = () => {
  const { structure } = useFees();
  const [target, setTarget] = useState({ class_name: '', section: '' });
  const [form, setForm] = useState({ name: '', category: 'Tuition', amount: '', description: '', start_date: today(), due_date: '' });
  const [existingFees, setExistingFees] = useState([]);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const targets = useMemo(() => {
    const selectedClass = structure.classes.find((item) => item.name === target.class_name);
    if (!selectedClass) return [];
    return target.section
      ? [{ class_name: target.class_name, section: target.section }]
      : selectedClass.sections.map((item) => ({ class_name: target.class_name, section: item.name }));
  }, [structure, target]);

  const loadExistingFees = useCallback(async () => {
    if (!target.class_name) {
      setExistingFees([]);
      return;
    }
    try {
      const { data } = await api.get('/fees/structures');
      setExistingFees(data.filter((fee) => fee.targets?.some((feeTarget) => (
        feeTarget.class_name === target.class_name
        && (!target.section || feeTarget.section === target.section)
      ))));
    } catch {
      setExistingFees([]);
    }
  }, [target]);

  useEffect(() => { loadExistingFees(); }, [loadExistingFees]);

  const submit = async () => {
    setSaving(true);
    setNotice('');
    try {
      const { data } = await api.post('/fees/structures', { ...form, targets, academic_year: structure.academic_year });
      setNotice(`${data.name} was created for ${target.class_name}${target.section ? ` — ${target.section}` : ' — all sections'} and assigned to ${data.invoices_created} student(s).`);
      setForm({ name: '', category: 'Tuition', amount: '', description: '', start_date: today(), due_date: '' });
      loadExistingFees();
    } catch (error) {
      setNotice(error.response?.data?.detail || 'Could not create the fee.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <PageTitle title="Create Fee" subtitle="First select the Class and Section, create the new fee, then check existing fees for the same academic group." />

      {notice && <div className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${notice.includes('was created') ? 'border-green-100 bg-green-50 text-green-700' : 'border-indigo-100 bg-indigo-50 text-indigo-700'}`}>{notice}</div>}

      <Card className="mb-6" title="1. Select academic group" subtitle="Choose one Section, or leave Section on All Sections to apply the fee to every section in the selected Class.">
        <GroupFilters structure={structure} value={target} onChange={setTarget} allowAllSections />
      </Card>

      <Card className="mb-6" title="2. Fee details" subtitle="The fee becomes locked after creation. Any later change requires the Director’s OTP approval.">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="md:col-span-2 text-[12px] font-medium text-[#555]">Fee name *<input className={input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. School Fee – Term 1" /></label>
          <label className="text-[12px] font-medium text-[#555]">Fee type *<select className={input} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{feeTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-[12px] font-medium text-[#555]">Amount (₹) *<input className={input} type="number" min="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" /></label>
          <label className="md:col-span-2 text-[12px] font-medium text-[#555]">Description<textarea className={`${input} h-24 py-3`} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What does this fee include?" /></label>
          <label className="text-[12px] font-medium text-[#555]">Start date<input className={input} type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></label>
          <label className="text-[12px] font-medium text-[#555]">End / due date *<input className={input} type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} /></label>
        </div>
        <div className="mt-6 flex items-center justify-between rounded-xl bg-[#f7f8f9] p-4">
          <div>
            <p className="text-[13px] font-semibold">Academic Year: {structure.academic_year || 'Not configured'}</p>
            <p className="text-[12px] text-[#777]">Target: {target.class_name ? `${target.class_name}${target.section ? ` — ${target.section}` : ' — All Sections'}` : 'Select a Class first'}</p>
          </div>
          <Btn icon={FileText} onClick={submit} disabled={saving || !targets.length}>{saving ? 'Creating…' : 'Create Fee'}</Btn>
        </div>
      </Card>

      <Card
        title="3. Existing Fees"
        subtitle={target.class_name ? `Fees already created for ${target.class_name}${target.section ? ` — ${target.section}` : ' — All Sections'}.` : 'Select a Class and Section above to check whether a fee already exists.'}
        pad="p-0"
      >
        {target.class_name ? (
          <div className="overflow-x-auto">
            <Table columns={[{ label: 'Fee Name' }, { label: 'Type' }, { label: 'Amount' }, { label: 'Applies To' }, { label: 'Start Date' }, { label: 'Due Date' }]}>
              {existingFees.map((fee) => (
                <tr key={fee.id} className="border-b border-gray-50">
                  <td className="px-6 py-4 text-[13px] font-semibold">{fee.name}<span className="block text-[11px] font-normal text-[#999]">{fee.description || 'No description'}</span></td>
                  <td className="py-4 text-[13px]">{fee.category}</td>
                  <td className="py-4 text-[13px] font-semibold">{money(fee.amount)}</td>
                  <td className="py-4 text-[12px]">{fee.targets?.filter((item) => item.class_name === target.class_name).map((item) => item.section).join(', ') || '—'}</td>
                  <td className="py-4 text-[12px]">{fee.start_date || '—'}</td>
                  <td className="py-4 pr-6 text-[12px]">{fee.due_date || '—'}</td>
                </tr>
              ))}
            </Table>
            {!existingFees.length && <p className="py-12 text-center text-[13px] text-[#999]">No fee has been created for this selected group yet. You can create the first one above.</p>}
          </div>
        ) : (
          <p className="py-14 text-center text-[13px] text-[#999]">Select a Class and Section to view existing fees.</p>
        )}
      </Card>
    </Layout>
  );
};

const RecentPayments = ({ rows, groupSelected, query, onQueryChange }) => (
  <Card
    title={groupSelected ? 'Recent Payments for Selected Group' : 'Recent Payments'}
    subtitle={groupSelected ? 'Latest payments received for the selected Class and Section.' : 'Latest fee payments received across every Class and Section.'}
    action={
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-[#999]" />
        <input
          className="h-10 w-64 rounded-lg border border-gray-200 pl-9 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-indigo-100"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search student or receipt…"
        />
      </div>
    }
    pad="p-0"
  >
    <div className="overflow-x-auto">
      <Table columns={[{ label: 'Receipt No.' }, { label: 'Student' }, { label: 'Class' }, { label: 'Section' }, { label: 'Fee' }, { label: 'Amount Received' }, { label: 'Payment Mode' }, { label: 'Received On' }]}>
        {rows.map((payment) => (
          <tr key={payment.id} className="border-b border-gray-50">
            <td className="px-6 py-4 text-[12px] font-semibold text-[#4F46E5]">{payment.id}</td>
            <td className="py-4 text-[13px] font-semibold">
              {payment.student_name}
              <span className="block text-[11px] font-normal text-[#999]">{payment.admission_no || 'Admission number unavailable'}</span>
            </td>
            <td className="py-4 text-[13px]">{payment.class_name || '—'}</td>
            <td className="py-4 text-[13px]">{payment.section || '—'}</td>
            <td className="py-4 text-[13px]">{payment.fee_name || 'School Fee'}</td>
            <td className="py-4 text-[13px] font-semibold text-green-700">{money(payment.amount)}</td>
            <td className="py-4"><Badge color="blue">{payment.method || 'Cash'}</Badge></td>
            <td className="py-4 pr-6 text-[12px] text-[#666]">{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : '—'}</td>
          </tr>
        ))}
      </Table>
      {!rows.length && <p className="py-16 text-center text-[13px] text-[#999]">{groupSelected ? 'No payments have been received for this selection yet.' : 'No fee payments have been recorded yet.'}</p>}
    </div>
  </Card>
);

export const ViewCollections = () => {
  const { invoices, structure, summary } = useFees();
  const [filters, setFilters] = useState({ class_name: '', section: '' });
  const [receipts, setReceipts] = useState([]);
  const [paymentSearch, setPaymentSearch] = useState('');

  useEffect(() => {
    api.get('/fees/receipts').then(({ data }) => setReceipts(data)).catch(() => setReceipts([]));
  }, []);

  const hasSelection = Boolean(filters.class_name || filters.section);
  const selectedInvoices = useMemo(
    () => invoices.filter((invoice) => (
      (!filters.class_name || invoice.class_name === filters.class_name)
      && (!filters.section || invoice.section === filters.section)
    )),
    [invoices, filters],
  );
  const overview = useMemo(() => {
    if (!hasSelection) return summary;
    return selectedInvoices.reduce((totals, invoice) => ({
      total: totals.total + Number(invoice.total || 0),
      collected: totals.collected + Number(invoice.paid || 0),
      pending: totals.pending + Number(invoice.due || 0),
    }), { total: 0, collected: 0, pending: 0 });
  }, [selectedInvoices, summary, hasSelection]);

  const efficiency = overview.total ? Math.round((overview.collected || 0) / overview.total * 1000) / 10 : 0;
  const recentPayments = useMemo(
    () => receipts
      .filter((payment) => (
        (!filters.class_name || payment.class_name === filters.class_name)
        && (!filters.section || payment.section === filters.section)
      ))
      .filter((payment) => !paymentSearch || `${payment.id} ${payment.student_name} ${payment.admission_no}`.toLowerCase().includes(paymentSearch.toLowerCase()))
      .sort((first, second) => new Date(second.paid_at || 0) - new Date(first.paid_at || 0))
      .slice(0, 20),
    [receipts, filters, paymentSearch],
  );

  return (
    <Layout>
      <PageTitle
        title="View Collections"
        subtitle="View the fee position and latest payments for the whole school, or select a Class and Section to focus on one group."
      />

      <StatCards items={[
        { label: 'Fee Expected', value: money(overview.total), icon: Wallet },
        { label: 'Collected', value: money(overview.collected), icon: IndianRupee, tint: 'bg-green-50 text-green-600' },
        { label: 'Outstanding', value: money(overview.pending), icon: Receipt, tint: 'bg-indigo-50 text-[#4F46E5]' },
        { label: 'Collection Efficiency', value: `${efficiency}%`, icon: FileText, tint: 'bg-amber-50 text-amber-600' },
      ]} />

      <Card
        className="mb-6"
        title="Select collection group"
        subtitle="Leave both fields empty to view payments from all Classes and Sections."
      >
        <GroupFilters structure={structure} value={filters} onChange={setFilters} />
      </Card>

      <RecentPayments
        rows={recentPayments}
        groupSelected={hasSelection}
        query={paymentSearch}
        onQueryChange={setPaymentSearch}
      />
    </Layout>
  );
};

const EditFeeModal = ({ value, setValue, onClose, onRequest }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl"><div className="mb-5 flex items-center justify-between"><h2 className="font-poppins text-[20px] font-bold">View / Edit Fee</h2><button onClick={onClose}><X size={20} /></button></div><p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">This fee is locked. Saving changes sends a Director approval request and the Director’s OTP is required before any invoice changes.</p><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><label className="md:col-span-2 text-[12px] font-medium">Fee name<input className={input} value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} /></label><label className="text-[12px] font-medium">Type<select className={input} value={value.category} onChange={(event) => setValue({ ...value, category: event.target.value })}>{feeTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-[12px] font-medium">Amount<input className={input} type="number" value={value.amount} onChange={(event) => setValue({ ...value, amount: event.target.value })} /></label><label className="md:col-span-2 text-[12px] font-medium">Description<textarea className={`${input} h-20 py-2`} value={value.description || ''} onChange={(event) => setValue({ ...value, description: event.target.value })} /></label><label className="text-[12px] font-medium">Start date<input className={input} type="date" value={value.start_date || ''} onChange={(event) => setValue({ ...value, start_date: event.target.value })} /></label><label className="text-[12px] font-medium">Due date<input className={input} type="date" value={value.due_date || ''} onChange={(event) => setValue({ ...value, due_date: event.target.value })} /></label></div><div className="mt-6 flex justify-end gap-3"><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn icon={LockKeyhole} onClick={onRequest}>Request Director Approval</Btn></div></div></div>;

export const CollectFee = () => {
  const { invoices, students, structure, load } = useFees();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ class_name: '', section: '' });
  const [studentId, setStudentId] = useState(new URLSearchParams(window.location.search).get('student') || '');
  const [feeId, setFeeId] = useState('');
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [method, setMethod] = useState('Cash');
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const canBrowse = Boolean(search.trim() || (filters.class_name && filters.section) || studentId);
  const found = useMemo(() => {
    if (!canBrowse) return [];
    return students
      .filter((item) => {
        const matchesSearch = !search || `${item.name} ${item.admission_no}`.toLowerCase().includes(search.toLowerCase());
        const matchesGroup = (!filters.class_name || item.class_name === filters.class_name) && (!filters.section || item.section === filters.section);
        return matchesSearch && matchesGroup;
      })
      .sort((first, second) => first.name.localeCompare(second.name));
  }, [students, search, filters, canBrowse]);

  const student = students.find((item) => item.id === studentId);
  const studentInvoices = invoices.filter((item) => item.student_id === studentId);
  const pending = studentInvoices.filter((item) => item.due > 0);
  const fee = pending.find((item) => item.id === feeId);
  const collected = studentInvoices.reduce((sum, item) => sum + Number(item.paid || 0), 0);
  const billed = studentInvoices.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const percent = billed ? Math.round(collected / billed * 100) : 0;
  const pastDue = studentInvoices.filter((item) => item.academic_year && structure.academic_year && item.academic_year !== structure.academic_year && item.due > 0);

  const openReceipt = () => {
    if (!fee) {
      setNotice('Select the fee the parent is paying.');
      return;
    }
    setAmount(String(fee.due));
    setDiscount('0');
    setDiscountReason('');
    setReceiptOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const { data } = await api.post(`/fees/${fee.id}/pay`, {
        amount: Number(amount),
        discount: Number(discount || 0),
        discount_reason: discountReason,
        method,
      });
      setResult(data.receipt);
      setReceiptOpen(false);
      setNotice('Payment recorded. Receipt and SMS / WhatsApp / app notification are queued for the parent.');
      load();
    } catch (error) {
      setNotice(error.response?.data?.detail || 'Payment could not be processed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <PageTitle title="Collect Fee" subtitle="Search by full student name or admission number. You can also select a Class and Section to find a student." />

      {notice && <div className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${notice.includes('recorded') ? 'border-green-100 bg-green-50 text-green-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>{notice}</div>}

      <Card className="mb-6" title="Find Student" subtitle="Student records stay hidden until you search or choose both a Class and Section.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <label className="lg:col-span-1 text-[12px] font-medium text-[#555]">
            Universal search
            <div className="relative">
              <Search size={16} className="absolute left-3 top-[22px] text-[#999]" />
              <input className={`${input} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Full student name or admission number" />
            </div>
          </label>
          <GroupFilters structure={structure} value={filters} onChange={setFilters} allowAllSections />
        </div>

        {canBrowse ? (
          <div className="mt-5 max-h-52 overflow-auto rounded-xl border border-gray-100">
            <Table columns={[{ label: 'Student' }, { label: 'Admission No.' }, { label: 'Class / Section' }, { label: '' }]}>
              {found.map((item) => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="py-3 text-[13px] font-semibold">{item.name}</td>
                  <td className="py-3 text-[12px] text-[#666]">{item.admission_no}</td>
                  <td className="py-3 text-[12px] text-[#666]">{item.class_name} — {item.section}</td>
                  <td className="py-3 text-right"><button onClick={() => { setStudentId(item.id); setFeeId(''); setResult(null); }} className="text-[12px] font-semibold text-[#4F46E5]">Open account</button></td>
                </tr>
              ))}
            </Table>
            {!found.length && <p className="py-8 text-center text-[13px] text-[#999]">No student matches this search or group.</p>}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-[#fafafa] px-4 py-8 text-center text-[13px] text-[#888]">
            Type a student name or admission number above to start collecting a fee.
          </div>
        )}
      </Card>

      {student && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-1" title="Student Collection Health">
            <div className="flex items-center gap-3">
              <img src={student.avatar} alt="" className="h-12 w-12 rounded-xl object-cover" />
              <div><p className="font-semibold">{student.name}</p><p className="text-[12px] text-[#777]">Adm No. {student.admission_no} · {student.class_name} — {student.section}</p></div>
            </div>
            <div className="mt-5 rounded-xl bg-[#f1f5f8] p-4">
              <p className="text-[12px] text-[#777]">Collection Percentage</p>
              <p className={`mt-1 text-[26px] font-bold ${percent >= 80 ? 'text-green-600' : percent >= 40 ? 'text-amber-600' : 'text-[#4F46E5]'}`}>{percent}%</p>
              <p className="text-[12px] text-[#777]">{percent >= 80 ? 'Healthy collection' : percent >= 40 ? 'Needs follow-up' : 'Critical outstanding balance'}</p>
            </div>
            <div className="mt-4 text-[13px]"><p className="text-[#777]">Current Outstanding</p><b className="text-[#4F46E5]">{money(pending.reduce((sum, item) => sum + item.due, 0))}</b></div>
            {pastDue.length > 0 && <div className="mt-4 rounded-lg bg-indigo-50 p-3 text-[12px] text-indigo-700">{pastDue.length} pending fee(s) from a previous Academic Year: {money(pastDue.reduce((sum, item) => sum + item.due, 0))}</div>}
          </Card>

          <Card className="xl:col-span-2" title="Select Fee and Open Receipt">
            <Table columns={[{ label: '' }, { label: 'Fee' }, { label: 'Academic Year' }, { label: 'Due Date' }, { label: 'Pending Amount' }, { label: 'Status' }]}>
              {pending.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-4"><input type="radio" name="fee" checked={feeId === item.id} onChange={() => setFeeId(item.id)} className="accent-[#4F46E5]" /></td>
                  <td className="py-4 text-[13px] font-semibold">{item.fee_name || 'School Fee'}<span className="block text-[11px] font-normal text-[#999]">{item.category || 'General Fee'}</span></td>
                  <td className="py-4 text-[12px]">{item.academic_year || '—'}</td>
                  <td className="py-4 text-[12px]">{item.due_date || '—'}</td>
                  <td className="py-4 text-[13px] font-semibold">{money(item.due)}</td>
                  <td className="py-4"><Badge color={colour(item.status)}>{item.status}</Badge></td>
                </tr>
              ))}
            </Table>
            {pending.length ? <div className="mt-5 flex justify-end"><Btn icon={Receipt} onClick={openReceipt}>Open Payment Receipt</Btn></div> : <p className="py-12 text-center text-[13px] text-green-700">No pending fees for this student.</p>}
          </Card>
        </div>
      )}

      {receiptOpen && fee && <ReceiptModal student={student} fee={fee} amount={amount} setAmount={setAmount} discount={discount} setDiscount={setDiscount} discountReason={discountReason} setDiscountReason={setDiscountReason} method={method} setMethod={setMethod} onClose={() => setReceiptOpen(false)} onSubmit={submit} saving={saving} />}
      {result && <ReceiptView receipt={result} student={student} onClose={() => setResult(null)} />}
    </Layout>
  );
};

const SchoolHeader = ({ receiptNo, date, academicYear }) => <div className="border-b-2 border-black pb-3"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-black bg-[#f5f5f5] text-center font-serif text-[12px] font-black leading-tight">ORISON<br />SCHOOL</div><div className="font-serif"><p className="text-[24px] font-black leading-tight">ORISON MODEL SCHOOL</p><p className="text-[14px] font-bold">ACADEMIC YEAR ({academicYear || '2026–27'})</p><p className="mt-1 text-[12px]">School Campus, Hyderabad · Ph: 00000 00000</p></div></div><div className="shrink-0 pt-2 text-right font-serif text-[12px]"><p>Date: <b>{date}</b></p><p className="mt-4 border border-black px-2 py-1 font-black">FEE RECEIPT</p><p className="mt-1">School Copy</p></div></div><div className="mt-3 flex items-center justify-between font-serif text-[14px]"><span>No. <b>{receiptNo}</b></span><span>Receipt generated by Orison ERP</span></div></div>;

const ReceiptModal = ({ student, fee, amount, setAmount, discount, setDiscount, discountReason, setDiscountReason, method, setMethod, onClose, onSubmit, saving }) => {
  const after = Math.max(0, Number(fee.due || 0) - Number(amount || 0) - Number(discount || 0));
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/50 p-4"><div className="mx-auto my-6 w-full max-w-3xl bg-white p-3 shadow-2xl"><div className="border-2 border-black p-5 font-serif text-black"><div className="flex justify-end"><button onClick={onClose} className="mb-2 inline-flex items-center gap-1 text-[12px] font-sans text-[#555]"><X size={15} /> Close</button></div><SchoolHeader receiptNo="Draft" date={new Date().toLocaleDateString('en-GB')} academicYear={fee.academic_year} /><div className="grid grid-cols-2 border-b border-black py-3 text-[14px]"><p>Adm No: <b>{student.admission_no || '—'}</b></p><p>Name: <b>{student.name}</b></p><p>FName: <b>{student.parent_name || student.father_name || '—'}</b></p><p>Class: <b>{student.class_name} — {student.section}</b></p></div><table className="w-full border-collapse text-[14px]"><thead><tr className="border-b border-black"><th className="border-r border-black p-2 text-left">Sno</th><th className="border-r border-black p-2 text-left">Description</th><th className="border-r border-black p-2 text-left">Mode of Pay</th><th className="p-2 text-right">Amount</th></tr></thead><tbody><tr className="border-b border-black"><td className="border-r border-black p-2">1.</td><td className="border-r border-black p-2"><b>{fee.fee_name || 'School Fee'}</b><span className="block text-[11px]">{fee.category || 'Fee'}</span></td><td className="border-r border-black p-2"><select value={method} onChange={(event) => setMethod(event.target.value)} className="w-full bg-transparent font-serif outline-none"><option>Cash</option><option>Card</option><option>Online</option></select></td><td className="p-2"><input type="number" min="0" max={fee.due} value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full bg-transparent text-right font-bold outline-none" /></td></tr></tbody></table><div className="grid grid-cols-1 gap-3 border-b border-black py-3 md:grid-cols-2"><label className="text-[12px] font-sans font-semibold">Approved Discount (₹)<input className="mt-1 h-9 w-full border border-gray-400 px-2 font-serif text-[14px]" type="number" min="0" max={fee.due} value={discount} onChange={(event) => setDiscount(event.target.value)} /></label><label className="text-[12px] font-sans font-semibold">Discount approval note<textarea className="mt-1 h-9 w-full border border-gray-400 px-2 py-1 font-serif text-[13px]" value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} placeholder="KDM verbal approval / reason" /></label></div><div className="border-b border-black py-3 text-[14px]"><p><b>NOTE:</b> Fee once paid will not be refunded.</p><div className="mt-3 flex justify-between border-t border-black pt-2 text-[16px] font-bold"><span>Total Received</span><span>{money(amount)}</span></div><div className="mt-2 flex justify-between"><span>Discount</span><span>{money(discount)}</span></div><div className="mt-2 flex justify-between"><span>Due</span><span>{money(after)}</span></div><p className="mt-3 text-right font-bold">Authorised Signatory</p></div><div className="mt-5 flex justify-end gap-3 font-sans"><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn icon={CheckCircle2} onClick={onSubmit} disabled={saving}>{saving ? 'Submitting…' : 'Submit Receipt'}</Btn></div></div></div></div>;
};

const ReceiptView = ({ receipt, student, onClose }) => <div className="fixed inset-0 z-50 overflow-auto bg-black/50 p-4"><div className="mx-auto my-6 w-full max-w-3xl bg-white p-3 shadow-2xl"><div id="fee-receipt" className="border-2 border-black p-5 font-serif text-black"><SchoolHeader receiptNo={receipt.id} date={new Date(receipt.paid_at).toLocaleDateString('en-GB')} academicYear={receipt.academic_year} /><div className="grid grid-cols-2 border-b border-black py-3 text-[14px]"><p>Adm No: <b>{receipt.admission_no || student?.admission_no || '—'}</b></p><p>Name: <b>{receipt.student_name || student?.name}</b></p><p>FName: <b>{receipt.parent_name || student?.parent_name || student?.father_name || '—'}</b></p><p>Class: <b>{receipt.class_name || student?.class_name} — {receipt.section || student?.section}</b></p></div><table className="w-full border-collapse text-[14px]"><thead><tr className="border-b border-black"><th className="border-r border-black p-2 text-left">Sno</th><th className="border-r border-black p-2 text-left">Description</th><th className="border-r border-black p-2 text-left">Mode of Pay</th><th className="p-2 text-right">Amount</th></tr></thead><tbody><tr className="border-b border-black"><td className="border-r border-black p-2">1.</td><td className="border-r border-black p-2"><b>{receipt.fee_name}</b></td><td className="border-r border-black p-2">{receipt.method}</td><td className="p-2 text-right font-bold">{money(receipt.amount)}</td></tr></tbody></table><div className="border-b border-black py-3 text-[14px]"><p><b>NOTE:</b> Fee once paid will not be refunded.</p>{receipt.discount > 0 && <div className="mt-3 flex justify-between"><span>Approved Discount</span><b>{money(receipt.discount)}</b></div>}<div className="mt-3 flex justify-between border-t border-black pt-2 text-[16px] font-bold"><span>Total Received</span><span>{money(receipt.amount)}</span></div><div className="mt-2 flex justify-between"><span>Due</span><span>{money(receipt.balance_after)}</span></div><p className="mt-4 text-right font-bold">Authorised Signatory</p></div><p className="mt-3 font-sans text-[11px] text-[#555]">Parent receipt notification is queued by SMS, WhatsApp and app push.</p><div className="mt-5 flex justify-end gap-3 font-sans"><Btn variant="outline" icon={Printer} onClick={printPage}>Print Receipt</Btn><Btn onClick={onClose}>Done</Btn></div></div></div></div>;

export const FeeReceipts = () => { const [rows, setRows] = useState([]); const [q, setQ] = useState(''); useEffect(() => { api.get('/fees/receipts').then(({ data }) => setRows(data)).catch(() => setRows([])); }, []); const shown = rows.filter((item) => `${item.id} ${item.student_name} ${item.admission_no}`.toLowerCase().includes(q.toLowerCase())); return <Layout><PageTitle title="Receipts" subtitle="All submitted fee receipts are available for download, printing and parent follow-up." actions={<Btn variant="outline" icon={Download} onClick={() => downloadCSV('fee-receipts.csv', ['Receipt', 'Student', 'Fee', 'Amount', 'Discount', 'Method', 'Date'], shown.map((item) => [item.id, item.student_name, item.fee_name, item.amount, item.discount, item.method, item.paid_at]))}>Export CSV</Btn>} /><Card title="Fee Receipts" action={<div className="relative"><Search size={16} className="absolute left-3 top-3 text-[#999]" /><input className="h-10 rounded-lg border border-gray-200 pl-9 pr-3 text-[13px]" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search receipt or student…" /></div>} pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'Receipt' }, { label: 'Student' }, { label: 'Fee' }, { label: 'Received' }, { label: 'Discount' }, { label: 'Payment Mode' }, { label: 'Date' }]}>{shown.map((item) => <tr key={item.id} className="border-b border-gray-50"><td className="px-6 py-3 text-[12px] font-semibold text-[#4F46E5]">{item.id}</td><td className="py-3 text-[13px] font-semibold">{item.student_name}<span className="block text-[11px] font-normal text-[#999]">{item.admission_no || '—'}</span></td><td className="py-3 text-[13px]">{item.fee_name}</td><td className="py-3 text-[13px] font-semibold text-green-700">{money(item.amount)}</td><td className="py-3 text-[13px]">{money(item.discount)}</td><td className="py-3"><Badge color="blue">{item.method}</Badge></td><td className="py-3 pr-6 text-[12px]">{item.paid_at ? new Date(item.paid_at).toLocaleString() : '—'}</td></tr>)}</Table>{!shown.length && <p className="py-16 text-center text-[13px] text-[#999]">No receipts have been submitted yet.</p>}</div></Card></Layout>; };

export const FeeManagement = ViewCollections;

const downloadReceiptFile = (receipt) => {
  const text = `ORISON MODEL SCHOOL\nFEE RECEIPT\n\nReceipt No: ${receipt.id}\nDate: ${receipt.paid_at ? new Date(receipt.paid_at).toLocaleString() : ''}\nStudent: ${receipt.student_name}\nAdmission No: ${receipt.admission_no || '—'}\nClass: ${receipt.class_name || ''} — ${receipt.section || ''}\n\nFee: ${receipt.fee_name}\nAmount Received: ${money(receipt.amount)}\nDiscount: ${money(receipt.discount)}\nPayment Mode: ${receipt.method}\nBalance Due: ${money(receipt.balance_after)}\n\nFee once paid will not be refunded.`;
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); link.download = `${receipt.id}-fee-receipt.txt`; link.click(); URL.revokeObjectURL(link.href);
};

export const FeeReceiptsArchive = () => {
  const { structure } = useFees();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ class_name: '', section: '' });
  const [paymentMonth, setPaymentMonth] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.get('/fees/receipts').then(({ data }) => setRows(data)).catch(() => setRows([]));
  }, []);

  const filterDescription = [
    filters.class_name && `${filters.class_name}${filters.section ? ` — ${filters.section}` : ''}`,
    paymentMonth && new Date(`${paymentMonth}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  ].filter(Boolean).join(' · ');

  const shown = useMemo(() => rows
    .filter((item) => (!filters.class_name || item.class_name === filters.class_name) && (!filters.section || item.section === filters.section))
    .filter((item) => !paymentMonth || String(item.paid_at || '').slice(0, 7) === paymentMonth)
    .filter((item) => `${item.id} ${item.student_name} ${item.admission_no}`.toLowerCase().includes(q.toLowerCase()))
    .sort((first, second) => new Date(second.paid_at || 0) - new Date(first.paid_at || 0)), [rows, filters, paymentMonth, q]);

  const clearFilters = () => {
    setFilters({ class_name: '', section: '' });
    setPaymentMonth('');
    setQ('');
  };

  return (
    <Layout>
      <PageTitle
        title="Receipts"
        subtitle="Latest payment receipts are shown below. Use Class, Section or payment month/year only when you need a specific earlier receipt."
        actions={<Btn variant="outline" icon={Download} onClick={() => downloadCSV('fee-receipts.csv', ['Receipt', 'Student', 'Admission No.', 'Class', 'Section', 'Fee', 'Received', 'Discount', 'Payment Mode', 'Date'], shown.map((item) => [item.id, item.student_name, item.admission_no, item.class_name, item.section, item.fee_name, item.amount, item.discount, item.method, item.paid_at]))}>Export List</Btn>}
      />

      <Card className="mb-6" title="Find a specific previous receipt" subtitle="These filters are optional. Select Class, Section and payment month/year only for an earlier receipt request.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><GroupFilters structure={structure} value={filters} onChange={setFilters} /></div>
          <label className="text-[12px] font-medium text-[#555]">
            Payment month and year
            <input className={input} type="month" value={paymentMonth} onChange={(event) => setPaymentMonth(event.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex justify-end"><Btn variant="outline" onClick={clearFilters}>Clear Filters</Btn></div>
      </Card>

      <Card
        title={filterDescription ? 'Filtered Fee Receipts' : 'Latest Fee Payments'}
        subtitle={filterDescription ? `Showing receipts for ${filterDescription}.` : 'Most recently received payments across all Classes and Sections.'}
        action={<div className="relative"><Search size={16} className="absolute left-3 top-3 text-[#999]" /><input className="h-10 rounded-lg border border-gray-200 pl-9 pr-3 text-[13px]" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search student or receipt…" /></div>}
        pad="p-0"
      >
        <div className="overflow-x-auto">
          <Table columns={[{ label: 'Receipt' }, { label: 'Student' }, { label: 'Class' }, { label: 'Section' }, { label: 'Fee' }, { label: 'Received' }, { label: 'Payment Mode' }, { label: 'Date' }, { label: 'Receipt Actions' }]}>
            {shown.map((item) => (
              <tr key={item.id} className="border-b border-gray-50">
                <td className="px-6 py-3 text-[12px] font-semibold text-[#4F46E5]">{item.id}</td>
                <td className="py-3 text-[13px] font-semibold">{item.student_name}<span className="block text-[11px] font-normal text-[#999]">{item.admission_no || '—'}</span></td>
                <td className="py-3 text-[13px]">{item.class_name || '—'}</td>
                <td className="py-3 text-[13px]">{item.section || '—'}</td>
                <td className="py-3 text-[13px]">{item.fee_name}</td>
                <td className="py-3 text-[13px] font-semibold text-green-700">{money(item.amount)}</td>
                <td className="py-3"><Badge color="blue">{item.method}</Badge></td>
                <td className="py-3 text-[12px]">{item.paid_at ? new Date(item.paid_at).toLocaleString() : '—'}</td>
                <td className="py-3 pr-6"><div className="flex gap-3"><button onClick={() => setOpen(item)} className="text-[12px] font-semibold text-[#4F46E5]">View / Print</button><button onClick={() => downloadReceiptFile(item)} className="text-[12px] font-semibold text-[#555]">Download</button></div></td>
              </tr>
            ))}
          </Table>
          {!shown.length && <p className="py-16 text-center text-[13px] text-[#999]">No receipt matches the selected filters.</p>}
        </div>
      </Card>

      {open && <ReceiptView receipt={open} student={{ name: open.student_name, admission_no: open.admission_no, class_name: open.class_name, section: open.section, parent_name: open.parent_name }} onClose={() => setOpen(null)} />}
    </Layout>
  );
};

export const RazorpayVerification = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await api.get('/payments/razorpay')).data || []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const shown = rows.filter((row) => `${row.payment_id} ${row.order_id} ${row.student_name} ${row.fee_name}`.toLowerCase().includes(query.toLowerCase()));
  const statusColour = (status) => status === 'Verified' ? 'green' : status === 'Failed' ? 'red' : status === 'Refunded' ? 'purple' : 'amber';
  return <Layout>
    <PageTitle title="Razorpay Payment Verification" subtitle="Read-only gateway verification trail. Razorpay signatures are checked automatically; staff do not approve or reject parent payments." actions={<Btn variant="outline" icon={RefreshCw} onClick={load}>Refresh</Btn>} />
    <StatCards items={[
      { label: 'Verified payments', value: rows.filter((row) => row.status === 'Verified').length, icon: ShieldCheck, tint: 'bg-emerald-50 text-emerald-700' },
      { label: 'Pending confirmation', value: rows.filter((row) => row.status === 'Created').length, icon: CreditCard, tint: 'bg-amber-50 text-amber-700' },
      { label: 'Failed verification', value: rows.filter((row) => row.status === 'Failed').length, icon: X, tint: 'bg-indigo-50 text-indigo-700' },
      { label: 'Verified value', value: money(rows.filter((row) => row.status === 'Verified').reduce((sum, row) => sum + Number(row.amount || 0), 0)), icon: IndianRupee, tint: 'bg-blue-50 text-blue-700' },
    ]} />
    <Card title="Gateway transaction audit" subtitle="Razorpay order, payment and signature verification status with automatic ledger posting." action={<div className="relative"><Search size={16} className="absolute left-3 top-3 text-[#999]" /><input className="h-10 rounded-lg border border-gray-200 pl-9 pr-3 text-[13px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search payment or student…" /></div>} pad="p-0">
      <div className="overflow-x-auto"><Table columns={[{label:'Student / Fee'},{label:'Razorpay Order'},{label:'Payment ID'},{label:'Amount'},{label:'Verification'},{label:'Updated'}]}>
        {shown.map((row) => <tr key={row.id || row.order_id} className="border-b border-gray-50">
          <td className="px-6 py-3 text-[13px] font-semibold">{row.student_name || '—'}<span className="block text-[11px] font-normal text-[#999]">{row.fee_name || row.fee_id}</span></td>
          <td className="py-3 font-mono text-[11px]">{row.order_id || '—'}</td><td className="py-3 font-mono text-[11px]">{row.payment_id || 'Awaiting payment'}</td>
          <td className="py-3 text-[13px] font-semibold">{money(row.amount)}</td><td className="py-3"><Badge color={statusColour(row.status)}>{row.status}</Badge>{row.failure_reason && <span className="mt-1 block max-w-[220px] text-[10px] text-indigo-600">{row.failure_reason}</span>}</td>
          <td className="py-3 pr-6 text-[11px] text-[#777]">{row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}<span className="block text-[10px] text-[#aaa]">{row.updated_by || 'Razorpay webhook'}</span></td>
        </tr>)}
      </Table>{!loading && !shown.length && <p className="py-16 text-center text-[13px] text-[#999]">No Razorpay transactions found.</p>}{loading && <p className="py-16 text-center text-[13px] text-[#999]">Loading gateway transactions…</p>}</div>
    </Card>
  </Layout>;
};
