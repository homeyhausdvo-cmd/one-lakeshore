import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function WorkPermitsManager({ profile }) {
  const [permits, setPermits] = useState([])

  async function load() {
    const { data } = await supabase
      .from('work_permits')
      .select('*, profiles!work_permits_submitted_by_fkey(full_name)')
      .order('created_at', { ascending: false })
    setPermits(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function updateStatus(id, status) {
    await supabase
      .from('work_permits')
      .update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    load()
  }

  const pending = permits.filter((p) => p.status === 'pending')
  const reviewed = permits.filter((p) => p.status !== 'pending')

  function Row({ p, showActions }) {
    return (
      <div className="list-item" key={p.id}>
        <div>
          <div className="title">
            {p.worker_names}{' '}
            <span className={`badge ${p.status === 'approved' ? 'paid' : p.status === 'rejected' ? 'overdue' : 'unpaid'}`}>
              {p.status}
            </span>
          </div>
          <div className="meta">
            {p.tower}, Unit {p.unit_number} · {p.company || 'No company listed'} · {p.purpose}
            <br />
            Submitted by {p.profiles?.full_name} ·{' '}
            {new Date(p.valid_from + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' → '}
            {new Date(p.valid_to + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
          {showActions && (
            <div style={{ marginTop: 8, display: 'flex', gap: 14 }}>
              <button className="link-btn" onClick={() => updateStatus(p.id, 'approved')}>Approve</button>
              <button className="link-btn danger" onClick={() => updateStatus(p.id, 'rejected')}>Reject</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Pending Work Permits</h2>
      {pending.length === 0 && <div className="empty">No pending permits.</div>}
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