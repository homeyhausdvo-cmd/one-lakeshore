import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import GuestCheckPanel from '../components/GuestCheckPanel'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function guestPhase(g) {
  if (g.checked_out_at) return 'past'
  if (g.checked_in_at) return 'active'
  return 'upcoming'
}

export default function FrontDesk({ profile }) {
  const [todayGuests, setTodayGuests] = useState([])
  const [permits, setPermits] = useState([])
  const [upcoming7, setUpcoming7] = useState([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef(null)

  async function loadToday() {
    const { data } = await supabase
      .from('guests')
      .select('*, units(unit_number)')
      .eq('valid_from', todayStr())
      .order('created_at', { ascending: true })
    setTodayGuests(data || [])
  }

  async function loadPermits() {
    const { data } = await supabase
      .from('work_permits')
      .select('*')
      .eq('status', 'approved')
      .gte('valid_to', todayStr())
      .order('valid_from', { ascending: true })
    setPermits(data || [])
  }

  async function loadUpcoming7() {
    const in7 = new Date()
    in7.setDate(in7.getDate() + 7)
    const { data } = await supabase
      .from('guests')
      .select('*, units(unit_number)')
      .eq('status', 'approved')
      .gt('valid_from', todayStr())
      .lte('valid_from', in7.toISOString().slice(0, 10))
      .order('valid_from', { ascending: true })
      .limit(10)
    setUpcoming7(data || [])
  }

  useEffect(() => {
    loadToday()
    loadPermits()
    loadUpcoming7()
  }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    setSearching(true)
    const timeout = setTimeout(() => runSearch(q), 300)
    return () => clearTimeout(timeout)
  }, [query])

  async function runSearch(q) {
    const { data } = await supabase
      .from('guests')
      .select('*, units!inner(unit_number)')
      .or(`guest_name.ilike.%${q}%,contact_number.ilike.%${q}%,units.unit_number.ilike.%${q}%`)
      .order('valid_from', { ascending: false })
      .limit(50)
    setResults(data || [])
    setSearching(false)
  }

  async function checkInWorker(id) {
    await supabase
      .from('work_permits')
      .update({ checked_in_at: new Date().toISOString(), checked_in_by: profile.id })
      .eq('id', id)
    loadPermits()
  }

  const upcoming = results.filter((g) => guestPhase(g) === 'upcoming')
  const active = results.filter((g) => guestPhase(g) === 'active')
  const past = results.filter((g) => guestPhase(g) === 'past')

  const checkedInTodayCount = todayGuests.filter((g) => g.checked_in_at).length

  return (
    <div>
      <div className="view-header">
        <div className="eyebrow">Front Desk</div>
        <h1>Guest Check-in Lookup</h1>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <label style={{ marginTop: 0 }}>Search guest, unit, or phone number</label>
        <input
          ref={searchRef}
          type="text"
          placeholder="Type a guest name, unit number, or phone..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ fontSize: 16, padding: '13px 16px' }}
        />
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 6 }}>
          Press <strong>⌘K</strong> / <strong>Ctrl+K</strong> to jump to search anytime
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="num">{todayGuests.length}</div>
          <div className="lbl">Today's Arrivals</div>
        </div>
        <div className="stat">
          <div className="num">{checkedInTodayCount}</div>
          <div className="lbl">Checked In Today</div>
        </div>
        <div className="stat">
          <div className="num">{permits.length}</div>
          <div className="lbl">Active Permits</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>
          📅 Today —{' '}
          <span
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontWeight: 500,
              fontSize: 12,
              color: 'var(--ink-soft)',
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </h2>

        {todayGuests.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 20px' }}>
            <div className="icon" style={{ fontSize: 26, marginBottom: 4 }}>📅</div>
            <div className="sub">No arrivals scheduled today. Guests arriving today will appear here automatically.</div>
          </div>
        ) : (
          todayGuests.map((g) => (
            <GuestCheckPanel key={g.id} guest={g} unitLabel={g.units?.unit_number} onRefresh={loadToday} profile={profile} />
          ))
        )}

        <div style={{ borderTop: '1px solid var(--border)', margin: '18px 0' }}></div>

        <h2>🛠 Active Work Permits</h2>
        {permits.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 20px' }}>
            <div className="icon" style={{ fontSize: 26, marginBottom: 4 }}>🛠</div>
            <div className="sub">No active work permits. Approved permits will appear here.</div>
          </div>
        ) : (
          permits.map((p) => (
            <div className="list-item" key={p.id}>
              <div>
                <div className="title">{p.worker_names}</div>
                <div className="meta">
                  {p.tower}, Unit {p.unit_number}
                  {p.company ? ` · ${p.company}` : ''}
                  {p.purpose ? ` · ${p.purpose}` : ''}
                </div>
                <div style={{ marginTop: 8 }}>
                  {p.checked_in_at ? (
                    <span className="status-pill arrived">
                      <span className="dot"></span>
                      Checked in{' '}
                      {new Date(p.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : (
                    <button className="btn-small" onClick={() => checkInWorker(p.id)}>
                      Check in
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {upcoming7.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>Upcoming Arrivals — next 7 days</h2>
          {upcoming7.map((g) => (
            <div className="list-item" key={g.id}>
              <div>
                <div className="title">{g.guest_name}</div>
                <div className="meta">
                  Unit {g.units?.unit_number}
                  {g.checkin_time ? ` · ${g.checkin_time}` : ''}
                  {g.purpose ? ` · ${g.purpose}` : ''}
                </div>
              </div>
              <div className="date-chip">
                {new Date(g.valid_from + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="view-header" style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 2 }}>
          Search Results
        </div>
      </div>

      {!query.trim() && <div className="empty">Start typing above to search all guests.</div>}
      {query.trim() && searching && <div className="empty">Searching…</div>}
      {query.trim() && !searching && results.length === 0 && (
        <div className="empty">No matching guest or unit found.</div>
      )}

      {query.trim() && !searching && results.length > 0 && (
        <>
          {active.length > 0 && (
            <>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 15, margin: '0 0 10px 0', color: 'var(--green)' }}>
                ● Active — currently checked in ({active.length})
              </h2>
              {active.map((g) => (
                <GuestCheckPanel key={g.id} guest={g} unitLabel={g.units?.unit_number} onRefresh={() => runSearch(query.trim())} profile={profile} />
              ))}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 15, margin: '20px 0 10px 0' }}>
                Upcoming ({upcoming.length})
              </h2>
              {upcoming.map((g) => (
                <GuestCheckPanel key={g.id} guest={g} unitLabel={g.units?.unit_number} onRefresh={() => runSearch(query.trim())} profile={profile} />
              ))}
            </>
          )}

          {past.length > 0 && (
            <>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 15, margin: '20px 0 10px 0', color: 'var(--ink-soft)' }}>
                Past — checked out ({past.length})
              </h2>
              {past.map((g) => (
                <GuestCheckPanel key={g.id} guest={g} unitLabel={g.units?.unit_number} onRefresh={() => runSearch(query.trim())} profile={profile} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}