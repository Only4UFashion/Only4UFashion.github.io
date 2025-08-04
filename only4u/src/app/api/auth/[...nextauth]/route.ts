import NextAuth, { type NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const authOptions: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('Authorize called with:', {
          email: credentials?.email,
          env: {
            nextAuthUrl: process.env.NEXTAUTH_URL,
            supabaseUrl: process.env.SUPABASE_URL,
            supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? '[set]' : '[unset]',
          },
        });

        if (!credentials?.email || !credentials?.password || typeof credentials.email !== 'string' || typeof credentials.password !== 'string') {
          console.error('Invalid credentials provided:', {
            email: credentials?.email,
            password: credentials?.password ? '[provided]' : '[missing]',
          });
          throw new Error('Missing or invalid credentials');
        }

        try {
          const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (authError || !session?.user || !session?.access_token) {
            console.error('Supabase auth error:', authError?.message, {
              email: credentials.email,
              code: authError?.code,
            });
            if (authError?.message.includes('Email not confirmed')) {
              throw new Error('Email not confirmed');
            }
            throw new Error('Invalid email or password');
          }

          console.log('Authenticated user:', {
            id: session.user.id,
            email: session.user.email,
            confirmed: session.user.confirmed_at ? 'yes' : 'no',
            access_token: session.access_token ? '[present]' : '[missing]',
          });

          const { data: users, error } = await supabase
            .from('users')
            .select('id, email, first_name, last_name, role')
            .eq('id', session.user.id)
            .single();

          if (error || !users) {
            console.warn('User not found in users table, using auth.users data:', session.user.id);
            return {
              id: session.user.id,
              email: session.user.email ?? credentials.email,
              name: session.user.user_metadata?.first_name ?? 'Unknown',
              role: session.user.user_metadata?.role ?? 'user',
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            };
          }

          return {
            id: users.id,
            email: users.email,
            name: `${users.first_name} ${users.last_name || ''}`.trim(),
            role: users.role || 'user',
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          };
        } catch (err: any) {
          console.error('Authorize error:', err.message, {
            stack: err.stack,
          });
          throw new Error(err.message || 'Authentication failed');
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    signOut: '/',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.access_token = user.access_token;
        token.refresh_token = user.refresh_token;
      }
      console.log('JWT callback:', {
        tokenId: token.id,
        email: token.email,
        role: token.role,
        accessToken: token.access_token ? '[present]' : '[missing]',
        refreshToken: token.refresh_token ? '[present]' : '[missing]',
      });
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = session.user || {};
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as string;
        session.access_token = token.access_token as string;
        session.refresh_token = token.refresh_token as string;

        console.log('Session callback:', {
          userId: session.user.id,
          email: session.user.email,
          role: session.user.role,
          accessToken: session.access_token ? '[present]' : '[missing]',
          refreshToken: session.refresh_token ? '[present]' : '[missing]',
          sessionKeys: Object.keys(session),
          userKeys: session.user ? Object.keys(session.user) : [],
        });
      } else {
        console.warn('Session callback skipped: missing token', {
          tokenExists: !!token,
          sessionUserExists: !!session?.user,
        });
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.includes('/login') || url.includes('/signup')) {
        return baseUrl;
      }
      return url;
    },
  },
};

// Validate environment variables
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET is not set');
}
if (!process.env.NEXTAUTH_URL) {
  console.warn('NEXTAUTH_URL is not set, defaulting to http://localhost:3000');
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase environment variables are not set');
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
export const { GET, POST } = handlers;