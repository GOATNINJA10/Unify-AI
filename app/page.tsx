"use client"

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/main');
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  return <div>Loading...</div>;
}
