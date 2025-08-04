'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { supabase, setSupabaseAuth } from '@/lib/supabase';

export default function Profile() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    subscribe: false,
    company: '',
    website: '',
    phone: '',
    address: '',
    apartment: '',
    city: '',
    zip_code: '',
    country: '',
    state: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (status === 'loading') {
        console.log('Session status: loading');
        return;
      }

      if (status === 'unauthenticated') {
        console.log('Session status: unauthenticated, redirecting to /login');
        router.push('/login');
        return;
      }

      if (status === 'authenticated' && session?.user?.id && session?.access_token) {
        console.log('Session before setSupabaseAuth:', {
          userId: session.user.id,
          email: session.user.email,
          accessToken: session.access_token ? '[present]' : '[missing]',
        });
        try {
          const authSuccess = await setSupabaseAuth(session);
          if (!authSuccess) {
            console.warn('Failed to set Supabase auth token, attempting direct fetch');
          }

          const { data, error } = await supabase
            .from('users')
            .select('first_name, last_name, email, subscribe, company, website, phone, address, apartment, city, zip_code, country, state')
            .eq('id', session.user.id)
            .single();

          if (error) {
            console.error('Supabase fetch error:', error.message, {
              code: error.code,
            });
            throw error;
          }

          if (data) {
            setUserData(data);
          } else {
            console.error('No user data found for id:', session.user.id);
            setError('User data not found');
          }
        } catch (err: any) {
          console.error('Fetch user data error:', err.message, {
            stack: err.stack,
          });
          setError('Failed to load user data: ' + err.message);
        } finally {
          setLoading(false);
        }
      } else {
        console.error('Session missing user.id or access_token:', {
          userId: session?.user?.id ?? '[missing]',
          accessToken: session?.access_token ? '[present]' : '[missing]',
        });
        setError('User not authenticated');
        setLoading(false);
      }
    };

    fetchData();
  }, [session, status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!session?.user?.id || !session?.access_token) {
      console.error('Submit error: session.user.id or access_token missing:', {
        userId: session?.user?.id ?? '[missing]',
        accessToken: session?.access_token ? '[present]' : '[missing]',
      });
      setError('User not authenticated');
      return;
    }

    if (!userData.first_name || !userData.email || !userData.company || !userData.phone || !userData.address || !userData.city || !userData.zip_code || !userData.country) {
      setError('Please fill out all required fields');
      return;
    }

    try {
      console.log('Updating user data for id:', session.user.id);
      const authSuccess = await setSupabaseAuth(session);
      if (!authSuccess) {
        console.warn('Failed to set Supabase auth token, proceeding with update');
      }

      const { error } = await supabase
        .from('users')
        .update({
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          subscribe: userData.subscribe,
          company: userData.company,
          website: userData.website,
          phone: userData.phone,
          address: userData.address,
          apartment: userData.apartment,
          city: userData.city,
          zip_code: userData.zip_code,
          country: userData.country,
          state: userData.state,
        })
        .eq('id', session.user.id);

      if (error) {
        console.error('Supabase update error:', error.message, {
          code: error.code,
        });
        throw error;
      }

      setSuccess('Profile updated successfully');
    } catch (err: any) {
      console.error('Update profile error:', err.message, {
        stack: err.stack,
      });
      setError('Failed to update profile: ' + err.message);
    }
  };

  if (status === 'loading' || loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!session?.user?.id) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">You must be logged in to view this page.</p>
        <Link href="/login" className="text-pink-300 hover:underline">
          Go to Login
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
        <Link href="/" className="text-pink-300 hover:underline">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-2">
        Skip to main content
      </a>
      <div id="main-content" className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Profile</h1>
        <div className="flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Edit Profile</h2>
            {error && <p className="text-red-500 text-center mb-4">{error}</p>}
            {success && <p className="text-green-500 text-center mb-4">{success}</p>}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name *
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={userData.first_name}
                  onChange={(e) => setUserData({ ...userData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={userData.last_name}
                  onChange={(e) => setUserData({ ...userData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email *
                </label>
                <input
                  id="email"
                  type="email"
                  value={userData.email}
                  onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                  required
                />
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={userData.subscribe}
                    onChange={(e) => setUserData({ ...userData, subscribe: e.target.checked })}
                    className="h-4 w-4 text-pink-300 focus:ring-pink-300 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Subscribe to our newsletter</span>
                </label>
              </div>
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                  Company *
                </label>
                <input
                  id="company"
                  type="text"
                  value={userData.company}
                  onChange={(e) => setUserData({ ...userData, company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                  required
                />
              </div>
              <div>
                <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                  Website
                </label>
                <input
                  id="website"
                  type="url"
                  value={userData.website}
                  onChange={(e) => setUserData({ ...userData, website: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone *
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 py-2 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 text-gray-500 text-sm">
                    +1
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    value={userData.phone}
                    onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Address *
                </label>
                <input
                  id="address"
                  type="text"
                  value={userData.address}
                  onChange={(e) => setUserData({ ...userData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                  required
                />
              </div>
              <div>
                <label htmlFor="apartment" className="block text-sm font-medium text-gray-700">
                  Apartment/Suite/Etc.
                </label>
                <input
                  id="apartment"
                  type="text"
                  value={userData.apartment}
                  onChange={(e) => setUserData({ ...userData, apartment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                  City *
                </label>
                <input
                  id="city"
                  type="text"
                  value={userData.city}
                  onChange={(e) => setUserData({ ...userData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                  required
                />
              </div>
              <div>
                <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700">
                  Zip Code *
                </label>
                <input
                  id="zipCode"
                  type="text"
                  value={userData.zip_code}
                  onChange={(e) => setUserData({ ...userData, zip_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                  required
                />
              </div>
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                  Country *
                </label>
                <select
                  id="country"
                  value={userData.country}
                  onChange={(e) => setUserData({ ...userData, country: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                  required
                >
                  <option value="">Select a country</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="UK">United Kingdom</option>
                </select>
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                  State
                </label>
                <input
                  id="state"
                  type="text"
                  value={userData.state}
                  onChange={(e) => setUserData({ ...userData, state: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-pink-300 text-white py-2 rounded-md hover:bg-pink-400 transition-colors"
              >
                Update Profile
              </button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-600">
              <Link href="/" className="text-pink-300 hover:underline">
                Back to Home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}