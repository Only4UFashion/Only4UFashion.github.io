"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Edit } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Product {
  variant_group_id: string;
  name: string;
  price: string;
  category: string;
  status: string;
}

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function checkAdmin() {
      if (session?.user?.id) {
        try {
          const res = await fetch('/api/check-admin');
          const data = await res.json();
          if (isMounted) {
            setIsAdmin(data.isAdmin);
            if (!data.isAdmin) {
              toast.error('Unauthorized access');
              router.push('/');
            }
          }
        } catch (err) {
          console.error('Error checking admin status:', err);
          if (isMounted) {
            toast.error('Failed to verify admin status');
            router.push('/');
          }
        }
      } else if (status === 'unauthenticated') {
        if (isMounted) {
          router.push('/login');
        }
      }
    }

    async function loadProducts() {
      if (!session?.user) {
        if (isMounted) {
          setProducts([]);
          toast.error('Please sign in to view products');
        }
        return;
      }

      try {
        const res = await fetch(`/api/products?sortBy=${sortBy}&sortOrder=${sortOrder}`);
        if (!res.ok) {
          throw new Error('Failed to fetch products');
        }
        const productsData = await res.json();
        if (isMounted) {
          setProducts(productsData);
        }
      } catch (err) {
        if (isMounted) {
          toast.error('Failed to load products');
          console.error('Error in loadProducts:', err);
        }
      }
    }

    checkAdmin();
    if (isAdmin) {
      loadProducts();
    }

    return () => {
      isMounted = false;
    };
  }, [session, status, router, sortBy, sortOrder, isAdmin]);

  const handleSort = (column: string) => {
    setSortBy(column);
    setSortOrder(sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc');
  };

  if (status === 'loading' || isAdmin === null) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!session || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-geist-sans">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Admin Dashboard</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Manage Products</h2>
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['name', 'price', 'category', 'status', 'actions'].map((column) => (
                    <th
                      key={column}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => column !== 'actions' && handleSort(column)}
                    >
                      {column.charAt(0).toUpperCase() + column.slice(1)}
                      {sortBy === column && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.length > 0 ? (
                  products.map((product) => (
                    <tr key={product.variant_group_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.price}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.category.charAt(0).toUpperCase() + product.category.slice(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/admin/edit-product/${product.variant_group_id}`}
                          className="text-pink-500 hover:text-pink-700 flex items-center"
                        >
                          <Edit className="w-4 h-4 mr-1" /> Edit
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No products available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}