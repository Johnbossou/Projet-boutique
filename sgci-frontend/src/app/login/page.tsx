'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Store, ArrowRight, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const { user, login, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    if (requiresTwoFactor && !twoFactorCode) {
      toast.error('Veuillez entrer le code 2FA');
      return;
    }

    try {
      if (requiresTwoFactor) {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/login`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              two_factor_code: twoFactorCode,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Erreur de connexion');
        }

        localStorage.setItem('user_data', JSON.stringify(data.user));

        toast.success('Connexion réussie');

        if (data.user.role === 'proprietaire') {
          window.location.href = '/selection-boutique';
        } else {
          window.location.href = '/dashboard';
        }
      } else {
        await login(formData.email, formData.password);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (
          error.message.includes('Code 2FA requis') ||
          error.message.includes('requires_two_factor')
        ) {
          setRequiresTwoFactor(true);
          toast.info('Code 2FA requis');
        } else {
          toast.error(error.message || 'Erreur de connexion');
        }
      } else {
        toast.error('Erreur de connexion inattendue');
      }
    }
  };

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Redirection en cours…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* ── Left panel — branding (desktop only) ── */}
      <div className="hidden bg-gray-50 lg:flex lg:w-1/2 xl:w-[55%]">
        <div className="relative flex w-full flex-col justify-between p-12 xl:p-16">
          {/* Background grid */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />

          <div className="relative">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
                <Store className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-gray-900">
                SGCI Bénin
              </span>
            </Link>
          </div>

          <div className="relative space-y-10">
            <div>
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-gray-900 xl:text-5xl">
                Gérez votre
                <br />
                activité commerciale
                <br />
                <span className="text-blue-600">en toute simplicité</span>
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-gray-500">
                Terminal de caisse, gestion de stock, facturation et analytics —
                tout dans une seule plateforme conçue pour les commerçants du
                Bénin.
              </p>
            </div>

            <div className="space-y-4">
              {[
                'Suivi des ventes et stocks en temps réel',
                'Compatible mobile money et cash',
                'Application mobile Android incluse',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                    <svg
                      className="h-3.5 w-3.5 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-600">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative text-xs text-gray-400">
            © 2026 SGCI Bénin. Tous droits réservés.
          </div>
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Mobile-only logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
              <Store className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">
              SGCI Bénin
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Connexion
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Entrez vos identifiants pour accéder à votre espace.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Adresse email
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="vous@exemple.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Mot de passe
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-blue-600 hover:text-blue-500"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* 2FA */}
            {requiresTwoFactor && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2 }}
              >
                <label
                  htmlFor="two-factor-code"
                  className="block text-sm font-medium text-gray-700"
                >
                  Code 2FA
                </label>
                <input
                  id="two-factor-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Connexion…
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Pas encore de compte ?{' '}
            <Link
              href="/register"
              className="font-semibold text-blue-600 hover:text-blue-500"
            >
              Créer un compte
            </Link>
          </p>

          {/* Test accounts */}
          <div className="mt-8 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-700">
              Comptes de démonstration
            </p>
            <div className="mt-2 space-y-1.5 text-xs text-gray-500">
              <p>
                Gérant :{' '}
                <span className="font-medium text-gray-700">
                  gerant@sgci.bj
                </span>{' '}
                / password
              </p>
              <p>
                Caissier :{' '}
                <span className="font-medium text-gray-700">
                  caissier@sgci.bj
                </span>{' '}
                / password
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
