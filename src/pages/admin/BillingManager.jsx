import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

const BILL_TYPES = [
  { value: 'hoa', label: 'HOA Dues' },
  { value: 'electric', label: 'Electric Bill' },
  { value: 'water', label: 'Water Bill' },
]

export default function BillingManager() {
  const [units, setUnits] = useState([])
  const [bills, setBills] = useState([])
  const [filterUnit, setFilterUnit] = useState('')
  const [form, setForm] = useState({
    unit_id: '',
    bill_type: 'hoa',
    period_label: '',
    amount: '',
    due_date: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [{ data: unitsData }, { data: billsData }] = await Promise.all([
      supabase.from('units').select('id, unit_number, monthly_dues').order('unit_number'),
      supabase
        .from('hoa_bills')
        .select('*, units(unit_number)')
        .order('due_date', { ascending: false }),
    ])
    setUnits(unitsData || [])
    setBills(billsData || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.unit_id || !form.period_label.trim() || !form.amount || !form.due_date) {
      setError('Please fill in all fields.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('hoa_bills').insert({
      unit_id: form.unit_id,
      bill_type: form.bill_type,
      period_label: form.period_label.trim(),
      amount: Number(form.amount),
      due_date: form.due_date,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ unit_id: '', bill_type: 'hoa', period_label: '', amount: '', due_date: '' })
    load()
  }

  async function markPaid(id) {
    await supabase
      .from('hoa_bills')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id)
    load()
  }

  async function markStatus(id, status) {
    await supabase.from('hoa_bills').update({ status }).eq('id', id)
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this bill?')) return
    await supabase.from('hoa_bills').delete().eq('id', id)
    load()
  }

  const visibleBills = filterUnit ? bills.filter((b) => b.unit_id === filterUnit) : bills
  const typeLabel = (t) => BILL_TYPES.find((bt) => bt.value === t)?.label || t

  return (
    <div className="grid2">
      <div className="card">
        <h2>Create a Bill</h2>
        <form onSubmit={handleSubmit}>
          <label>Unit</label>
          <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })}>
            <option value="">Select unit…</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unit_number}
              </option>
            ))}
          </select>
          <label>Bill Type</label>
          <select value={form.bill_type} onChange={(e) => setForm({ ...form, bill_type: e.target.value })}>
            {BILL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <label>Period</label>
          <input
            type="text"
            placeholder="e.g. July 2026"
            value={form.period_label}
            onChange={(e) => setForm({ ...form, period_label: e.target.value })}
          />
          <div className="two-col">
            <div>
              <label>Amount (₱)</label>
              <input
                type="number"
                step="0.01"
                placeholder="4500"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <label>Due date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create bill'}
          </button>
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Bills</h2>
          <select
            style={{ width: 140 }}
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
          >
            <option value="">All units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unit_number}
              </option>
            ))}
          </select>
        </div>
        {visibleBills.length === 0 && <div className="empty">No bills yet.</div>}
        <table className="mini-table">
          <tbody>
            {visibleBills.map((b) => (
              <tr key={b.id}>
                <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>
                  {b.units?.unit_number}
                </td>
                <td>
                  {typeLabel(b.bill_type)} — {b.period_label}
                  <br />
                  <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                    ₱{Number(b.amount).toLocaleString()} · due{' '}
                    {new Date(b.due_date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </td>
                <td>
                  <span className={`badge ${b.status}`}>{b.status}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {b.status !== 'paid' && (
                      <button className="link-btn" onClick={() => markPaid(b.id)}>
                        Mark paid
                      </button>
                    )}
                    {b.status === 'unpaid' && (
                      <button className="link-btn" onClick={() => markStatus(b.id, 'overdue')}>
                        Mark overdue
                      </button>
                    )}
                    <button className="link-btn danger" onClick={() => remove(b.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}