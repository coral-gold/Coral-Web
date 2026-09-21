import React, { useEffect, useState } from 'react';
import PublicLayout from '../../components/PublicLayout';
import api from '../../api';

export default function Contact() {
  const [content,  setContent]  = useState({});
  const [form,     setForm]     = useState({ name: '', company: '', email: '', phone: '', message: '' });
  const [status,   setStatus]   = useState('');
  const [sending,  setSending]  = useState(false);

  useEffect(() => {
    api.get('/public/content').then(d => { if (d.ok) setContent(d.content); }).catch(() => {});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSending(true); setStatus('');
    try {
      const d = await api.post('/public/contact', form);
      if (d.ok) { setStatus('success'); setForm({ name: '', company: '', email: '', phone: '', message: '' }); }
      else setStatus('error');
    } catch { setStatus('error'); }
    finally { setSending(false); }
  }

  return (
    <PublicLayout>
      <section className="hero" style={{ padding: '48px 20px' }}>
        <div className="container">
          <h1 style={{ fontSize: 38 }}>Contact Us</h1>
          <div className="gold-line" />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-info">
              <h3>Get In Touch</h3>
              <p>📧 {content.contact_email || 'info@coralgold.in'}</p>
              <p>📞 {content.contact_phone || '+91 98765 43210'}</p>
              <p>📍 {content.contact_address || 'Mumbai, Maharashtra, India'}</p>
              <p style={{ marginTop: 20, fontSize: 14, lineHeight: 1.7 }}>
                For wholesale enquiries, partnership opportunities, or to request an appointment,
                please fill out the form or contact us directly.
              </p>
            </div>
            <div>
              {status === 'success' && (
                <div className="alert alert-success">Message sent! We'll get back to you shortly.</div>
              )}
              {status === 'error' && (
                <div className="alert alert-error">Failed to send. Please try again or email us directly.</div>
              )}
              <form onSubmit={submit}>
                <div className="form-group">
                  <label>Name *</label>
                  <input className="form-control" required value={form.name} onChange={set('name')} />
                </div>
                <div className="form-group">
                  <label>Company</label>
                  <input className="form-control" value={form.company} onChange={set('company')} />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input className="form-control" type="email" required value={form.email} onChange={set('email')} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input className="form-control" value={form.phone} onChange={set('phone')} />
                </div>
                <div className="form-group">
                  <label>Message *</label>
                  <textarea className="form-control" rows={5} required value={form.message} onChange={set('message')} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? <><span className="spinner" />Sending…</> : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
