"use server";

import { redirect } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  images?: { url: string; path: string }[];
  error?: string;
}

interface FormState {
  error?: string;
  success?: boolean;
}

async function checkUniqueName(name: string, excludeVariantGroupId?: string): Promise<boolean> {
  let query = supabase
    .from('product_groups')
    .select('name')
    .eq('name', name);

  if (excludeVariantGroupId) {
    query = query.neq('variant_group_id', excludeVariantGroupId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Supabase error checking name uniqueness:', error.message, error.details);
    return false;
  }
  return data.length === 0;
}

export async function handleSubmit(prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    // Log all FormData entries with details
    const formDataEntries: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      formDataEntries[key] = value instanceof File ? { name: value.name, size: value.size, type: value.type } : value;
    }
    console.log('All FormData entries received:', JSON.stringify(formDataEntries, null, 2));

    // Validate form data
    const name = formData.get('name') as string;
    const price = formData.get('price') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const status = formData.get('status') as string;
    const variantsRaw = formData.get('variants') as string;

    if (!name || !price || !category || !status || !description) {
      console.error('Validation failed: Missing required fields', { name, price, category, status, description });
      return { error: 'Name, price, category, status, and description are required' };
    }

    if (isNaN(Number(price)) || Number(price) <= 0) {
      console.error('Validation failed: Invalid price', { price });
      return { error: 'Price must be a positive number' };
    }

    let variants: Variant[];
    try {
      variants = JSON.parse(variantsRaw) as Variant[];
    } catch (err) {
      console.error('Failed to parse variants:', err);
      return { error: 'Invalid variants data' };
    }

    if (!variants.every((v) => v.color && v.stock && !isNaN(Number(v.stock)) && Number(v.stock) >= 0)) {
      console.error('Validation failed: Invalid variants', { variants });
      return { error: 'All variants must have a color and non-negative stock' };
    }

    // Server-side imports
    const { auth } = await import('@/app/api/auth/[...nextauth]/route');
    const session = await auth();

    if (!session?.user?.id) {
      console.error('No session found in handleSubmit');
      return { error: 'Unauthorized: No session found' };
    }

    // Check admin status
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (userError || user?.role !== 'admin') {
      console.error('Admin check failed:', userError?.message || 'User is not admin');
      return { error: 'Unauthorized: Admin access required' };
    }

    // Check for unique product name
    const isNameUnique = await checkUniqueName(name);
    if (!isNameUnique) {
      console.error('Validation failed: Product name not unique', { name });
      return { error: 'Product name must be unique' };
    }

    // Upload images
    const variant_group_id = uuidv4();
    let imageData: ImageUploadResponse = { images: [] };
    const imagesToUpload: File[] = [];
    for (const variant of variants) {
      const mainImageKey = `mainImage-${variant.id}`;
      const hoverImageKey = `hoverImage-${variant.id}`;
      const mainImage = formData.get(mainImageKey);
      const hoverImage = formData.get(hoverImageKey);
      console.log('Checking variant:', {
        variantId: variant.id,
        mainImageKey,
        mainImageExists: !!mainImage,
        mainImageDetails: mainImage instanceof File ? { name: mainImage.name, size: mainImage.size, type: mainImage.type } : mainImage,
        hoverImageKey,
        hoverImageExists: !!hoverImage,
        hoverImageDetails: hoverImage instanceof File ? { name: hoverImage.name, size: hoverImage.size, type: hoverImage.type } : hoverImage,
      });
      if (!mainImage || !(mainImage instanceof File)) {
        console.error('Missing or invalid main image for variant:', { variantId: variant.id, mainImageKey });
        return { error: `Main image is required for variant ${variant.id}` };
      }
      imagesToUpload.push(mainImage as File);
      if (hoverImage && hoverImage instanceof File) {
        imagesToUpload.push(hoverImage);
      }
    }

    if (imagesToUpload.length > 0) {
      if (imagesToUpload.length > 10) {
        console.error('Too many images:', { imageCount: imagesToUpload.length });
        return { error: 'Maximum 10 images allowed per submission' };
      }

      const imageFormData = new FormData();
      imagesToUpload.forEach((image, index) => {
        imageFormData.append(`images[${index}]`, image);
      });
      imageFormData.append('productId', variant_group_id);

      // Log FormData contents for upload
      const uploadFormDataEntries: Record<string, any> = {};
      for (const [key, value] of imageFormData.entries()) {
        uploadFormDataEntries[key] = value instanceof File ? { name: value.name, size: value.size, type: value.type } : value;
      }
      console.log('FormData contents before upload:', JSON.stringify(uploadFormDataEntries, null, 2));

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
      const uploadUrl = `${baseUrl}/api/upload-product-image`;
      console.log('Attempting image upload to:', uploadUrl, {
        imageCount: imagesToUpload.length,
        productId: variant_group_id,
      });

      // Forward cookies to authenticate the request
      const cookieStore = await cookies();
      const cookieHeader = cookieStore.getAll().map(({ name, value }: { name: string; value: string }) => `${name}=${value}`).join('; ');

      const imageResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: imageFormData,
        headers: {
          Cookie: cookieHeader,
        },
      });

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        console.error('Image upload failed:', {
          status: imageResponse.status,
          statusText: imageResponse.statusText,
          errorText,
          url: uploadUrl,
          cookieHeader: cookieHeader ? '[present]' : '[missing]',
        });
        return { error: `Image upload failed: ${errorText || 'Unknown error'}` };
      }

      imageData = await imageResponse.json();
      console.log('Image upload successful:', imageData);
    } else {
      console.error('No images to upload');
      return { error: 'At least one main image is required' };
    }

    // Insert into product_groups
    const { error: groupError } = await supabase
      .from('product_groups')
      .insert([{
        variant_group_id,
        name,
        price: parseFloat(price),
        description,
        category,
        status,
      }]);

    if (groupError) {
      console.error('Error inserting product group:', {
        message: groupError.message,
        code: groupError.code,
        details: groupError.details,
      });
      if (groupError.code === '42501') {
        return { error: 'Permission denied: Ensure user has admin role' };
      } else if (groupError.code === '23505') {
        return { error: 'Product name must be unique' };
      } else if (groupError.code === 'PGRST204') {
        return { error: 'Invalid column in insert: Check product_groups schema' };
      } else {
        return { error: `Failed to add product: ${groupError.message}` };
      }
    }

    // Insert variants
    let imageIndex = 0;
    for (const variant of variants) {
      let mainImageUrl = '';
      if (formData.get(`mainImage-${variant.id}`)) {
        mainImageUrl = imageData.images?.[imageIndex++]?.url || '';
        if (!mainImageUrl) {
          console.error('Missing main image URL for variant:', variant);
          return { error: 'Failed to get main image URL for variant' };
        }
      }

      let hoverImageUrl: string | null = null;
      if (formData.get(`hoverImage-${variant.id}`)) {
        hoverImageUrl = imageData.images?.[imageIndex++]?.url || '';
        if (!hoverImageUrl) {
          console.error('Missing hover image URL for variant:', variant);
          return { error: 'Failed to get hover image URL for variant' };
        }
      }

      const { error: variantError } = await supabase.from('products').insert({
        id: variant.id,
        variant_group_id,
        color: variant.color,
        image_url: mainImageUrl,
        hover_image_url: hoverImageUrl,
        stock: parseInt(variant.stock),
      });

      if (variantError) {
        console.error('Supabase error inserting variant:', variantError.message, variantError.details);
        return { error: `Failed to add variant: ${variantError.message}` };
      }
    }

    console.log('Product added successfully, redirecting to /admin/dashboard');
    redirect('/admin/dashboard');
  } catch (err: any) {
    console.error('Unexpected error in handleSubmit:', {
      message: err.message,
      stack: err.stack,
    });
    return { error: `An unexpected error occurred: ${err.message}` };
  }
}