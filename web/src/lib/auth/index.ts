import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { upsertUser } from '@/lib/db';

const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || 'dashdot.com.au')
  .split(',')
  .map(d => d.trim().toLowerCase());

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return false;
      
      const email = user.email?.toLowerCase();
      if (!email) return false;
      
      // Check domain restriction
      const domain = email.split('@')[1];
      if (!ALLOWED_DOMAINS.includes(domain)) {
        return false;
      }
      
      // Upsert user in database
      upsertUser({
        id: user.id!,
        email: email,
        name: user.name || null,
        avatar_url: user.image || null,
        last_login_at: new Date().toISOString(),
      });
      
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  session: {
    strategy: 'jwt',
  },
});

// Helper to check if user is admin
export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const adminEmail = process.env.ADMIN_EMAIL || 'marketing@dashdot.com.au';
  return email.toLowerCase() === adminEmail.toLowerCase();
}
