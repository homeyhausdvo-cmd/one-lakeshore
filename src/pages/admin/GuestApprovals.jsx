import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import Ticket from '../../components/Ticket'

function monthKey(dateStr) {
  return (dateStr || '').slice(0, 7) // "YYYY-MM"
}

function monthLabel(key) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function GuestApprovals({ profile, onChange }) {
  const [guests, setGuests] = useState([])
  const [unpaidCount, setUnpaidCount] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date().toISOString()))

  async function loadAll() {
    const { data: guestsData } = await supabase
      .from('guests')
      .select('*, units(unit_number)')
      .order('created_at', { ascending: false })
    setGuests(guestsData || [])

    const { count } = await supabase
      .from('hoa_bills')
      .select('*', { count: 'exact', head: true })
      .in('status', ['unpaid', 'overdue'])
    setUnpaidCount(count || 0)
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function updateStatus(id, status) {
    await supabase
      .from('guests')
      .update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    loadAll()
    onChange?.()
  }

  const pending = guests.filter((g) => g.status === 'pending')
  const reviewedAll = guests.filter((g) => g.status !== 'pending')

  const availableMonths = useMemo(() => {
    const keys = new Set(reviewedAll.map((g) => monthKey(g.valid_from)))
    return Array.from(keys).sort().reverse()
  }, [reviewedAll])

  const reviewedForMonth = reviewedAll.filter((g) => monthKey(g.valid_from) === selectedMonth)

  const approvedThisMonth = guests.filter((g) => {
    if (g.status !== 'approved' || !g.reviewed_at) return false
    const d = new Date(g.reviewed_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  return (
    <div>
      <div className="stat-row">
        <div className="stat">
          <div className="num">{pending.length}</div>
          <div className="lbl">Pending review</div>
        </div>
        <div className="stat">
          <div className="num">{approvedThisMonth}</div>
          <div className="lbl">Approved this month</div>
        </div>
        <div className="stat">
          <div className="num">{unpaidCount}</div>
          <div className="lbl">Unpaid/overdue bills</div>
        </div>
      </div>

      {pending.length > 0 && (
        <>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 15, margin: '0 0 10px 0' }}>
            Awaiting review
          </h2>
          {pending.map((g) => (
            <Ticket
              key={g.id}
              guest={g}
              unitLabel={g.units?.unit_number}
              adminActions
              onApprove={(id) => updateStatus(id, 'approved')}
              onReject={(id) => updateStatus(id, 'rejected')}
            />
          ))}
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 10px' }}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 15, margin: 0 }}>Reviewed History</h2>
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
        <div className="empty">No reviewed guests for this month.</div>
      ) : (
        reviewedForMonth.map((g) => <Ticket key={g.id} guest={g} unitLabel={g.units?.unit_number} />)
      )}

      {guests.length === 0 && <div className="empty">No submissions yet.</div>}
    </div>
  )
}
