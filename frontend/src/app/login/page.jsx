// filepath: frontend/src/app/login/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../utils/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.push('/');
      }
    });
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(40px);}
          to { opacity: 1; transform: translateY(0);}
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.8s cubic-bezier(.39,.575,.565,1) both;
        }
      `}</style>
      <div className="animate-fadeInUp bg-white/80 backdrop-blur-lg shadow-2xl rounded-xl px-10 py-12 w-full max-w-md flex flex-col items-center">
        <div className="mb-6 flex flex-col items-center">
          <h2 className="text-3xl font-extrabold text-gray-800 margin-22">Login</h2>
          <p className="text-gray-500 mt-1 text-sm">Welcome back! Please sign in to continue.</p>
        </div>
        <form onSubmit={handleLogin} className="w-full">
          {error && <div className="text-red-500 mb-4 text-center">{error}</div>}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full mb-4 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full mb-6 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            required
          />
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-lg font-semibold shadow-lg hover:scale-105 cursor-pointer transition-transform duration-200"
          >
            Login
          </button>
        </form>
        <div className="mt-6 text-sm text-gray-600">
          Don't have an account?{' '}
          <a
            href="/register"
            className="text-blue-500 hover:underline font-medium cursor-pointer transition"
          >
            Register
          </a>
        </div>
      </div>
    </div>
  );
}