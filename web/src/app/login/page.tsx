'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).then((r) => r.json());
      if (res.success) {
        const params = new URLSearchParams(window.location.search);
        const from = params.get('from');
        window.location.href = from && from.startsWith('/') ? from : '/';
      } else {
        setError(res.message || 'ログインに失敗しました');
      }
    } catch {
      setError('通信エラー');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form onSubmit={onSubmit} className="login-card">
        <p className="login-brand">Kirindo Produce</p>
        <h1 className="login-title">青果 発注・振分</h1>
        <p className="login-sub">ログインしてください</p>

        <label className="login-field">
          <span>メールアドレス</span>
          <input type="text" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin" />
        </label>
        <label className="login-field">
          <span>パスワード</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
        </label>

        {error && <p className="login-error">{error}</p>}

        <button type="submit" disabled={busy} className="login-btn">
          {busy ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
    </div>
  );
}
