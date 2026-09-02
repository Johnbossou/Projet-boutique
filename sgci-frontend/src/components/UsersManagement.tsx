'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserPlus, RefreshCw, Trash2, Save, Mail, Download, Upload, FileText } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveRole, canGerer } from '@/lib/role';
interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: 'proprietaire' | 'gerant' | 'caissier';
  telephone?: string | null;
  est_actif: boolean;
}

export function UsersManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'gerant' | 'caissier'>('caissier');
  const [editTarget, setEditTarget] = useState<ApiUser | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    telephone: '',
    role: 'caissier' as 'gerant' | 'caissier' | 'proprietaire',
    password: '',
  });
  const [pendingConfirm, setPendingConfirm] = useState<{
    message: string;
    gerantName: string;
    action: () => Promise<void>;
  } | null>(null);

  const canModify = canGerer(user, getEffectiveRole(user));
  const roleCourant = getEffectiveRole(user);

  const canEditUser = (u: ApiUser) => {
    if (!canModify) return false;
    if (roleCourant === 'gerant') return u.role !== 'proprietaire';
    if (roleCourant === 'proprietaire') return user != null && u.id !== user.id;
    return false;
  };

  const openEdit = (u: ApiUser) => {
    setEditTarget(u);
    setEditForm({
      name: u.name,
      email: u.email,
      telephone: u.telephone ?? '',
      role: u.role,
      password: '',
    });
    setSaving(false);
  };
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
      setUsers(Array.isArray(data) ? data : (data.data ?? []));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur utilisateurs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const creerUtilisateur = async (confirmer = false) => {
    if (!form.name || !form.email || !form.password) {
      toast.error('Nom, email et mot de passe requis');
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          ...(user?.current_boutique_id
            ? { boutique_id: user.current_boutique_id, role_dans_boutique: form.role }
            : {}),
          ...(confirmer ? { confirmer: true } : {}),
        }),
      });
      if (response.status === 409) {
        const err = await response.json().catch(() => ({}));
        if (err.code === 'gerant_existant') {
          setPendingConfirm({
            message: err.message || 'Cette boutique a déjà un gérant.',
            gerantName: err.gerant_actuel?.name || '',
            action: async () => {
              setPendingConfirm(null);
              await creerUtilisateur(true);
            },
          });
          return;
        }
        throw new Error(err.message || 'Création échouée');
      }
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

  const modifierUtilisateur = async (confirmer = false) => {
    if (!editTarget) return;
    if (!editForm.name || !editForm.email) {
      toast.error('Nom et email requis');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name,
        email: editForm.email,
        telephone: editForm.telephone || null,
        role: editForm.role,
      };
      if (editForm.password) payload.password = editForm.password;
      if (confirmer) payload.confirmer = true;
      const response = await apiFetch(`/users/${editTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (response.status === 409) {
        const err = await response.json().catch(() => ({}));
        if (err.code === 'gerant_existant') {
          setPendingConfirm({
            message: err.message || 'Cette boutique a déjà un gérant.',
            gerantName: err.gerant_actuel?.name || '',
            action: async () => {
              setPendingConfirm(null);
              await modifierUtilisateur(true);
            },
          });
          return;
        }
        throw new Error(err.message || 'Modification échouée');
      }
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Modification échouée');
      }
      toast.success('Membre modifié');
      setEditTarget(null);
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const desactiver = async (u: ApiUser) => {    if (!confirm(`Désactiver ${u.name} ?`)) return;
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

  const inviteUser = async () => {
    if (!inviteEmail) {
      toast.error('Email requis');
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch('/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Invitation échouée');
      }
      toast.success('Invitation envoyée avec succès');
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('caissier');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const exportUsers = async () => {
    try {
      const response = await apiFetch('/users/export', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Export échoué');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `utilisateurs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Export réussi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const importUsers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setSaving(true);
    try {
      const response = await apiFetch('/users/import', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Import échoué');
      }
      const result = await response.json();
      toast.success(`${result.imported || 0} utilisateurs importés avec succès`);
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
      event.target.value = '';
    }
  };

  return (
    <>
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
          <Button variant="outline" size="sm" onClick={() => setShowInviteDialog(true)}>
            <Mail className="w-4 h-4 mr-2" />
            Inviter
          </Button>
          <Button variant="outline" size="sm" onClick={exportUsers}>
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
          <Button variant="outline" size="sm" onClick={() => document.getElementById('import-users')?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Importer
          </Button>
          <input
            id="import-users"
            type="file"
            accept=".csv,.xlsx"
            onChange={importUsers}
            className="hidden"
          />
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
              <Button onClick={() => creerUtilisateur()} disabled={saving} className="w-full">
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
                  <div className="flex items-center justify-end gap-1">
                    {canEditUser(u) && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Modifier
                      </Button>
                    )}
                    {u.est_actif ? (
                      <Button variant="ghost" size="sm" onClick={() => desactiver(u)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => reactiver(u)}>
                        Réactiver
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    {/* Invite Dialog */}
    <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter un membre</DialogTitle>
          <DialogDescription>
            Envoyez une invitation par email pour rejoindre votre équipe
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="email@exemple.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Rôle</Label>
            <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gerant">Gérant</SelectItem>
                <SelectItem value="caissier">Caissier</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
            Annuler
          </Button>
          <Button onClick={inviteUser} disabled={saving}>
            {saving ? 'Envoi...' : 'Envoyer l\'invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Edit Member Dialog */}
    <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier un membre</DialogTitle>
          <DialogDescription>
            Modifiez les informations de {editTarget?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nom</Label>
            <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Téléphone</Label>
            <Input value={editForm.telephone} onChange={(e) => setEditForm((f) => ({ ...f, telephone: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Rôle</Label>
            <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as 'gerant' | 'caissier' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="caissier">Caissier</SelectItem>
                <SelectItem value="gerant">Gérant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mot de passe (laisser vide pour ne pas changer)</Label>
            <Input type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={() => modifierUtilisateur()} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Gerant confirmation dialog */}
    <Dialog open={!!pendingConfirm} onOpenChange={(open) => { if (!open) setPendingConfirm(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Un gérant existe déjà</DialogTitle>
          <DialogDescription>
            {pendingConfirm?.message}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 text-sm text-slate-600 dark:text-slate-400">
          <p className="font-medium">{pendingConfirm?.gerantName}</p>
          <p className="mt-2">
            Si vous continuez, l'ancien gérant sera <strong>rétrogradé en caissier</strong> et le nouveau membre deviendra gérant.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPendingConfirm(null)}>
            Annuler
          </Button>
          <Button onClick={() => pendingConfirm?.action()} disabled={saving}>
            Continuer (rétrograder l'ancien gérant)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
