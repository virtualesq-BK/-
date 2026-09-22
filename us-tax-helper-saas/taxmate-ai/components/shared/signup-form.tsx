'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function SignupForm() {
  return (
    <Button
      className="w-full"
      onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
    >
      Sign up with Google
    </Button>
  );
}
