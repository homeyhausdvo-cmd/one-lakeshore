import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const TOWERS = ['Tower 1', 'Tower 2', 'Tower 3', 'Tower 4']

export default function ManagerDashboard({ profile }) {
  const [permits, setPermits] = useState([])
  const [form, setForm] = useState({
    tower: TOWERS[0],
    unit_number: '',
    worker_names: '',
    company: '',
    purpose: '',
    valid_from: '',
    valid_to: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase
      .from('work_permits')
      .select('*')
      .eq('submitted_by', profile.id)
      .order('created_at', { ascending: false })
    setPermits(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.unit_number.trim() || !form.worker_names.trim() || !form.valid_from || !form.valid_to) {
      setError('Please fill in unit number, worker name(s), and both dates.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('work_permits').insert({
      submitted_by: profile.id,
      tower: form.tower,
      unit_number: form.unit_number.trim(),
      worker_names: form.worker_names.trim(),
      company: form.company.trim() || null,
      purpose: form.purpose.trim() || null,
      valid_from: form.valid_from,
      valid_to: form.valid_to,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ tower: TOWERS[0], unit_number: '', worker_names: '', company: '', purpose: '', valid_from: '', valid_to: '' })
    load()
  }

  return (
    <div>
      <div className="view-header">
        <div className="eyebrow">Manager Portal</div>
        <h1>Welcome back, {profile.full_name}</h1>
        <div className="subtext">Submit work permits for approval</div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Submit a Work Permit</h2>
          <form onSubmit={handleSubmit}>
            <div className="two-col">
              <div>
                <label>Tower</label>
                <select value={form.tower} onChange={(e) => setForm({ ...form, tower: e.target.value })}>
                  {TOWERS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Unit Number</label>
                <input
                  type="text"
                  placeholder="e.g. 14B"
                  value={form.unit_number}
                  onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
                />
              </div>
            </div>
            <label>Worker Name(s)</label>
            <input
              type="text"
              placeholder="e.g. Juan Cruz, Pedro Reyes"
              value={form.worker_names}
              onChange={(e) => setForm({ ...form, worker_names: e.target.value })}
            />
            <label>Company (optional)</label>
            <input
              type="text"
              placeholder="e.g. ABC Renovation Services"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
            <label>Purpose of Work</label>
            <input
              type="text"
              placeholder="e.g. Bathroom renovation"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            />
            <div className="two-col">
              <div>
                <label>Valid From</label>
                <input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                />
              </div>
              <div>
                <label>Valid To</label>
                <input
                  type="date"
                  value={form.valid_to}
                  onChange={(e) => setForm({ ...form, valid_to: e.target.value })}
                />
              </div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit for approval'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Your Work Permits</h2>
          {permits.length === 0 && <div className="empty">No permits submitted yet.</div>}
          {permits.map((p) => (
            <div className="list-item" key={p.id}>
              <div>
                <div className="title">
                  {p.worker_names}
                  {' '}
                  <span className={`badge ${p.status === 'approved' ? 'paid' : p.status === 'rejected' ? 'overdue' : 'unpaid'}`}>
                    {p.status}
                  </span>
                </div>
                <div className="meta">
                  {p.tower}, Unit {p.unit_number} · {p.purpose}
                  <br />
                  {new Date(p.valid_from + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' → '}
                  {new Date(p.valid_to + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}