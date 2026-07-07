import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function RegistrationsManager() {
  const [pending, setPending] = useState([])
  const [reviewed, setReviewed] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const [{ data: profilesData }, { data: claimsData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'owner')
        .order('created_at', { ascending: false }),
      supabase
        .from('unit_claims')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false }),
    ])

    const registrationItems = (profilesData || []).map((p) => ({
      kind: 'registration',
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      tower: p.requested_tower,
      unit_number: p.requested_unit_number,
      status: p.approval_status,
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
      raw: c,
    }))

    const combined = [...registrationItems, ...claimItems]
    setPending(combined.filter((x) => x.status === 'pending'))
    setReviewed(combined.filter((x) => x.status !== 'pending'))
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

  function Row({ item, showActions }) {
    return (
      <div className="list-item" key={`${item.kind}-${item.id}`}>
        <div>
          <div className="title">
            {item.full_name}{' '}
            <span className={`badge ${item.status === 'approved' ? 'paid' : item.status === 'rejected' ? 'overdue' : 'unpaid'}`}>
              {item.status}
            </span>{' '}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--ink-soft)',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {item.kind === 'registration' ? '· New Registration' : '· Additional Unit'}
            </span>
          </div>
          <div className="meta">
            {item.email} · {item.tower}, Unit {item.unit_number}
          </div>
          {showActions && (
            <div style={{ marginTop: 8, display: 'flex', gap: 14 }}>
              <button className="link-btn" onClick={() => approve(item)} disabled={busyId === item.id}>
                {busyId === item.id ? 'Approving…' : 'Approve'}
              </button>
              <button className="link-btn danger" onClick={() => reject(item)} disabled={busyId === item.id}>
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Pending Registrations & Unit Requests — cross-check against your hard copy records</h2>
      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
      {pending.length === 0 && <div className="empty">No pending requests.</div>}
      {pending.map((item) => <Row key={`${item.kind}-${item.id}`} item={item} showActions />)}

      {reviewed.length > 0 && (
        <>
          <h2 style={{ marginTop: 24 }}>Reviewed</h2>
          {reviewed.map((item) => <Row key={`${item.kind}-${item.id}`} item={item} />)}
        </>
      )}
    </div>
  )
}