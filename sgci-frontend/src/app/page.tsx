'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  Shield, 
  Zap, 
  Star, 
  ArrowRight,
  Play,
  CheckCircle2,
  Users,
  BarChart3,
  ShoppingCart
} from 'lucide-react';

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ 
    width: 1200, 
    height: 800 
  });

  useEffect(() => {
    setIsVisible(true);
    
    // Mettre à jour les dimensions de la fenêtre uniquement côté client
    const updateDimensions = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    // Initialiser les dimensions
    updateDimensions();

    // Écouter les changements de taille
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Animation des particules flottantes
  const FloatingParticles = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-orange-400/30 rounded-full"
          initial={{ 
            x: Math.random() * windowDimensions.width,
            y: Math.random() * windowDimensions.height,
            scale: 0 
          }}
          animate={{ 
            y: [null, -100, -200],
            scale: [0, 1, 0],
            opacity: [0, 1, 0]
          }}
          transition={{ 
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 2
          }}
        />
      ))}
    </div>
  );

  const FeatureCard = ({ icon: Icon, title, description, delay }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ 
        scale: 1.05,
        y: -10,
        transition: { type: "spring", stiffness: 300 }
      }}
      className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 text-center group hover:bg-white/15 transition-all duration-500"
    >
      <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
        <Icon className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-300 text-sm leading-relaxed">{description}</p>
    </motion.div>
  );

  const StatCard = ({ number, label, suffix = "" }: any) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 100 }}
      className="text-center"
    >
      <div className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
        {number}{suffix}
      </div>
      <div className="text-gray-400 text-sm font-medium">{label}</div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-blue-900 overflow-hidden relative">
      {/* Background Elements */}
      <FloatingParticles />
      
      {/* Animated Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />
      
      {/* Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 container mx-auto px-4">
        {/* Navigation */}
        <motion.nav 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex justify-between items-center py-6"
        >
          <motion.div 
            className="flex items-center space-x-3"
            whileHover={{ scale: 1.05 }}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">SGCI BÉNIN</span>
          </motion.div>

          <div className="hidden md:flex items-center space-x-8">
            {['Fonctionnalités', 'Tarifs', 'Contact'].map((item, index) => (
              <motion.a
                key={item}
                href="#"
                className="text-gray-300 hover:text-white transition-colors duration-300 font-medium"
                whileHover={{ y: -2 }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {item}
              </motion.a>
            ))}
          </div>
        </motion.nav>

        {/* Hero Section */}
        <div className="text-center space-y-12 py-20">
          {/* Main Heading */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-lg border border-white/20 rounded-full px-4 py-2 mb-4"
            >
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-white font-medium">Solution Premium pour Supermarchés</span>
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-3 h-3 text-yellow-400 fill-current" />
                ))}
              </div>
            </motion.div>

            <motion.h1 
              className="text-6xl md:text-8xl font-bold tracking-tight"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <span className="text-white">SGCI</span>
              <motion.span 
                className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent ml-4"
                animate={{ 
                  backgroundPosition: ['0%', '100%', '0%'] 
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
                style={{ 
                  backgroundSize: '200% 100%' 
                }}
              >
                BÉNIN
              </motion.span>
            </motion.h1>

            <motion.p 
              className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Système de Gestion Commerciale Intelligente -{' '}
              <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent font-semibold">
                L'excellence technologique au service de votre croissance
              </span>
            </motion.p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mx-auto"
          >
            <StatCard number="500" label="Entreprises" suffix="+" />
            <StatCard number="99.9" label="Disponibilité" suffix="%" />
            <StatCard number="24/7" label="Support" />
            <StatCard number="4.9" label="Satisfaction" suffix="/5" />
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/login">
              <motion.button
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: "0 20px 40px rgba(249, 115, 22, 0.3)"
                }}
                whileTap={{ scale: 0.95 }}
                className="group relative bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold py-4 px-12 rounded-2xl transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center space-x-3">
                  <Zap className="w-5 h-5" />
                  <span className="text-lg">Démarrer Maintenant</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </span>
              </motion.button>
            </Link>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group flex items-center space-x-3 bg-white/10 backdrop-blur-lg border border-white/20 text-white font-medium py-4 px-8 rounded-2xl hover:bg-white/15 transition-all duration-300"
            >
              <Play className="w-5 h-5" />
              <span>Voir la Démo</span>
            </motion.button>
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="flex flex-wrap items-center justify-center gap-6 text-gray-400 text-sm"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>Certifié par l'État Béninois</span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span>Données 100% sécurisées</span>
            </div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              <span>+40% d'efficacité garantie</span>
            </div>
          </motion.div>
        </div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto py-20"
        >
          <FeatureCard
            icon={ShoppingCart}
            title="Gestion des Ventes"
            description="Terminal de caisse intelligent avec analyse en temps réel et gestion multi-caisses"
            delay={0.1}
          />
          <FeatureCard
            icon={BarChart3}
            title="Analytics Avancés"
            description="Tableaux de bord interactifs avec IA prédictive et rapports automatisés"
            delay={0.2}
          />
          <FeatureCard
            icon={Users}
            title="CRM Intégré"
            description="Gestion complète de la relation client avec programmes de fidélité intelligents"
            delay={0.3}
          />
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          className="text-center py-16"
        >
          <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-lg border border-white/20 rounded-3xl p-12 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-4">
              Prêt à transformer votre business ?
            </h2>
            <p className="text-gray-300 text-lg mb-8">
              Rejoignez les centaines de supermarchés qui font confiance à SGCI Bénin
            </p>
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-4 px-12 rounded-2xl hover:shadow-2xl transition-all duration-300"
              >
                Commencer l'Aventure
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7 }}
          className="text-center py-8 border-t border-white/10"
        >
          <p className="text-gray-400">
            © 2024 SGCI Bénin. Tous droits réservés. • Conçu avec ❤️ pour les entrepreneurs béninois
          </p>
        </motion.footer>
      </div>
    </div>
  );
}