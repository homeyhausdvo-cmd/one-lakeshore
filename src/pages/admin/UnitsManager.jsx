import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'

const TOWERS = ['Tower 1', 'Tower 2', 'Tower 3', 'Tower 4']

const OCCUPANCY_LABELS = {
  owner_occupied: 'Owner-occupied',
  long_term_tenant: 'Long-term tenant',
  str: 'STR (short-term rental)',
}

function getFloor(unitNumber) {
  const match = (unitNumber || '').match(/^\d+/)
  return match ? match[0] : null
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
    building: TOWERS[0],
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [towerFilter, setTowerFilter] = useState('all')
  const [floorFilter, setFloorFilter] = useState('all')

  async function load() {
    const [{ data: unitsData }, { data: profilesData }] = await Promise.all([
      supabase.from('units').select('*, profiles!units_owner_id_fkey(full_name, email)').order('unit_number'),
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

  const availableFloors = useMemo(() => {
    const scoped = towerFilter === 'all' ? units : units.filter((u) => u.building === towerFilter)
    const floors = new Set(scoped.map((u) => getFloor(u.unit_number)).filter(Boolean))
    return Array.from(floors).sort((a, b) => Number(a) - Number(b))
  }, [units, towerFilter])

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase()
    return units.filter((u) => {
      if (towerFilter !== 'all' && u.building !== towerFilter) return false
      if (floorFilter !== 'all' && getFloor(u.unit_number) !== floorFilter) return false
      if (q && !(u.unit_number.toLowerCase().includes(q) || (u.owner_name || '').toLowerCase().includes(q))) {
        return false
      }
      return true
    })
  }, [units, search, towerFilter, floorFilter])

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

        <input
          type="text"
          placeholder="Search unit # or owner name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 10 }}
        />

        <div className="two-col" style={{ marginBottom: 16 }}>
          <div>
            <select
              value={towerFilter}
              onChange={(e) => {
                setTowerFilter(e.target.value)
                setFloorFilter('all')
              }}
            >
              <option value="all">All Towers</option>
              {TOWERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
              <option value="all">All Floors</option>
              {availableFloors.map((f) => (
                <option key={f} value={f}>Floor {f}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredUnits.length === 0 && (
          <div className="empty">
            {units.length === 0 ? 'No units yet.' : 'No units match your search/filter.'}
          </div>
        )}
        {filteredUnits.map((u) => (
          <div className="unit-card" key={u.id}>
            <div className="unit-card-top">
              <div>
                <div className="unit-card-title">
                  Unit {u.unit_number}
                  {u.building ? ` · ${u.building}` : ''}
                </div>
                <div className="unit-card-meta">
                  {u.owner_name}
                  {u.managed_by ? ` · Managed by ${u.managed_by}` : ''}
                </div>
              </div>
              <button className="icon-btn" title="Delete unit" onClick={() => remove(u.id)}>
                🗑
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <span className={`occ-badge ${u.occupancy_type}`}>{OCCUPANCY_LABELS[u.occupancy_type]}</span>
            </div>

            <div style={{ marginTop: 10 }}>
              {u.owner_id ? (
                <div className="owner-pill">
                  ✓ Linked to {u.profiles?.full_name}
                  <span className="unlink-x" onClick={() => unlinkOwner(u.id)}>✕</span>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    style={{ width: 240, padding: '6px 8px', fontSize: 12.5 }}
                    value={linkChoice[u.id] || ''}
                    onChange={(e) => setLinkChoice({ ...linkChoice, [u.id]: e.target.value })}
                  >
                    <option value="">No login linked — select an owner account…</option>
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
          </div>
        ))}
      </div>
    </div>
  )
}