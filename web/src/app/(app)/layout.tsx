import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[var(--muted)]">
      <Sidebar />
      <Header />
      <main className="pl-64 pt-16">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
