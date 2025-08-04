"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Search, User, ShoppingCart, Menu, X, Instagram, Facebook, Twitter, Share2 } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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
  description: string;
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
  description: string;
}

// Fetch products by status from Supabase
async function fetchProducts(status?: string): Promise<Product[]> {
  try {
    let query = supabase
      .from('product_groups')
      .select('variant_group_id, name, price, category, status, description')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: groupsData, error: groupsError } = await query;

    if (groupsError) {
      console.error(`Supabase error fetching product groups${status ? ` for ${status}` : ''}:`, groupsError.message, groupsError.details);
      return [];
    }

    if (!groupsData) {
      console.warn(`No product groups found${status ? ` for ${status}` : ''}`);
      return [];
    }

    const { data: variantsData, error: variantsError } = await supabase
      .from('products')
      .select('id, variant_group_id, color, image_url, hover_image_url, stock')
      .in('variant_group_id', groupsData.map(g => g.variant_group_id))
      .order('created_at', { ascending: true });

    if (variantsError) {
      console.error(`Supabase error fetching variants${status ? ` for ${status}` : ''}:`, variantsError.message, variantsError.details);
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
        description: group.description || 'No description available',
        variants: variants.map((v) => ({ id: v.id, color: v.color, stock: v.stock })),
      };
      return acc;
    }, {} as Record<string, Product>);

    return Object.values(grouped);
  } catch (err) {
    console.error(`Unexpected error fetching products${status ? ` for ${status}` : ''}:`, err);
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
          <button className="w-full bg-black text-white py-2 text-sm font-semibold rounded-md hover:bg-gray-800 transition-colors">
            Quick Add
          </button>
        </div>
      </div>
      <h3 className="mt-4 text-md font-semibold text-gray-800">{product.name}</h3>
      <p className="mt-1 text-lg text-gray-600">${product.price}</p>
      <p className="mt-1 text-sm text-gray-500">{product.description}</p>
      <p className="mt-1 text-sm text-gray-500">
        Available in: {product.variants.map((v) => v.color).join(', ')}
      </p>
    </div>
  );
};

// ProductSection Component
const ProductSection: React.FC<{ title: string; products: Product[]; error?: string; link?: string }> = ({ title, products, error, link }) => (
  <section className="py-16">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-3xl font-bold text-center text-gray-800">{title}</h2>
        {link && (
          <Link href={link} className="text-pink-500 hover:underline">
            View All
          </Link>
        )}
      </div>
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
        {products.length > 0 ? (
          products.map(product => <ProductCard key={product.variant_group_id} product={product} />)
        ) : (
          <p className="text-center text-gray-600 col-span-full">
            {error ? 'Failed to load products' : 'No products available.'}
          </p>
        )}
      </div>
    </div>
  </section>
);

// Main App Component
export default function App() {
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [error, setError] = useState<string>('');
  const { data: session } = useSession();

  useEffect(() => {
    async function loadProducts() {
      if (!session?.user) {
        setNewArrivals([]);
        setBestSellers([]);
        setError('Please sign in to view products');
        return;
      }

      try {
        const newArrivalsData = await fetchProducts('new');
        const bestSellersData = await fetchProducts('best_selling');
        setNewArrivals(newArrivalsData.slice(0, 4)); // Limit to 4
        setBestSellers(bestSellersData.slice(0, 4)); // Limit to 4
        setError(newArrivalsData.length === 0 && bestSellersData.length === 0 ? 'No products found' : '');
      } catch (err) {
        setError('Failed to load products');
        console.error('Error in loadProducts:', err);
      }
    }
    loadProducts();
  }, [session]);

  return (
    <div className="bg-white font-sans">
      <main>
        <HeroSection /> 
        <FeaturedCategories /> 
        <ProductSection
          title="New Arrivals"
          products={newArrivals}
          error={error}
          link="/products/new-arrivals"
        />
        <ProductSection
          title="Best Sellers"
          products={bestSellers}
          error={error}
          link="/products/best-sellers"
        />
        <PromoSection /> 
        <InstagramSection /> 
      </main>
    </div>
  );
}
// Lookbook/Promo Section
const PromoSection = () => (
    <section className="bg-pink-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16 py-16">
                <div className="md:w-1/2">
                    <img src="https://placehold.co/800x600/F5E6E6/4A3F3F?text=Lookbook" alt="Lookbook" className="rounded-lg shadow-xl w-full"/>
                </div>
                <div className="md:w-1/2 text-center md:text-left">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">The Weekend Edit</h2>
                    <p className="text-gray-600 text-lg mb-6">
                        Effortless styles designed for your weekend plans. Discover curated looks that blend comfort and chic.
                    </p>
                    <a href="#" className="bg-black text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-gray-800 transition-all duration-300 transform hover:scale-105 inline-block">
                        Shop The Look
                    </a>
                </div>
            </div>
        </div>
    </section>
);

// Instagram Section
const InstagramSection = () => (
    <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-4">Follow Us</h2>
            <a href="#" className="block text-center text-pink-600 text-lg mb-10 hover:underline">@only4ufashion</a>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {instagramPosts.map(post => (
                    <a href="#" key={post.id} className="group block overflow-hidden rounded-lg">
                        <img src={post.image} alt="Instagram Post" className="w-full h-full object-cover aspect-square group-hover:scale-110 transition-transform duration-300"/>
                    </a>
                ))}
            </div>
        </div>
    </section>
);

// Featured Categories Component
const FeaturedCategories = () => (
    <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <a href="#" className="group relative block">
                    <img src="https://placehold.co/600x800/EBD4D4/4A3F3F?text=Dresses" alt="Dresses" className="w-full h-full object-cover rounded-lg shadow-lg"/>
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center rounded-lg group-hover:bg-opacity-50 transition-all duration-300">
                        <h3 className="text-white text-3xl font-bold">Dresses</h3>
                    </div>
                </a>
                <a href="#" className="group relative block">
                    <img src="https://placehold.co/600x800/D4C3E2/4A3F3F?text=Tops" alt="Tops" className="w-full h-full object-cover rounded-lg shadow-lg"/>
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center rounded-lg group-hover:bg-opacity-50 transition-all duration-300">
                        <h3 className="text-white text-3xl font-bold">Tops</h3>
                    </div>
                </a>
                <a href="#" className="group relative block">
                    <img src="https://placehold.co/600x800/C3D1E2/4A3F3F?text=New+In" alt="New In" className="w-full h-full object-cover rounded-lg shadow-lg"/>
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center rounded-lg group-hover:bg-opacity-50 transition-all duration-300">
                        <h3 className="text-white text-3xl font-bold">New In</h3>
                    </div>
                </a>
            </div>
        </div>
    </section>
);

// Hero Section Component
const HeroSection = () => (
    <div className="relative bg-cover bg-center h-[60vh] md:h-[80vh] flex items-center" style={{ backgroundImage: "url('/hero.jpg')" }}>
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight mb-4" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.5)'}}>
                Discover Your Style
            </h1>
            <p className="text-lg md:text-xl max-w-2xl mx-auto mb-8" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.5)'}}>
                Fresh looks for every moment. Explore our latest collection and find your new favorite outfit.
            </p>
            <a href="#" className="bg-white text-black font-bold py-3 px-8 rounded-full text-lg hover:bg-gray-200 transition-all duration-300 transform hover:scale-105">
                Shop New Arrivals
            </a>
        </div>
    </div>
);
const instagramPosts = [
    { id: 1, image: 'https://placehold.co/300x300/F5D7D7/4A3F3F?text=@only4u' },
    { id: 2, image: 'https://placehold.co/300x300/D7E6F5/4A3F3F?text=@only4u' },
    { id: 3, image: 'https://placehold.co/300x300/D7F5E6/4A3F3F?text=@only4u' },
    { id: 4, image: 'https://placehold.co/300x300/F5F2D7/4A3F3F?text=@only4u' },
    { id: 5, image: 'https://placehold.co/300x300/E6D7F5/4A3F3F?text=@only4u' },
    { id: 6, image: 'https://placehold.co/300x300/D7F5F5/4A3F3F?text=@only4u' },
];

