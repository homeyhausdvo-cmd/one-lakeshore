import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ManagerRegister({ onDone }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

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
    setSubmitting(true)
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name, is_manager: true },
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
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18 }}>Account created</h2>
          <p className="subtext" style={{ marginTop: 10 }}>
            Sign in any time. Once a unit owner grants you access using this exact email address,
            that unit will automatically appear in your Manager Dashboard.
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
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand" style={{ color: 'var(--primary)' }}>
          One Lakeshore
          <span style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--gold)', marginTop: 4 }}>
            Property Manager Sign Up
          </span>
        </div>

        <label>Full Name</label>
        <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />

        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4 }}>
          Use the same email the unit owner will invite you with.
        </div>

        <label>Password</label>
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />

        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
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