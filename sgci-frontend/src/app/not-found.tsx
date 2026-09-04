import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <p className="text-[8rem] font-bold leading-none tracking-tighter bg-gradient-to-br from-orange-500 to-red-600 bg-clip-text text-transparent dark:from-orange-400 dark:to-red-500">
        404
      </p>
      <h1 className="text-2xl font-semibold text-foreground">
        Page introuvable
      </h1>
      <p className="text-muted-foreground max-w-md">
        La page que vous recherchez n&apos;existe pas ou a été déplacée.
      </p>
      <Button asChild size="lg">
        <Link href="/">Retour au dashboard</Link>
      </Button>
    </div>
  );
}
