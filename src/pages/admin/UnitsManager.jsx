import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

const TOWERS = ['Tower 1', 'Tower 2', 'Tower 3', 'Tower 4']

const OCCUPANCY_LABELS = {
  owner_occupied: 'Owner-occupied',
  long_term_tenant: 'Long-term tenant',
  str: 'STR (short-term rental)',
}

export default function UnitsManager() {
  const [units, setUnits] = useState([])
  const [form, setForm] = useState({
    unit_number: '',
    owner_name: '',
    managed_by: '',
    occupancy_type: 'owner_occupied',
    building: TOWERS[0],
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.from('units').select('*').order('unit_number')
    setUnits(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.unit_number.trim() || !form.owner_name.trim() || !form.building) {
      setError('Please fill in unit number, owner name, and tower.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('units').insert({
      unit_number: form.unit_number.trim(),
      owner_name: form.owner_name.trim(),
      managed_by: form.managed_by.trim() || null,
      occupancy_type: form.occupancy_type,
      building: form.building,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ unit_number: '', owner_name: '', managed_by: '', occupancy_type: 'owner_occupied', building: TOWERS[0] })
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this unit? This will also delete its bills and guest records.')) return
    await supabase.from('units').delete().eq('id', id)
    load()
  }

  return (
    <div className="grid2">
      <div className="card">
        <h2>Add a Unit</h2>
        <form onSubmit={handleSubmit}>
          <label>Unit #</label>
          <input
            type="text"
            placeholder="e.g. 14B"
            value={form.unit_number}
            onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
          />
          <label>Owner's Name</label>
          <input
            type="text"
            placeholder="e.g. Juan Dela Cruz"
            value={form.owner_name}
            onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
          />
          <label>Managed by (optional)</label>
          <input
            type="text"
            placeholder="e.g. Maria Santos (property manager)"
            value={form.managed_by}
            onChange={(e) => setForm({ ...form, managed_by: e.target.value })}
          />
          <label>Occupancy Type</label>
          <select
            value={form.occupancy_type}
            onChange={(e) => setForm({ ...form, occupancy_type: e.target.value })}
          >
            <option value="owner_occupied">Owner-occupied</option>
            <option value="long_term_tenant">Long-term tenant</option>
            <option value="str">STR (short-term rental)</option>
          </select>
          <label>Tower</label>
          <select
            value={form.building}
            onChange={(e) => setForm({ ...form, building: e.target.value })}
          >
            {TOWERS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add unit'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>All Units</h2>
        {units.length === 0 && <div className="empty">No units yet.</div>}
        {units.map((u) => (
          <div className="list-item" key={u.id}>
            <div>
              <div className="title">
                Unit {u.unit_number}
                {u.building ? ` · ${u.building}` : ''}
              </div>
              <div className="meta">
                {u.owner_name}
                {u.managed_by ? ` · Managed by ${u.managed_by}` : ''}
                {' · '}
                {OCCUPANCY_LABELS[u.occupancy_type]}
              </div>
              <div style={{ marginTop: 8 }}>
                <button className="link-btn danger" onClick={() => remove(u.id)}>
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