"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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

// Fetch sale products from Supabase
async function fetchSaleProducts(): Promise<Product[]> {
  try {
    const { data: groupsData, error: groupsError } = await supabase
      .from('product_groups')
      .select('variant_group_id, name, price, category, status')
      .eq('status', 'on_sale')
      .order('created_at', { ascending: false });

    if (groupsError) {
      console.error('Supabase error fetching product groups:', groupsError.message, groupsError.details);
      return [];
    }

    if (!groupsData) {
      console.warn('No sale products found');
      return [];
    }

    const { data: variantsData, error: variantsError } = await supabase
      .from('products')
      .select('id, variant_group_id, color, image_url, hover_image_url, stock')
      .in('variant_group_id', groupsData.map(g => g.variant_group_id))
      .order('created_at', { ascending: true });

    if (variantsError) {
      console.error('Supabase error fetching variants:', variantsError.message, variantsError.details);
      return [];
    }

    // Group products by variant_group_id
    const grouped = groupsData.reduce((acc, group) => {
      const variants = variantsData.filter((v) => v.variant_group_id === group.variant_group_id);
      if (variants.length === 0) return acc;

      const firstVariant = variants[0];
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
    console.error('Unexpected error fetching sale products:', err);
    return [];
  }
}

// Reusable Product Card Component
const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
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
        {product.status === 'on_sale' && (
          <span className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">On Sale</span>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-white bg-opacity-75 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button className="w-full bg-black text-white py-2 text-sm font-semibold rounded-md hover:bg-gray-800 transition-colors">
            Quick Add
          </button>
        </div>
      </div>
      <h3 className="mt-4 text-md font-semibold text-gray-800">{product.name}</h3>
      <p className="mt-1 text-lg text-gray-600">${product.price}</p>
      <p className="text-sm text-gray-500">
        Available in: {product.variants.map((v) => v.color).join(', ')}
      </p>
    </div>
  );
};

export default function SalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string>('');
  const { data: session } = useSession();

  useEffect(() => {
    async function loadProducts() {
      if (!session?.user) {
        setProducts([]);
        setError('Please sign in to view products');
        return;
      }

      try {
        const productsData = await fetchSaleProducts();
        const validProducts = productsData.filter(product => product.category);
        setProducts(validProducts);
        setError(validProducts.length === 0 ? 'No sale products found' : '');
      } catch (err) {
        setError('Failed to load sale products');
        console.error('Error in loadProducts:', err);
      }
    }

    loadProducts();
  }, [session]);

  return (
    <div className="bg-white font-sans">
      <main>
        <section className="py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-10">Sale</h2>
            {error && <p className="text-red-500 text-center mb-4">{error}</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
              {products.length > 0 ? (
                products.map(product => <ProductCard key={product.variant_group_id} product={product} />)
              ) : (
                <p className="text-center text-gray-600 col-span-full">
                  {error ? 'Failed to load sale products' : 'No sale products available.'}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}