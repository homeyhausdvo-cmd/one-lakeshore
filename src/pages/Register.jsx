import { useState } from 'react'
import { supabase } from '../supabaseClient'

const TOWERS = ['Tower 1', 'Tower 2', 'Tower 3', 'Tower 4']

export default function Register({ onDone }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    tower: TOWERS[0],
    unit_number: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.full_name || !form.email || !form.password || !form.unit_number) {
      setError('Please fill in all required fields.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          tower: form.tower,
          unit_number: form.unit_number,
        },
      },
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="brand" style={{ color: 'var(--primary)' }}>One Lakeshore</div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18 }}>Registration submitted</h2>
          <p className="subtext" style={{ marginTop: 10 }}>
            Your details are being reviewed against our unit records. You'll be able to sign in
            once an admin approves your registration.
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
      <form className="login-card" style={{ width: 400 }} onSubmit={handleSubmit}>
        <div className="brand" style={{ color: 'var(--primary)' }}>
          One Lakeshore
          <span style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--gold)', marginTop: 4 }}>
            Resident Registration
          </span>
        </div>

        <label>Full Name</label>
        <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />

        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <label>Password</label>
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />

        <div className="two-col">
          <div>
            <label>Tower</label>
            <select value={form.tower} onChange={(e) => setForm({ ...form, tower: e.target.value })}>
              {TOWERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Unit Number</label>
            <input type="text" placeholder="e.g. 14B" value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} />
          </div>
        </div>

        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
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