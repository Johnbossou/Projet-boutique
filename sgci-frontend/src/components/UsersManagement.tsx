'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserPlus, RefreshCw, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: 'gerant' | 'caissier';
  telephone?: string | null;
  est_actif: boolean;
}

export function UsersManagement() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    telephone: '',
    role: 'caissier' as 'gerant' | 'caissier',
  });

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/users?actifs_seulement=0');
      if (!response.ok) throw new Error('Chargement impossible');
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur utilisateurs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const creerUtilisateur = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error('Nom, email et mot de passe requis');
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Création échouée');
      }
      toast.success('Utilisateur créé');
      setShowForm(false);
      setForm({ name: '', email: '', password: '', telephone: '', role: 'caissier' });
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const desactiver = async (u: ApiUser) => {
    if (!confirm(`Désactiver ${u.name} ?`)) return;
    try {
      const response = await apiFetch(`/users/${u.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Échec désactivation');
      toast.success('Utilisateur désactivé');
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const reactiver = async (u: ApiUser) => {
    try {
      const response = await apiFetch(`/users/${u.id}`, {
        method: 'PUT',
        body: JSON.stringify({ est_actif: true }),
      });
      if (!response.ok) throw new Error('Échec réactivation');
      toast.success('Utilisateur réactivé');
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  return (
    <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Équipe & caissiers</CardTitle>
          <CardDescription>Créer et gérer les accès (gérant uniquement)</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={charger} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Nouveau
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showForm && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Mot de passe</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as 'gerant' | 'caissier' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="caissier">Caissier</SelectItem>
                  <SelectItem value="gerant">Gérant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={creerUtilisateur} disabled={saving} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Créer
              </Button>
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell className="capitalize">{u.role}</TableCell>
                <TableCell>
                  <Badge variant={u.est_actif ? 'default' : 'secondary'}>
                    {u.est_actif ? 'Actif' : 'Inactif'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {u.est_actif ? (
                    <Button variant="ghost" size="sm" onClick={() => desactiver(u)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => reactiver(u)}>
                      Réactiver
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
