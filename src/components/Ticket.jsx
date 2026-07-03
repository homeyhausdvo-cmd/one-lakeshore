export default function Ticket({ guest, unitLabel, adminActions, onApprove, onReject, checkinAction, onCheckIn }) {
  const statusLabel =
    guest.status === 'pending' ? 'Pending' : guest.status === 'approved' ? 'Approved' : 'Rejected'

  const fmt = (d) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="ticket">
      <div className="ticket-main">
        <div className="guest-name">{guest.guest_name}</div>
        <div className="unit-tag">UNIT {unitLabel}</div>
        <div className="dates">
          {fmt(guest.valid_from)} → {fmt(guest.valid_to)}
          {guest.purpose ? ` · ${guest.purpose}` : ''}
        </div>
      </div>
      <div className="ticket-divider"></div>
      <div className="ticket-status">
        <div className={`status-stamp ${guest.status}`}>{statusLabel}</div>
        {adminActions && guest.status === 'pending' && (
          <div className="ticket-actions">
            <button className="btn btn-approve" onClick={() => onApprove(guest.id)}>
              Approve
            </button>
            <button className="btn btn-reject" onClick={() => onReject(guest.id)}>
              Reject
            </button>
          </div>
        )}
        {checkinAction && (
          guest.status !== 'approved' ? (
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', textAlign: 'center' }}>
              Not approved yet
            </div>
          ) : guest.checked_in_at ? (
            <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
              ✓ Checked in {new Date(guest.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          ) : (
            <button className="btn-small" onClick={() => onCheckIn(guest.id)}>
              Check in
            </button>
          )
        )}
      </div>
    </div>
  )
}