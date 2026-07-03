import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

const OCCUPANCY_LABELS = {
  owner_occupied: 'Owner-occupied',
  long_term_tenant: 'Long-term tenant',
  str: 'STR (short-term rental)',
}

export default function UnitsManager() {
  const [units, setUnits] = useState([])
  const [ownerProfiles, setOwnerProfiles] = useState([])
  const [linkChoice, setLinkChoice] = useState({})
  const [form, setForm] = useState({
    unit_number: '',
    owner_name: '',
    managed_by: '',
    occupancy_type: 'owner_occupied',
    building: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [{ data: unitsData }, { data: profilesData }] = await Promise.all([
      supabase.from('units').select('*, profiles(full_name, email)').order('unit_number'),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'owner').order('full_name'),
    ])
    setUnits(unitsData || [])
    setOwnerProfiles(profilesData || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.unit_number.trim() || !form.owner_name.trim()) {
      setError('Please fill in the unit number and owner name.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('units').insert({
      unit_number: form.unit_number.trim(),
      owner_name: form.owner_name.trim(),
      managed_by: form.managed_by.trim() || null,
      occupancy_type: form.occupancy_type,
      building: form.building.trim() || null,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ unit_number: '', owner_name: '', managed_by: '', occupancy_type: 'owner_occupied', building: '' })
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this unit? This will also delete its bills and guest records.')) return
    await supabase.from('units').delete().eq('id', id)
    load()
  }

  async function linkOwner(unitId) {
    const profileId = linkChoice[unitId]
    if (!profileId) return
    await supabase.from('units').update({ owner_id: profileId }).eq('id', unitId)
    load()
  }

  async function unlinkOwner(unitId) {
    if (!confirm('Unlink this owner account? They will lose access to this unit in the Owner Portal.')) return
    await supabase.from('units').update({ owner_id: null }).eq('id', unitId)
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
          <label>Building (optional)</label>
          <input
            type="text"
            placeholder="e.g. Tower 1"
            value={form.building}
            onChange={(e) => setForm({ ...form, building: e.target.value })}
          />
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
            <div style={{ flex: 1 }}>
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

              <div style={{ marginTop: 10, fontSize: 12.5 }}>
                {u.owner_id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                      ✓ Linked to {u.profiles?.full_name} ({u.profiles?.email})
                    </span>
                    <button className="link-btn danger" onClick={() => unlinkOwner(u.id)}>
                      Unlink
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      style={{ width: 220, padding: '6px 8px', fontSize: 12.5 }}
                      value={linkChoice[u.id] || ''}
                      onChange={(e) => setLinkChoice({ ...linkChoice, [u.id]: e.target.value })}
                    >
                      <option value="">No login account linked — select one…</option>
                      {ownerProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} ({p.email})
                        </option>
                      ))}
                    </select>
                    <button className="link-btn" onClick={() => linkOwner(u.id)} disabled={!linkChoice[u.id]}>
                      Link
                    </button>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 8 }}>
                <button className="link-btn danger" onClick={() => remove(u.id)}>
                  Delete unit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}