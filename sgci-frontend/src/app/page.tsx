'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
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
    <div className="min-h-screen bg-white">
      {/* ── Navigation ── */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
              <Store className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">
              SGCI Bénin
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#fonctionnalites"
              className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
            >
              Fonctionnalités
            </a>
            <a
              href="#comment-ça-marche"
              className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
            >
              Comment ça marche
            </a>
            <a
              href="#tarifs"
              className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
            >
              Tarifs
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 sm:inline-block"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
            >
              Démarrer gratuitement
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold tracking-wide text-blue-700">
              <Zap className="h-3 w-3" />
              PLATEFORME DE GESTION COMMERCIALE
            </span>
          </motion.div>

          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl"
          >
            Gérez votre boutique
            <br />
            <span className="text-blue-600">avec intelligence</span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-500"
          >
            SGCI Bénin est la solution tout-en-un pour gérer vos ventes, suivre
            votre stock, fidéliser vos clients et piloter votre activité en
            temps réel — sur ordinateur et mobile.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30"
            >
              Commencer maintenant
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
            >
              Voir la démo
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-400"
          >
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <span className="ml-1 font-medium text-gray-600">4.9/5</span>
            </div>
            <span className="hidden h-4 w-px bg-gray-200 sm:block" />
            <span>Données hébergées au Bénin</span>
            <span className="hidden h-4 w-px bg-gray-200 sm:block" />
            <span>Support en français</span>
            <span className="hidden h-4 w-px bg-gray-200 sm:block" />
            <span>Sans engagement</span>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="fonctionnalites" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="text-center"
          >
            <motion.span
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="text-sm font-semibold tracking-wide text-blue-600"
            >
              FONCTIONNALITÉS
            </motion.span>
            <motion.h2
              variants={fadeUp}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
            >
              Tout ce qu&apos;il faut pour gérer
              <br className="hidden sm:block" /> votre commerce
            </motion.h2>
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto mt-4 max-w-xl text-gray-500"
            >
              De la caisse à l&apos;analytics, SGCI centralise toutes vos
              opérations dans une seule plateforme fiable et rapide.
            </motion.p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[
              {
                icon: ShoppingCart,
                title: 'Terminal de caisse',
                desc: 'Encaissez vos ventes en quelques clics. Paiement cash, mobile money ou carte acceptés.',
              },
              {
                icon: Package,
                title: 'Gestion de stock',
                desc: 'Suivi en temps réel des quantités. Alertes automatiques quand un produit est en rupture.',
              },
              {
                icon: BarChart3,
                title: 'Tableaux de bord',
                desc: 'Chiffre d\'affaires, marges, produits phares, tendances — tout est visualisable en un coup d\'œil.',
              },
              {
                icon: Users,
                title: 'Fidélisation client',
                desc: 'Programme de fidélité intégré, historique d\'achats et segmentation client automatique.',
              },
              {
                icon: Receipt,
                title: 'Facturation',
                desc: 'Générez factures et devis professionnels. Numérotation automatique par boutique.',
              },
              {
                icon: Smartphone,
                title: 'Mobile & Web',
                desc: 'Application mobile Android et interface web responsive. Gérez votre boutique depuis n\'importe où.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                className="group rounded-2xl border border-gray-100 bg-gray-50/50 p-6 transition-all hover:border-blue-100 hover:bg-white hover:shadow-lg hover:shadow-blue-50"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-gray-900">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section
        id="comment-ça-marche"
        className="border-t border-gray-100 bg-gray-50 px-6 py-24"
      >
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="text-center"
          >
            <motion.span
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="text-sm font-semibold tracking-wide text-blue-600"
            >
              SIMPLE & RAPIDE
            </motion.span>
            <motion.h2
              variants={fadeUp}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
            >
              Opérationnel en 3 étapes
            </motion.h2>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="mt-16 grid gap-10 md:grid-cols-3"
          >
            {[
              {
                step: '01',
                title: 'Créez votre compte',
                desc: 'Inscrivez-vous en 30 secondes. Aucune carte bancaire requise.',
              },
              {
                step: '02',
                title: 'Configurez votre boutique',
                desc: 'Ajoutez vos catégories, produits et prix. Importez votre catalogue existant.',
              },
              {
                step: '03',
                title: 'Commencez à vendre',
                desc: 'Utilisez le terminal de caisse et suivez vos performances en temps réel.',
              },
            ].map(({ step, title, desc }) => (
              <motion.div
                key={step}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                className="relative text-center"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Pourquoi SGCI ── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid items-center gap-16 lg:grid-cols-2"
          >
            <div>
              <motion.span
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="text-sm font-semibold tracking-wide text-blue-600"
              >
                POURQUOI SGCI
              </motion.span>
              <motion.h2
                variants={fadeUp}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
              >
                Conçu pour les commerçants
                <br />
                du Bénin et d&apos;Afrique
              </motion.h2>
              <motion.p
                variants={fadeUp}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-5 text-gray-500 leading-relaxed"
              >
                SGCI a été pensé à partir des besoins réels des boutiquiers,
                supermarchés et grossistes. Pas de solutions importées qui ne
                correspondent pas à votre réalité.
              </motion.p>

              <motion.ul
                variants={stagger}
                className="mt-8 space-y-4"
              >
                {[
                  'Interface en français, pensée pour la simplicité',
                  'Compatible mobile money (MTN, Moov, Celtis)',
                  'Fonctionne même avec une connexion internet limitée',
                  'Données sécurisées et hébergées en Afrique',
                  'Support client réactif par WhatsApp et téléphone',
                ].map((item) => (
                  <motion.li
                    key={item}
                    variants={fadeUp}
                    transition={{ duration: 0.3 }}
                    className="flex items-start gap-3"
                  >
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                    <span className="text-sm text-gray-600">{item}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>

            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="relative"
            >
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8">
                <div className="space-y-4">
                  {[
                    {
                      icon: Shield,
                      label: 'Sécurité',
                      value: 'Chiffrement SSL & conformité',
                    },
                    {
                      icon: Clock,
                      label: 'Disponibilité',
                      value: '99.9% de temps de fonctionnement',
                    },
                    {
                      icon: TrendingUp,
                      label: 'Performance',
                      value: '+40% de productivité moyenne',
                    },
                    {
                      icon: Users,
                      label: 'Communauté',
                      value: '500+ boutiques actives',
                    },
                  ].map(({ icon: Icon, label, value }) => (
                    <div
                      key={label}
                      className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {label}
                        </p>
                        <p className="text-xs text-gray-500">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-2xl border border-blue-100 bg-blue-50/50" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section
        id="tarifs"
        className="border-t border-gray-100 bg-gray-50 px-6 py-24"
      >
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            <motion.span
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="text-sm font-semibold tracking-wide text-blue-600"
            >
              TARIFS
            </motion.span>
            <motion.h2
              variants={fadeUp}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
            >
              Un seul plan, tout inclus
            </motion.h2>
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto mt-4 max-w-lg text-gray-500"
            >
              Pas de surprises, pas de frais cachés. Payez simplement votre
              abonnement mensuel.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mx-auto mt-12 max-w-md"
          >
            <div className="rounded-2xl border border-blue-200 bg-white p-8 shadow-lg shadow-blue-50">
              <h3 className="text-lg font-bold text-gray-900">
                Plan Professionnel
              </h3>
              <div className="mt-4 flex items-baseline justify-center gap-1">
                <span className="text-5xl font-extrabold text-gray-900">
                  15 000
                </span>
                <span className="text-sm text-gray-500">FCFA/mois</span>
              </div>
              <p className="mt-2 text-sm text-gray-400">
                Par boutique • Sans engagement
              </p>
              <ul className="mt-8 space-y-3 text-left text-sm text-gray-600">
                {[
                  'Terminal de caisse illimité',
                  'Gestion de stock avancée',
                  'Tableaux de bord & analytics',
                  'Facturation & devis',
                  'Programme de fidélité',
                  'Application mobile Android',
                  'Support par WhatsApp',
                  'Mises à jour gratuites',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 flex-shrink-0 text-blue-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-8 block w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
              >
                Démarrer gratuitement
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Prêt à digitaliser votre commerce&nbsp;?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-gray-500">
              Rejoignez les centaines de commerçants qui utilisent SGCI Bénin
              pour piloter leur activité au quotidien.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl"
              >
                Créer mon compte gratuit
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
              >
                Accéder à la démo
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 bg-white px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-gray-400 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
              <Store className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-medium text-gray-600">SGCI Bénin</span>
          </div>
          <p>© 2026 SGCI Bénin. Tous droits réservés.</p>
          <div className="flex gap-6">
            <a href="#" className="transition-colors hover:text-gray-600">
              Contact
            </a>
            <a href="#" className="transition-colors hover:text-gray-600">
              Conditions
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
