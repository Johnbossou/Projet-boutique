'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import AnimatedParticles from '@/components/AnimatedParticles';
import {
  ShoppingCart,
  BarChart3,
  Users,
  Package,
  Shield,
  Clock,
  Smartphone,
  ArrowRight,
  Check,
  Zap,
  Store,
  Receipt,
  TrendingUp,
  Star,
  Sparkles,
} from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-blue-900 overflow-hidden relative">
      {/* Particles */}
      <AnimatedParticles count={20} />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />

      {/* Glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />

      <div className="relative z-10">
        {/* ── Navigation ── */}
        <motion.nav
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl bg-white/5"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                <Store className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">SGCI BÉNIN</span>
            </Link>

            <nav className="hidden items-center gap-8 md:flex">
              <a href="#fonctionnalites" className="text-gray-300 hover:text-white transition-colors duration-300 font-medium text-sm">
                Fonctionnalités
              </a>
              <a href="#comment-ça-marche" className="text-gray-300 hover:text-white transition-colors duration-300 font-medium text-sm">
                Comment ça marche
              </a>
              <a href="#tarifs" className="text-gray-300 hover:text-white transition-colors duration-300 font-medium text-sm">
                Tarifs
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/login" className="hidden text-sm font-medium text-gray-300 hover:text-white transition-colors sm:inline-block">
                Connexion
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-orange-500/25 transition-all"
              >
                Démarrer gratuitement
              </Link>
            </div>
          </div>
        </motion.nav>

        {/* ── Hero ── */}
        <section className="text-center space-y-12 py-20 px-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-lg border border-white/20 rounded-full px-4 py-2"
          >
            <Zap className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-white font-medium">PLATEFORME DE GESTION COMMERCIALE</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6 max-w-4xl mx-auto"
          >
            <motion.h1
              className="text-5xl md:text-7xl font-bold tracking-tight"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <span className="text-white">Gérez votre</span>
              <br />
              <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                boutique avec intelligence
              </span>
            </motion.h1>

            <motion.p
              className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              SGCI Bénin est la solution tout-en-un pour gérer vos ventes, suivre
              votre stock, fidéliser vos clients et piloter votre activité en
              temps réel — sur ordinateur et mobile.
            </motion.p>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/register">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(249, 115, 22, 0.3)" }}
                whileTap={{ scale: 0.95 }}
                className="group bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold py-4 px-10 rounded-2xl transition-all duration-300 flex items-center space-x-2"
              >
                <span>Commencer maintenant</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </Link>
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center space-x-2 bg-white/10 backdrop-blur-lg border border-white/20 text-white font-medium py-4 px-8 rounded-2xl hover:bg-white/15 transition-all duration-300"
              >
                <span>Voir la démo</span>
              </motion.button>
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400"
          >
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-4 h-4 text-yellow-400 fill-current" />
              ))}
              <span className="ml-1 font-medium text-white">4.9/5</span>
            </div>
            <span className="hidden h-4 w-px bg-white/20 sm:block" />
            <span>Données hébergées au Bénin</span>
            <span className="hidden h-4 w-px bg-white/20 sm:block" />
            <span>Support en français</span>
            <span className="hidden h-4 w-px bg-white/20 sm:block" />
            <span>Sans engagement</span>
          </motion.div>
        </section>

        {/* ── Features ── */}
        <section id="fonctionnalites" className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center"
            >
              <motion.span
                variants={fadeUp}
                className="text-sm font-semibold tracking-wide text-orange-400"
              >
                FONCTIONNALITÉS
              </motion.span>
              <motion.h2
                variants={fadeUp}
                transition={{ delay: 0.1 }}
                className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl"
              >
                Tout ce qu&apos;il faut pour gérer
                <br className="hidden sm:block" /> votre commerce
              </motion.h2>
              <motion.p
                variants={fadeUp}
                transition={{ delay: 0.2 }}
                className="mx-auto mt-4 max-w-xl text-gray-400"
              >
                De la caisse à l&apos;analytics, SGCI centralise toutes vos
                opérations dans une seule plateforme fiable et rapide.
              </motion.p>
            </motion.div>

            <motion.div
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
              className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {[
                {
                  icon: ShoppingCart,
                  title: "Terminal de caisse",
                  desc: "Encaissez vos ventes en quelques clics. Paiement cash, mobile money ou carte acceptés.",
                },
                {
                  icon: Package,
                  title: "Gestion de stock",
                  desc: "Suivi en temps réel des quantités. Alertes automatiques quand un produit est en rupture.",
                },
                {
                  icon: BarChart3,
                  title: "Tableaux de bord",
                  desc: "Chiffre d'affaires, marges, produits phares, tendances — tout est visualisable en un coup d'œil.",
                },
                {
                  icon: Users,
                  title: "Fidélisation client",
                  desc: "Programme de fidélité intégré, historique d'achats et segmentation client automatique.",
                },
                {
                  icon: Receipt,
                  title: "Facturation",
                  desc: "Générez factures et devis professionnels. Numérotation automatique par boutique.",
                },
                {
                  icon: Smartphone,
                  title: "Mobile & Web",
                  desc: "Application mobile Android et interface web responsive. Gérez votre boutique depuis n'importe où.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <motion.div
                  key={title}
                  variants={fadeUp}
                  whileHover={{ scale: 1.03, y: -8, transition: { type: "spring", stiffness: 300 } }}
                  className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 text-center group hover:bg-white/15 transition-all duration-300"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Comment ça marche ── */}
        <section id="comment-ça-marche" className="px-6 py-24 border-t border-white/10">
          <div className="mx-auto max-w-5xl">
            <motion.div
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center"
            >
              <motion.span
                variants={fadeUp}
                className="text-sm font-semibold tracking-wide text-orange-400"
              >
                SIMPLE & RAPIDE
              </motion.span>
              <motion.h2
                variants={fadeUp}
                transition={{ delay: 0.1 }}
                className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl"
              >
                Opérationnel en 3 étapes
              </motion.h2>
            </motion.div>

            <motion.div
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
              className="mt-16 grid gap-10 md:grid-cols-3"
            >
              {[
                {
                  step: "01",
                  title: "Créez votre compte",
                  desc: "Inscrivez-vous en 30 secondes. Aucune carte bancaire requise.",
                },
                {
                  step: "02",
                  title: "Configurez votre boutique",
                  desc: "Ajoutez vos catégories, produits et prix. Importez votre catalogue existant.",
                },
                {
                  step: "03",
                  title: "Commencez à vendre",
                  desc: "Utilisez le terminal de caisse et suivez vos performances en temps réel.",
                },
              ].map(({ step, title, desc }) => (
                <motion.div
                  key={step}
                  variants={fadeUp}
                  className="text-center"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-lg font-bold text-white shadow-lg shadow-orange-500/25">
                    {step}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Pourquoi SGCI ── */}
        <section className="px-6 py-24 border-t border-white/10">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid items-center gap-16 lg:grid-cols-2"
            >
              <div>
                <motion.span
                  variants={fadeUp}
                  className="text-sm font-semibold tracking-wide text-orange-400"
                >
                  POURQUOI SGCI
                </motion.span>
                <motion.h2
                  variants={fadeUp}
                  transition={{ delay: 0.1 }}
                  className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl"
                >
                  Conçu pour les commerçants
                  <br />
                  du Bénin et d&apos;Afrique
                </motion.h2>
                <motion.p
                  variants={fadeUp}
                  transition={{ delay: 0.2 }}
                  className="mt-5 text-gray-400 leading-relaxed"
                >
                  SGCI a été pensé à partir des besoins réels des boutiquiers,
                  supermarchés et grossistes. Pas de solutions importées qui ne
                  correspondent pas à votre réalité.
                </motion.p>

                <motion.ul variants={stagger} className="mt-8 space-y-4">
                  {[
                    "Interface en français, pensée pour la simplicité",
                    "Compatible mobile money (MTN, Moov, Celtis)",
                    "Fonctionne même avec une connexion internet limitée",
                    "Données sécurisées et hébergées en Afrique",
                    "Support client réactif par WhatsApp et téléphone",
                  ].map((item) => (
                    <motion.li
                      key={item}
                      variants={fadeUp}
                      className="flex items-start gap-3"
                    >
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-400" />
                      <span className="text-sm text-gray-300">{item}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              </div>

              <motion.div variants={fadeUp} transition={{ delay: 0.3 }}>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 space-y-4">
                  {[
                    { icon: Shield, label: "Sécurité", value: "Chiffrement SSL & conformité" },
                    { icon: Clock, label: "Disponibilité", value: "99.9% de temps de fonctionnement" },
                    { icon: TrendingUp, label: "Performance", value: "+40% de productivité moyenne" },
                    { icon: Users, label: "Communauté", value: "500+ boutiques actives" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-4 rounded-xl bg-white/10 p-4 border border-white/10 hover:bg-white/15 transition-all">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-lg">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="text-xs text-gray-400">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── Tarifs ── */}
        <section id="tarifs" className="px-6 py-24 border-t border-white/10">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
            >
              <motion.span variants={fadeUp} className="text-sm font-semibold tracking-wide text-orange-400">
                TARIFS
              </motion.span>
              <motion.h2 variants={fadeUp} transition={{ delay: 0.1 }} className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Un seul plan, tout inclus
              </motion.h2>
              <motion.p variants={fadeUp} transition={{ delay: 0.2 }} className="mx-auto mt-4 max-w-lg text-gray-400">
                Pas de surprises, pas de frais cachés. Payez simplement votre abonnement mensuel.
              </motion.p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mx-auto mt-12 max-w-md"
            >
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 shadow-2xl">
                <h3 className="text-lg font-bold text-white">Plan Professionnel</h3>
                <div className="mt-4 flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-extrabold text-white">15 000</span>
                  <span className="text-sm text-gray-400">FCFA/mois</span>
                </div>
                <p className="mt-2 text-sm text-gray-400">Par boutique • Sans engagement</p>
                <ul className="mt-8 space-y-3 text-left text-sm text-gray-300">
                  {[
                    "Terminal de caisse illimité",
                    "Gestion de stock avancée",
                    "Tableaux de bord & analytics",
                    "Facturation & devis",
                    "Programme de fidélité",
                    "Application mobile Android",
                    "Support par WhatsApp",
                    "Mises à jour gratuites",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 flex-shrink-0 text-orange-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="mt-8 block w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-500 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl"
                  >
                    Démarrer gratuitement
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="px-6 py-24 border-t border-white/10">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Prêt à digitaliser votre commerce&nbsp;?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-gray-400">
                Rejoignez les centaines de commerçants qui utilisent SGCI Bénin
                pour piloter leur activité au quotidien.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/register">
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(249, 115, 22, 0.3)" }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all"
                  >
                    Créer mon compte gratuit
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </Link>
                <Link href="/login">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 backdrop-blur-lg px-8 py-4 text-sm font-semibold text-white transition-all hover:bg-white/15"
                  >
                    Accéder à la démo
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/10 px-6 py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-gray-400 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                <Store className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-medium text-white">SGCI Bénin</span>
            </div>
            <p>© 2026 SGCI Bénin. Tous droits réservés.</p>
            <div className="flex gap-6">
              <a href="#" className="transition-colors hover:text-white">Contact</a>
              <a href="#" className="transition-colors hover:text-white">Conditions</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
