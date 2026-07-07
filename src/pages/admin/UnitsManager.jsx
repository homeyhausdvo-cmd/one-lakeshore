import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'

const TOWERS = ['Tower 1', 'Tower 2', 'Tower 3', 'Tower 4']

const OCCUPANCY_LABELS = {
  owner_occupied: 'Owner',
  long_term_tenant: 'Long-term',
  str: 'STR',
}

function getFloor(unitNumber) {
  const match = (unitNumber || '').match(/^\d+/)
  return match ? match[0] : null
}

export default function UnitsManager() {
  const [units, setUnits] = useState([])
  const [ownerProfiles, setOwnerProfiles] = useState([])
  const [billStanding, setBillStanding] = useState({})
  const [linkChoice, setLinkChoice] = useState({})
  const [editingLinkFor, setEditingLinkFor] = useState(null)

  const [showAddModal, setShowAddModal] = useState(false)
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
    const [{ data: unitsData }, { data: profilesData }, { data: billsData }] = await Promise.all([
      supabase.from('units').select('*, profiles!units_owner_id_fkey(full_name, email)').order('unit_number'),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'owner').order('full_name'),
      supabase.from('hoa_bills').select('unit_id, status'),
    ])
    setUnits(unitsData || [])
    setOwnerProfiles(profilesData || [])

    const standing = {}
    ;(billsData || []).forEach((b) => {
      const cur = standing[b.unit_id]
      if (b.status === 'overdue') standing[b.unit_id] = 'overdue'
      else if (b.status === 'unpaid' && cur !== 'overdue') standing[b.unit_id] = 'unpaid'
      else if (!cur) standing[b.unit_id] = 'paid'
    })
    setBillStanding(standing)
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
    setShowAddModal(false)
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
    setEditingLinkFor(null)
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

  function StandingBadge({ unitId }) {
    const s = billStanding[unitId]
    if (!s) return <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>—</span>
    if (s === 'overdue') return <span className="badge overdue">Overdue</span>
    if (s === 'unpaid') return <span className="badge unpaid">Pending</span>
    return <span className="badge paid">Good standing</span>
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>All Units</h2>
        <button className="btn btn-primary" style={{ marginTop: 0 }} onClick={() => setShowAddModal(true)}>
          + Add Unit
        </button>
      </div>

      <input
        type="text"
        placeholder="Search unit # or owner name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 10 }}
      />

      <div className="two-col" style={{ marginBottom: 16, maxWidth: 480 }}>
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

      {filteredUnits.length === 0 ? (
        <div className="empty">
          {units.length === 0 ? 'No units yet.' : 'No units match your search/filter.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="mini-table">
            <thead>
              <tr>
                <th>Tower</th>
                <th>Unit</th>
                <th>Owner</th>
                <th>Manager</th>
                <th>Type</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((u) => (
                <tr key={u.id}>
                  <td>{u.building}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>{u.unit_number}</td>
                  <td>
                    <div>{u.owner_name}</div>
                    {u.owner_id ? (
                      <div style={{ fontSize: 11.5, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        ✓ {u.profiles?.email}
                        <span
                          style={{ cursor: 'pointer', color: 'var(--red)', fontWeight: 700 }}
                          onClick={() => unlinkOwner(u.id)}
                        >
                          ✕
                        </span>
                      </div>
                    ) : editingLinkFor === u.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                        <select
                          style={{ width: 170, padding: '4px 6px', fontSize: 11.5 }}
                          value={linkChoice[u.id] || ''}
                          onChange={(e) => setLinkChoice({ ...linkChoice, [u.id]: e.target.value })}
                        >
                          <option value="">Select account…</option>
                          {ownerProfiles.map((p) => (
                            <option key={p.id} value={p.id}>{p.full_name}</option>
                          ))}
                        </select>
                        <button className="link-btn" onClick={() => linkOwner(u.id)} disabled={!linkChoice[u.id]}>
                          OK
                        </button>
                      </div>
                    ) : (
                      <button className="link-btn" style={{ fontSize: 11.5, marginTop: 3 }} onClick={() => setEditingLinkFor(u.id)}>
                        + Link account
                      </button>
                    )}
                  </td>
                  <td>{u.managed_by || '—'}</td>
                  <td>
                    <span className={`occ-badge ${u.occupancy_type}`}>{OCCUPANCY_LABELS[u.occupancy_type]}</span>
                  </td>
                  <td><StandingBadge unitId={u.id} /></td>
                  <td>
                    <button className="icon-btn" title="Delete unit" onClick={() => remove(u.id)}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-box-header">
              <h2 style={{ margin: 0 }}>Add a Unit</h2>
              <button className="icon-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
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
              <button className="btn btn-primary" disabled={submitting} style={{ width: '100%' }}>
                {submitting ? 'Adding…' : 'Add unit'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}