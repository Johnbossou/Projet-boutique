'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Mail, 
  Phone, 
  Shield, 
  Edit, 
  Trash2,
  UserPlus,
  Store,
  ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Utilisateur {
  id: number;
  name: string;
  email: string;
  telephone?: string | null;
  role: 'proprietaire' | 'gerant' | 'caissier';
  role_dans_boutique?: 'gerant' | 'caissier';
  est_actif: boolean;
  derniere_connexion?: string;
  created_at: string;
}

interface Boutique {
  id: number;
  nom: string;
}

const ROLE_LABELS: Record<string, string> = {
  proprietaire: 'Propriétaire',
  gerant: 'Gérant',
  caissier: 'Caissier',
};

export default function BoutiqueEquipePage() {
  const { user } = useAuth();
  const params = useParams();
  const boutiqueId = parseInt(params.id as string);
  
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [equipe, setEquipe] = useState<Utilisateur[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    telephone: '',
    role: 'caissier',
    password: '',
  });

  const fetchBoutique = async () => {
    try {
      const response = await apiFetch(`/boutiques/${boutiqueId}`);
      if (response.ok) {
        const data = await response.json();
        setBoutique(data);
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const fetchEquipe = async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch(`/boutiques/${boutiqueId}/users`);
      
      if (!response.ok) throw new Error('Erreur lors du chargement de l\'équipe');
      
      const data = await response.json();
      setEquipe(data);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement de l\'équipe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await apiFetch(`/boutiques/${boutiqueId}/users`, {
        method: 'POST',
        body: JSON.stringify({
          ...newMember,
          role_dans_boutique: newMember.role,
        }),
      });
      
      if (!response.ok) throw new Error('Erreur lors de l\'ajout du membre');
      
      toast.success('Membre ajouté avec succès');
      setShowAddDialog(false);
      setNewMember({ name: '', email: '', telephone: '', role: 'caissier', password: '' });
      fetchEquipe();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'ajout du membre');
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce membre de l\'équipe ?')) return;
    
    try {
      const response = await apiFetch(`/boutiques/${boutiqueId}/users/${userId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Erreur lors de la suppression');
      
      toast.success('Membre supprimé avec succès');
      fetchEquipe();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  useEffect(() => {
    if (user && boutiqueId) {
      fetchBoutique();
      fetchEquipe();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, boutiqueId]);

  if (!user || user.role !== 'proprietaire') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-slate-400" />
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
                  Équipe - {boutique?.nom || 'Chargement...'}
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                  Gérez les membres de cette boutique
                </p>
              </div>
            </div>
            <Button 
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              onClick={() => setShowAddDialog(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Ajouter un membre
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
                    Total Équipe
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                    {equipe.length}
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
                    Gérants
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                    {equipe.filter(m => m.role === 'gerant').length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Caissiers
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                    {equipe.filter(m => m.role === 'caissier').length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center">
                  <Store className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Équipe Grid */}
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
        ) : equipe.length > 0 ? (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {equipe.map((membre, index) => (
              <motion.div
                key={membre.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 + index * 0.1 }}
              >
                <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{membre.name}</CardTitle>
                        <CardDescription className="flex items-center text-xs">
                          <Mail className="w-3 h-3 mr-1" />
                          {membre.email}
                        </CardDescription>
                      </div>
                      <Badge variant={membre.est_actif ? "default" : "secondary"}>
                        {membre.est_actif ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Info Grid */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                        <Shield className="w-4 h-4" />
                        <span className="capitalize">{ROLE_LABELS[membre.role] ?? membre.role}</span>
                      </div>
                      {membre.telephone && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                          <Phone className="w-4 h-4" />
                          <span>{membre.telephone}</span>
                        </div>
                      )}
                      {membre.derniere_connexion && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Dernière connexion: {new Date(membre.derniere_connexion).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2 pt-2">
                      <Button variant="outline" className="flex-1" size="sm">
                        <Edit className="w-4 h-4 mr-2" />
                        Modifier
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1" 
                        size="sm"
                        onClick={() => handleRemoveMember(membre.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </Button>
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
            <Users className="w-24 h-24 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Aucun membre
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Commencez par ajouter des membres à votre équipe
            </p>
            <Button 
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              onClick={() => setShowAddDialog(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Ajouter le premier membre
            </Button>
          </motion.div>
        )}
      </main>

      {/* Add Member Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ajouter un membre</DialogTitle>
            <DialogDescription>
              Ajoutez un nouveau membre à l&apos;équipe de {boutique?.nom}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet *</Label>
                <Input
                  id="name"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input
                  id="telephone"
                  value={newMember.telephone}
                  onChange={(e) => setNewMember({ ...newMember, telephone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rôle *</Label>
                <Select value={newMember.role} onValueChange={(value) => setNewMember({ ...newMember, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gerant">Gérant</SelectItem>
                    <SelectItem value="caissier">Caissier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newMember.password}
                  onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                Ajouter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
