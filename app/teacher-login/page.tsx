'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TeacherLoginPage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/teacher-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      router.push('/teacher');
    } else {
      const data = await res.json();
      setError(data.error || 'Invalid token');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Teacher Login</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="Teacher token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-es-red"
            required
          />
          {error && <p className="text-sm text-es-red">{error}</p>}
          <button type="submit" className="w-full rounded bg-es-red px-4 py-2 text-white hover:bg-es-red-dark">
            Login
          </button>
        </form>
      </div>
    </main>
  );
}
