import { AdapterUser } from 'next-auth/adapters';
import { JWT as NextAuthJWT, Session as NextAuthSession } from 'next-auth';

declare module 'next-auth' {
  interface User extends AdapterUser {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
    access_token?: string | null;
    refresh_token?: string | null;
    emailVerified?: Date | null;
  }

  interface Session extends NextAuthSession {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role?: string | null;
      emailVerified?: Date | null;
    };
    access_token?: string | null;
    refresh_token?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends NextAuthJWT {
    id?: string | null;
    email?: string | null;
    name?: string | null;
    role?: string | null;
    access_token?: string | null;
    refresh_token?: string | null;
    emailVerified?: Date | null;
  }
}