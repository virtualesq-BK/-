'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  ClipboardCheck,
  Users,
  Briefcase,
  Settings,
} from 'lucide-react';
import type { UserRole } from '@prisma/client';

const userNavItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/documents', label: 'Docs', icon: FileText },
  { href: '/review', label: 'Return', icon: ClipboardCheck },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const userNavDesktop = [
  ...userNavItems.slice(0, 4),
  { href: '/cpa-match', label: 'Find CPA', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const cpaNavItems = [
  { href: '/cpa/dashboard', label: 'CPA Dashboard', icon: Briefcase },
  { href: '/chat', label: 'Messages', icon: MessageSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function DashboardNav({ role = 'USER' }: { role?: UserRole }) {
  const pathname = usePathname();
  const isCpa = role === 'CPA';
  const desktopItems = isCpa ? cpaNavItems : userNavDesktop;
  const mobileItems = isCpa ? cpaNavItems : userNavItems;

  const NavLink = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          active
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="hidden lg:inline">{label}</span>
      </Link>
    );
  };

  return (
    <>
      <aside className="hidden w-64 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center border-b px-6">
          <Link
            href={isCpa ? '/cpa/dashboard' : '/dashboard'}
            className="text-lg font-bold text-primary"
          >
            TaxMate AI
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {desktopItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t bg-card lg:hidden">
        {mobileItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
