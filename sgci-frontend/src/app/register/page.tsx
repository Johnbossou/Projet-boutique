'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Store, UserPlus, ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import AnimatedParticles from '@/components/AnimatedParticles';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    telephone: '',
    password: '',
    password_confirmation: '',
    boutique_nom: '',
    boutique_adresse: '',
    boutique_telephone: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.password !== formData.password_confirmation) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (!formData.email.includes('@')) {
      toast.error('Veuillez entrer une adresse email valide');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erreur lors de l'inscription");
      }

      toast.success('Inscription réussie ! Vous pouvez maintenant vous connecter');
      router.push('/login');
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message || "Erreur lors de l'inscription");
      } else {
        toast.error("Erreur lors de l'inscription");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full bg-white/5 border border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-11 rounded-xl px-4 text-sm outline-none';

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-blue-900">
      {/* Background */}
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
          transition={{ duration: 0.8, ease: 'easeOut' }}
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
                <span className="block text-gray-300">Rejoignez</span>
                <span className="block bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                  l&apos;excellence
                </span>
                <span className="block text-gray-300">commerciale</span>
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed max-w-lg">
                Créez votre compte en quelques secondes et commencez à gérer
                votre boutique avec SGCI Bénin.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              {[
                { icon: Check, text: 'Inscription gratuite et rapide', color: 'text-blue-400' },
                { icon: Check, text: 'Accès à toutes les fonctionnalités', color: 'text-green-400' },
                { icon: Check, text: 'Support 24/7 inclus', color: 'text-purple-400' },
                { icon: Check, text: 'Données sécurisées et hébergées au Bénin', color: 'text-orange-400' },
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
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="flex flex-1 items-center justify-center p-8"
        >
          <div className="w-full max-w-lg">
            {/* Mobile logo */}
            <Link href="/" className="flex items-center space-x-3 mb-8 lg:hidden">
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
              <div className="text-center mb-6">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl mb-4">
                  <UserPlus className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Créer un compte</h2>
                <p className="text-gray-300 text-sm mt-1">
                  Rejoignez SGCI Bénin en quelques secondes
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Section: Infos perso */}
                <div className="space-y-3">
                  <h3 className="text-white font-semibold text-sm border-b border-white/10 pb-2">
                    Informations personnelles
                  </h3>

                  <div className="space-y-1.5">
                    <label className="text-white text-sm font-medium">Nom complet *</label>
                    <input
                      type="text"
                      placeholder="Jean Kouassi"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={inputClass}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-white text-sm font-medium">Email *</label>
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="jean@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={inputClass}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-white text-sm font-medium">Téléphone</label>
                      <input
                        type="tel"
                        placeholder="+229 97 00 00 00"
                        value={formData.telephone}
                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Boutique */}
                <div className="space-y-3">
                  <h3 className="text-white font-semibold text-sm border-b border-white/10 pb-2">
                    Informations boutique
                  </h3>

                  <div className="space-y-1.5">
                    <label className="text-white text-sm font-medium">Nom de la boutique *</label>
                    <input
                      type="text"
                      placeholder="Supermarché Kouassi"
                      value={formData.boutique_nom}
                      onChange={(e) => setFormData({ ...formData, boutique_nom: e.target.value })}
                      className={inputClass}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-white text-sm font-medium">Adresse</label>
                    <input
                      type="text"
                      placeholder="Cotonou, Quartier ..."
                      value={formData.boutique_adresse}
                      onChange={(e) => setFormData({ ...formData, boutique_adresse: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-white text-sm font-medium">Téléphone boutique</label>
                    <input
                      type="tel"
                      placeholder="+229 97 00 00 00"
                      value={formData.boutique_telephone}
                      onChange={(e) => setFormData({ ...formData, boutique_telephone: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Section: Sécurité */}
                <div className="space-y-3">
                  <h3 className="text-white font-semibold text-sm border-b border-white/10 pb-2">
                    Sécurité
                  </h3>

                  <div className="space-y-1.5">
                    <label className="text-white text-sm font-medium">Mot de passe *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Au moins 8 caractères"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className={inputClass + ' pr-10'}
                        required
                        minLength={8}
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

                  <div className="space-y-1.5">
                    <label className="text-white text-sm font-medium">Confirmer le mot de passe *</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Confirmer le mot de passe"
                        value={formData.password_confirmation}
                        onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                        className={inputClass + ' pr-10'}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

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
                      Inscription…
                    </>
                  ) : (
                    <>
                      <span>Créer mon compte</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Login link */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-300">
                  Vous avez déjà un compte ?{' '}
                  <Link href="/login" className="text-orange-400 hover:text-orange-300 font-semibold transition-colors">
                    Se connecter
                  </Link>
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
