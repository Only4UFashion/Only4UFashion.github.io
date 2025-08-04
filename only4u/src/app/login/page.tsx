'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Client-side validation
    if (!email || !password) {
      setError('Please fill out all required fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Invalid email format');
      return;
    }

    try {
      console.log('Attempting login with email:', email); // Debug log
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false, // Handle redirect manually
      });

      if (result?.error) {
        console.error('signIn error:', result.error, { status: result.status }); // Debug log
        if (result.error.includes('Configuration')) {
          setError('Invalid login attempt. Please check your configuration or try again later.');
        } else if (result.error.includes('Invalid email or password')) {
          setError('Incorrect email or password');
        } else if (result.error.includes('User not found')) {
          setError('No account found with this email');
        } else {
          setError('An error occurred during login: ' + result.error);
        }
        return;
      }

      console.log('Login successful, redirecting to /'); // Debug log
      setSuccess('Login successful! Redirecting...');
      setTimeout(() => router.push('/'), 1000); // Redirect to homepage
    } catch (err: any) {
      console.error('Unexpected login error:', err.message, err.stack); // Debug log
      setError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <>
      <div id="main-content" className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Log In</h2>
            {error && <p className="text-red-500 text-center mb-4">{error}</p>}
            {success && <p className="text-green-500 text-center mb-4">{success}</p>}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-pink-300 text-white py-2 rounded-md hover:bg-pink-400 transition-colors"
              >
                Log In
              </button>
            </form>
            <p className="mt-4 text-center text-sm text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-pink-300 hover:underline">
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}