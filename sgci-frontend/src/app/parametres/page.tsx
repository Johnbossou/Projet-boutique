'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  Settings,
  User,
  Bell,
  Shield,
  Database,
  Palette,
  Globe,
  Download,
  Upload,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  X,
  Trash2,
  Key,
  Mail,
  Phone,
  Store,
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UserProfile {
  name: string;
  email: string;
  telephone: string;
  role: string;
}

interface BoutiqueSettings {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  tva: number;
  devise: string;
}

export default function ParametresPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profil');
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 🎯 ÉTATS DES PARAMÈTRES
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    telephone: '',
    role: ''
  });

  const [boutique, setBoutique] = useState<BoutiqueSettings>({
    nom: 'SGCI Bénin - Boutique Principale',
    adresse: 'Cotonou, Bénin',
    telephone: '+229 01 02 03 04',
    email: 'contact@sgci.bj',
    tva: 18,
    devise: 'FCFA'
  });

  const [preferences, setPreferences] = useState({
    notificationsEmail: true,
    notificationsSMS: false,
    darkMode: true,
    autoBackup: true,
    rapportsAutomatiques: true,
    alertesStock: true
  });

  const [securite, setSecurite] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactor: false,
    sessionTimeout: 30
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 🎯 CHARGEMENT DES DONNÉES
  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name,
        email: user.email,
        telephone: user.telephone,
        role: user.role
      });
    }
  }, [user]);

  // 🎯 FONCTIONS DE SAUVEGARDE
  const sauvegarderProfil = async () => {
    setSaving(true);
    try {
      // Simulation sauvegarde API
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Profil mis à jour avec succès');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const sauvegarderBoutique = async () => {
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Paramètres boutique mis à jour');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const sauvegarderPreferences = async () => {
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success('Préférences sauvegardées');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const changerMotDePasse = async () => {
    if (securite.newPassword !== securite.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (securite.newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Mot de passe changé avec succès');
      setSecurite(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error) {
      toast.error('Erreur lors du changement de mot de passe');
    } finally {
      setSaving(false);
    }
  };

  const exporterDonnees = () => {
    toast.success('Export des données lancé');
    // Logique d'export ici
  };

  const importerDonnees = () => {
    toast.info('Fonctionnalité d\'import en développement');
  };

  if (!user) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header Paramètres */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Paramètres Avancés
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Configuration complète de votre système
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              onClick={exporterDonnees}
              disabled={saving}
            >
              <Download className="w-4 h-4 mr-2" />
              Exporter
            </Button>
            
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {user.name[0]}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Navigation Tabs */}
          <TabsList className="grid grid-cols-5 gap-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 p-1">
            <TabsTrigger value="profil" className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Profil</span>
            </TabsTrigger>
            <TabsTrigger value="boutique" className="flex items-center space-x-2">
              <Store className="w-4 h-4" />
              <span>Boutique</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center space-x-2">
              <Palette className="w-4 h-4" />
              <span>Préférences</span>
            </TabsTrigger>
            <TabsTrigger value="securite" className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Sécurité</span>
            </TabsTrigger>
            <TabsTrigger value="systeme" className="flex items-center space-x-2">
              <Database className="w-4 h-4" />
              <span>Système</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Profil */}
          <TabsContent value="profil" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Carte Profil */}
              <Card className="lg:col-span-1 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {user.name}
                      </h3>
                      <Badge className="mt-2 capitalize bg-green-500/10 text-green-600 border-green-500/20">
                        {user.role}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex items-center justify-center space-x-2">
                        <Mail className="w-4 h-4" />
                        <span>{user.email}</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <Phone className="w-4 h-4" />
                        <span>{user.telephone}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Formulaire Profil */}
              <Card className="lg:col-span-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="w-5 h-5 text-blue-500" />
                    <span>Informations Personnelles</span>
                  </CardTitle>
                  <CardDescription>
                    Gérez vos informations de profil et de contact
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom complet</Label>
                      <Input
                        id="name"
                        value={profile.name}
                        onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Votre nom complet"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="votre@email.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="telephone">Téléphone</Label>
                      <Input
                        id="telephone"
                        value={profile.telephone}
                        onChange={(e) => setProfile(prev => ({ ...prev, telephone: e.target.value }))}
                        placeholder="+229 XX XX XX XX"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Rôle</Label>
                      <Input
                        id="role"
                        value={profile.role}
                        disabled
                        className="bg-slate-100 dark:bg-slate-700"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={sauvegarderProfil}
                      disabled={saving}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Sauvegarde...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Sauvegarder
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Boutique */}
          <TabsContent value="boutique" className="space-y-6">
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Store className="w-5 h-5 text-green-500" />
                  <span>Paramètres de la Boutique</span>
                </CardTitle>
                <CardDescription>
                  Configurez les informations de votre établissement commercial
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="boutique-nom">Nom de la boutique</Label>
                      <Input
                        id="boutique-nom"
                        value={boutique.nom}
                        onChange={(e) => setBoutique(prev => ({ ...prev, nom: e.target.value }))}
                        placeholder="Nom de votre boutique"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="boutique-adresse">Adresse</Label>
                      <Input
                        id="boutique-adresse"
                        value={boutique.adresse}
                        onChange={(e) => setBoutique(prev => ({ ...prev, adresse: e.target.value }))}
                        placeholder="Adresse complète"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="boutique-telephone">Téléphone boutique</Label>
                      <Input
                        id="boutique-telephone"
                        value={boutique.telephone}
                        onChange={(e) => setBoutique(prev => ({ ...prev, telephone: e.target.value }))}
                        placeholder="Téléphone de contact"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="boutique-email">Email boutique</Label>
                      <Input
                        id="boutique-email"
                        type="email"
                        value={boutique.email}
                        onChange={(e) => setBoutique(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="contact@boutique.bj"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="boutique-tva">TVA (%)</Label>
                      <Input
                        id="boutique-tva"
                        type="number"
                        value={boutique.tva}
                        onChange={(e) => setBoutique(prev => ({ ...prev, tva: Number(e.target.value) }))}
                        min="0"
                        max="100"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="boutique-devise">Devise</Label>
                      <Input
                        id="boutique-devise"
                        value={boutique.devise}
                        onChange={(e) => setBoutique(prev => ({ ...prev, devise: e.target.value }))}
                        placeholder="Devise utilisée"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={sauvegarderBoutique}
                    disabled={saving}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Sauvegarde...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Sauvegarder les paramètres
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Préférences */}
          <TabsContent value="preferences" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Notifications */}
              <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Bell className="w-5 h-5 text-orange-500" />
                    <span>Notifications</span>
                  </CardTitle>
                  <CardDescription>
                    Contrôlez comment vous recevez les notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notifications par email</Label>
                      <p className="text-sm text-slate-500">Alertes stocks, rapports, etc.</p>
                    </div>
                    <Switch
                      checked={preferences.notificationsEmail}
                      onCheckedChange={(checked) => 
                        setPreferences(prev => ({ ...prev, notificationsEmail: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notifications SMS</Label>
                      <p className="text-sm text-slate-500">Alertes urgentes par SMS</p>
                    </div>
                    <Switch
                      checked={preferences.notificationsSMS}
                      onCheckedChange={(checked) => 
                        setPreferences(prev => ({ ...prev, notificationsSMS: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Alertes stock bas</Label>
                      <p className="text-sm text-slate-500">Notifications automatiques</p>
                    </div>
                    <Switch
                      checked={preferences.alertesStock}
                      onCheckedChange={(checked) => 
                        setPreferences(prev => ({ ...prev, alertesStock: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Interface & Système */}
              <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Palette className="w-5 h-5 text-purple-500" />
                    <span>Interface & Système</span>
                  </CardTitle>
                  <CardDescription>
                    Personnalisez l'apparence et le comportement du système
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Mode sombre</Label>
                      <p className="text-sm text-slate-500">Interface sombre pour un confort visuel</p>
                    </div>
                    <Switch
                      checked={preferences.darkMode}
                      onCheckedChange={(checked) => 
                        setPreferences(prev => ({ ...prev, darkMode: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Sauvegarde automatique</Label>
                      <p className="text-sm text-slate-500">Sauvegarde quotidienne des données</p>
                    </div>
                    <Switch
                      checked={preferences.autoBackup}
                      onCheckedChange={(checked) => 
                        setPreferences(prev => ({ ...prev, autoBackup: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Rapports automatiques</Label>
                      <p className="text-sm text-slate-500">Génération automatique des rapports</p>
                    </div>
                    <Switch
                      checked={preferences.rapportsAutomatiques}
                      onCheckedChange={(checked) => 
                        setPreferences(prev => ({ ...prev, rapportsAutomatiques: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={sauvegarderPreferences}
                disabled={saving}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Sauvegarder les préférences
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Tab Sécurité */}
          <TabsContent value="securite" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Changement mot de passe */}
              <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Key className="w-5 h-5 text-red-500" />
                    <span>Changer le mot de passe</span>
                  </CardTitle>
                  <CardDescription>
                    Mettez à jour votre mot de passe régulièrement
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Mot de passe actuel</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={securite.currentPassword}
                        onChange={(e) => setSecurite(prev => ({ ...prev, currentPassword: e.target.value }))}
                        placeholder="Votre mot de passe actuel"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nouveau mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={securite.newPassword}
                        onChange={(e) => setSecurite(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="Nouveau mot de passe"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={securite.confirmPassword}
                        onChange={(e) => setSecurite(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirmer le nouveau mot de passe"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button 
                    onClick={changerMotDePasse}
                    disabled={saving}
                    className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Modification...
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4 mr-2" />
                        Changer le mot de passe
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Authentification à deux facteurs */}
              <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-blue-500" />
                    <span>Sécurité Avancée</span>
                  </CardTitle>
                  <CardDescription>
                    Renforcez la sécurité de votre compte
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Authentification à deux facteurs</Label>
                      <p className="text-sm text-slate-500">Sécurisez votre compte avec 2FA</p>
                    </div>
                    <Switch
                      checked={securite.twoFactor}
                      onCheckedChange={(checked) => 
                        setSecurite(prev => ({ ...prev, twoFactor: checked }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">Délai de session (minutes)</Label>
                    <Input
                      id="session-timeout"
                      type="number"
                      value={securite.sessionTimeout}
                      onChange={(e) => setSecurite(prev => ({ ...prev, sessionTimeout: Number(e.target.value) }))}
                      min="5"
                      max="240"
                    />
                    <p className="text-sm text-slate-500">
                      Durée avant déconnexion automatique
                    </p>
                  </div>

                  <div className="pt-4">
                    <Button variant="outline" className="w-full border-red-300 text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer le compte
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Système */}
          <TabsContent value="systeme" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sauvegarde & Restauration */}
              <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Database className="w-5 h-5 text-green-500" />
                    <span>Sauvegarde & Restauration</span>
                  </CardTitle>
                  <CardDescription>
                    Gérez vos sauvegardes et restaurez vos données
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Dernière sauvegarde</Label>
                    <p className="text-sm text-slate-500">15 Octobre 2024, 14:30</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Taille des données</Label>
                    <p className="text-sm text-slate-500">45.2 MB</p>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button 
                      onClick={exporterDonnees}
                      variant="outline"
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Exporter
                    </Button>
                    
                    <Button 
                      onClick={importerDonnees}
                      variant="outline"
                      className="flex-1"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Importer
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Informations Système */}
              <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Globe className="w-5 h-5 text-purple-500" />
                    <span>Informations Système</span>
                  </CardTitle>
                  <CardDescription>
                    Détails techniques de votre installation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Version SGCI</span>
                    <Badge variant="outline">v2.1.0</Badge>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Environnement</span>
                    <Badge variant="outline" className="bg-green-500/10 text-green-600">Production</Badge>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Base de données</span>
                    <span className="text-sm font-medium">MySQL 8.0</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Dernière mise à jour</span>
                    <span className="text-sm font-medium">12 Oct 2024</span>
                  </div>

                  <div className="pt-4">
                    <Button variant="outline" className="w-full">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Vérifier les mises à jour
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}