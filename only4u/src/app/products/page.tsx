"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

// Product interface for UI
interface Product {
  variant_group_id: string;
  name: string;
  price: string;
  image: string;
  hover_image: string;
  variants: { id: string; color: string; stock: number }[];
  category: string;
  status: string;
}

// Supabase product type
interface ProductFromSupabase {
  id: string;
  variant_group_id: string;
  color: string;
  image_url: string;
  hover_image_url?: string;
  stock: number;
}

// Supabase product group type
interface ProductGroupFromSupabase {
  variant_group_id: string;
  name: string;
  price: number;
  category: string;
  status: string;
}

// Fetch products from Supabase
async function fetchProducts(): Promise<Product[]> {
  try {
    const { data: groupsData, error: groupsError } = await supabase
      .from('product_groups')
      .select('variant_group_id, name, price, category, status')
      .order('created_at', { ascending: false });

    if (groupsError) {
      console.error('Supabase error fetching product groups:', groupsError.message, groupsError.details);
      toast.error('Failed to load products');
      return [];
    }

    if (!groupsData) {
      console.warn('No product groups found');
      return [];
    }

    const { data: variantsData, error: variantsError } = await supabase
      .from('products')
      .select('id, variant_group_id, color, image_url, hover_image_url, stock')
      .order('created_at', { ascending: true }); // Ensure first variant is consistent

    if (variantsError) {
      console.error('Supabase error fetching variants:', variantsError.message, variantsError.details);
      toast.error('Failed to load products');
      return [];
    }

    // Group products by variant_group_id
    const grouped = groupsData.reduce((acc, group) => {
      const variants = variantsData.filter((v) => v.variant_group_id === group.variant_group_id);
      if (variants.length === 0) return acc; // Skip groups with no variants

      const firstVariant = variants[0]; // Use first variant for images
      acc[group.variant_group_id] = {
        variant_group_id: group.variant_group_id,
        name: group.name,
        price: group.price.toFixed(2),
        image: firstVariant.image_url,
        hover_image: firstVariant.hover_image_url || firstVariant.image_url,
        category: group.category,
        status: group.status,
        variants: variants.map((v) => ({ id: v.id, color: v.color, stock: v.stock })),
      };
      return acc;
    }, {} as Record<string, Product>);

    return Object.values(grouped);
  } catch (err) {
    console.error('Unexpected error fetching products:', err);
    toast.error('Failed to load products');
    return [];
  }
}

// Reusable Product Card Component
const ProductCard: React.FC<{ product: Product; isAdmin: boolean }> = ({ product, isAdmin }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="group relative text-center">
      <div className="relative overflow-hidden rounded-lg">
        <img
          src={isHovered ? product.hover_image : product.image}
          alt={product.name}
          className="w-full h-auto object-cover aspect-[2/3] transition-transform duration-500 ease-in-out group-hover:scale-105"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
        {product.status === 'new' && (
          <span className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">New</span>
        )}
        {product.status === 'best_selling' && (
          <span className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">Best Seller</span>
        )}
        {product.status === 'sold_out' && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">Sold Out</span>
        )}
        {product.status === 'on_sale' && (
          <span className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">On Sale</span>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-white bg-opacity-75 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button className="w-full bg-pink-500 text-white py-2 text-sm font-semibold rounded-md hover:bg-pink-600 transition-colors">
            Quick Add
          </button>
        </div>
      </div>
      <h3 className="mt-4 text-md font-semibold text-gray-800">{product.name}</h3>
      <p className="mt-1 text-lg text-gray-600">${product.price}</p>
      <p className="text-sm text-gray-500">
        Available in: {product.variants.map((v) => v.color).join(', ')}
      </p>
      {isAdmin && (
        <Link
          href={`/admin/edit-product/${product.variant_group_id}`}
          className="mt-2 inline-block text-pink-500 hover:underline text-sm"
        >
          Edit Product
        </Link>
      )}
    </div>
  );
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        const productsData = await fetchProducts();
        // Filter out products with null or undefined category
        const validProducts = productsData.filter(product => product.category);
        if (isMounted) {
          setProducts(validProducts);
          setError(validProducts.length === 0 ? 'No products found' : '');
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load products');
          console.error('Error in loadProducts:', err);
          setLoading(false);
        }
      }
    }

    async function checkAdmin() {
      if (session?.user?.id) {
        const res = await fetch('/api/check-admin');
        const data = await res.json();
        if (isMounted) {
          setIsAdmin(data.isAdmin);
        }
      } else {
        if (isMounted) {
          setIsAdmin(false);
        }
      }
    }

    loadProducts();
    checkAdmin();

    return () => {
      isMounted = false;
    };
  }, [session]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-geist-sans">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-10 text-center">All Products</h1>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {products.length > 0 ? (
              products.map(product => (
                <ProductCard key={product.variant_group_id} product={product} isAdmin={isAdmin} />
              ))
            ) : (
              <p className="text-center text-gray-600 col-span-full">
                {error ? 'Failed to load products' : 'No products available.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}