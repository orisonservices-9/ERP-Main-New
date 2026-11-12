// Shared client-side utilities for search, CSV export and printing
export const filterRows = (rows, q, keys) => {
  if (!q || !q.trim()) return rows;
  const s = q.toLowerCase();
  return rows.filter((r) => keys.some((k) => String(r[k] ?? '').toLowerCase().includes(s)));
};

export const downloadCSV = (filename, headers, rows) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const printPage = () => window.print();

export const isActiveStudentOn = (student, targetDate = '') => {
  const activeStatuses = new Set(['', 'active', 'enrolled', 'admitted']);
  if (!activeStatuses.has(String(student?.status || '').trim().toLowerCase())) return false;
  const joined = String(student?.admission_date || student?.joining_date || student?.joined_on || '').slice(0, 10);
  const left = String(student?.exit_date || student?.withdrawal_date || student?.transfer_date || '').slice(0, 10);
  if (targetDate && joined && joined > targetDate) return false;
  if (targetDate && left && left < targetDate) return false;
  return true;
};
