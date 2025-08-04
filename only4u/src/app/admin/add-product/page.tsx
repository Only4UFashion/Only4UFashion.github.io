'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { handleSubmit } from '@/lib/server-actions';
import { setSupabaseAuth } from '@/lib/supabase';

interface Variant {
  id: string;
  color: string;
  image: File | null;
  image_url: string;
  hover_image: File | null;
  hover_image_url: string;
  stock: string;
}

interface FormState {
  error?: string;
  success?: boolean;
}

export default function AddProduct() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    category: 'dress',
    status: 'new',
    variants: [{ id: crypto.randomUUID(), color: '', image: null, image_url: '', hover_image: null, hover_image_url: '', stock: '0' }],
  });
  const [state, formAction] = useActionState(handleSubmit, { error: undefined, success: undefined });
  const { pending } = useFormStatus();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check admin status and set Supabase auth
  useEffect(() => {
    let isMounted = true;

    async function checkAdmin() {
      if (status === 'authenticated' && session?.user?.id) {
        try {
          console.log('Checking admin status:', {
            userId: session.user.id,
            email: session.user.email,
            accessToken: session.access_token ? '[present]' : '[missing]',
            refreshToken: session.refresh_token ? '[present]' : '[missing]',
            sessionKeys: Object.keys(session),
            userKeys: session.user ? Object.keys(session.user) : [],
          });

          // Only call setSupabaseAuth if access_token is present
          if (session.access_token) {
            const success = await setSupabaseAuth(session);
            if (!success) {
              console.warn('setSupabaseAuth failed, relying on server-side auth');
            }
          } else {
            console.warn('Skipping setSupabaseAuth: no access_token in session');
          }

          const res = await fetch('/api/check-admin');
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to verify admin status');
          }

          if (isMounted) {
            setIsAdmin(data.isAdmin);
            if (!data.isAdmin) {
              setAuthError('Unauthorized: Admin access required');
            }
          }
        } catch (err: any) {
          console.error('Error checking admin status or setting Supabase auth:', err.message, {
            stack: err.stack,
          });
          if (isMounted) {
            setAuthError('Failed to verify admin status: ' + err.message);
          }
        }
      } else if (status === 'unauthenticated') {
        if (isMounted) {
          console.log('Unauthenticated, redirecting to /login');
          router.push('/login');
        }
      }
    }

    checkAdmin();

    return () => {
      isMounted = false;
    };
  }, [status, session, router]);

  // Handle form state errors
  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
    if (state.success) {
      toast.success('Product added successfully');
      router.push('/admin/dashboard');
    }
  }, [state, router]);

  const addVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, { id: crypto.randomUUID(), color: '', image: null, image_url: '', hover_image: null, hover_image_url: '', stock: '0' }],
    }));
  };

  const updateVariant = (index: number, field: keyof Variant, value: string | File | null) => {
    if (field === 'image' || field === 'hover_image') {
      if (value && value instanceof File) {
        if (!value.type.startsWith('image/')) {
          toast.error('Only image files are allowed');
          return;
        }
        if (value.size > 5 * 1024 * 1024) {
          toast.error('Image size must be less than 5MB');
          return;
        }
      }
    }

    setFormData((prev) => {
      const newVariants = [...prev.variants];
      newVariants[index] = { ...newVariants[index], [field]: value };
      return { ...prev, variants: newVariants };
    });
  };

  const removeVariant = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Log FormData and append variant images
  const handleSubmitWithLogging = async (formData: FormData) => {
    // Create new FormData to ensure correct data
    const newFormData = new FormData();
    newFormData.append('name', formData.get('name') || '');
    newFormData.append('price', formData.get('price') || '');
    newFormData.append('description', formData.get('description') || '');
    newFormData.append('category', formData.get('category') || '');
    newFormData.append('status', formData.get('status') || '');
    const variantsString = formData.get('variants') as string;
    const variants = variantsString ? JSON.parse(variantsString) as Variant[] : [];
    newFormData.append('variants', JSON.stringify(variants));

    // Append variant-specific fields
    variants.forEach((variant: Variant, index: number) => {
      console.log('Appending variant:', {
        variantId: variant.id,
        color: variant.color,
        stock: variant.stock,
        mainImage: variant.image ? `[File: ${variant.image.name}]` : formData.get(`mainImage-${variant.id}`) ? `[File: ${String(formData.get(`mainImage-${variant.id}`))}]` : '[null]',
        hoverImage: variant.hover_image ? `[File: ${variant.hover_image.name}]` : formData.get(`hoverImage-${variant.id}`) ? `[File: ${String(formData.get(`hoverImage-${variant.id}`))}]` : '[null]',
      });
      newFormData.append(`color-${variant.id}`, formData.get(`color-${variant.id}`) || variant.color);
      newFormData.append(`stock-${variant.id}`, formData.get(`stock-${variant.id}`) || variant.stock);
      const mainImage = formData.get(`mainImage-${variant.id}`);
      if (mainImage) {
        newFormData.append(`mainImage-${variant.id}`, mainImage);
      }
      const hoverImage = formData.get(`hoverImage-${variant.id}`);
      if (hoverImage) {
        newFormData.append(`hoverImage-${variant.id}`, hoverImage);
      }
    });

    const formDataEntries: Record<string, any> = {};
    for (const [key, value] of newFormData.entries()) {
      formDataEntries[key] = value instanceof File ? { name: value.name, size: value.size, type: value.type } : value;
    }
    console.log('Client-side FormData before submission:', JSON.stringify(formDataEntries, null, 2));

    formAction(newFormData);
  };

  if (status === 'loading' || isAdmin === null) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (authError) return <div className="flex items-center justify-center min-h-screen text-red-500">{authError}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-geist-sans">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Add Product</h1>
        <form action={handleSubmitWithLogging}>
          <input type="hidden" name="variants" value={JSON.stringify(formData.variants)} />
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Product Name</label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:ring-pink-500 focus:border-pink-500"
              required
            />
          </div>
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700">Price</label>
            <input
              id="price"
              name="price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={handleInputChange}
              className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:ring-pink-500 focus:border-pink-500"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:ring-pink-500 focus:border-pink-500"
              rows={4}
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:ring-pink-500 focus:border-pink-500"
              required
            >
              <option value="dress">Dress</option>
              <option value="pants">Pants</option>
              <option value="shirt">Shirt</option>
              <option value="jacket">Jacket</option>
              <option value="accessory">Accessory</option>
            </select>
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:ring-pink-500 focus:border-pink-500"
              required
            >
              <option value="new">New</option>
              <option value="best_selling">Best Selling</option>
              <option value="sold_out">Sold Out</option>
              <option value="on_sale">On Sale</option>
            </select>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Variants</h2>
            {formData.variants.map((variant, index) => (
              <div key={variant.id} className="border border-gray-200 rounded-lg p-4 mb-4" data-variant-id={variant.id}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Color</label>
                    <input
                      type="text"
                      name={`color-${variant.id}`}
                      value={variant.color}
                      onChange={(e) => updateVariant(index, 'color', e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:ring-pink-500 focus:border-pink-500"
                      placeholder="e.g., Red"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Stock</label>
                    <input
                      type="number"
                      name={`stock-${variant.id}`}
                      value={variant.stock}
                      onChange={(e) => updateVariant(index, 'stock', e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded-lg p-2 focus:ring-pink-500 focus:border-pink-500"
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Main Image</label>
                    {variant.image_url && (
                      <img src={variant.image_url} alt="Main" className="w-24 h-24 object-cover rounded-lg mb-2" />
                    )}
                    <input
                      type="file"
                      name={`mainImage-${variant.id}`}
                      accept="image/*"
                      onChange={(e) => updateVariant(index, 'image', e.target.files?.[0] || null)}
                      className="mt-1 w-full text-sm text-gray-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Hover Image (Optional)</label>
                    {variant.hover_image_url && (
                      <img src={variant.hover_image_url} alt="Hover" className="w-24 h-24 object-cover rounded-lg mb-2" />
                    )}
                    <input
                      type="file"
                      name={`hoverImage-${variant.id}`}
                      accept="image/*"
                      onChange={(e) => updateVariant(index, 'hover_image', e.target.files?.[0] || null)}
                      className="mt-1 w-full text-sm text-gray-500"
                    />
                  </div>
                </div>
                {formData.variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="mt-4 text-red-500 hover:text-red-700 flex items-center text-sm"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Remove Variant
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addVariant}
              className="flex items-center text-pink-500 hover:text-pink-700 text-sm"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Another Color
            </button>
          </div>
          <button
            type="submit"
            disabled={pending || !isAdmin}
            className="w-full bg-pink-500 text-white p-3 rounded-lg hover:bg-pink-600 disabled:opacity-50 flex items-center justify-center"
          >
            {pending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            {pending ? 'Adding...' : 'Add Product'}
          </button>
        </form>
      </div>
    </div>
  );
}