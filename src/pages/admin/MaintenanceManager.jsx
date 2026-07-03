import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

const STATUS_OPTIONS = ['scheduled', 'in_progress', 'completed', 'cancelled']

export default function MaintenanceManager({ profile }) {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    area: '',
    scheduled_date: '',
    scheduled_time: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase
      .from('maintenance_schedule')
      .select('*')
      .order('scheduled_date', { ascending: true })
    setItems(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.title.trim() || !form.scheduled_date) {
      setError('Please fill in a title and date.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('maintenance_schedule').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      area: form.area.trim() || null,
      scheduled_date: form.scheduled_date,
      scheduled_time: form.scheduled_time.trim() || null,
      created_by: profile.id,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ title: '', description: '', area: '', scheduled_date: '', scheduled_time: '' })
    load()
  }

  async function updateStatus(id, status) {
    await supabase.from('maintenance_schedule').update({ status }).eq('id', id)
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this maintenance entry?')) return
    await supabase.from('maintenance_schedule').delete().eq('id', id)
    load()
  }

  return (
    <div className="grid2">
      <div className="card">
        <h2>Schedule Maintenance</h2>
        <form onSubmit={handleSubmit}>
          <label>Title</label>
          <input
            type="text"
            placeholder="e.g. Elevator servicing"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <label>Area</label>
          <input
            type="text"
            placeholder="e.g. Tower 1 Lobby"
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
          />
          <div className="two-col">
            <div>
              <label>Date</label>
              <input
                type="date"
                value={form.scheduled_date}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
              />
            </div>
            <div>
              <label>Time (optional)</label>
              <input
                type="text"
                placeholder="e.g. 9AM - 12PM"
                value={form.scheduled_time}
                onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
              />
            </div>
          </div>
          <label>Description (optional)</label>
          <textarea
            rows={3}
            placeholder="Notes for residents..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Add to schedule'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Upcoming & Past Work</h2>
        {items.length === 0 && <div className="empty">Nothing scheduled yet.</div>}
        {items.map((m) => (
          <div className="list-item" key={m.id}>
            <div style={{ flex: 1 }}>
              <div className="title">{m.title}</div>
              <div className="meta">
                {m.area}
                {m.scheduled_time ? `, ${m.scheduled_time}` : ''} ·{' '}
                {new Date(m.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                <select
                  value={m.status}
                  onChange={(e) => updateStatus(m.id, e.target.value)}
                  style={{ width: 'auto', padding: '5px 8px', fontSize: 12.5 }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <button className="link-btn danger" onClick={() => remove(m.id)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}