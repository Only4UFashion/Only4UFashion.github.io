import { createClient } from '@supabase/supabase-js';

// Utility to decode JWT payload (without verification)
function decodeJWTPayload(token: string): any {
  try {
    const [, payloadBase64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    return {
      exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : '[unknown]',
      iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : '[unknown]',
      sub: payload.sub ?? '[missing]',
    };
  } catch (err: any) {
    console.error('Failed to decode JWT payload:', err.message);
    return { exp: '[error]', iat: '[error]', sub: '[error]' };
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export let supabase: any = null;

if (supabaseUrl && supabaseAnonKey) {
  if (supabaseUrl !== process.env.SUPABASE_URL) {
    console.warn('Supabase URL mismatch:', {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      SUPABASE_URL: process.env.SUPABASE_URL,
    });
  }
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  console.log('Supabase initialized successfully:', {
    supabaseUrl,
    supabaseAnonKey: supabaseAnonKey ? '[set]' : '[unset]',
    clientInitialized: !!supabase,
    authConfig: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
} else {
  console.error('Supabase initialization failed: Missing environment variables', {
    supabaseUrl: supabaseUrl ?? '[unset]',
    supabaseAnonKey: supabaseAnonKey ? '[set]' : '[unset]',
    supabaseServiceUrl: process.env.SUPABASE_URL ?? '[unset]',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? '[set]' : '[unset]',
  });
  throw new Error('Supabase environment variables are not set');
}

export async function setSupabaseAuth(session: any) {
  if (!supabase) {
    console.warn('setSupabaseAuth skipped: Supabase client not initialized');
    return false;
  }

  console.log('setSupabaseAuth called with:', {
    userId: session?.user?.id ?? '[missing]',
    email: session?.user?.email ?? '[missing]',
    accessToken: session?.access_token ? '[present]' : '[missing]',
    refreshToken: session?.refresh_token ? '[present]' : '[missing]',
    accessTokenLength: session?.access_token?.length ?? 0,
    refreshTokenLength: session?.refresh_token?.length ?? 0,
    accessTokenPayload: session?.access_token ? decodeJWTPayload(session.access_token) : '[missing]',
    sessionExists: !!session,
    userExists: !!session?.user,
    sessionKeys: session ? Object.keys(session) : [],
    userKeys: session?.user ? Object.keys(session.user) : [],
    env: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '[unset]',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '[set]' : '[unset]',
      supabaseServiceUrl: process.env.SUPABASE_URL ?? '[unset]',
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? '[set]' : '[unset]',
    },
  });

  if (!session || !session.user?.id || !session.access_token) {
    console.warn('Skipping Supabase auth token set: incomplete session data');
    return false;
  }

  try {
    // Validate access_token
    const { data: userData, error: validateError } = await supabase.auth.getUser(session.access_token);
    if (validateError || !userData.user) {
      console.error('Access token validation failed:', validateError?.message, {
        code: validateError?.code,
        details: JSON.stringify(validateError, null, 2),
        accessTokenTruncated: session.access_token ? session.access_token.slice(0, 10) + '...' : '[missing]',
        accessTokenPayload: session.access_token ? decodeJWTPayload(session.access_token) : '[missing]',
      });

      // Attempt to refresh session if refresh_token is present
      if (session.refresh_token) {
        console.log('Attempting to refresh session with refresh_token');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: session.refresh_token,
        });
        if (refreshError || !refreshData.session) {
          console.error('Failed to refresh session:', refreshError?.message, {
            code: refreshError?.code,
            details: JSON.stringify(refreshError, null, 2),
            refreshTokenTruncated: session.refresh_token ? session.refresh_token.slice(0, 10) + '...' : '[missing]',
          });
          return false;
        }
        session.access_token = refreshData.session.access_token;
        session.refresh_token = refreshData.session.refresh_token;
        console.log('Session refreshed successfully:', {
          accessToken: '[present]',
          refreshToken: '[present]',
          accessTokenLength: refreshData.session.access_token.length,
          refreshTokenLength: refreshData.session.refresh_token.length,
          accessTokenPayload: decodeJWTPayload(refreshData.session.access_token),
        });
      } else {
        console.warn('No refresh_token available to refresh session');
        return false;
      }
    }

    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token || '',
    });

    if (error) {
      console.error('Failed to set Supabase auth token:', error.message, {
        code: error.code,
        details: JSON.stringify(error, null, 2),
        accessTokenTruncated: session.access_token ? session.access_token.slice(0, 10) + '...' : '[missing]',
        accessTokenPayload: session.access_token ? decodeJWTPayload(session.access_token) : '[missing]',
      });
      return false;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('Failed to get Supabase user:', userError.message, {
        code: userError.code,
        details: JSON.stringify(userError, null, 2),
      });
      return false;
    }

    console.log('Supabase auth set successfully:', {
      id: user?.id,
      email: user?.email,
      confirmed: user?.confirmed_at ? 'yes' : 'no',
    });
    return true;
  } catch (err: any) {
    console.error('Unexpected error in setSupabaseAuth:', err.message, {
      stack: err.stack,
      details: JSON.stringify(err, null, 2),
    });
    return false;
  }
}