'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../utils/supabaseClient';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.push('/');
      }
    });
  }, [router]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Registration successful! Please check your email to confirm your account.');
      setTimeout(() => router.push('/login'), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100">
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
          <h2 className="text-3xl font-extrabold text-gray-800">Register</h2>
          <p className="text-gray-500 mt-1 text-sm">Create your account to get started!</p>
        </div>
        <form onSubmit={handleRegister} className="w-full">
          {error && <div className="text-red-500 mb-4 text-center">{error}</div>}
          {success && <div className="text-green-500 mb-4 text-center">{success}</div>}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full mb-4 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full mb-6 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
            required
          />
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold shadow-lg hover:scale-105 cursor-pointer transition-transform duration-200"
          >
            Register
          </button>
        </form>
        <div className="mt-6 text-sm text-gray-600">
          Already have an account?{' '}
          <a
            href="/login"
            className="text-purple-500 hover:underline font-medium cursor-pointer transition"
          >
            Login
          </a>
        </div>
      </div>
    </div>
  );
}