'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Store, Smartphone, TrendingUp, Sparkles, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    password: ''
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
      console.log('🔄 Tentative de connexion avec:', formData.email);
      
      if (requiresTwoFactor) {
        // Login avec 2FA
        const response = await fetch('http://localhost:8000/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            two_factor_code: twoFactorCode,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Erreur de connexion');
        }

        // Stocker le token et les données utilisateur
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_data', JSON.stringify(data.user));
        if (data.expires_at) {
          localStorage.setItem('token_expires_at', data.expires_at);
        }

        toast.success('Connexion réussie');
        
        // Redirection selon le rôle
        if (data.user.role === 'proprietaire') {
          window.location.href = '/selection-boutique';
        } else {
          window.location.href = '/dashboard';
        }
      } else {
        // Login normal - la redirection est gérée par AuthContext
        await login(formData.email, formData.password);
      }
      
    } catch (error: unknown) {
      console.error('🚨 Erreur de connexion:', error);
      
      if (error instanceof Error) {
        // Vérifier si le 2FA est requis
        if (error.message.includes('Code 2FA requis') || error.message.includes('requires_two_factor')) {
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

  // Si déjà connecté, on affiche un message de chargement
  // Mais normalement on ne devrait jamais voir ça car la redirection est immédiate
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center text-white">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-xl">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Background animé premium */}
      <div className="absolute inset-0">
        {/* Effets de lumière */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-500/10 rounded-full blur-2xl animate-pulse delay-500" />
        
        {/* Particules animées */}
        <AnimatedParticles count={20} />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Section présentation élégante */}
        <motion.div 
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 text-white"
        >
          <div className="space-y-12">
            {/* Logo et titre */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center space-x-4">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl"
                >
                  <Store className="w-7 h-7 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    SGCI BÉNIN
                  </h1>
                  <p className="text-gray-400 text-sm">Édition Premium</p>
                </div>
              </div>
            </motion.div>

            {/* Message principal */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-6xl font-bold leading-tight">
                  <span className="block text-4xl text-gray-300 mt-4">L&apos;intelligence</span>
                  <motion.span 
                    className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400"
                    animate={{ 
                      backgroundPosition: ['0%', '100%'],
                    }}
                    transition={{ 
                      duration: 3, 
                      repeat: Infinity, 
                      repeatType: "reverse" 
                    }}
                    style={{ 
                      backgroundSize: '200% auto',
                    }}
                  >
                    commerciale
                  </motion.span>
                  <span className="block text-4xl text-gray-300 mt-4">réinventée</span>
                </h1>
              </div>
              
              <p className="text-xl text-gray-300 leading-relaxed max-w-2xl">
                Système de Gestion Commerciale Intelligente conçu pour propulser 
                votre business vers de nouveaux sommets.
              </p>
            </motion.div>

            {/* Features */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="space-y-6"
            >
              <div className="grid gap-4">
                {[
                  { icon: Smartphone, text: 'Interface révolutionnaire mobile-first', color: 'text-blue-400' },
                  { icon: TrendingUp, text: 'Analytics prédictifs en temps réel', color: 'text-green-400' },
                  { icon: Sparkles, text: 'Expérience utilisateur ultime', color: 'text-purple-400' },
                  { icon: Store, text: 'Gestion multi-boutiques intelligente', color: 'text-orange-400' }
                ].map((item, index) => (
                  <motion.div 
                    key={index}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.8 + index * 0.1 }}
                    className="flex items-center space-x-4 p-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300"
                  >
                    <div className={`p-2 rounded-xl bg-white/10 ${item.color}`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="text-gray-200 font-medium">{item.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center text-gray-400 space-y-2"
          >
            <p className="text-sm">© 2025 SGCI Bénin - Système Premium</p>
            <p className="text-xs opacity-70">Optimisé pour l&apos;excellence commerciale</p>
          </motion.div>
        </motion.div>

        {/* Formulaire de connexion */}
        <motion.div 
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-1 items-center justify-center p-8"
        >
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Card className="w-full max-w-md bg-white/10 backdrop-blur-2xl border-white/20 shadow-2xl relative overflow-hidden">
              {/* Effet de brillance */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-purple-500/10" />
              
              <CardHeader className="space-y-4 text-center relative z-10">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                  className="mx-auto w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl flex items-center justify-center shadow-2xl"
                >
                  <LogIn className="w-10 h-10 text-white" />
                </motion.div>
                <CardTitle className="text-3xl font-bold text-white">
                  Connexion
                </CardTitle>
                <CardDescription className="text-gray-300 text-lg">
                  Accédez à votre espace premium
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 relative z-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Champ Email */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="space-y-3"
                  >
                    <Label htmlFor="email" className="text-white text-sm font-medium">
                      Adresse Email
                    </Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        placeholder="gerant@sgci.bj"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-2xl pl-4"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </motion.div>

                  {/* Champ Mot de passe */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="space-y-3"
                  >
                    <Label htmlFor="password" className="text-white text-sm font-medium">
                      Mot de passe
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-2xl pl-4 pr-12"
                        required
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-10 w-10 hover:bg-white/10 text-gray-400 rounded-xl"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </motion.div>

                  {/* Champ Code 2FA */}
                  {requiresTwoFactor && (
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.75 }}
                      className="space-y-3"
                    >
                      <Label htmlFor="two-factor-code" className="text-white text-sm font-medium">
                        Code 2FA
                      </Label>
                      <div className="relative">
                        <Input
                          id="two-factor-code"
                          type="text"
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value)}
                          placeholder="Code à 6 chiffres"
                          className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-2xl pl-4"
                          required
                          maxLength={6}
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Bouton de connexion */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-4 rounded-2xl transition-all duration-300 shadow-2xl hover:shadow-orange-500/25 relative overflow-hidden group"
                      disabled={isLoading}
                    >
                      {/* Effet de brillance sur hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                      
                      {isLoading ? (
                        <div className="flex items-center space-x-3">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          />
                          <span>Connexion en cours...</span>
                        </div>
                      ) : (
                        <span className="relative flex items-center justify-center space-x-2">
                          <Sparkles className="w-5 h-5" />
                          <span>Se connecter</span>
                        </span>
                      )}
                    </Button>
                  </motion.div>
                </form>

                {/* Lien mot de passe oublié */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="text-center space-y-2"
                >
                  <Link href="/forgot-password" className="text-sm text-gray-300 hover:text-orange-400 transition-colors">
                    Mot de passe oublié ?
                  </Link>
                  <div className="text-sm text-gray-300">
                    Pas encore de compte ?{' '}
                    <Link href="/register" className="text-orange-400 hover:text-orange-300 font-semibold transition-colors">
                      Créer un compte
                    </Link>
                  </div>
                </motion.div>

                {/* Informations de test */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="text-center p-4 bg-white/5 rounded-2xl border border-white/10"
                >
                  <p className="text-sm text-gray-300 mb-2">
                    <strong>Comptes de test :</strong>
                  </p>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>📧 <strong>gerant@sgci.bj</strong> / password</p>
                    <p>📱 <strong>caissier@sgci.bj</strong> / password</p>
                  </div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}