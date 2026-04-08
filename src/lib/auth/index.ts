import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getUserByEmail, upsertUser, getDb } from '@/lib/db';
import { hashPassword, verifyPassword, generateUserId } from './password';

// Initialize admin user from environment variables on first load
function initializeAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminEmail || !adminPassword) {
    console.warn('Warning: ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables');
    return;
  }
  
  const db = getDb();
  const existingUser = getUserByEmail(adminEmail);
  
  if (!existingUser) {
    // Create admin user with hashed password
    const hashedPassword = hashPassword(adminPassword);
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, name, password_hash)
      VALUES (?, ?, ?, ?)
    `).run(generateUserId(), adminEmail, 'Admin', hashedPassword);
    console.log('Admin user created successfully');
  } else if (!existingUser.password_hash) {
    // Update existing user with password if they don't have one
    const hashedPassword = hashPassword(adminPassword);
    db.prepare(`
      UPDATE users SET password_hash = ? WHERE email = ?
    `).run(hashedPassword, adminEmail);
    console.log('Admin user password updated');
  }
}

// Initialize admin on module load
initializeAdminUser();

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        
        const email = (credentials.email as string).toLowerCase();
        const password = credentials.password as string;
        
        const user = getUserByEmail(email);
        
        if (!user || !user.password_hash) {
          return null;
        }
        
        const isValid = verifyPassword(password, user.password_hash);
        
        if (!isValid) {
          return null;
        }
        
        // Update last login
        upsertUser({
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          password_hash: user.password_hash,
          last_login_at: new Date().toISOString(),
        });
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar_url,
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
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
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  return email.toLowerCase() === adminEmail.toLowerCase();
}
