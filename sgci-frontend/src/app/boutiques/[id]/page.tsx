'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Store, 
  Settings, 
  DollarSign,
  Save,
  ArrowLeft,
  Percent,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Boutique {
  id: number;
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  devise?: string;
  taux_tva?: number;
  delai_annulation_vente_minutes?: number;
  created_at: string;
  proprietaire_id: number;
}

export default function BoutiqueSettingsPage() {
  const { user } = useAuth();
  const params = useParams();
  const boutiqueId = parseInt(params.id as string);
  
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    telephone: '',
    email: '',
    devise: 'XOF',
    taux_tva: 18,
    delai_annulation_vente_minutes: 30,
  });

  const fetchBoutique = async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch(`/boutiques/${boutiqueId}`);
      
      if (!response.ok) throw new Error('Erreur lors du chargement de la boutique');
      
      const data = await response.json();
      setBoutique(data);
      setFormData({
        nom: data.nom || '',
        adresse: data.adresse || '',
        telephone: data.telephone || '',
        email: data.email || '',
        devise: data.devise || 'XOF',
        taux_tva: data.taux_tva || 18,
        delai_annulation_vente_minutes: data.delai_annulation_vente_minutes || 30,
      });
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement de la boutique');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      const response = await apiFetch(`/boutiques/${boutiqueId}`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) throw new Error('Erreur lors de la mise à jour');
      
      toast.success('Paramètres mis à jour avec succès');
      fetchBoutique();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (user && boutiqueId) {
      fetchBoutique();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, boutiqueId]);

  if (!user || user.role !== 'proprietaire') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Settings className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <h2 className="text-xl font-bold mb-2">Accès non autorisé</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Seuls les propriétaires peuvent accéder à cette page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <main className="p-8">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/boutiques">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  Paramètres - {boutique?.nom || 'Chargement...'}
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                  Configurez les paramètres de cette boutique
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Settings Form */}
        {isLoading ? (
          <div className="max-w-3xl">
            <Card className="animate-pulse">
              <CardContent className="p-8 space-y-6">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded" />
              </CardContent>
            </Card>
          </div>
        ) : (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="max-w-3xl space-y-6"
          >
            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Store className="w-5 h-5" />
                  <span>Informations générales</span>
                </CardTitle>
                <CardDescription>
                  Informations de base de votre boutique
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom de la boutique *</Label>
                    <Input
                      id="nom"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adresse">Adresse</Label>
                    <Textarea
                      id="adresse"
                      value={formData.adresse}
                      onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="telephone">Téléphone</Label>
                      <Input
                        id="telephone"
                        value={formData.telephone}
                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5" />
                  <span>Paramètres financiers</span>
                </CardTitle>
                <CardDescription>
                  Devise et taux de TVA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="devise">Devise</Label>
                      <Input
                        id="devise"
                        value={formData.devise}
                        onChange={(e) => setFormData({ ...formData, devise: e.target.value })}
                        placeholder="XOF"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="taux_tva">Taux de TVA (%)</Label>
                      <div className="relative">
                        <Input
                          id="taux_tva"
                          type="number"
                          value={formData.taux_tva}
                          onChange={(e) => setFormData({ ...formData, taux_tva: parseFloat(e.target.value) })}
                          min={0}
                          max={100}
                          step={0.1}
                        />
                        <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>Paramètres de vente</span>
                </CardTitle>
                <CardDescription>
                  Configuration des ventes et annulations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="delai_annulation_vente_minutes">
                      Délai d&apos;annulation de vente (minutes)
                    </Label>
                    <Input
                      id="delai_annulation_vente_minutes"
                      type="number"
                      value={formData.delai_annulation_vente_minutes}
                      onChange={(e) => setFormData({ ...formData, delai_annulation_vente_minutes: parseInt(e.target.value) })}
                      min={0}
                      max={1440}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Délai pendant lequel une vente peut être annulée après validation
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-4">
              <Link href="/boutiques">
                <Button variant="outline">
                  Annuler
                </Button>
              </Link>
              <Button 
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</span> : 'Enregistrer'}
              </Button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
