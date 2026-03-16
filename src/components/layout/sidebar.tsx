'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Image, 
  History, 
  Play, 
  Settings, 
  FileCode,
  Clock,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Current Baseline', href: '/baseline', icon: Image },
  { name: 'Baseline History', href: '/baseline/history', icon: Layers },
  { name: 'Run History', href: '/runs', icon: History },
  { name: 'New Run', href: '/runs/new', icon: Play },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Config Editor', href: '/settings/config', icon: FileCode },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-[var(--background)] border-r border-[var(--border)]">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-[var(--border)]">
        <Clock className="h-6 w-6 text-[var(--primary)]" />
        <span className="font-semibold text-lg">VGress</span>
      </div>
      <nav className="flex flex-col gap-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
