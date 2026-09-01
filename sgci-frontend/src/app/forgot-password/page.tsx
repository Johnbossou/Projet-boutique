'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Veuillez entrer votre email');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch('/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la demande');
      }

      setIsSuccess(true);
      setResetToken(data.token || '');
      toast.success(data.message || 'Lien de réinitialisation envoyé');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la demande');
    } finally {
      setIsLoading(false);
    }
  };

  const goToReset = () => {
    if (resetToken) {
      router.push(`/reset-password?token=${resetToken}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-slate-200/50 dark:border-slate-700/50 shadow-2xl">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">
                {isSuccess ? 'Email envoyé' : 'Mot de passe oublié'}
              </CardTitle>
              <CardDescription className="mt-2">
                {isSuccess
                  ? 'Un lien de réinitialisation a été envoyé à votre adresse email.'
                  : 'Entrez votre email pour recevoir un lien de réinitialisation'}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {!isSuccess ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Adresse email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                  disabled={isLoading}
                >
                  {isLoading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                </Button>

                <div className="text-center">
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Retour à la connexion
                  </Link>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle2 className="w-8 h-8" />
                  <span className="font-semibold">Email envoyé!</span>
                </div>
                
                <p className="text-center text-sm text-muted-foreground">
                  Consultez votre boîte de réception et cliquez sur le lien pour réinitialiser votre mot de passe.
                </p>

                {resetToken && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">
                      Mode développement - Token de réinitialisation:
                    </p>
                    <code className="text-xs break-all text-blue-600 dark:text-blue-400">
                      {resetToken}
                    </code>
                    <Button
                      onClick={goToReset}
                      className="w-full mt-2"
                      variant="outline"
                      size="sm"
                    >
                      Utiliser ce token directement
                    </Button>
                  </div>
                )}

                <div className="text-center pt-4">
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Retour à la connexion
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
