import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import Ticket from '../../components/Ticket'

export default function GuestApprovals({ profile }) {
  const [guests, setGuests] = useState([])
  const [unpaidCount, setUnpaidCount] = useState(0)

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
  }

  const pending = guests.filter((g) => g.status === 'pending')
  const reviewed = guests.filter((g) => g.status !== 'pending')
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

      {reviewed.length > 0 && (
        <>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 15, margin: '20px 0 10px 0' }}>
            Reviewed
          </h2>
          {reviewed.map((g) => (
            <Ticket key={g.id} guest={g} unitLabel={g.units?.unit_number} />
          ))}
        </>
      )}

      {guests.length === 0 && <div className="empty">No submissions yet.</div>}
    </div>
  )
}