'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';

// Valorant logo SVG icon - angular V shape matching official logo
function ValorantIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      {/* Left V shape */}
      <path d="M5 20L42 80H58L21 20H5Z" />
      {/* Right vertical + diagonal */}
      <path d="M58 20V55L78 80H95V20H78V55L58 20Z" />
    </svg>
  );
}

// osu! logo SVG icon - circle with "osu!" text
function OsuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" />
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fill="currentColor"
        fontSize="32"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        osu!
      </text>
    </svg>
  );
}

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const navItems: NavItem[] = [
  { href: '/general', icon: Home, label: 'General' },
  { href: '/valorant', icon: ValorantIcon, label: 'Valorant' },
  { href: '/osu', icon: OsuIcon, label: 'osu!' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="topnav">
      <div className="topnav-inner">
        {/* Brand */}
        <Link href="/general" className="topnav-brand">
          <span className="topnav-brand-text">luca</span>
        </Link>

        {/* Navigation Links */}
        <div className="topnav-links">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('topnav-link', isActive && 'topnav-link-active')}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right side spacer for symmetry */}
        <div className="topnav-right" />
      </div>
    </nav>
  );
}
