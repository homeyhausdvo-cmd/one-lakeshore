import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function RegistrationsManager() {
  const [pending, setPending] = useState([])
  const [reviewed, setReviewed] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'owner')
      .order('created_at', { ascending: false })
    setPending((data || []).filter((p) => p.approval_status === 'pending'))
    setReviewed((data || []).filter((p) => p.approval_status !== 'pending'))
  }

  useEffect(() => {
    load()
  }, [])

  async function approve(profile) {
    setError('')
    setBusyId(profile.id)
    try {
      const { data: existingUnit, error: findErr } = await supabase
        .from('units')
        .select('id, owner_id')
        .eq('unit_number', profile.requested_unit_number)
        .eq('building', profile.requested_tower)
        .maybeSingle()
      if (findErr) throw findErr

      if (existingUnit) {
        const { error: linkErr } = await supabase
          .from('units')
          .update({ owner_id: profile.id, owner_name: profile.full_name })
          .eq('id', existingUnit.id)
        if (linkErr) throw linkErr
      } else {
        const { error: insertErr } = await supabase.from('units').insert({
          unit_number: profile.requested_unit_number,
          building: profile.requested_tower,
          owner_name: profile.full_name,
          owner_id: profile.id,
          occupancy_type: 'owner_occupied',
        })
        if (insertErr) throw insertErr
      }

      const { error: statusErr } = await supabase
        .from('profiles')
        .update({ approval_status: 'approved' })
        .eq('id', profile.id)
      if (statusErr) throw statusErr

      await load()
    } catch (err) {
      setError(err.message || 'Something went wrong while approving.')
    }
    setBusyId(null)
  }

  async function reject(id) {
    setError('')
    setBusyId(id)
    const { error } = await supabase.from('profiles').update({ approval_status: 'rejected' }).eq('id', id)
    if (error) setError(error.message)
    await load()
    setBusyId(null)
  }

  function Row({ p, showActions }) {
    return (
      <div className="list-item" key={p.id}>
        <div>
          <div className="title">
            {p.full_name}{' '}
            <span className={`badge ${p.approval_status === 'approved' ? 'paid' : p.approval_status === 'rejected' ? 'overdue' : 'unpaid'}`}>
              {p.approval_status}
            </span>
          </div>
          <div className="meta">
            {p.email} · {p.requested_tower}, Unit {p.requested_unit_number}
          </div>
          {showActions && (
            <div style={{ marginTop: 8, display: 'flex', gap: 14 }}>
              <button className="link-btn" onClick={() => approve(p)} disabled={busyId === p.id}>
                {busyId === p.id ? 'Approving…' : 'Approve'}
              </button>
              <button className="link-btn danger" onClick={() => reject(p.id)} disabled={busyId === p.id}>
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
      <h2>Pending Registrations — cross-check against your hard copy records</h2>
      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
      {pending.length === 0 && <div className="empty">No pending registrations.</div>}
      {pending.map((p) => <Row key={p.id} p={p} showActions />)}

      {reviewed.length > 0 && (
        <>
          <h2 style={{ marginTop: 24 }}>Reviewed</h2>
          {reviewed.map((p) => <Row key={p.id} p={p} />)}
        </>
      )}
    </div>
  )
}