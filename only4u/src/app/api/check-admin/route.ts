import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { auth } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    // Check environment variables
    console.log('Environment variables in /api/check-admin:', {
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'unset',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'unset',
    });

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('Supabase environment variables missing in /api/check-admin');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const session = await auth();
    console.log('Session in /api/check-admin:', {
      userId: session?.user?.id ?? '[missing]',
      email: session?.user?.email ?? '[missing]',
      role: session?.user?.role ?? '[missing]',
      accessToken: session?.access_token ? '[present]' : '[missing]',
      fullSession: JSON.stringify(session, null, 2),
    });

    if (!session?.user?.id) {
      console.warn('No session or user ID in /api/check-admin');
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Supabase error fetching user role:', error.message, {
        code: error.code,
        userId: session.user.id,
      });
      return NextResponse.json({ isAdmin: false }, { status: 400 });
    }

    const isAdmin = user?.role === 'admin';
    console.log('Admin check result:', { userId: session.user.id, isAdmin });

    return NextResponse.json({ isAdmin }, { status: 200 });
  } catch (err: any) {
    console.error('Unexpected error in /api/check-admin:', err.message, {
      stack: err.stack,
    });
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}