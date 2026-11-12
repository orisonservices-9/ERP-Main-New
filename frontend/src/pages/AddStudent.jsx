import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { ChevronLeft, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import api from '../api';
import { PageTitle } from '../components/Shared';

const REQUIRED = ['name', 'admission_no', 'class_name', 'section', 'academic_year', 'gender', 'father_name', 'mobile'];

const AddStudent = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [academicStructure, setAcademicStructure] = useState({ academic_year: '', classes: [] });
  const [transportRoutes, setTransportRoutes] = useState([]);
  const [f, setF] = useState({
    name: '', admission_no: '', class_name: '', section: '', academic_year: '', status: '',
    blood_group: '', dob: '', gender: '', aadhar: '', apaar_id: '', pen: '', aadhaar_consent: '', rte_quota: '', previous_school: '', father_name: '', mobile: '',
    mother_name: '', mobile_alt: '', emergency_contact: '', guardian_name: '',
    transport_route_id: '', transport_route: '', pickup_stop: '',
  });
  const set = (k) => (e) => {
    const val = e.target.value;
    setF((s) => ({ ...s, [k]: val }));
    setErrors((er) => {
      if (!er[k] && !er._form) return er;
      const n = { ...er }; delete n[k]; delete n._form; return n;
    });
  };
  useEffect(() => {
    api.get('/academic-structure').then(({ data }) => {
      const structure = { academic_year: data.academic_year || '', classes: data.classes || [] };
      setAcademicStructure(structure);
      if (structure.academic_year) setF((current) => ({ ...current, academic_year: structure.academic_year }));
    }).catch(() => setErrors((current) => ({ ...current, _form: 'Academic Setup could not be loaded. Please configure the school year, classes and sections first.' })));
    api.get('/parent-center/transport/routes').then(({ data }) => setTransportRoutes((data || []).filter((route) => route.status !== 'Inactive'))).catch(() => setTransportRoutes([]));
  }, []);

  const fields = [
    ['name', 'Student Name', 'Enter student name'],
    ['admission_no', 'Admission no', 'Enter admission number'],
    ['class_name', 'Class', 'Select class', true],
    ['section', 'Section', 'Select section', true],
    ['academic_year', 'Academic year', 'Select year', true],
    ['status', 'Status', 'Active/Tc/Dropout'],
    ['blood_group', 'Blood group', 'e.g. O+'],
    ['dob', 'Date of Birth', 'DD/MM/YYYY'],
    ['gender', 'Gender', 'Select Gender', true],
    ['aadhar', 'Aadhaar no', 'XXXX-XXXX-XXXX'],
    ['apaar_id', 'APAAR ID', '12-digit APAAR ID'],
    ['pen', 'PEN (UDISE+)', 'Permanent Education Number'],
    ['aadhaar_consent', 'APAAR consent', 'Received / Pending / Declined'],
    ['rte_quota', 'RTE 25% quota', 'Yes / No'],
    ['previous_school', 'Previous school', 'School name (if transfer)'],
    ['father_name', 'Father / Guardian Name', 'Enter name'],
    ['mobile', 'Mobile num', '+91 ...'],
    ['mother_name', 'Mother name', 'Enter name'],
    ['mobile_alt', 'Mobile no', '+91 ...'],
    ['emergency_contact', 'Emergency contact', '+91 ...'],
    ['guardian_name', 'Guardian name', 'Guardian name'],
    ['transport_route_id', 'Transport Route', 'No bus transport', true],
    ['pickup_stop', 'Pickup Stop', 'Select pickup stop', true],
  ];
  const selectedClass = academicStructure.classes.find((item) => item.name === f.class_name);
  const opts = {
    class_name: academicStructure.classes.map((item) => item.name),
    section: selectedClass?.sections.map((item) => item.name) || [],
    academic_year: academicStructure.academic_year ? [academicStructure.academic_year] : [],
    gender: ['Male', 'Female', 'Other'],
    transport_route_id: transportRoutes.map((route) => ({ value: route.id, label: `${route.route_name}${route.bus_number ? ` · ${route.bus_number}` : ''}` })),
    pickup_stop: (transportRoutes.find((route) => route.id === f.transport_route_id)?.stops || []).map((stop) => stop.name),
  };

  const validate = () => {
    const e = {};
    REQUIRED.forEach((k) => { if (!String(f[k] || '').trim()) e[k] = 'This field is required'; });
    if (f.mobile && !e.mobile && !/^[+\d][\d\s-]{9,}$/.test(f.mobile.trim())) e.mobile = 'Enter a valid phone number';
    return e;
  };

  const save = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const { data } = await api.post('/students', f);
      navigate(`/students/profile?id=${data.id}`);
    } catch (err) {
      setSaving(false);
      const detail = err?.response?.data?.detail || 'Something went wrong. Please try again.';
      if (err?.response?.status === 409) setErrors((s) => ({ ...s, admission_no: detail }));
      else setErrors((s) => ({ ...s, _form: detail }));
    }
  };

  const baseInput = 'w-full h-11 rounded-lg bg-[#f6f6f7] px-3.5 text-[14px] text-[#333] focus:outline-none focus:ring-2 transition';

  return (
    <Layout>
      <PageTitle eyebrow="New admission" title="Add Student" subtitle="Enter the student's details once — attendance, fees, the parent app and certificates all use this record." actions={<button onClick={() => navigate(-1)} className="flex h-10 items-center gap-1.5 rounded-xl border px-4 text-[13px] font-bold"><ChevronLeft className="w-4 h-4" />Back</button>} />

      <div className="bg-white rounded-[22px] border border-white ring-1 ring-slate-100 shadow-[0_12px_32px_rgba(15,23,42,0.055)] p-7">
        {errors._form && (
          <div data-testid="add-student-form-error" className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 p-3.5 flex items-start gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 text-[#4F46E5] mt-0.5 shrink-0" />
            <p className="text-[14px] text-[#4F46E5]">{errors._form}</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-5">
          {fields.map(([k, label, ph, select]) => {
            const hasErr = !!errors[k];
            const req = REQUIRED.includes(k);
            return (
              <div key={k}>
                <label className="block text-[14px] text-[#555] mb-1.5">{label}{req && <span className="text-[#4F46E5]"> *</span>}</label>
                <div className="relative">
                  {select ? (
                    <select data-testid={`add-student-${k}`} value={f[k]} onChange={k === 'class_name' ? (e) => { set(k)(e); setF((current) => ({ ...current, section: '' })); } : k === 'transport_route_id' ? (e) => { const route = transportRoutes.find((item) => item.id === e.target.value); setF((current) => ({ ...current, transport_route_id: e.target.value, transport_route: route?.route_name || '', pickup_stop: '' })); } : set(k)} disabled={((k === 'class_name' || k === 'academic_year') && !opts[k].length) || (k === 'pickup_stop' && !f.transport_route_id)} className={`appearance-none pr-9 border ${baseInput} ${hasErr ? 'border-[#4F46E5] ring-indigo-100 focus:ring-indigo-100' : 'border-[#ececee] focus:ring-indigo-100'} disabled:opacity-60`}>
                      <option value="">{ph}</option>
                      {(opts[k] || []).map((o) => <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>{typeof o === 'string' ? o : o.label}</option>)}
                    </select>
                  ) : (
                    <input data-testid={`add-student-${k}`} value={f[k]} onChange={set(k)} placeholder={ph} className={`border ${baseInput} placeholder:text-[#b0b0b0] ${hasErr ? 'border-[#4F46E5] focus:ring-indigo-100' : 'border-[#ececee] focus:ring-indigo-100 focus:border-indigo-200'}`} />
                  )}
                  {select && <ChevronDown className="w-4 h-4 text-[#aaa] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                </div>
                {hasErr && <p data-testid={`add-student-error-${k}`} className="text-[13px] text-[#4F46E5] mt-1">{errors[k]}</p>}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-3 mt-8">
          <button data-testid="add-student-cancel-btn" onClick={() => navigate(-1)} className="flex items-center gap-2 px-6 h-11 rounded-lg text-[14px] text-[#555] border border-gray-200 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /> Cancel</button>
          <button data-testid="add-student-save-btn" onClick={save} disabled={saving} className="flex items-center gap-2 px-6 h-11 rounded-lg text-[14px] font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] shadow-sm disabled:opacity-70">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save & Continue
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default AddStudent;
