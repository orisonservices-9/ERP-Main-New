import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { PageTitle, StatCards, Card, Btn, Badge, SearchBar, Table } from '../../components/Shared';
import { INVENTORY, EXPENSES } from '../../mock2';
import { Boxes, AlertTriangle, XCircle, Package, Plus, Download, Receipt, TrendingDown, Wallet } from 'lucide-react';
import { filterRows, downloadCSV } from '../../utils';

export const InventoryManagement = () => {
  const [q, setQ] = useState('');
  const rows = filterRows(INVENTORY, q, ['item', 'category', 'status']);
  const exportCSV = () => downloadCSV('inventory.csv', ['Item', 'Category', 'Stock', 'Unit', 'Status'], rows.map((it) => [it.item, it.category, it.stock, it.unit, it.status]));
  return (
    <Layout>
      <PageTitle title="Inventory Management" subtitle="Track school assets, supplies and stock levels."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Plus}>Add Item</Btn></>} />
      <StatCards items={[
        { label: 'Total Items', value: '1,204', icon: Boxes },
        { label: 'In Stock', value: '1,142', icon: Package, tint: 'bg-green-50 text-green-600' },
        { label: 'Low Stock', value: '48', icon: AlertTriangle, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Out of Stock', value: '14', icon: XCircle, tint: 'bg-red-50 text-[#C4141B]' },
      ]} />
      <Card title="Stock Overview" action={<SearchBar placeholder="Search items..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Item'},{label:'Category'},{label:'Stock'},{label:'Unit'},{label:'Status'}]}>
          {rows.map((it) => (
            <tr key={it.item} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3 text-[13px] font-medium text-[#1a1a1a]">{it.item}</td>
              <td className="py-3 text-[13px] text-[#666]">{it.category}</td>
              <td className="py-3 text-[13px] font-semibold text-[#333]">{it.stock}</td>
              <td className="py-3 text-[13px] text-[#666]">{it.unit}</td>
              <td className="py-3"><Badge color={it.status==='In Stock'?'green':it.status==='Low Stock'?'amber':'red'}>{it.status}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-[13px] text-[#999]">No items found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};

export const ExpensesManagement = () => {
  const [q, setQ] = useState('');
  const rows = filterRows(EXPENSES, q, ['desc', 'category', 'method', 'status']);
  const exportCSV = () => downloadCSV('expenses.csv', ['Date', 'Category', 'Description', 'Method', 'Amount', 'Status'], rows.map((e) => [e.date, e.category, e.desc, e.method, e.amount, e.status]));
  return (
    <Layout>
      <PageTitle title="Expenses Management" subtitle="Record and monitor school expenditures."
        actions={<><Btn variant="outline" icon={Download} onClick={exportCSV}>Export</Btn><Btn icon={Plus}>Add Expense</Btn></>} />
      <StatCards items={[
        { label: 'This Month', value: '₹1.2L', icon: Wallet, tint: 'bg-red-50 text-[#C4141B]' },
        { label: 'Pending', value: '₹20,900', icon: Receipt, tint: 'bg-amber-50 text-amber-600' },
        { label: 'Avg / Day', value: '₹4,120', icon: TrendingDown, tint: 'bg-blue-50 text-blue-600' },
        { label: 'Transactions', value: '86', icon: Boxes },
      ]} />
      <Card title="Recent Expenses" action={<SearchBar placeholder="Search..." className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <Table columns={[{label:'Date'},{label:'Category'},{label:'Description'},{label:'Method'},{label:'Amount'},{label:'Status'}]}>
          {rows.map((e, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-[#fafafa]">
              <td className="py-3 text-[13px] text-[#666]">{e.date}</td>
              <td className="py-3"><Badge color="gray">{e.category}</Badge></td>
              <td className="py-3 text-[13px] font-medium text-[#333]">{e.desc}</td>
              <td className="py-3 text-[13px] text-[#666]">{e.method}</td>
              <td className="py-3 text-[13px] font-semibold text-[#333]">{e.amount}</td>
              <td className="py-3"><Badge color={e.status==='Paid'?'green':'amber'}>{e.status}</Badge></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-[#999]">No expenses found.</td></tr>}
        </Table>
      </Card>
    </Layout>
  );
};
