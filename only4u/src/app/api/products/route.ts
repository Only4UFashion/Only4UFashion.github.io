import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@/app/api/auth/[...nextauth]/route';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkUniqueName(name: string, excludeVariantGroupId?: string): Promise<boolean> {
  const query = supabase
    .from('product_groups')
    .select('name')
    .eq('name', name);
  
  if (excludeVariantGroupId) {
    query.neq('variant_group_id', excludeVariantGroupId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Supabase error checking name uniqueness:', error.message, error.details);
    return false;
  }
  return data.length === 0;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const price = parseFloat(formData.get('price') as string);
    const category = formData.get('category') as string;
    const status = formData.get('status') as string;
    const description = formData.get('description') as string;
    const variants = JSON.parse(formData.get('variants') as string);
    const variant_group_id = uuidv4();

    if (!name || isNaN(price) || !category || !status || !description || !variants) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check for unique product name
    const isNameUnique = await checkUniqueName(name);
    if (!isNameUnique) {
      return NextResponse.json({ error: 'Product name must be unique' }, { status: 400 });
    }

    const { error: groupError } = await supabase.from('product_groups').insert({
      variant_group_id,
      name,
      price,
      category,
      status,
      description,
    });

    if (groupError) {
      console.error('Supabase error inserting product group:', groupError.message, groupError.details);
      return NextResponse.json({ error: `Failed to add product group: ${groupError.message}` }, { status: 500 });
    }

    for (const variant of variants) {
      const mainImage = formData.get(`mainImage-${variant.id}`) as File;
      const hoverImage = formData.get(`hoverImage-${variant.id}`) as File | null;

      if (!mainImage) {
        return NextResponse.json({ error: 'Main image is required for each variant' }, { status: 400 });
      }

      const mainImageExt = mainImage.name.split('.').pop();
      const mainImageName = `${variant_group_id}/${variant.id}-main.${mainImageExt}`;
      const { error: mainImageError } = await supabase.storage.from('product-images').upload(mainImageName, mainImage, { upsert: true });
      if (mainImageError) {
        console.error('Supabase error uploading main image:', mainImageError.message, mainImageError);
        return NextResponse.json({ error: `Failed to upload main image: ${mainImageError.message}` }, { status: 500 });
      }
      const { data: mainImageData } = supabase.storage.from('product-images').getPublicUrl(mainImageName);
      const mainImageUrl = mainImageData.publicUrl;

      let hoverImageUrl: string | null = null;
      if (hoverImage) {
        const hoverImageExt = hoverImage.name.split('.').pop();
        const hoverImageName = `${variant_group_id}/${variant.id}-hover.${hoverImageExt}`;
        const { error: hoverImageError } = await supabase.storage.from('product-images').upload(hoverImageName, hoverImage, { upsert: true });
        if (hoverImageError) {
          console.error('Supabase error uploading hover image:', hoverImageError.message, hoverImageError);
          return NextResponse.json({ error: `Failed to upload hover image: ${hoverImageError.message}` }, { status: 500 });
        }
        const { data: hoverImageData } = supabase.storage.from('product-images').getPublicUrl(hoverImageName);
        hoverImageUrl = hoverImageData.publicUrl;
      }

      const { error: variantError } = await supabase.from('products').insert({
        id: variant.id,
        variant_group_id,
        color: variant.color,
        image_url: mainImageUrl,
        hover_image_url: hoverImageUrl,
        stock: variant.stock,
      });

      if (variantError) {
        console.error('Supabase error inserting variant:', variantError.message, variantError.details);
        return NextResponse.json({ error: `Failed to add variant: ${variantError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ message: 'Product added successfully' }, { status: 200 });
  } catch (err) {
    console.error('Unexpected error in POST /api/products:', err);
    return NextResponse.json({ error: 'Failed to add product' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const variant_group_id = searchParams.get('id');
    if (!variant_group_id) {
      return NextResponse.json({ error: 'Missing variant_group_id' }, { status: 400 });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const price = parseFloat(formData.get('price') as string);
    const category = formData.get('category') as string;
    const status = formData.get('status') as string;
    const description = formData.get('description') as string;
    const variants = JSON.parse(formData.get('variants') as string);

    if (!name || isNaN(price) || !category || !status || !description || !variants) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!variants.every((v: any) => v.color && v.image_url && v.hover_image_url && v.stock !== undefined)) {
      return NextResponse.json({ error: 'All variants must have color, images, and stock' }, { status: 400 });
    }

    // Check for unique product name (excluding current product)
    const isNameUnique = await checkUniqueName(name, variant_group_id);
    if (!isNameUnique) {
      return NextResponse.json({ error: 'Product name must be unique' }, { status: 400 });
    }

    // Update product group
    const { error: groupError } = await supabase
      .from('product_groups')
      .update({
        name,
        price,
        category,
        status,
        description,
      })
      .eq('variant_group_id', variant_group_id);

    if (groupError) {
      console.error('Supabase error updating product group:', groupError.message, groupError.details);
      return NextResponse.json({ error: `Failed to update product group: ${groupError.message}` }, { status: 500 });
    }

    // Fetch existing variants
    const { data: existingVariants, error: fetchError } = await supabase
      .from('products')
      .select('id')
      .eq('variant_group_id', variant_group_id);

    if (fetchError) {
      console.error('Supabase error fetching existing variants:', fetchError.message, fetchError.details);
      return NextResponse.json({ error: `Failed to fetch variants: ${fetchError.message}` }, { status: 500 });
    }

    const existingVariantIds = existingVariants?.map((v) => v.id) || [];
    const submittedVariantIds = variants.map((v: any) => v.id);

    // Delete removed variants
    const variantsToDelete = existingVariantIds.filter((id) => !submittedVariantIds.includes(id));
    if (variantsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .in('id', variantsToDelete);

      if (deleteError) {
        console.error('Supabase error deleting variants:', deleteError.message, deleteError.details);
        return NextResponse.json({ error: `Failed to delete variants: ${deleteError.message}` }, { status: 500 });
      }
    }

    // Update or insert variants
    for (const variant of variants) {
      const mainImage = formData.get(`mainImage-${variant.id}`) as File | null;
      const hoverImage = formData.get(`hoverImage-${variant.id}`) as File | null;

      let mainImageUrl = variant.image_url;
      if (mainImage) {
        const mainImageExt = mainImage.name.split('.').pop();
        const mainImageName = `${variant_group_id}/${variant.id}-main.${mainImageExt}`;
        const { error: mainImageError } = await supabase.storage
          .from('product-images')
          .upload(mainImageName, mainImage, { upsert: true });
        if (mainImageError) {
          console.error('Supabase error uploading main image:', mainImageError.message, mainImageError);
          return NextResponse.json({ error: `Failed to upload main image: ${mainImageError.message}` }, { status: 500 });
        }
        const { data: mainImageData } = supabase.storage.from('product-images').getPublicUrl(mainImageName);
        mainImageUrl = mainImageData.publicUrl;
      }

      let hoverImageUrl = variant.hover_image_url;
      if (hoverImage) {
        const hoverImageExt = hoverImage.name.split('.').pop();
        const hoverImageName = `${variant_group_id}/${variant.id}-hover.${hoverImageExt}`;
        const { error: hoverImageError } = await supabase.storage
          .from('product-images')
          .upload(hoverImageName, hoverImage, { upsert: true });
        if (hoverImageError) {
          console.error('Supabase error uploading hover image:', hoverImageError.message, hoverImageError);
          return NextResponse.json({ error: `Failed to upload hover image: ${hoverImageError.message}` }, { status: 500 });
        }
        const { data: hoverImageData } = supabase.storage.from('product-images').getPublicUrl(hoverImageName);
        hoverImageUrl = hoverImageData.publicUrl;
      }

      const variantData = {
        id: variant.id,
        variant_group_id,
        color: variant.color,
        image_url: mainImageUrl,
        hover_image_url: hoverImageUrl,
        stock: variant.stock,
      };

      if (existingVariantIds.includes(variant.id)) {
        const { error: updateError } = await supabase
          .from('products')
          .update(variantData)
          .eq('id', variant.id);

        if (updateError) {
          console.error('Supabase error updating variant:', updateError.message, updateError.details);
          return NextResponse.json({ error: `Failed to update variant: ${updateError.message}` }, { status: 500 });
        }
      } else {
        const { error: insertError } = await supabase
          .from('products')
          .insert(variantData);

        if (insertError) {
          console.error('Supabase error inserting variant:', insertError.message, insertError.details);
          return NextResponse.json({ error: `Failed to insert variant: ${insertError.message}` }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ message: 'Product updated successfully' }, { status: 200 });
  } catch (err) {
    console.error('Unexpected error in PATCH /api/products:', err);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}