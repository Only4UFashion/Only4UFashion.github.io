"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use } from 'react';

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

interface Params {
  category: string;
}

// Fetch products by category from Supabase
async function fetchProductsByCategory(category: string): Promise<Product[]> {
  try {
    const { data: groupsData, error: groupsError } = await supabase
      .from('product_groups')
      .select('variant_group_id, name, price, category, status')
      .eq('category', category)
      .order('created_at', { ascending: false });

    if (groupsError) {
      console.error('Supabase error fetching product groups:', groupsError.message, groupsError.details);
      return [];
    }

    if (!groupsData) {
      console.warn(`No product groups found for category: ${category}`);
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
    return [];
  }
}

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
        {product.status === 'new' && (
          <span className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">New</span>
        )}
        {product.status === 'best_selling' && (
          <span className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">Best Seller</span>
        )}
        {product.status === 'sold_out' && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">Sold Out</span>
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

export default function CategoryPage({ params }: { params: Promise<Params> }) {
  const { category } = use(params); // Unwrap params with React.use()
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string>('');
  const { data: session } = useSession();
  const router = useRouter();

  // List of valid categories
  const validCategories = ['dress', 'pants', 'shirt', 'jacket', 'accessory'];

  useEffect(() => {
    let isMounted = true;

    console.log('CategoryPage loaded with category:', category, 'Pathname:', window.location.pathname);

    // Check for invalid category and redirect
    if (!category || !validCategories.includes(category)) {
      if (isMounted && window.location.pathname !== '/products') {
        console.log('Redirecting to /products due to invalid category:', category);
        router.push('/products');
      }
      return;
    }

    async function loadProducts() {
      if (!session?.user) {
        if (isMounted) {
          setProducts([]);
          setError('Please sign in to view products');
        }
        return;
      }

      try {
        const productsData = await fetchProductsByCategory(category);
        if (isMounted) {
          // Filter out products with null category
          const validProducts = productsData.filter(product => product.category);
          setProducts(validProducts);
          setError(validProducts.length === 0 ? `No products found for ${category}` : '');
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load products');
          console.error('Error in loadProducts:', err);
        }
      }
    }
    loadProducts();

    return () => {
      isMounted = false; // Cleanup to prevent state updates after unmount
    };
  }, [session, category, router]);

  if (!category || !validCategories.includes(category)) {
    return null; // Prevent rendering during redirect
  }

  return (
    <div className="bg-white font-sans">
      <main>
        <section className="py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-10">
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </h2>
            {error && <p className="text-red-500 text-center mb-4">{error}</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
              {products.length > 0 ? (
                products.map(product => <ProductCard key={product.variant_group_id} product={product} />)
              ) : (
                <p className="text-center text-gray-600 col-span-full">
                  {error ? 'Failed to load products' : `No ${category}s available.`}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}