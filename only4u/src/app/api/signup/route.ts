import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-server';
import { hash } from 'bcrypt';

export async function POST(request: Request) {
  try {
    // Validate environment variables
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Supabase client variables missing', {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'unset',
      });
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    if (!process.env.NEXTAUTH_SECRET || !process.env.NEXTAUTH_URL) {
      console.error('NextAuth variables missing', {
        secret: process.env.NEXTAUTH_SECRET ? 'set' : 'unset',
        url: process.env.NEXTAUTH_URL,
      });
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const formData = await request.formData();
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string | null;
    const email = formData.get('email') as string;
    const subscribe = formData.get('subscribe') === 'true';
    const company = formData.get('company') as string;
    const website = formData.get('website') as string | null;
    const phone = formData.get('phone') as string;
    const address = formData.get('address') as string;
    const apartment = formData.get('apartment') as string | null;
    const city = formData.get('city') as string;
    const zipCode = formData.get('zipCode') as string;
    const country = formData.get('country') as string;
    const state = formData.get('state') as string | null;
    const password = formData.get('password') as string;
    const businessLicense = formData.get('businessLicense') as File | null;

    // Validate required fields
    if (!firstName || !email || !company || !phone || !address || !city || !zipCode || !country || !password || !businessLicense) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Create user in auth.users
    const { data: { user }, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXTAUTH_URL}/api/auth/callback/credentials`,
        data: { first_name: firstName, last_name: lastName, role: 'user' },
      },
    });

    if (signUpError || !user) {
      console.error('Sign-up error:', signUpError);
      if (signUpError?.message.includes('already registered')) {
        return NextResponse.json({ error: 'User already exists' }, { status: 400 });
      }
      return NextResponse.json({ error: signUpError?.message || 'Failed to create user' }, { status: 400 });
    }

    // Confirm user immediately (requires service_role)
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });

    if (confirmError) {
      console.error('User confirmation error:', confirmError);
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      return NextResponse.json({ error: 'Failed to confirm user' }, { status: 400 });
    }

    // Hash password for users table
    const hashedPassword = await hash(password, 10);

    // Upload business license
    let businessLicensePath = null;
    if (businessLicense) {
      const fileExt = businessLicense.name.split('.').pop();
      const fileName = `${user.id}/license-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from('business-licenses')
        .upload(fileName, businessLicense, { contentType: businessLicense.type });
      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        await supabaseAdmin.auth.admin.deleteUser(user.id);
        return NextResponse.json({ error: 'Failed to upload business license' }, { status: 400 });
      }
      businessLicensePath = fileName;
    }

    // Insert into users table with supabaseAdmin to bypass RLS
    const { error: insertError } = await supabaseAdmin.from('users').insert({
      id: user.id,
      first_name: firstName,
      last_name: lastName,
      email,
      subscribe,
      company,
      website,
      phone,
      address,
      apartment,
      city,
      zip_code: zipCode,
      country,
      state,
      business_license: businessLicensePath,
      role: 'user',
      password: hashedPassword,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('Insert user error:', insertError);
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      return NextResponse.json({ error: 'Failed to insert user data' }, { status: 400 });
    }

    // Auto-login server-side
    const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError || !session) {
      console.error('Auto-login error:', loginError);
      return NextResponse.json({ message: 'User created successfully, please log in' }, { status: 201 });
    }

    // Set session cookie
    const response = NextResponse.json({ message: 'User created and logged in successfully' }, { status: 201 });
    response.cookies.set('supabase-auth-token', session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: session.expires_in,
    });

    return response;
  } catch (err: any) {
    console.error('Signup error:', err.message, err.stack);
    return NextResponse.json({ error: 'An error occurred during sign-up' }, { status: 500 });
  }
}