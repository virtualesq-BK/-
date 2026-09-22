'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function LoginForm() {
  return (
    <Button
      className="w-full"
      onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
    >
      Continue with Google
    </Button>
  );
}
