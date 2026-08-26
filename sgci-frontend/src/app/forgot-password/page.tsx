'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, CheckCircle2, ArrowLeft, Store } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import AnimatedParticles from '@/components/AnimatedParticles';
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-blue-900 flex items-center justify-center p-4">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <AnimatedParticles count={10} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Mobile logo */}
        <Link href="/" className="flex items-center justify-center space-x-3 mb-8 lg:hidden">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
            <Store className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">SGCI BÉNIN</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl mb-4">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                {isSuccess ? 'Email envoyé' : 'Mot de passe oublié'}
              </h2>
              <p className="text-gray-300 text-sm mt-2">
                {isSuccess
                  ? 'Un lien de réinitialisation a été envoyé à votre adresse email.'
                  : 'Entrez votre email pour recevoir un lien de réinitialisation'}
              </p>
            </div>

            {!isSuccess ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-white text-sm font-medium">Adresse email</label>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="w-full bg-white/5 border border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-xl px-4 text-sm outline-none disabled:opacity-50"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Envoi…
                    </>
                  ) : (
                    'Envoyer le lien'
                  )}
                </motion.button>

                <div className="text-center">
                  <Link href="/login" className="text-sm text-gray-400 hover:text-orange-400 transition-colors flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Retour à la connexion
                  </Link>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                  <span className="font-semibold text-white">Email envoyé !</span>
                </div>

                <p className="text-center text-sm text-gray-300">
                  Consultez votre boîte de réception et cliquez sur le lien pour
                  réinitialiser votre mot de passe.
                </p>

                {resetToken && (
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-xs text-gray-400 mb-2">
                      Mode développement — Token :
                    </p>
                    <code className="text-xs break-all text-orange-400">{resetToken}</code>
                    <button
                      onClick={goToReset}
                      className="w-full mt-3 bg-white/10 border border-white/20 text-white text-sm font-medium py-2 rounded-xl hover:bg-white/15 transition-all"
                    >
                      Utiliser ce token
                    </button>
                  </div>
                )}

                <div className="text-center pt-2">
                  <Link href="/login" className="text-sm text-gray-400 hover:text-orange-400 transition-colors flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Retour à la connexion
                  </Link>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
