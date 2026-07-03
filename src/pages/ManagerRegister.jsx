import { useState } from 'react'
import { supabase } from '../supabaseClient'

const TOWERS = ['Tower 1', 'Tower 2', 'Tower 3', 'Tower 4']

export default function ManagerRegister({ onDone }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [claims, setClaims] = useState([{ tower: TOWERS[0], unit_number: '' }])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  function updateClaim(index, field, value) {
    const next = [...claims]
    next[index][field] = value
    setClaims(next)
  }

  function addClaim() {
    setClaims([...claims, { tower: TOWERS[0], unit_number: '' }])
  }

  function removeClaim(index) {
    setClaims(claims.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.full_name || !form.email || !form.password) {
      setError('Please fill in your name, email, and password.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    const validClaims = claims.filter((c) => c.unit_number.trim())
    if (validClaims.length === 0) {
      setError('Please list at least one unit you manage.')
      return
    }

    setSubmitting(true)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          is_manager: true,
        },
      },
    })
    if (signUpError) {
      setSubmitting(false)
      setError(signUpError.message)
      return
    }

    const managerId = signUpData.user?.id
    if (managerId) {
      const rows = validClaims.map((c) => ({
        manager_id: managerId,
        claimed_tower: c.tower,
        claimed_unit_number: c.unit_number.trim(),
      }))
      const { error: claimsError } = await supabase.from('manager_unit_claims').insert(rows)
      if (claimsError) {
        setSubmitting(false)
        setError(claimsError.message)
        return
      }
    }

    setSubmitting(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="brand" style={{ color: 'var(--primary)' }}>One Lakeshore</div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18 }}>Registration submitted</h2>
          <p className="subtext" style={{ marginTop: 10 }}>
            Your account and the units you listed are being reviewed. Each unit owner will need
            to approve your access before you can view or manage it.
          </p>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={onDone}>
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-wrap">
      <form className="login-card" style={{ width: 440 }} onSubmit={handleSubmit}>
        <div className="brand" style={{ color: 'var(--primary)' }}>
          One Lakeshore
          <span style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--gold)', marginTop: 4 }}>
            Property Manager Registration
          </span>
        </div>

        <label>Full Name</label>
        <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />

        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <label>Password</label>
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />

        <label style={{ marginTop: 20 }}>Units you manage</label>
        {claims.map((c, i) => (
          <div key={i} className="two-col" style={{ marginBottom: 8, alignItems: 'end' }}>
            <div>
              <select value={c.tower} onChange={(e) => updateClaim(i, 'tower', e.target.value)}>
                {TOWERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Unit #, e.g. 14B"
                value={c.unit_number}
                onChange={(e) => updateClaim(i, 'unit_number', e.target.value)}
              />
              {claims.length > 1 && (
                <button type="button" className="link-btn danger" onClick={() => removeClaim(i)}>
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="button" className="link-btn" style={{ marginTop: 4 }} onClick={addClaim}>
          + Add another unit
        </button>

        {error && <div className="error-text" style={{ marginTop: 14 }}>{error}</div>}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Register'}
        </button>
        <button
          type="button"
          className="link-btn"
          style={{ marginTop: 14, display: 'block', textAlign: 'center', width: '100%' }}
          onClick={onDone}
        >
          Already have an account? Sign in
        </button>
      </form>
    </div>
  )
}