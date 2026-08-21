'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Store, UserPlus, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    
    // Validation
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
      const response = await fetch('http://localhost:8000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de l\'inscription');
      }

      toast.success('Inscription réussie ! Vous pouvez maintenant vous connecter');
      router.push('/login');
    } catch (error: unknown) {
      console.error('🚨 Erreur d\'inscription:', error);
      
      if (error instanceof Error) {
        toast.error(error.message || 'Erreur lors de l\'inscription');
      } else {
        toast.error('Erreur lors de l\'inscription');
      }
    } finally {
      setIsLoading(false);
    }
  };

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
                  <p className="text-gray-400 text-sm">Créez votre compte</p>
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
                  <span className="block text-4xl text-gray-300 mt-4">Rejoignez</span>
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
                    l'excellence
                  </motion.span>
                  <span className="block text-4xl text-gray-300 mt-4">commerciale</span>
                </h1>
              </div>
              
              <p className="text-xl text-gray-300 leading-relaxed max-w-2xl">
                Créez votre compte en quelques secondes et commencez à gérer votre boutique avec SGCI Bénin.
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
                  { text: 'Inscription gratuite et rapide', color: 'text-blue-400' },
                  { text: 'Accès à toutes les fonctionnalités', color: 'text-green-400' },
                  { text: 'Support 24/7 inclus', color: 'text-purple-400' },
                  { text: 'Sécurité bancaire niveau', color: 'text-orange-400' }
                ].map((item, index) => (
                  <motion.div 
                    key={index}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.8 + index * 0.1 }}
                    className="flex items-center space-x-4 p-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300"
                  >
                    <div className={`p-2 rounded-xl bg-white/10 ${item.color}`}>
                      <Sparkles className="w-5 h-5" />
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
            <p className="text-xs opacity-70">Optimisé pour l'excellence commerciale</p>
          </motion.div>
        </motion.div>

        {/* Formulaire d'inscription */}
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
            <Card className="w-full max-w-2xl bg-white/10 backdrop-blur-2xl border-white/20 shadow-2xl relative overflow-hidden">
              {/* Effet de brillance */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-purple-500/10" />
              
              <CardHeader className="space-y-4 text-center relative z-10">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                  className="mx-auto w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl flex items-center justify-center shadow-2xl"
                >
                  <UserPlus className="w-10 h-10 text-white" />
                </motion.div>
                <CardTitle className="text-3xl font-bold text-white">
                  Créer un compte
                </CardTitle>
                <CardDescription className="text-gray-300 text-lg">
                  Rejoignez SGCI Bénin en quelques secondes
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 relative z-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Informations personnelles */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="space-y-4"
                  >
                    <h3 className="text-white font-semibold text-lg border-b border-white/10 pb-2">
                      Informations personnelles
                    </h3>
                    
                    <div className="space-y-3">
                      <Label htmlFor="name" className="text-white text-sm font-medium">
                        Nom complet *
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Jean Kouassi"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-2xl pl-4"
                        required
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-white text-sm font-medium">
                        Adresse email *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="jean@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-2xl pl-4"
                        required
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="telephone" className="text-white text-sm font-medium">
                        Téléphone
                      </Label>
                      <Input
                        id="telephone"
                        type="tel"
                        placeholder="+229 97 00 00 00"
                        value={formData.telephone}
                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-2xl pl-4"
                      />
                    </div>
                  </motion.div>

                  {/* Informations boutique */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="space-y-4"
                  >
                    <h3 className="text-white font-semibold text-lg border-b border-white/10 pb-2">
                      Informations boutique
                    </h3>
                    
                    <div className="space-y-3">
                      <Label htmlFor="boutique_nom" className="text-white text-sm font-medium">
                        Nom de la boutique *
                      </Label>
                      <Input
                        id="boutique_nom"
                        type="text"
                        placeholder="Supermarché Kouassi"
                        value={formData.boutique_nom}
                        onChange={(e) => setFormData({ ...formData, boutique_nom: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-2xl pl-4"
                        required
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="boutique_adresse" className="text-white text-sm font-medium">
                        Adresse
                      </Label>
                      <Input
                        id="boutique_adresse"
                        type="text"
                        placeholder="Cotonou, Quartier ..."
                        value={formData.boutique_adresse}
                        onChange={(e) => setFormData({ ...formData, boutique_adresse: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-2xl pl-4"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="boutique_telephone" className="text-white text-sm font-medium">
                        Téléphone boutique
                      </Label>
                      <Input
                        id="boutique_telephone"
                        type="tel"
                        placeholder="+229 97 00 00 00"
                        value={formData.boutique_telephone}
                        onChange={(e) => setFormData({ ...formData, boutique_telephone: e.target.value })}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-2xl pl-4"
                      />
                    </div>
                  </motion.div>

                  {/* Mot de passe */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="space-y-4"
                  >
                    <h3 className="text-white font-semibold text-lg border-b border-white/10 pb-2">
                      Sécurité
                    </h3>
                    
                    <div className="space-y-3">
                      <Label htmlFor="password" className="text-white text-sm font-medium">
                        Mot de passe *
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Au moins 8 caractères"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-2xl pl-4 pr-12"
                          required
                          minLength={8}
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
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="password_confirmation" className="text-white text-sm font-medium">
                        Confirmer le mot de passe *
                      </Label>
                      <div className="relative">
                        <Input
                          id="password_confirmation"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirmer le mot de passe"
                          value={formData.password_confirmation}
                          onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                          className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 h-12 rounded-2xl pl-4 pr-12"
                          required
                          minLength={8}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1 h-10 w-10 hover:bg-white/10 text-gray-400 rounded-xl"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>

                  {/* Bouton d'inscription */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-4 rounded-2xl transition-all duration-300 shadow-2xl hover:shadow-orange-500/25 relative overflow-hidden group"
                      disabled={isLoading}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                      
                      {isLoading ? (
                        <div className="flex items-center space-x-3">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          />
                          <span>Inscription en cours...</span>
                        </div>
                      ) : (
                        <span className="relative flex items-center justify-center space-x-2">
                          <UserPlus className="w-5 h-5" />
                          <span>Créer mon compte</span>
                          <ArrowRight className="w-5 h-5" />
                        </span>
                      )}
                    </Button>
                  </motion.div>
                </form>

                {/* Lien connexion */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="text-center"
                >
                  <p className="text-sm text-gray-300">
                    Vous avez déjà un compte ?{' '}
                    <Link href="/login" className="text-orange-400 hover:text-orange-300 font-semibold transition-colors">
                      Se connecter
                    </Link>
                  </p>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
