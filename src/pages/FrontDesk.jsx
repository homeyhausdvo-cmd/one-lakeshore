import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
}

function relativeTime(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function downloadCsv(rows) {
  const header = ['Resident', 'Email', 'Type', 'Tower', 'Unit', 'Status']
  const lines = [header.join(',')]
  rows.forEach((r) => {
    lines.push(
      [r.full_name, r.email, r.kind === 'registration' ? 'New Registration' : 'Additional Unit', r.tower, r.unit_number, r.status]
        .map((v) => `"${(v || '').toString().replace(/"/g, '""')}"`)
        .join(',')
    )
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'registrations.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function RegistrationsManager() {
  const [pending, setPending] = useState([])
  const [reviewed, setReviewed] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [totalUnits, setTotalUnits] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  async function load() {
    const [{ data: profilesData }, { data: claimsData }, { count: unitsCount }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'owner')
        .order('created_at', { ascending: false }),
      supabase
        .from('unit_claims')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false }),
      supabase.from('units').select('*', { count: 'exact', head: true }),
    ])

    const registrationItems = (profilesData || []).map((p) => ({
      kind: 'registration',
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      tower: p.requested_tower,
      unit_number: p.requested_unit_number,
      status: p.approval_status,
      date: p.created_at,
      raw: p,
    }))

    const claimItems = (claimsData || []).map((c) => ({
      kind: 'claim',
      id: c.id,
      full_name: c.profiles?.full_name,
      email: c.profiles?.email,
      tower: c.tower,
      unit_number: c.unit_number,
      status: c.status,
      date: c.created_at,
      raw: c,
    }))

    const combined = [...registrationItems, ...claimItems]
    setPending(combined.filter((x) => x.status === 'pending'))
    setReviewed(combined.filter((x) => x.status !== 'pending'))
    setTotalUnits(unitsCount || 0)
  }

  useEffect(() => {
    load()
  }, [])

  async function findOrCreateUnit({ tower, unit_number, owner_id, owner_name, occupancy_type }) {
    const { data: existingUnit, error: findErr } = await supabase
      .from('units')
      .select('id')
      .eq('unit_number', unit_number)
      .eq('building', tower)
      .maybeSingle()
    if (findErr) throw findErr

    if (existingUnit) {
      const { error: linkErr } = await supabase
        .from('units')
        .update({ owner_id, owner_name })
        .eq('id', existingUnit.id)
      if (linkErr) throw linkErr
    } else {
      const { error: insertErr } = await supabase.from('units').insert({
        unit_number,
        building: tower,
        owner_name,
        owner_id,
        occupancy_type: occupancy_type || 'owner_occupied',
      })
      if (insertErr) throw insertErr
    }
  }

  async function approve(item) {
    setError('')
    setBusyId(item.id)
    try {
      await findOrCreateUnit({
        tower: item.tower,
        unit_number: item.unit_number,
        owner_id: item.kind === 'registration' ? item.id : item.raw.owner_id,
        owner_name: item.full_name,
        occupancy_type: item.kind === 'claim' ? item.raw.occupancy_type : 'owner_occupied',
      })

      if (item.kind === 'registration') {
        const { error: statusErr } = await supabase
          .from('profiles')
          .update({ approval_status: 'approved' })
          .eq('id', item.id)
        if (statusErr) throw statusErr
      } else {
        const { error: statusErr } = await supabase
          .from('unit_claims')
          .update({ status: 'approved' })
          .eq('id', item.id)
        if (statusErr) throw statusErr
      }

      await load()
    } catch (err) {
      setError(err.message || 'Something went wrong while approving.')
    }
    setBusyId(null)
  }

  async function reject(item) {
    setError('')
    setBusyId(item.id)
    if (item.kind === 'registration') {
      await supabase.from('profiles').update({ approval_status: 'rejected' }).eq('id', item.id)
    } else {
      await supabase.from('unit_claims').update({ status: 'rejected' }).eq('id', item.id)
    }
    await load()
    setBusyId(null)
  }

  const approvedCount = reviewed.filter((r) => r.status === 'approved').length
  const rejectedCount = reviewed.filter((r) => r.status === 'rejected').length
  const totalResidents = new Set(reviewed.filter((r) => r.status === 'approved').map((r) => r.email)).size

  const filteredReviewed = useMemo(() => {
    const q = search.trim().toLowerCase()
    return reviewed.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (q) {
        const haystack = `${r.full_name} ${r.email} ${r.unit_number} ${r.tower}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [reviewed, search, statusFilter])

  function PendingRow({ item }) {
    return (
      <div className="reg-table-row">
        <div className="avatar-circle">{initials(item.full_name)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {item.full_name}{' '}
            <span className="badge badge-lg unpaid">Pending</span>{' '}
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {item.kind === 'registration' ? '· New Registration' : '· Additional Unit'}
            </span>
          </div>
          <div className="meta" style={{ marginTop: 2 }}>
            {item.email} · {item.tower}, Unit {item.unit_number} · {relativeTime(item.date)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="link-btn" onClick={() => approve(item)} disabled={busyId === item.id}>
            {busyId === item.id ? 'Approving…' : 'Approve'}
          </button>
          <button className="link-btn danger" onClick={() => reject(item)} disabled={busyId === item.id}>
            Reject
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="stat-row">
        <div className="stat">
          <div className="num">{pending.length}</div>
          <div className="lbl">Pending</div>
        </div>
        <div className="stat">
          <div className="num">{approvedCount}</div>
          <div className="lbl">Approved</div>
        </div>
        <div className="stat">
          <div className="num">{rejectedCount}</div>
          <div className="lbl">Rejected</div>
        </div>
        <div className="stat">
          <div className="num">{totalUnits}</div>
          <div className="lbl">Total Units</div>
        </div>
        <div className="stat">
          <div className="num">{totalResidents}</div>
          <div className="lbl">Total Residents</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Pending Registrations & Unit Requests</h2>
        <div className="subtext" style={{ marginTop: -8, marginBottom: 14 }}>
          Cross-check against your hard copy records before approving
        </div>
        {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
        {pending.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📋</div>
            <div className="title">You're all caught up!</div>
            <div className="sub">No pending registrations or unit requests right now.</div>
          </div>
        ) : (
          pending.map((item) => <PendingRow key={`${item.kind}-${item.id}`} item={item} />)
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Reviewed History</h2>
          <button className="link-btn" onClick={() => downloadCsv(filteredReviewed)}>
            Export CSV
          </button>
        </div>

        <input
          type="text"
          placeholder="🔍 Search resident, email, unit, or tower..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        <div className="filter-pills">
          {[
            { key: 'all', label: 'All' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
          ].map((f) => (
            <button
              key={f.key}
              className={`filter-pill ${statusFilter === f.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredReviewed.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🔍</div>
            <div className="title">No matching records</div>
            <div className="sub">Try a different search term or filter.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Type</th>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredReviewed.map((r) => (
                  <tr key={`${r.kind}-${r.id}`}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar-circle" style={{ width: 28, height: 28, fontSize: 11.5 }}>
                          {initials(r.full_name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{r.full_name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12.5 }}>{r.kind === 'registration' ? 'New Registration' : 'Additional Unit'}</td>
                    <td>{r.tower} · {r.unit_number}</td>
                    <td>
                      <span className={`badge badge-lg ${r.status === 'approved' ? 'paid' : 'overdue'}`}>
                        {r.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{relativeTime(r.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}