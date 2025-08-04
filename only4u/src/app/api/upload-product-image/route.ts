import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/app/api/auth/[...nextauth]/route';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // Log incoming cookies for debugging
    const cookieHeader = request.headers.get('cookie');
    console.log('Incoming cookies in /api/upload-product-image:', {
      cookieHeader: cookieHeader ? '[present]' : '[missing]',
      cookies: cookieHeader || 'none',
    });

    const session = await auth();
    console.log('Session in /api/upload-product-image:', {
      userId: session?.user?.id || '[missing]',
      email: session?.user?.email || '[missing]',
    });

    if (!session?.user) {
      console.error('Unauthorized: No session or user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (user?.role !== 'admin') {
      console.error('Forbidden: User is not admin', { userId: session.user.id });
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const images = formData.getAll('images') as File[];
    const productId = formData.get('productId') as string;

    // Log FormData contents for debugging
    const formDataEntries: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      formDataEntries[key] = value instanceof File ? { name: value.name, size: value.size, type: value.type } : value;
    }
    console.log('FormData received in /api/upload-product-image:', formDataEntries);

    if (!images.length || !productId) {
      console.error('Missing images or productId', { imageCount: images.length, productId });
      return NextResponse.json({ error: 'Missing images or productId' }, { status: 400 });
    }

    if (images.length > 10) {
      console.error('Too many images', { imageCount: images.length });
      return NextResponse.json({ error: 'Maximum 10 images allowed per request' }, { status: 400 });
    }

    const uploadedImages = [];

    for (const image of images) {
      if (!image.type.startsWith('image/')) {
        console.error('Invalid image type', { fileName: image.name, type: image.type });
        return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
      }
      if (image.size > 5 * 1024 * 1024) {
        console.error('Image too large', { fileName: image.name, size: image.size });
        return NextResponse.json({ error: 'Image size must be less than 5MB' }, { status: 400 });
      }

      const fileName = `${productId}/${Date.now()}-${image.name}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, image, { upsert: true });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        return NextResponse.json({ error: uploadError.message }, { status: 400 });
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      uploadedImages.push({ url: publicUrlData.publicUrl, path: fileName });
    }

    console.log('Images uploaded successfully', { imageCount: uploadedImages.length, productId });
    return NextResponse.json({
      message: 'Images uploaded successfully',
      images: uploadedImages,
    }, { status: 201 });
  } catch (err) {
    console.error('Image upload error:', err);
    return NextResponse.json({ error: 'An error occurred during image upload' }, { status: 500 });
  }
}