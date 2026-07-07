import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function UnitClaimsManager() {
  const [pending, setPending] = useState([])
  const [reviewed, setReviewed] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase
      .from('unit_claims')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false })
    setPending((data || []).filter((c) => c.status === 'pending'))
    setReviewed((data || []).filter((c) => c.status !== 'pending'))
  }

  useEffect(() => {
    load()
  }, [])

  async function approve(claim) {
    setError('')
    setBusyId(claim.id)
    try {
      const { data: existingUnit, error: findErr } = await supabase
        .from('units')
        .select('id')
        .eq('unit_number', claim.unit_number)
        .eq('building', claim.tower)
        .maybeSingle()
      if (findErr) throw findErr

      if (existingUnit) {
        const { error: linkErr } = await supabase
          .from('units')
          .update({ owner_id: claim.owner_id, owner_name: claim.profiles?.full_name })
          .eq('id', existingUnit.id)
        if (linkErr) throw linkErr
      } else {
        const { error: insertErr } = await supabase.from('units').insert({
          unit_number: claim.unit_number,
          building: claim.tower,
          owner_name: claim.profiles?.full_name,
          owner_id: claim.owner_id,
          occupancy_type: 'owner_occupied',
        })
        if (insertErr) throw insertErr
      }

      const { error: statusErr } = await supabase
        .from('unit_claims')
        .update({ status: 'approved' })
        .eq('id', claim.id)
      if (statusErr) throw statusErr

      await load()
    } catch (err) {
      setError(err.message || 'Something went wrong while approving.')
    }
    setBusyId(null)
  }

  async function reject(id) {
    setBusyId(id)
    await supabase.from('unit_claims').update({ status: 'rejected' }).eq('id', id)
    await load()
    setBusyId(null)
  }

  function Row({ c, showActions }) {
    return (
      <div className="list-item" key={c.id}>
        <div>
          <div className="title">
            {c.profiles?.full_name}{' '}
            <span className={`badge ${c.status === 'approved' ? 'paid' : c.status === 'rejected' ? 'overdue' : 'unpaid'}`}>
              {c.status}
            </span>
          </div>
          <div className="meta">
            {c.profiles?.email} · {c.tower}, Unit {c.unit_number}
          </div>
          {showActions && (
            <div style={{ marginTop: 8, display: 'flex', gap: 14 }}>
              <button className="link-btn" onClick={() => approve(c)} disabled={busyId === c.id}>
                {busyId === c.id ? 'Approving…' : 'Approve'}
              </button>
              <button className="link-btn danger" onClick={() => reject(c.id)} disabled={busyId === c.id}>
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
      <h2>Pending Additional Unit Requests</h2>
      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
      {pending.length === 0 && <div className="empty">No pending requests.</div>}
      {pending.map((c) => <Row key={c.id} c={c} showActions />)}

      {reviewed.length > 0 && (
        <>
          <h2 style={{ marginTop: 24 }}>Reviewed</h2>
          {reviewed.map((c) => <Row key={c.id} c={c} />)}
        </>
      )}
    </div>
  )
}