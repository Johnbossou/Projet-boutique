'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Store, 
  Plus, 
  Users, 
  Settings, 
  TrendingUp,
  MapPin,
  Phone,
  DollarSign,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Boutique {
  id: number;
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  devise?: string;
  taux_tva?: number;
  created_at: string;
  proprietaire_id: number;
  _count?: {
    users: number;
    produits: number;
    ventes: number;
  };
}

interface NewBoutique {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  devise: string;
  taux_tva: number;
}

export default function BoutiquesPage() {
  const { user } = useAuth();
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newBoutique, setNewBoutique] = useState<NewBoutique>({
    nom: '',
    adresse: '',
    telephone: '',
    email: '',
    devise: 'XOF',
    taux_tva: 18,
  });

  const fetchBoutiques = async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch('/boutiques');
      
      if (!response.ok) throw new Error('Erreur lors du chargement des boutiques');
      
      const data = await response.json();
      setBoutiques(data);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des boutiques');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBoutique = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsCreating(true);
      const response = await apiFetch('/boutiques', {
        method: 'POST',
        body: JSON.stringify(newBoutique),
      });
      
      if (!response.ok) throw new Error('Erreur lors de la création de la boutique');
      
      toast.success('Boutique créée avec succès');
      setShowCreateDialog(false);
      setNewBoutique({
        nom: '',
        adresse: '',
        telephone: '',
        email: '',
        devise: 'XOF',
        taux_tva: 18,
      });
      fetchBoutiques();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la création de la boutique');
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBoutiques();
    }
  }, [user]);

  if (!user || user.role !== 'proprietaire') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Store className="w-16 h-16 mx-auto mb-4 text-slate-400" />
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
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Mes Boutiques
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Gérez tous vos établissements depuis un seul endroit
              </p>
            </div>
            <Button 
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Boutique
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Total Boutiques
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                    {boutiques.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center">
                  <Store className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Total Équipe
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                    {boutiques.reduce((sum, b) => sum + (b._count?.users || 0), 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Total Produits
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                    {boutiques.reduce((sum, b) => sum + (b._count?.produits || 0), 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Boutiques Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : boutiques.length > 0 ? (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {boutiques.map((boutique, index) => (
              <motion.div
                key={boutique.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 + index * 0.1 }}
              >
                <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all duration-300 group">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{boutique.nom}</CardTitle>
                        {boutique.adresse && (
                          <CardDescription className="flex items-center text-xs">
                            <MapPin className="w-3 h-3 mr-1" />
                            {boutique.adresse}
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant={boutique.id === user.current_boutique_id ? "default" : "secondary"}>
                        {boutique.id === user.current_boutique_id ? "Actuelle" : "Autre"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                        <Users className="w-4 h-4" />
                        <span>{boutique._count?.users || 0} membres</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                        <Store className="w-4 h-4" />
                        <span>{boutique._count?.produits || 0} produits</span>
                      </div>
                      {boutique.telephone && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400 col-span-2">
                          <Phone className="w-4 h-4" />
                          <span>{boutique.telephone}</span>
                        </div>
                      )}
                      {boutique.devise && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400 col-span-2">
                          <DollarSign className="w-4 h-4" />
                          <span>Devise: {boutique.devise} (TVA: {boutique.taux_tva}%)</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2 pt-2">
                      <Link href={`/boutiques/${boutique.id}`} className="flex-1">
                        <Button variant="outline" className="w-full" size="sm">
                          <Settings className="w-4 h-4 mr-2" />
                          Gérer
                        </Button>
                      </Link>
                      <Link href={`/boutiques/${boutique.id}/equipe`} className="flex-1">
                        <Button variant="outline" className="w-full" size="sm">
                          <Users className="w-4 h-4 mr-2" />
                          Équipe
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center py-16"
          >
            <Store className="w-24 h-24 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Aucune boutique
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Commencez par créer votre première boutique
            </p>
            <Button 
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Créer ma première boutique
            </Button>
          </motion.div>
        )}
      </main>

      {/* Create Boutique Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Créer une nouvelle boutique</DialogTitle>
            <DialogDescription>
              Ajoutez une nouvelle boutique à votre portefeuille
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateBoutique}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom de la boutique *</Label>
                <Input
                  id="nom"
                  value={newBoutique.nom}
                  onChange={(e) => setNewBoutique({ ...newBoutique, nom: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adresse">Adresse</Label>
                <Textarea
                  id="adresse"
                  value={newBoutique.adresse}
                  onChange={(e) => setNewBoutique({ ...newBoutique, adresse: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input
                    id="telephone"
                    value={newBoutique.telephone}
                    onChange={(e) => setNewBoutique({ ...newBoutique, telephone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newBoutique.email}
                    onChange={(e) => setNewBoutique({ ...newBoutique, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="devise">Devise</Label>
                  <Input
                    id="devise"
                    value={newBoutique.devise}
                    onChange={(e) => setNewBoutique({ ...newBoutique, devise: e.target.value })}
                    placeholder="XOF"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taux_tva">Taux de TVA (%)</Label>
                  <Input
                    id="taux_tva"
                    type="number"
                    value={newBoutique.taux_tva}
                    onChange={(e) => setNewBoutique({ ...newBoutique, taux_tva: parseFloat(e.target.value) })}
                    min={0}
                    max={100}
                    step={0.1}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Annuler
              </Button>
              <Button 
                type="submit" 
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                disabled={isCreating}
              >
                {isCreating ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Création...</span> : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
