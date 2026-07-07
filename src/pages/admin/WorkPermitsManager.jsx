import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'

function monthKey(dateStr) {
  return (dateStr || '').slice(0, 7)
}

function monthLabel(key) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function WorkPermitsManager({ profile }) {
  const [permits, setPermits] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date().toISOString()))

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
  const reviewedAll = permits.filter((p) => p.status !== 'pending')

  const availableMonths = useMemo(() => {
    const keys = new Set(reviewedAll.map((p) => monthKey(p.valid_from)))
    return Array.from(keys).sort().reverse()
  }, [reviewedAll])

  const reviewedForMonth = reviewedAll.filter((p) => monthKey(p.valid_from) === selectedMonth)

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
            {p.checked_in_at && (
              <>
                <br />
                ✓ Checked in {new Date(p.checked_in_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </>
            )}
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 10px' }}>
        <h2 style={{ margin: 0 }}>Reviewed History</h2>
        {availableMonths.length > 0 && (
          <select
            style={{ width: 200 }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {availableMonths.map((k) => (
              <option key={k} value={k}>{monthLabel(k)}</option>
            ))}
          </select>
        )}
      </div>

      {reviewedForMonth.length === 0 ? (
        <div className="empty">No reviewed permits for this month.</div>
      ) : (
        reviewedForMonth.map((p) => <Row key={p.id} p={p} />)
      )}
    </div>
  )
}