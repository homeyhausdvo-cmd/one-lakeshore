import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function RegistrationsManager() {
  const [pending, setPending] = useState([])
  const [reviewed, setReviewed] = useState([])

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

  async function setStatus(id, approval_status) {
    await supabase.from('profiles').update({ approval_status }).eq('id', id)
    load()
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
            {p.address ? ` · ${p.address}` : ''}
          </div>
          {showActions && (
            <div style={{ marginTop: 8, display: 'flex', gap: 14 }}>
              <button className="link-btn" onClick={() => setStatus(p.id, 'approved')}>Approve</button>
              <button className="link-btn danger" onClick={() => setStatus(p.id, 'rejected')}>Reject</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Pending Registrations — cross-check against your hard copy records</h2>
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
