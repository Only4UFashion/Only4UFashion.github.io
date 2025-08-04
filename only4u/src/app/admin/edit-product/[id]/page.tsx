"use client";

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, setSupabaseAuth } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-hot-toast';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { use } from 'react';

interface Variant {
  id: string;
  color: string;
  image: File | null;
  image_url: string;
  hover_image: File | null;
  hover_image_url: string;
  stock: string;
}

interface ImageUploadResponse {
  images?: { url: string, path: string }[];
  error?: string;
}

interface Params {
  id: string;
}

export default function EditProduct({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    category: 'dress',
    status: 'new',
    variants: [] as Variant[],
  });
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Fetch admin status and set Supabase auth
  useEffect(() => {
    let isMounted = true;

    async function checkAdminAndAuth() {
      if (status === 'authenticated' && session?.user?.id && session?.access_token) {
        try {
          console.log('Session before setSupabaseAuth:', {
            userId: session.user.id,
            email: session.user.email,
            accessToken: session.access_token ? '[present]' : '[missing]',
          });
          const authSuccess = await setSupabaseAuth(session);
          if (!authSuccess) {
            throw new Error('Failed to set Supabase auth token');
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
          console.error('Error checking admin status:', err.message, {
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
      } else {
        console.log('Session not fully hydrated, status:', status);
      }
    }

    checkAdminAndAuth();

    return () => {
      isMounted = false;
    };
  }, [status, session, router]);

  // Fetch product data
  useEffect(() => {
    let isMounted = true;

    async function fetchProduct() {
      try {
        if (session?.access_token) {
          const authSuccess = await setSupabaseAuth(session);
          if (!authSuccess) {
            throw new Error('Failed to set Supabase auth token');
          }
        } else {
          throw new Error('No access token available');
        }

        const { data: groupData, error: groupError } = await supabase
          .from('product_groups')
          .select('variant_group_id, name, price, description, category, status')
          .eq('variant_group_id', id)
          .single();

        if (groupError || !groupData) {
          console.error('Supabase error fetching product group:', groupError);
          if (isMounted) toast.error('Failed to load product');
          return;
        }

        const { data: variantsData, error: variantsError } = await supabase
          .from('products')
          .select('id, variant_group_id, color, image_url, hover_image_url, stock')
          .eq('variant_group_id', id);

        if (variantsError) {
          console.error('Supabase error fetching variants:', variantsError);
          if (isMounted) toast.error('Failed to load variants');
          return;
        }

        const variants = variantsData.map((item) => ({
          id: item.id,
          color: item.color,
          image: null,
          image_url: item.image_url,
          hover_image: null,
          hover_image_url: item.hover_image_url || item.image_url,
          stock: item.stock.toString(),
        }));

        if (isMounted) {
          setFormData({
            name: groupData.name,
            price: groupData.price.toFixed(2),
            description: groupData.description || '',
            category: groupData.category,
            status: groupData.status,
            variants,
          });
        }
      } catch (err: any) {
        console.error('Unexpected error fetching product:', err.message, {
          stack: err.stack,
        });
        if (isMounted) toast.error('Failed to load product: ' + err.message);
      }
    }

    if (isAdmin && id) {
      fetchProduct();
    }

    return () => {
      isMounted = false;
    };
  }, [isAdmin, id, session]);

  const addVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, { id: uuidv4(), color: '', image: null, image_url: '', hover_image: null, hover_image_url: '', stock: '0' }],
    }));
  };

  const updateVariant = (index: number, field: keyof Variant, value: string | File | null) => {
    if ((field === 'image' || field === 'hover_image') && value instanceof File) {
      if (!value.type.startsWith('image/')) {
        toast.error('Only image files are allowed');
        return;
      }
      if (value.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.name || !formData.price || !formData.category || !formData.status) {
      toast.error('Name, price, category, and status are required');
      setLoading(false);
      return;
    }

    if (!formData.variants.every((v) => v.color && (v.image || v.image_url) && v.stock)) {
      toast.error('All variants must have a color, main image, and stock');
      setLoading(false);
      return;
    }

    try {
      if (session?.access_token) {
        const authSuccess = await setSupabaseAuth(session);
        if (!authSuccess) {
          throw new Error('Failed to set Supabase auth token');
        }
      } else {
        throw new Error('No access token available');
      }

      // Upload new images
      let imageData: ImageUploadResponse = { images: [] };
      const imagesToUpload = formData.variants.flatMap((v) => [v.image, v.hover_image].filter(Boolean) as File[]);
      if (imagesToUpload.length > 0) {
        if (imagesToUpload.length > 10) {
          toast.error('Maximum 10 images allowed per submission');
          setLoading(false);
          return;
        }

        const imageFormData = new FormData();
        imagesToUpload.forEach((image) => imageFormData.append('images', image));
        imageFormData.append('productId', id);

        const imageResponse = await fetch('/api/upload-product-image', {
          method: 'POST',
          body: imageFormData,
        });
        imageData = await imageResponse.json();

        if (!imageResponse.ok) {
          console.error('Image upload failed:', imageData.error);
          toast.error(imageData.error || 'Image upload failed');
          setLoading(false);
          return;
        }
      }

      let imageIndex = 0;
      const variants = formData.variants.map((variant) => ({
        id: variant.id,
        color: variant.color,
        image_url: variant.image ? imageData.images?.[imageIndex++]?.url || variant.image_url : variant.image_url,
        hover_image_url: variant.hover_image ? imageData.images?.[imageIndex++]?.url || variant.hover_image_url : variant.hover_image_url,
        stock: parseInt(variant.stock),
      }));

      const updateFormData = new FormData();
      updateFormData.append('name', formData.name);
      updateFormData.append('price', formData.price);
      updateFormData.append('description', formData.description);
      updateFormData.append('category', formData.category);
      updateFormData.append('status', formData.status);
      updateFormData.append('variants', JSON.stringify(variants));
      variants.forEach((variant) => {
        const mainImage = formData.variants.find((v) => v.id === variant.id)?.image;
        const hoverImage = formData.variants.find((v) => v.id === variant.id)?.hover_image;
        if (mainImage) updateFormData.append(`mainImage-${variant.id}`, mainImage);
        if (hoverImage) updateFormData.append(`hoverImage-${variant.id}`, hoverImage);
      });

      const response = await fetch(`/api/products?id=${id}`, {
        method: 'PATCH',
        body: updateFormData,
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('API error updating product:', result.error);
        toast.error(result.error || 'Failed to update product');
        setLoading(false);
        return;
      }

      toast.success('Product updated successfully');
      router.push('/admin/dashboard');
    } catch (err: any) {
      console.error('Unexpected error during submission:', err.message, {
        stack: err.stack,
      });
      toast.error('An unexpected error occurred: ' + err.message);
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (status === 'loading' || isAdmin === null) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (authError) return <div className="flex items-center justify-center min-h-screen text-red-500">{authError}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-geist-sans">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Edit Product</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
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
              <div key={variant.id} className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Color</label>
                    <input
                      type="text"
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
                      accept="image/*"
                      onChange={(e) => updateVariant(index, 'image', e.target.files?.[0] || null)}
                      className="mt-1 w-full text-sm text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Hover Image</label>
                    {variant.hover_image_url && (
                      <img src={variant.hover_image_url} alt="Hover" className="w-24 h-24 object-cover rounded-lg mb-2" />
                    )}
                    <input
                      type="file"
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
            disabled={loading || !isAdmin}
            className="w-full bg-pink-500 text-white p-3 rounded-lg hover:bg-pink-600 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            {loading ? 'Updating...' : 'Update Product'}
          </button>
        </form>
      </div>
    </div>
  );
}