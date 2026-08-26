'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Store, LogIn, Smartphone, TrendingUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import AnimatedParticles from '@/components/AnimatedParticles';
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-blue-900">
        <div className="text-center text-white">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-xl">Redirection en cours…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-blue-900">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <AnimatedParticles count={15} />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* ── Left panel — branding ── */}
        <motion.div
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 text-white"
        >
          <div className="space-y-12">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl">
                <Store className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold">SGCI BÉNIN</span>
            </Link>

            {/* Heading */}
            <div className="space-y-6">
              <h1 className="text-5xl font-bold leading-tight">
                <span className="block text-gray-300">Gérez votre</span>
                <span className="block bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                  activité commerciale
                </span>
                <span className="block text-gray-300">en toute simplicité</span>
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed max-w-lg">
                Terminal de caisse, gestion de stock, facturation et analytics —
                tout dans une seule plateforme conçue pour les commerçants du Bénin.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              {[
                { icon: Smartphone, text: "Application mobile Android incluse", color: "text-blue-400" },
                { icon: TrendingUp, text: "Suivi des ventes et stocks en temps réel", color: "text-green-400" },
                { icon: Sparkles, text: "Compatible mobile money et cash", color: "text-purple-400" },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="flex items-center space-x-4 p-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300"
                >
                  <div className={`p-2 rounded-xl bg-white/10 ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-gray-200 font-medium text-sm">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-gray-400 text-sm">
            © 2026 SGCI Bénin. Tous droits réservés.
          </div>
        </motion.div>

        {/* ── Right panel — form ── */}
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-1 items-center justify-center p-8"
        >
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <Link href="/" className="flex items-center space-x-3 mb-10 lg:hidden">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                <Store className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">SGCI BÉNIN</span>
            </Link>

            {/* Card */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 shadow-2xl"
            >
              {/* Header */}
              <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl mb-4">
                  <LogIn className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Connexion</h2>
                <p className="text-gray-300 text-sm mt-1">
                  Entrez vos identifiants pour accéder à votre espace.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div className="space-y-2">
                  <label className="text-white text-sm font-medium">
                    Adresse email
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="gerant@sgci.bj"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-xl px-4 text-sm outline-none"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-white text-sm font-medium">
                      Mot de passe
                    </label>
                    <Link href="/forgot-password" className="text-xs text-gray-400 hover:text-orange-400 transition-colors">
                      Mot de passe oublié ?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-white/5 border border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-xl px-4 pr-12 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* 2FA */}
                {requiresTwoFactor && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-2"
                  >
                    <label className="text-white text-sm font-medium">
                      Code 2FA
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      className="w-full bg-white/5 border border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-xl px-4 text-sm outline-none"
                      required
                    />
                  </motion.div>
                )}

                {/* Submit */}
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
                      Connexion…
                    </>
                  ) : (
                    <>
                      Se connecter
                      <Sparkles className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Links */}
              <div className="mt-6 text-center space-y-2">
                <p className="text-sm text-gray-300">
                  Pas encore de compte ?{' '}
                  <Link href="/register" className="text-orange-400 hover:text-orange-300 font-semibold transition-colors">
                    Créer un compte
                  </Link>
                </p>
              </div>

              {/* Test accounts */}
              <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-xs text-gray-300 font-semibold mb-2">
                  Comptes de démonstration
                </p>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>Gérant : <span className="font-medium text-gray-300">gerant@sgci.bj</span> / password</p>
                  <p>Caissier : <span className="font-medium text-gray-300">caissier@sgci.bj</span> / password</p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
