import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table } from '../../components/Shared';
import { Boxes, Package, Plus, Download, Receipt, IndianRupee, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Pencil, Loader2, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { filterRows, downloadCSV } from '../../utils';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

const defaultItemDraft = { item_name: '', category: 'Stationery', sku: '', unit: 'Units', quantity: '', reorder_level: '', unit_price: '', parent_price: '', supplier: '', location: 'Central Store', notes: '' };
const defaultMovement = { item_id: '', transaction_type: 'Issue', quantity: '', issue_to: '', recipient: '', reference: '', notes: '' };
const defaultPurchase = { item_id: '', purchase_date: new Date().toISOString().slice(0, 10), supplier: '', quantity: '', unit_cost: '', payment_method: 'Cash', reference: '', notes: '' };
const defaultParentIssue = { item_id: '', student_id: '', quantity: '', unit_price: '', due_date: '', reference: '', notes: '' };
const inventoryCategories = ['Textbooks & Workbooks', 'Stationery', 'Laboratory', 'Sports', 'IT & Electronics', 'Furniture & Fixtures', 'Uniforms', 'Transport', 'Housekeeping', 'Other'];
const inventoryUnits = ['Units', 'Boxes', 'Sets', 'Packets', 'Pieces', 'Copies'];
const issueTargets = ['Classroom', 'Teacher', 'Library', 'Science Lab', 'Computer Lab', 'Sports Department', 'Office', 'Transport', 'Housekeeping', 'Other'];
const expenseCategories = ['Salaries & Payroll', 'Utilities', 'Stationery & Supplies', 'Books & Academic', 'Transport', 'Repairs & Maintenance', 'Events & Activities', 'IT & Software', 'Rent & Facilities', 'Housekeeping', 'Other'];
const expenseMethods = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'];
const defaultExpense = { expense_date: new Date().toISOString().slice(0, 10), category: 'Stationery & Supplies', paid_to: '', description: '', amount: '', payment_method: 'Cash', reference: '', notes: '' };

export const InventoryManagement = ({ mode = 'overview' }) => {
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [students, setStudents] = useState([]);
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [draft, setDraft] = useState(defaultItemDraft);
  const [movement, setMovement] = useState(defaultMovement);
  const [purchase, setPurchase] = useState(defaultPurchase);
  const [parentIssue, setParentIssue] = useState(defaultParentIssue);
  const [screen, setScreen] = useState(mode);
  const [editId, setEditId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [itemRes, transactionRes, studentRes] = await Promise.all([api.get('/inventory/items'), api.get('/inventory/transactions'), api.get('/students')]);
      setItems(itemRes.data || []);
      setTransactions(transactionRes.data || []);
      setStudents(studentRes.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Inventory could not be loaded. Please make sure the backend is running.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setScreen(mode); setError(''); setMessage(''); }, [mode]);

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = !term ? items : items.filter((item) => [item.item_name, item.category, item.sku, item.location, item.supplier].some((value) => String(value || '').toLowerCase().includes(term)));
    return filtered.filter((item) => categoryFilter === 'All' || item.category === categoryFilter);
  }, [items, q, categoryFilter]);

  const stats = useMemo(() => {
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalValue = items.reduce((sum, item) => sum + Number(item.stock_value || 0), 0);
    const lowStock = items.filter((item) => item.stock_status === 'Low Stock' || item.stock_status === 'Out of Stock').length;
    return { totalItems, totalQuantity, totalValue, lowStock };
  }, [items]);

  const exportCSV = () => {
    downloadCSV('inventory-register.csv', ['Item', 'SKU', 'Category', 'In Stock', 'Unit', 'Reorder Level', 'Unit Price', 'Stock Value', 'Location', 'Status'], filteredRows.map((it) => [it.item_name, it.sku || '-', it.category, it.quantity, it.unit, it.reorder_level, it.unit_price, it.stock_value, it.location || '-', it.stock_status]));
  };

  const saveItem = async (event) => {
    event.preventDefault();
    if (!draft.item_name.trim()) { setError('Enter an item name.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...draft, quantity: Number(draft.quantity || 0), reorder_level: Number(draft.reorder_level || 0), unit_price: Number(draft.unit_price || 0), parent_price: Number(draft.parent_price || 0) };
      if (editId) await api.put(`/inventory/items/${editId}`, { ...payload, id: editId });
      else await api.post('/inventory/items', payload);
      setMessage(editId ? 'Inventory item updated.' : 'Inventory item added and opening stock recorded.');
      setDraft(defaultItemDraft); setEditId(''); setScreen('register'); await load();
    } catch (err) { setError(err.response?.data?.detail || 'Could not save this inventory item.'); }
    finally { setSaving(false); }
  };

  const recordMovement = async (event) => {
    event.preventDefault();
    if (!movement.item_id) { setError('Choose an inventory item.'); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/inventory/items/${movement.item_id}/movement`, { ...movement, quantity: Number(movement.quantity || 0) });
      setMessage(movement.transaction_type === 'Stock In' ? 'Stock received successfully.' : 'Items issued successfully.');
      setMovement(defaultMovement); setScreen('register'); await load();
    } catch (err) { setError(err.response?.data?.detail || 'Could not record this stock movement.'); }
    finally { setSaving(false); }
  };

  const recordPurchase = async (event) => {
    event.preventDefault();
    if (!purchase.item_id || !purchase.supplier.trim() || !Number(purchase.quantity || 0) || Number(purchase.unit_cost) < 0 || !purchase.reference.trim()) { setError('Choose the item and enter supplier, quantity, unit cost, and the PO or invoice number.'); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/inventory/items/${purchase.item_id}/purchase`, { ...purchase, quantity: Number(purchase.quantity), unit_cost: Number(purchase.unit_cost) });
      setPurchase(defaultPurchase); setMessage('Goods receipt posted. Stock and its paid purchase expense are now linked by the PO / invoice number.'); setScreen('register'); await load();
    } catch (err) { setError(err.response?.data?.detail || 'Could not save this purchase.'); }
    finally { setSaving(false); }
  };

  const issueToParent = async (event) => {
    event.preventDefault();
    if (!parentIssue.item_id || !parentIssue.student_id || !Number(parentIssue.quantity || 0) || !Number(parentIssue.unit_price || 0)) { setError('Choose the item and student, then enter quantity and the parent charge.'); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/inventory/items/${parentIssue.item_id}/issue-to-parent`, { ...parentIssue, quantity: Number(parentIssue.quantity), unit_price: Number(parentIssue.unit_price) });
      setParentIssue(defaultParentIssue); setMessage('Item issued. The amount was added to this student’s fee account.'); setScreen('register'); await load();
    } catch (err) { setError(err.response?.data?.detail || 'Could not issue this item to the parent.'); }
    finally { setSaving(false); }
  };

  const openEdit = (item) => {
    setDraft({ item_name: item.item_name || '', category: item.category || 'Stationery', sku: item.sku || '', unit: item.unit || 'Units', quantity: item.quantity ?? '', reorder_level: item.reorder_level ?? '', unit_price: item.unit_price ?? '', parent_price: item.parent_price ?? '', supplier: item.supplier || '', location: item.location || 'Central Store', notes: item.notes || '' });
    setEditId(item.id); setError(''); setMessage(''); setScreen('add');
  };

  const openMovement = (item, transaction_type) => { setMovement({ ...defaultMovement, item_id: item.id, transaction_type }); setError(''); setMessage(''); setScreen('movement'); };
  const itemById = items.find((item) => item.id === movement.item_id);
  const purchaseItem = items.find((item) => item.id === purchase.item_id);
  const parentIssueItem = items.find((item) => item.id === parentIssue.item_id);
  const lowStockItems = items.filter((item) => item.stock_status === 'Low Stock' || item.stock_status === 'Out of Stock');
  const categorySummary = useMemo(() => inventoryCategories.map((category) => {
    const categoryItems = items.filter((item) => item.category === category);
    return { category, count: categoryItems.length, quantity: categoryItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0), value: categoryItems.reduce((sum, item) => sum + Number(item.stock_value || 0), 0) };
  }).filter((row) => row.count), [items]);
  const recentMovements = transactions.slice(0, 6);
  const exportMovements = () => downloadCSV('inventory-movements.csv', ['Date', 'Item', 'Type', 'Quantity', 'Balance After', 'Issued To', 'Recipient', 'Reference'], transactions.map((row) => [new Date(row.created).toLocaleString(), row.item_name, row.transaction_type, row.quantity, row.balance_after, row.issue_to || '-', row.recipient || '-', row.reference || '-']));

  return (
    <Layout>
      <PageTitle title={screen === 'overview' ? 'Purchase & Stock Overview' : screen === 'purchase' ? 'Receive Purchased Stock' : screen === 'parent-issue' ? 'Issue Item to Parent' : screen === 'register' ? 'Stock Register' : screen === 'movement' ? 'Issue to Teacher / School' : screen === 'reports' ? 'Inventory Reports' : editId ? 'Edit Inventory Item' : 'Add Inventory Item'} subtitle={screen === 'overview' ? 'Track every item from supplier receipt to classroom, department, or parent issue.' : screen === 'purchase' ? 'Post goods only after they arrive. The PO or invoice links the stock receipt to the paid expense.' : screen === 'parent-issue' ? 'Issue books or other sellable items to a parent and add the charge to the selected student’s fees.' : screen === 'register' ? 'Maintain the master list of every item kept by the school.' : screen === 'movement' ? 'Issue school stock to teachers, departments or classrooms without charging a parent.' : screen === 'reports' ? 'Use these concise summaries for stock checks and purchase planning.' : 'Create a master record before receiving or issuing an item.'}
        actions={<div className="flex gap-2">{(screen === 'overview' || screen === 'register') && <Btn icon={Plus} onClick={() => { setDraft(defaultItemDraft); setEditId(''); setScreen('add'); }}>Add Inventory Item</Btn>}<Btn variant="outline" icon={Download} onClick={screen === 'movement' || screen === 'reports' ? exportMovements : exportCSV}>Export CSV</Btn></div>} />

      {(message || error) && <div className={`mb-5 flex items-center justify-between rounded-xl border px-4 py-3 text-[13px] ${error ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-green-200 bg-green-50 text-green-700'}`}><span>{error || message}</span><button onClick={() => { setError(''); setMessage(''); }} className="font-semibold">×</button></div>}

      <StatCards items={[
        { label: 'Total Items', value: String(stats.totalItems), icon: Boxes },
        { label: 'Total Quantity', value: String(stats.totalQuantity), icon: Package, tint: 'bg-green-50 text-green-600' },
        { label: 'Total Value', value: `₹${stats.totalValue.toLocaleString('en-IN')}`, icon: IndianRupee, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Needs Reorder', value: String(stats.lowStock), icon: AlertTriangle, tint: 'bg-indigo-50 text-[#4F46E5]' },
      ]} />

      {lowStockItems.length > 0 && <Card className="mb-6 border border-amber-200 bg-amber-50" pad="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[14px] font-semibold text-amber-800">Restock attention: {lowStockItems.length} item{lowStockItems.length === 1 ? '' : 's'}</p><p className="mt-1 text-[12px] text-amber-700">{lowStockItems.map((item) => `${item.item_name} (${item.quantity} ${item.unit})`).join(' · ')}</p></div><Btn variant="outline" icon={ArrowDownToLine} onClick={() => setScreen('purchase')}>Buy / Receive Stock</Btn></div></Card>}

      {screen === 'overview' && <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card title="Restock priority" subtitle="Items at or below their reorder level." className="xl:col-span-3" pad="p-0"><div className="overflow-x-auto"><Table columns={[{ label: 'Item' }, { label: 'Available' }, { label: 'Reorder at' }, { label: 'Location' }, { label: '' }]}>{lowStockItems.slice(0, 6).map((item) => <tr key={item.id} className="border-b border-gray-50 last:border-0"><td className="px-6 py-3 text-[13px] font-medium">{item.item_name}<div className="mt-0.5 text-[11px] font-normal text-[#999]">{item.category}</div></td><td className="py-3 text-[13px] font-semibold text-indigo-600">{item.quantity} {item.unit}</td><td className="py-3 text-[13px] text-[#666]">{item.reorder_level} {item.unit}</td><td className="py-3 text-[13px] text-[#666]">{item.location || '—'}</td><td className="py-3 pr-5 text-right"><button onClick={() => { setPurchase({ ...defaultPurchase, item_id: item.id, supplier: item.supplier || '' }); setScreen('purchase'); }} className="text-[12px] font-semibold text-[#4F46E5]">Buy stock</button></td></tr>)}{!lowStockItems.length && <tr><td colSpan={5} className="py-12 text-center text-[13px] text-green-700">All stocked items are above their reorder level.</td></tr>}</Table></div></Card>
        <Card title="Recent stock activity" subtitle="Latest store entries and issues." className="xl:col-span-2" pad="p-0"><div className="divide-y divide-gray-100">{recentMovements.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="truncate text-[13px] font-semibold text-[#333]">{row.item_name}</p><p className="mt-0.5 text-[11px] text-[#999]">{row.transaction_type}{row.issue_to ? ` · ${row.issue_to}` : ''}</p></div><div className={`shrink-0 text-right text-[12px] font-semibold ${row.transaction_type === 'Issue' ? 'text-amber-700' : 'text-green-700'}`}>{row.transaction_type === 'Issue' ? '−' : '+'}{row.quantity} {row.unit}<p className="mt-0.5 text-[10px] font-normal text-[#999]">{row.created ? new Date(row.created).toLocaleDateString() : ''}</p></div></div>)}{!recentMovements.length && <div className="px-5 py-12 text-center text-[13px] text-[#999]">No store activity yet.</div>}</div></Card>
        <Card title="Stock by category" subtitle="Current quantity held in each active category." className="xl:col-span-5"><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{categorySummary.map((row) => <div key={row.category} className="rounded-xl border border-gray-100 bg-[#fcfcfc] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[13px] font-semibold text-[#333]">{row.category}</p><p className="mt-1 text-[12px] text-[#888]">{row.count} item{row.count === 1 ? '' : 's'} · ₹{row.value.toLocaleString('en-IN')}</p></div><span className="rounded-lg bg-indigo-50 px-2 py-1 text-[12px] font-semibold text-[#4F46E5]">{row.quantity}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#4F46E5]" style={{ width: `${Math.max(8, Math.min(100, stats.totalQuantity ? (row.quantity / stats.totalQuantity) * 100 : 0))}%` }} /></div></div>)}{!categorySummary.length && <p className="py-8 text-center text-[13px] text-[#999] md:col-span-2 xl:col-span-3">Category summary appears after inventory items are added.</p>}</div></Card>
      </div>}

      {screen === 'add' && <Card title={editId ? 'Edit inventory item' : 'Add inventory item'} subtitle="Add a new item and its opening stock. Use Receive / Issue later for every stock movement." className="mb-6">
        <form onSubmit={saveItem} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input required value={draft.item_name} onChange={(e) => setDraft({ ...draft, item_name: e.target.value })} placeholder="Item name, e.g. A4 paper" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300">{inventoryCategories.map((option) => <option key={option}>{option}</option>)}</select>
          <input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} placeholder="SKU / item code (optional)" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <input type="number" min="0" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} placeholder="Opening quantity" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300">{inventoryUnits.map((option) => <option key={option}>{option}</option>)}</select>
          <input type="number" min="0" step="0.01" value={draft.unit_price} onChange={(e) => setDraft({ ...draft, unit_price: e.target.value })} placeholder="Unit price (₹)" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <input type="number" min="0" step="0.01" value={draft.parent_price} onChange={(e) => setDraft({ ...draft, parent_price: e.target.value })} placeholder="Parent charge per unit (₹)" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <input type="number" min="0" value={draft.reorder_level} onChange={(e) => setDraft({ ...draft, reorder_level: e.target.value })} placeholder="Reorder level" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <input value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} placeholder="Supplier (optional)" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Storage location" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes (optional)" className="min-h-[82px] rounded-lg border border-gray-200 p-3 text-[13px] outline-none focus:border-indigo-300 md:col-span-2 xl:col-span-3" />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 text-[12px] text-[#666] md:col-span-2 xl:col-span-3"><span>Opening stock value: <strong className="text-[#222]">₹{(Number(draft.quantity || 0) * Number(draft.unit_price || 0)).toLocaleString('en-IN')}</strong></span><div className="flex gap-2"><Btn variant="outline" onClick={() => { setDraft(defaultItemDraft); setEditId(''); setScreen('register'); }}>Cancel</Btn><Btn type="submit" icon={saving ? Loader2 : Plus}>{saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Item'}</Btn></div></div>
        </form>
      </Card>}

      {screen === 'purchase' && <Card title="Receive purchased stock" subtitle="Use this after goods arrive. It updates the store balance and records the matching paid purchase expense." className="mb-6">
        <form onSubmit={recordPurchase} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <select required value={purchase.item_id} onChange={(e) => { const selected = items.find((item) => item.id === e.target.value); setPurchase({ ...purchase, item_id: e.target.value, supplier: selected?.supplier || purchase.supplier, unit_cost: selected?.unit_price ?? purchase.unit_cost }); }} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300"><option value="">Choose stock item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.item_name} — {item.quantity} {item.unit} in stock</option>)}</select>
          <input required type="date" value={purchase.purchase_date} onChange={(e) => setPurchase({ ...purchase, purchase_date: e.target.value })} className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <input required value={purchase.supplier} onChange={(e) => setPurchase({ ...purchase, supplier: e.target.value })} placeholder="Supplier / vendor" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <input required type="number" min="1" value={purchase.quantity} onChange={(e) => setPurchase({ ...purchase, quantity: e.target.value })} placeholder="Quantity purchased" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <input required type="number" min="0" step="0.01" value={purchase.unit_cost} onChange={(e) => setPurchase({ ...purchase, unit_cost: e.target.value })} placeholder="Purchase cost per unit (₹)" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <select value={purchase.payment_method} onChange={(e) => setPurchase({ ...purchase, payment_method: e.target.value })} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300">{expenseMethods.map((method) => <option key={method}>{method}</option>)}</select>
          <input required value={purchase.reference} onChange={(e) => setPurchase({ ...purchase, reference: e.target.value })} placeholder="PO / invoice number (required)" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300 md:col-span-2 xl:col-span-3" />
          <textarea value={purchase.notes} onChange={(e) => setPurchase({ ...purchase, notes: e.target.value })} placeholder="Purchase notes (optional)" className="min-h-[82px] rounded-lg border border-gray-200 p-3 text-[13px] outline-none focus:border-indigo-300 md:col-span-2 xl:col-span-3" />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-green-50 px-4 py-3 text-[12px] text-green-800 md:col-span-2 xl:col-span-3"><span>{purchaseItem ? `This adds ${purchase.quantity || 0} ${purchaseItem.unit} to ${purchaseItem.item_name}.` : 'Choose a stock item to continue.'} <strong className="ml-2">Paid purchase value: ₹{(Number(purchase.quantity || 0) * Number(purchase.unit_cost || 0)).toLocaleString('en-IN')}</strong></span><div className="flex gap-2"><Btn variant="outline" onClick={() => setScreen('register')}>Cancel</Btn><Btn type="submit" icon={saving ? Loader2 : ArrowDownToLine}>{saving ? 'Posting...' : 'Post Goods Receipt'}</Btn></div></div>
        </form>
      </Card>}

      {screen === 'parent-issue' && <Card title="Issue item to a parent" subtitle="Use this for books or saleable items. Stock reduces and the selected student receives a new fee due automatically." className="mb-6">
        <form onSubmit={issueToParent} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <select required value={parentIssue.item_id} onChange={(e) => { const selected = items.find((item) => item.id === e.target.value); setParentIssue({ ...parentIssue, item_id: e.target.value, unit_price: selected?.parent_price ?? parentIssue.unit_price }); }} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300"><option value="">Choose book / item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.item_name} — {item.quantity} {item.unit} available</option>)}</select>
          <select required value={parentIssue.student_id} onChange={(e) => setParentIssue({ ...parentIssue, student_id: e.target.value })} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300"><option value="">Choose student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name} — {student.admission_no || student.id} · {student.class_name} / {student.section}</option>)}</select>
          <input required type="number" min="1" value={parentIssue.quantity} onChange={(e) => setParentIssue({ ...parentIssue, quantity: e.target.value })} placeholder="Quantity issued" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <input required type="number" min="0.01" step="0.01" value={parentIssue.unit_price} onChange={(e) => setParentIssue({ ...parentIssue, unit_price: e.target.value })} placeholder="Charge parent per unit (₹)" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <input type="date" value={parentIssue.due_date} onChange={(e) => setParentIssue({ ...parentIssue, due_date: e.target.value })} className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <input value={parentIssue.reference} onChange={(e) => setParentIssue({ ...parentIssue, reference: e.target.value })} placeholder="Issue reference (optional)" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <textarea value={parentIssue.notes} onChange={(e) => setParentIssue({ ...parentIssue, notes: e.target.value })} placeholder="Notes (optional)" className="min-h-[82px] rounded-lg border border-gray-200 p-3 text-[13px] outline-none focus:border-indigo-300 md:col-span-2 xl:col-span-3" />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-50 px-4 py-3 text-[12px] text-blue-800 md:col-span-2 xl:col-span-3"><span>{parentIssueItem ? `${parentIssue.quantity || 0} ${parentIssueItem.unit} will be issued from ${parentIssueItem.item_name}.` : 'Choose an item and student to continue.'} <strong className="ml-2">Fee added: ₹{(Number(parentIssue.quantity || 0) * Number(parentIssue.unit_price || 0)).toLocaleString('en-IN')}</strong></span><div className="flex gap-2"><Btn variant="outline" onClick={() => setScreen('register')}>Cancel</Btn><Btn type="submit" icon={saving ? Loader2 : ArrowUpFromLine}>{saving ? 'Saving...' : 'Issue & Add Parent Fee'}</Btn></div></div>
        </form>
      </Card>}

      {screen === 'movement' && <Card title="Issue to teacher or school" subtitle="Use this for internal school use only. It reduces stock but does not create a parent fee." className="mb-6">
        <form onSubmit={recordMovement} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="flex h-11 items-center rounded-lg border border-blue-100 bg-blue-50 px-3 text-[13px] font-medium text-blue-800">Internal school issue</div>
          <select required value={movement.item_id} onChange={(e) => setMovement({ ...movement, item_id: e.target.value })} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300"><option value="">Choose item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.item_name} — {item.quantity} {item.unit} available</option>)}</select>
          <input required type="number" min="1" value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: e.target.value })} placeholder="Quantity" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <select required value={movement.issue_to} onChange={(e) => setMovement({ ...movement, issue_to: e.target.value })} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300"><option value="">Issued to</option>{issueTargets.map((option) => <option key={option}>{option}</option>)}</select>
          <input value={movement.recipient} onChange={(e) => setMovement({ ...movement, recipient: e.target.value })} placeholder="Teacher / class / department" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <input value={movement.reference} onChange={(e) => setMovement({ ...movement, reference: e.target.value })} placeholder="Issue reference (optional)" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" />
          <textarea value={movement.notes} onChange={(e) => setMovement({ ...movement, notes: e.target.value })} placeholder="Notes (optional)" className="min-h-[82px] rounded-lg border border-gray-200 p-3 text-[13px] outline-none focus:border-indigo-300 md:col-span-2 xl:col-span-3" />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 text-[12px] text-[#666] md:col-span-2 xl:col-span-3"><span>{itemById ? `Available now: ${itemById.quantity} ${itemById.unit}` : 'Choose an item to see its current stock.'}</span><div className="flex gap-2"><Btn variant="outline" onClick={() => setScreen('register')}>Cancel</Btn><Btn type="submit" icon={ArrowUpFromLine}>{saving ? 'Saving...' : 'Issue Items'}</Btn></div></div>
        </form>
      </Card>}

      {screen === 'register' && <Card title="All stock items" subtitle="Search, review or update one inventory item at a time." action={<div className="flex flex-wrap gap-2"><SearchBar placeholder="Search item, SKU or location..." className="w-60" value={q} onChange={(e) => setQ(e.target.value)} /><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-[12px] text-[#444] outline-none focus:border-indigo-300"><option value="All">All categories</option>{inventoryCategories.map((option) => <option key={option}>{option}</option>)}</select></div>}>
        <Table columns={[{label:'Item'},{label:'Category'},{label:'Available'},{label:'Reorder at'},{label:'Value'},{label:'Location'},{label:'Status'},{label:''}]}>
          {filteredRows.map((it) => (
            <tr key={it.id} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3 text-[13px] font-medium text-[#1a1a1a]"><div>{it.item_name}</div><div className="mt-0.5 text-[11px] font-normal text-[#999]">{it.sku || 'No SKU'} {it.supplier ? `· ${it.supplier}` : ''}</div></td>
              <td className="py-3 text-[13px] text-[#666]">{it.category}</td>
              <td className="py-3 text-[13px] font-semibold text-[#333]">{it.quantity} <span className="font-normal text-[#888]">{it.unit}</span></td>
              <td className="py-3 text-[13px] text-[#666]">{it.reorder_level} {it.unit}</td>
              <td className="py-3 text-[13px] font-semibold text-[#333]">₹{Number(it.stock_value || 0).toLocaleString('en-IN')}</td>
              <td className="py-3 text-[13px] text-[#666]">{it.location || '—'}</td>
              <td className="py-3"><Badge color={it.stock_status === 'In Stock' ? 'green' : it.stock_status === 'Low Stock' ? 'amber' : 'red'}>{it.stock_status}</Badge></td>
              <td className="py-3 pr-2"><div className="flex justify-end gap-2"><button onClick={() => { setPurchase({ ...defaultPurchase, item_id: it.id, supplier: it.supplier || '', unit_cost: it.unit_price || '' }); setScreen('purchase'); }} className="rounded-md border border-green-200 px-2 py-1 text-[11px] font-semibold text-green-700">Buy</button><button onClick={() => { setParentIssue({ ...defaultParentIssue, item_id: it.id, unit_price: it.parent_price || '' }); setScreen('parent-issue'); }} className="rounded-md border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700">Parent</button><button onClick={() => openMovement(it, 'Issue')} className="rounded-md border border-amber-200 px-2 py-1 text-[11px] font-semibold text-amber-700">School</button><button onClick={() => openEdit(it)} className="rounded-md border border-gray-200 p-1.5 text-[#666]"><Pencil className="h-3.5 w-3.5" /></button></div></td>
            </tr>
          ))}
          {filteredRows.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-[13px] text-[#999]">{loading ? 'Loading inventory...' : 'No inventory items yet. Add the first item to start the register.'}</td></tr>}
        </Table>
      </Card>}

      {screen === 'reports' && <div className="space-y-6"><Card title="Category stock report" subtitle="A concise summary for purchasing and stock verification." pad="p-0"><Table columns={[{label:'Category'},{label:'Items'},{label:'Available Units'},{label:'Current Value'},{label:'Stock Health'}]}>{categorySummary.map((row) => <tr key={row.category} className="border-b border-gray-50 last:border-0"><td className="px-6 py-3 text-[13px] font-medium">{row.category}</td><td className="py-3 text-[13px] text-[#666]">{row.count}</td><td className="py-3 text-[13px] font-semibold">{row.quantity}</td><td className="py-3 text-[13px] font-semibold">₹{row.value.toLocaleString('en-IN')}</td><td className="py-3"><Badge color={items.some((item) => item.category === row.category && item.stock_status !== 'In Stock') ? 'amber' : 'green'}>{items.some((item) => item.category === row.category && item.stock_status !== 'In Stock') ? 'Needs review' : 'Healthy'}</Badge></td></tr>)}{!categorySummary.length && <tr><td colSpan={5} className="py-10 text-center text-[13px] text-[#999]">No inventory data is available for reporting yet.</td></tr>}</Table></Card><Card title="Inventory audit download" subtitle="Use the files below to share a simple stock check with management."><div className="flex flex-wrap gap-3"><Btn variant="outline" icon={Download} onClick={exportCSV}>Download Stock Register</Btn><Btn variant="outline" icon={Download} onClick={exportMovements}>Download Stock Movement</Btn></div></Card></div>}
    </Layout>
  );
};

export const ExpensesManagement = ({ mode = 'overview' }) => {
  const { auth } = useAuth();
  const [screen, setScreen] = useState(mode);
  const [expenses, setExpenses] = useState([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [draft, setDraft] = useState(defaultExpense);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const role = auth?.role || '';
  const canCreateExpense = ['admin', 'fee_manager'].includes(role);
  const canApproveExpense = ['admin', 'principal', 'director'].includes(role);
  const canPayExpense = ['admin', 'fee_manager'].includes(role);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/expenses'); setExpenses(data || []); }
    catch (err) { setError(err.response?.data?.detail || 'Expenses could not be loaded. Please make sure the backend is running.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setScreen(mode); setMessage(''); setError(''); }, [mode]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return expenses.filter((row) => (categoryFilter === 'All' || row.category === categoryFilter) && (!term || [row.paid_to, row.description, row.category, row.reference, row.payment_method].some((value) => String(value || '').toLowerCase().includes(term))));
  }, [expenses, query, categoryFilter]);
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const expenseStatus = (row) => row.status || 'Paid';
  const paidExpenses = expenses.filter((row) => expenseStatus(row) === 'Paid');
  const pendingExpenses = expenses.filter((row) => expenseStatus(row) === 'Pending Approval');
  const approvedExpenses = expenses.filter((row) => expenseStatus(row) === 'Approved');
  const totalSpend = paidExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const monthSpend = paidExpenses.filter((row) => String(row.expense_date || '').startsWith(thisMonth)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const pendingValue = pendingExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const approvedValue = approvedExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const categoryTotals = useMemo(() => expenseCategories.map((category) => ({ category, amount: paidExpenses.filter((row) => row.category === category).reduce((sum, row) => sum + Number(row.amount || 0), 0), count: paidExpenses.filter((row) => row.category === category).length })).filter((row) => row.count), [paidExpenses]);
  const actionQueue = expenses.filter((row) => ['Pending Approval', 'Approved'].includes(expenseStatus(row))).slice(0, 7);
  const maxCategoryAmount = Math.max(...categoryTotals.map((row) => row.amount), 1);
  const exportCSV = () => downloadCSV('school-expenses.csv', ['Date', 'Category', 'Payee', 'Description', 'Amount', 'Status', 'Payment Method', 'Reference', 'Source', 'Requested By', 'Approved By', 'Paid By'], filtered.map((row) => [row.expense_date, row.category, row.paid_to, row.description, row.amount, expenseStatus(row), row.payment_method, row.reference || '-', row.source || 'Legacy Entry', row.recorded_by || '-', row.approved_by || '-', row.paid_by || '-']));

  const saveExpense = async (event) => {
    event.preventDefault();
    if (!draft.paid_to.trim() || !draft.description.trim() || !Number(draft.amount || 0)) { setError('Enter the payee, description and amount.'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/expenses', { ...draft, amount: Number(draft.amount) });
      setDraft(defaultExpense); setMessage('Expense request submitted for approval. No payment is counted until it is approved and marked paid.'); setScreen('register'); await load();
    } catch (err) { setError(err.response?.data?.detail || 'Could not record this expense.'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (row, status) => {
    setSaving(true); setError('');
    try {
      await api.put(`/expenses/${row.id}/status`, { status });
      setMessage(status === 'Approved' ? 'Expense approved and moved to the payment queue.' : status === 'Paid' ? 'Payment completed and included in actual school spend.' : 'Expense request rejected.');
      await load();
    } catch (err) { setError(err.response?.data?.detail || 'Could not update this expense.'); }
    finally { setSaving(false); }
  };

  const expenseActions = (row, compact = false) => {
    const status = expenseStatus(row);
    const buttonSize = compact ? 'px-2.5 py-1.5' : 'px-3 py-1.5';
    if (status === 'Pending Approval' && canApproveExpense) return <>
      <button disabled={saving} onClick={() => updateStatus(row, 'Rejected')} className={`rounded-md border border-red-200 ${buttonSize} text-[11px] font-semibold text-red-600`}>Reject</button>
      <button disabled={saving} onClick={() => updateStatus(row, 'Approved')} className={`rounded-md bg-[#4F46E5] ${buttonSize} text-[11px] font-semibold text-white`}>Approve</button>
    </>;
    if (status === 'Approved' && canPayExpense) return <button disabled={saving} onClick={() => updateStatus(row, 'Paid')} className={`rounded-md bg-green-600 ${buttonSize} text-[11px] font-semibold text-white`}>Mark Paid</button>;
    if (status === 'Paid') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700"><CheckCircle2 className="h-3.5 w-3.5"/> Complete</span>;
    if (status === 'Rejected') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600"><XCircle className="h-3.5 w-3.5"/> Closed</span>;
    return <span className="text-[11px] font-medium text-[#888]">Awaiting authorized staff</span>;
  };

  const title = screen === 'overview' ? 'Expense Overview' : screen === 'record' ? 'Record Expense' : screen === 'register' ? 'Expense Register' : 'Expense Reports';
  const subtitle = screen === 'overview' ? 'Control every school expense from request and approval to final payment.' : screen === 'record' ? 'Submit a purchase or payment request with the bill details for approval.' : screen === 'register' ? 'Review the full audit trail and complete the next required action.' : 'Review only completed payments by category and download the complete audit register.';

  return <Layout>
    <PageTitle title={title} subtitle={subtitle} actions={<div className="flex gap-2">{canCreateExpense && (screen === 'overview' || screen === 'register') && <Btn icon={Plus} onClick={() => { setDraft(defaultExpense); setScreen('record'); }}>New Expense Request</Btn>}<Btn variant="outline" icon={Download} onClick={exportCSV}>Download Register</Btn></div>} />
    {(message || error) && <div className={`mb-5 flex items-center justify-between rounded-xl border px-4 py-3 text-[13px] ${error ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-green-200 bg-green-50 text-green-700'}`}><span>{error || message}</span><button onClick={() => { setError(''); setMessage(''); }} className="font-semibold">×</button></div>}
    {screen === 'overview' && <div className="mb-6 overflow-hidden rounded-[24px] bg-gradient-to-r from-[#11153b] via-[#252062] to-[#4f258f] p-6 text-white shadow-[0_18px_45px_rgba(44,35,107,0.18)]"><div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"><ShieldCheck className="h-3.5 w-3.5" /> Expense Control</div><h2 className="text-[26px] font-bold">Request → Approve → Pay</h2><p className="mt-2 max-w-2xl text-[13px] leading-6 text-white/65">Only completed payments count as actual spend. Pending requests and approved bills remain visible until action is taken.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="min-w-[145px] rounded-2xl border border-white/15 bg-white/10 p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Paid this month</p><p className="mt-2 text-xl font-bold">₹{monthSpend.toLocaleString('en-IN')}</p></div><div className="min-w-[145px] rounded-2xl border border-white/15 bg-white/10 p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Awaiting approval</p><p className="mt-2 text-xl font-bold">{pendingExpenses.length}</p><p className="text-[10px] text-white/50">₹{pendingValue.toLocaleString('en-IN')}</p></div><div className="min-w-[145px] rounded-2xl border border-white/15 bg-white/10 p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Ready to pay</p><p className="mt-2 text-xl font-bold">{approvedExpenses.length}</p><p className="text-[10px] text-white/50">₹{approvedValue.toLocaleString('en-IN')}</p></div><div className="min-w-[145px] rounded-2xl border border-white/15 bg-white/10 p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">All-time paid</p><p className="mt-2 text-xl font-bold">₹{totalSpend.toLocaleString('en-IN')}</p></div></div></div></div>}

    {screen === 'overview' && <div className="grid grid-cols-1 gap-6 xl:grid-cols-5"><Card title="Action queue" subtitle="Requests that need approval or payment." className="xl:col-span-3" pad="p-0"><div className="divide-y divide-gray-100">{actionQueue.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-[13px] font-semibold text-[#222]">{row.description}</p><Badge color={expenseStatus(row) === 'Approved' ? 'green' : 'amber'}>{expenseStatus(row)}</Badge></div><p className="mt-1 text-[11px] text-[#888]">{row.paid_to} · {row.category} · {row.expense_date}</p></div><div className="flex items-center gap-2"><span className="mr-2 text-[14px] font-bold text-[#252062]">₹{Number(row.amount || 0).toLocaleString('en-IN')}</span>{expenseActions(row)}</div></div>)}{!actionQueue.length && <div className="px-5 py-14 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-green-500"/><p className="mt-3 text-[13px] font-semibold text-[#333]">All expense work is complete</p><p className="mt-1 text-[11px] text-[#999]">There are no requests waiting for approval or payment.</p></div>}</div></Card><Card title="Paid spend by category" subtitle="Completed payments only." className="xl:col-span-2"><div className="space-y-4">{categoryTotals.slice(0, 6).map((row) => <div key={row.category}><div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]"><span className="font-medium text-[#444]">{row.category}</span><span className="font-semibold text-[#333]">₹{row.amount.toLocaleString('en-IN')}</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#4F46E5]" style={{ width: `${(row.amount / maxCategoryAmount) * 100}%` }} /></div></div>)}{!categoryTotals.length && <p className="py-12 text-center text-[13px] text-[#999]">Paid expenses will appear here.</p>}</div></Card></div>}

    {screen === 'record' && !canCreateExpense && <Card title="Expense request access" subtitle="Only the Admin or Fee Manager can submit a new expense request."><p className="text-[13px] text-[#666]">You can review the expense register, but this staff role cannot create financial requests.</p></Card>}
    {screen === 'record' && canCreateExpense && <Card title="Expense request details" subtitle="Enter the expected payee and bill details. Submission does not count as a payment."><form onSubmit={saveExpense} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"><input required type="date" value={draft.expense_date} onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })} className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" /><select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300">{expenseCategories.map((category) => <option key={category}>{category}</option>)}</select><input required value={draft.paid_to} onChange={(e) => setDraft({ ...draft, paid_to: e.target.value })} placeholder="Vendor / employee / payee" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" /><input required value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What is this request for?" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" /><input required type="number" min="0.01" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="Requested amount (₹)" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300" /><select value={draft.payment_method} onChange={(e) => setDraft({ ...draft, payment_method: e.target.value })} className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300">{expenseMethods.map((method) => <option key={method}>{method}</option>)}</select><input value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} placeholder="Quotation / bill / voucher reference (optional)" className="h-11 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-300 md:col-span-2 xl:col-span-3" /><textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Approval notes or purpose (optional)" className="min-h-[90px] rounded-lg border border-gray-200 p-3 text-[13px] outline-none focus:border-indigo-300 md:col-span-2 xl:col-span-3" /><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-[12px] text-amber-800 md:col-span-2 xl:col-span-3"><span>Amount requested: <strong>₹{Number(draft.amount || 0).toLocaleString('en-IN')}</strong> · Payment will be counted only after approval.</span><div className="flex gap-2"><Btn variant="outline" onClick={() => setScreen('register')}>Cancel</Btn><Btn type="submit" icon={saving ? Loader2 : Plus}>{saving ? 'Submitting...' : 'Submit for Approval'}</Btn></div></div></form></Card>}

    {screen === 'register' && <Card title="Expense approval & payment register" subtitle="Each request shows its next required action and full payment reference." action={<div className="flex flex-wrap gap-2"><SearchBar placeholder="Search expenses..." className="w-56" value={query} onChange={(e) => setQuery(e.target.value)} /><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-[12px] text-[#444]"><option value="All">All categories</option>{expenseCategories.map((category) => <option key={category}>{category}</option>)}</select></div>}><Table columns={[{ label: 'Date' }, { label: 'Expense / Payee' }, { label: 'Amount' }, { label: 'Status' }, { label: 'Reference' }, { label: 'Next Action', align: 'right' }]}>{filtered.map((row) => <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]"><td className="py-3 text-[12px] text-[#666]">{row.expense_date}<div className="mt-1 text-[10px] text-[#aaa]">{row.category}</div></td><td className="py-3 text-[13px]"><div className="font-semibold text-[#333]">{row.description}</div><div className="mt-0.5 text-[11px] text-[#888]">{row.paid_to} · {row.payment_method}</div></td><td className="py-3 text-[13px] font-bold text-[#252062]">₹{Number(row.amount || 0).toLocaleString('en-IN')}</td><td className="py-3"><Badge color={expenseStatus(row) === 'Paid' ? 'green' : expenseStatus(row) === 'Rejected' ? 'red' : expenseStatus(row) === 'Approved' ? 'blue' : 'amber'}>{expenseStatus(row)}</Badge></td><td className="py-3 text-[12px] text-[#777]">{row.reference || '—'}<div className="mt-1 text-[10px] text-[#aaa]">{row.source || 'Legacy entry'}</div></td><td className="py-3 pr-2"><div className="flex justify-end gap-2">{expenseActions(row, true)}</div></td></tr>)}{!filtered.length && <tr><td colSpan={6} className="py-10 text-center text-[13px] text-[#999]">{loading ? 'Loading expenses...' : 'No expense entries found.'}</td></tr>}</Table></Card>}

    {screen === 'reports' && <div className="space-y-6"><Card title="Expense category report" subtitle="A clear summary of what the school has spent money on." pad="p-0"><Table columns={[{ label: 'Category' }, { label: 'Expense Entries' }, { label: 'Total Spent', align: 'right' }, { label: 'Share of Spend', align: 'right' }]}>{categoryTotals.map((row) => <tr key={row.category} className="border-b border-gray-50 last:border-0"><td className="px-6 py-3 text-[13px] font-medium">{row.category}</td><td className="py-3 text-[13px] text-[#666]">{row.count}</td><td className="py-3 text-right text-[13px] font-semibold">₹{row.amount.toLocaleString('en-IN')}</td><td className="py-3 pr-6 text-right text-[13px] text-[#666]">{totalSpend ? ((row.amount / totalSpend) * 100).toFixed(1) : 0}%</td></tr>)}{!categoryTotals.length && <tr><td colSpan={4} className="py-10 text-center text-[13px] text-[#999]">No expense data is available for reporting yet.</td></tr>}</Table></Card><Card title="Management download" subtitle="Download the full expense register when you need to share outgoing-payment data."><Btn variant="outline" icon={Download} onClick={exportCSV}>Download Expense Register</Btn></Card></div>}
  </Layout>;
};
