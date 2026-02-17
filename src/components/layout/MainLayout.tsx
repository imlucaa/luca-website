'use client';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <main className="min-h-screen pt-[60px]">
      <div className="flex items-start justify-center min-h-[calc(100vh-60px)] p-5">
        {children}
      </div>
    </main>
  );
}
