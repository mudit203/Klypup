'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'ADMIN') {
        router.push('/');
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50 font-sans">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-neutral-500">Verifying administrator credentials...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
