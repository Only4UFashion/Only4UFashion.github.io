"use client";

import { supabase } from '@/lib/supabase';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

export default function ProductPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    async function fetchProduct() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, variant_group_id, name, price, description, color, image_url, hover_image_url, category, stock, status')
          .eq('id', params.id)
          .single();

        if (error) {
          console.error('Supabase error fetching product:', error);
          setErrorMessage(error.message);
          return;
        }

        setProduct(data);

        const { data: variantsData, error: variantsError } = await supabase
          .from('products')
          .select('id, color, image_url, hover_image_url, stock, status')
          .eq('variant_group_id', data.variant_group_id);

        if (variantsError) {
          console.error('Supabase error fetching variants:', variantsError);
          setErrorMessage(variantsError.message);
          return;
        }

        setVariants(variantsData || []);
      } catch (err) {
        console.error('Unexpected error fetching product:', err);
        setErrorMessage(String(err));
      }
    }

    fetchProduct();
  }, [params.id]);

  if (!product) {
    return <div>Error fetching product: {errorMessage || 'Product not found'}</div>;
  }

  return (
    <div className="bg-pink-300 min-h-screen p-4">
      <div className="bg-white rounded-lg shadow-md p-4 max-w-2xl mx-auto">
        {errorMessage && <p className="text-red-500 mb-4">Error: {errorMessage}</p>}
        <ClientComponent product={product} variants={variants} session={session} />
      </div>
    </div>
  );
}

function ClientComponent({
  product,
  variants,
  session,
}: {
  product: { id: string; name: string; price: number; description: string; color: string; image_url: string; hover_image_url?: string; category: string; stock: number; status: string };
  variants: { id: string; color: string; image_url: string; hover_image_url?: string; stock: number; status: string }[];
  session: any;
}) {
  const [selectedVariant, setSelectedVariant] = useState(product);

  if (!session) {
    return <div>Please log in to view product images.</div>;
  }

  return (
    <>
      <img
        src={selectedVariant.image_url}
        alt={selectedVariant.name}
        className="w-full h-64 object-cover"
      />
      <h1 className="text-2xl font-bold">{product.name}</h1>
      <p className="text-gray-600">${product.price.toFixed(2)}</p>
      <p className="text-sm text-gray-500">Category: {product.category.charAt(0).toUpperCase() + product.category.slice(1)}</p>
      <p className="text-sm text-gray-500">Stock: {selectedVariant.stock}</p>
      <p className="text-sm text-gray-500">Status: {selectedVariant.status.replace('_', ' ').charAt(0).toUpperCase() + selectedVariant.status.slice(1).replace('_', ' ')}</p>
      <p>{product.description}</p>
      {variants.length > 1 && (
        <div className="mt-4">
          <label className="block text-gray-700">Select Color</label>
          <select
            value={selectedVariant.id}
            onChange={(e) => {
              const variant = variants.find((v) => v.id === e.target.value);
              if (variant) setSelectedVariant({ ...product, ...variant });
            }}
            className="w-full border rounded-lg p-2"
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.color} ({variant.stock} in stock)
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}