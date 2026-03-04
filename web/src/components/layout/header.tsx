'use client';

import { signOut, useSession } from 'next-auth/react';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="fixed top-0 right-0 left-64 z-40 h-16 bg-[var(--background)] border-b border-[var(--border)]">
      <div className="flex h-full items-center justify-between px-6">
        <div />
        
        {session?.user && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center">
                  <User className="h-4 w-4 text-[var(--muted-foreground)]" />
                </div>
              )}
              <div className="text-sm">
                <p className="font-medium">{session.user.name}</p>
                <p className="text-[var(--muted-foreground)] text-xs">{session.user.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
