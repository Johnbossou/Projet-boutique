'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Truck,
  Plus,
  Package,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  Boxes,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveRole, canGerer } from '@/lib/role';
import type { CommandeFournisseur, Fournisseur, Produit, ReceptionLigne } from '@/types';

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  en_cours: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  livre: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  annule: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  livre: 'Livrée',
  annule: 'Annulée',
};

interface LigneSaisie {
  produit_id: number;
  quantite_commandee: number;
  prix_unitaire: number;
}

export default function ApprovisionnementPage() {
  const { user } = useAuth();
  const roleCourant = getEffectiveRole(user);
  const userPeutGerer = canGerer(user, roleCourant);

  const [commandes, setCommandes] = useState<CommandeFournisseur[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState('all');
  const [detailOuvert, setDetailOuvert] = useState<CommandeFournisseur | null>(null);
  const [creerOuvert, setCreerOuvert] = useState(false);
  const [creerFournisseurOuvert, setCreerFournisseurOuvert] = useState(false);

  // Formulaire nouvelle commande
  const [fournisseurId, setFournisseurId] = useState('');
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);

  // Formulaire nouveau fournisseur
  const [nfNom, setNfNom] = useState('');
  const [nfTel, setNfTel] = useState('');
  const [nfEmail, setNfEmail] = useState('');

  const [receptions, setReceptions] = useState<Record<number, string>>({});
  const [montantPaiement, setMontantPaiement] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const chargerCommandes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ per_page: '100' });
      if (filtreStatut !== 'all') params.set('statut', filtreStatut);
      const res = await apiFetch(`/commandes-fournisseurs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCommandes(data.data ?? []);
      } else {
        toast.error('Impossible de charger les commandes');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsLoading(false);
    }
  }, [filtreStatut]);

  const chargerFournisseurs = useCallback(async () => {
    try {
      const res = await apiFetch('/fournisseurs?per_page=100');
      if (res.ok) {
        const data = await res.json();
        setFournisseurs((data.data ?? data) || []);
      }
    } catch {
      toast.error('Erreur lors du chargement des fournisseurs');
    }
  }, []);

  const chargerProduits = useCallback(async () => {
    try {
      const res = await apiFetch('/produits?page=1&per_page=200');
      if (res.ok) {
        const data = await res.json();
        setProduits(Array.isArray(data.data) ? data.data : data.data ?? []);
      }
    } catch {
      toast.error('Erreur lors du chargement des produits');
    }
  }, []);

  useEffect(() => {
    chargerCommandes();
    chargerFournisseurs();
    chargerProduits();
  }, [chargerCommandes, chargerFournisseurs, chargerProduits]);

  const totalEnAttente = commandes.filter((c) => c.statut === 'en_attente').length;
  const totalEnCours = commandes.filter((c) => c.statut === 'en_cours').length;
  const totalLivrees = commandes.filter((c) => c.statut === 'livre').length;
  const montantTotal = commandes.filter((c) => c.statut !== 'annule').reduce((s, c) => s + c.montant_total, 0);

  const creerCommande = async () => {
    if (!fournisseurId) {
      toast.error('Veuillez sélectionner un fournisseur');
      return;
    }
    const lignesValides = lignes.filter((l) => l.produit_id && l.quantite_commandee > 0 && l.prix_unitaire >= 0);
    if (lignesValides.length === 0) {
      toast.error('Ajoutez au moins une ligne de produit');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        fournisseur_id: Number(fournisseurId),
        lignes: lignesValides.map((l) => ({
          produit_id: Number(l.produit_id),
          quantite_commandee: Number(l.quantite_commandee),
          prix_unitaire: Number(l.prix_unitaire),
        })),
      };
      const res = await apiFetch('/commandes-fournisseurs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success('Commande créée');
        setCreerOuvert(false);
        setFournisseurId('');
        setLignes([]);
        chargerCommandes();
      } else {
        const d = await res.json();
        toast.error(d.message || 'Erreur lors de la création');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsSaving(false);
    }
  };

  const validerCommande = async (commande: CommandeFournisseur) => {
    try {
      const res = await apiFetch(`/commandes-fournisseurs/${commande.id}/valider`, { method: 'POST' });
      if (res.ok) {
        toast.success('Commande validée');
        chargerCommandes();
        setDetailOuvert(null);
      } else {
        const d = await res.json();
        toast.error(d.message || "Erreur lors de la validation");
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const annulerCommande = async (commande: CommandeFournisseur) => {
    try {
      const res = await apiFetch(`/commandes-fournisseurs/${commande.id}/annuler`, { method: 'POST' });
      if (res.ok) {
        toast.success('Commande annulée');
        chargerCommandes();
        setDetailOuvert(null);
      } else {
        const d = await res.json();
        toast.error(d.message || "Erreur lors de l'annulation");
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const receptionner = async (commande: CommandeFournisseur) => {
    const lignesRecues = commande.lignes
      .filter((l) => {
        const v = Number(receptions[l.id]);
        return v > 0 && v <= (l.quantite_restante ?? l.quantite_commandee - l.quantite_recue);
      })
      .map((l) => ({ ligne_id: l.id, quantite_recue: Number(receptions[l.id]) }));

    if (lignesRecues.length === 0) {
      toast.error('Indiquez une quantité à recevoir (dans les limites restantes) pour au moins une ligne');
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiFetch(`/commandes-fournisseurs/${commande.id}/receptionner`, {
        method: 'POST',
        body: JSON.stringify({ lignes: lignesRecues }),
      });
      if (res.ok) {
        toast.success('Réception enregistrée — stock mis à jour');
        setReceptions({});
        chargerCommandes();
      } else {
        const d = await res.json();
        toast.error(d.message || 'Erreur lors de la réception');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsSaving(false);
    }
  };

  const payerCommande = async (commande: CommandeFournisseur) => {
    const montant = Number(montantPaiement);
    if (!montant || montant <= 0) {
      toast.error('Indiquez un montant à régler');
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiFetch(`/commandes-fournisseurs/${commande.id}/payer`, {
        method: 'POST',
        body: JSON.stringify({ montant }),
      });
      if (res.ok) {
        toast.success('Règlement enregistré');
        setMontantPaiement('');
        chargerCommandes();
      } else {
        const d = await res.json();
        toast.error(d.message || 'Erreur lors du règlement');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsSaving(false);
    }
  };

  const ajouterLigne = () => {
    if (lignes.length >= 20) return;
    setLignes([...lignes, { produit_id: 0, quantite_commandee: 1, prix_unitaire: 0 }]);
  };

  const majLigne = (idx: number, patch: Partial<LigneSaisie>) => {
    setLignes(lignes.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const supprimerLigne = (idx: number) => {
    setLignes(lignes.filter((_, i) => i !== idx));
  };

  const creerFournisseur = async () => {
    if (!nfNom) {
      toast.error('Le nom est requis');
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiFetch('/fournisseurs', {
        method: 'POST',
        body: JSON.stringify({ nom: nfNom, telephone: nfTel || null, email: nfEmail || null }),
      });
      if (res.ok) {
        toast.success('Fournisseur créé');
        setCreerFournisseurOuvert(false);
        setNfNom('');
        setNfTel('');
        setNfEmail('');
        chargerFournisseurs();
      } else {
        const d = await res.json();
        toast.error(d.message || 'Erreur lors de la création');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Truck className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Approvisionnement</h1>
        </div>
        {userPeutGerer && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCreerFournisseurOuvert(true)}>
              <Plus className="w-4 h-4 mr-1" /> Fournisseur
            </Button>
            <Button onClick={() => setCreerOuvert(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nouvelle commande
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">En attente</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-600">{totalEnAttente}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">En cours</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-600">{totalEnCours}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Livrées</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{totalLivrees}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Montant engagé</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{montantTotal.toLocaleString('fr-FR')} XOF</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="commandes">
        <TabsList>
          <TabsTrigger value="commandes">Commandes</TabsTrigger>
          <TabsTrigger value="fournisseurs">Fournisseurs</TabsTrigger>
        </TabsList>

        <TabsContent value="commandes" className="space-y-4">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filtreStatut} onValueChange={setFiltreStatut}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="en_attente">En attente</SelectItem>
                <SelectItem value="en_cours">En cours</SelectItem>
                <SelectItem value="livre">Livrée</SelectItem>
                <SelectItem value="annule">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-6 text-center text-muted-foreground">Chargement…</p>
              ) : commandes.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">Aucune commande trouvée</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° commande</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="text-right">Reste à payer</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commandes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.numero_commande}</TableCell>
                        <TableCell>{c.fournisseur?.nom ?? '—'}</TableCell>
                        <TableCell className="text-right font-mono">{c.montant_total.toLocaleString('fr-FR')} XOF</TableCell>
                        <TableCell className="text-right font-mono">
                          {Math.max(0, c.montant_total - c.montant_paye).toLocaleString('fr-FR')} XOF
                        </TableCell>
                        <TableCell>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[c.statut] ?? ''}`}>
                            {STATUT_LABELS[c.statut] ?? c.statut}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(c.date_commande).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => { setDetailOuvert(c); setReceptions({}); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fournisseurs" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {fournisseurs.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">Aucun fournisseur</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Pays</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fournisseurs.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.nom}</TableCell>
                        <TableCell>{f.telephone ?? '—'}</TableCell>
                        <TableCell className="text-xs">{f.email ?? '—'}</TableCell>
                        <TableCell>{f.pays ?? '—'}</TableCell>
                        <TableCell>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${f.actif ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-700'}`}>
                            {f.actif ? 'Actif' : 'Inactif'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog : nouvelle commande */}
      <Dialog open={creerOuvert} onOpenChange={setCreerOuvert}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle commande fournisseur</DialogTitle>
            <DialogDescription>Choisissez le fournisseur et les produits commandés.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fournisseur</Label>
              <Select
                value={fournisseurId}
                onValueChange={(v) => {
                  setFournisseurId(v);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Sélectionner un fournisseur" /></SelectTrigger>
                <SelectContent>
                  {fournisseurs.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">Aucun fournisseur. Créez-en un d'abord.</p>
                  ) : (
                    fournisseurs.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>{f.nom}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lignes de commande</Label>
                <Button type="button" variant="outline" size="sm" onClick={ajouterLigne}>
                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </div>
              {lignes.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune ligne. Ajoutez un produit.</p>
              )}
              {lignes.map((l, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_90px_110px_32px] gap-2 items-center">
                  <Select
                    value={l.produit_id ? String(l.produit_id) : ''}
                    onValueChange={(v) => majLigne(idx, { produit_id: Number(v) })}
                  >
                    <SelectTrigger><SelectValue placeholder="Produit" /></SelectTrigger>
                    <SelectContent>
                      {produits.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nom} (stock {p.quantite_stock})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Qté"
                    value={l.quantite_commandee}
                    onChange={(e) => majLigne(idx, { quantite_commandee: Number(e.target.value) })}
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Prix"
                    value={l.prix_unitaire}
                    onChange={(e) => majLigne(idx, { prix_unitaire: Number(e.target.value) })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => supprimerLigne(idx)}>
                    <XCircle className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreerOuvert(false)}>Annuler</Button>
            <Button onClick={creerCommande} disabled={isSaving}>
              {isSaving ? 'Création…' : 'Créer la commande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : nouveau fournisseur */}
      <Dialog open={creerFournisseurOuvert} onOpenChange={setCreerFournisseurOuvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau fournisseur</DialogTitle>
            <DialogDescription>Ajoutez un fournisseur pour vos approvisionnements.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={nfNom} onChange={(e) => setNfNom(e.target.value)} placeholder="Nom du fournisseur" />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={nfTel} onChange={(e) => setNfTel(e.target.value)} placeholder="+229" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={nfEmail} onChange={(e) => setNfEmail(e.target.value)} placeholder="contact@fournisseur.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreerFournisseurOuvert(false)}>Annuler</Button>
            <Button onClick={creerFournisseur} disabled={isSaving}>
              {isSaving ? 'Création…' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : fiche commande */}
      <Dialog open={!!detailOuvert} onOpenChange={(o) => { if (!o) setDetailOuvert(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailOuvert && (
            <>
              <DialogHeader>
                <DialogTitle>Commande {detailOuvert.numero_commande}</DialogTitle>
                <DialogDescription>
                  {detailOuvert.fournisseur?.nom ?? '—'} · {STATUT_LABELS[detailOuvert.statut] ?? detailOuvert.statut}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Date :</span> {new Date(detailOuvert.date_commande).toLocaleDateString('fr-FR')}</div>
                <div><span className="text-muted-foreground">Montant :</span> <span className="font-bold">{detailOuvert.montant_total.toLocaleString('fr-FR')} XOF</span></div>
                <div><span className="text-muted-foreground">Payé :</span> {detailOuvert.montant_paye.toLocaleString('fr-FR')} XOF</div>
                <div>
                  <span className="text-muted-foreground">Reste à payer :</span>{' '}
                  <span className={detailOuvert.montant_total - detailOuvert.montant_paye > 0 ? 'text-amber-600 font-semibold' : 'text-green-600 font-semibold'}>
                    {(detailOuvert.montant_total - detailOuvert.montant_paye).toLocaleString('fr-FR')} XOF
                  </span>
                </div>
                {detailOuvert.date_livraison_reelle && (
                  <div><span className="text-muted-foreground">Reçue le :</span> {new Date(detailOuvert.date_livraison_reelle).toLocaleDateString('fr-FR')}</div>
                )}
                {detailOuvert.notes && (
                  <div className="col-span-2 text-sm italic text-muted-foreground">« {detailOuvert.notes} »</div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Lignes :</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Commandé</TableHead>
                      <TableHead className="text-right">Reçu</TableHead>
                      <TableHead className="text-right">Reste</TableHead>
                      <TableHead>Prix</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailOuvert.lignes.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.produit?.nom ?? '—'}</TableCell>
                        <TableCell className="text-right">{l.quantite_commandee}</TableCell>
                        <TableCell className="text-right font-medium">{l.quantite_recue}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{l.quantite_restante ?? Math.max(0, l.quantite_commandee - l.quantite_recue)}</TableCell>
                        <TableCell className="text-right font-mono">{l.prix_unitaire.toLocaleString('fr-FR')} XOF</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {detailOuvert.statut === 'en_cours' && (
                <div className="space-y-3 border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-blue-500" />
                    <p className="text-sm font-medium">Réceptionnner du stock</p>
                  </div>
                  <div className="space-y-2">
                    {detailOuvert.lignes.map((l) => {
                      const reste = l.quantite_restante ?? Math.max(0, l.quantite_commandee - l.quantite_recue);
                      if (reste <= 0) return null;
                      return (
                        <div key={l.id} className="grid grid-cols-[1fr_120px] gap-2 items-center">
                          <span className="text-sm">{l.produit?.nom ?? '—'} <span className="text-muted-foreground">(reste {reste})</span></span>
                          <Input
                            type="number"
                            min={1}
                            max={reste}
                            placeholder={`0-${reste}`}
                            value={receptions[l.id] ?? ''}
                            onChange={(e) => setReceptions({ ...receptions, [l.id]: e.target.value })}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {detailOuvert.statut !== 'annule' && detailOuvert.montant_paye < detailOuvert.montant_total && userPeutGerer && (
                <div className="space-y-3 border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-medium">Règlement</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Payé : <span className="font-semibold text-green-600">{detailOuvert.montant_paye.toLocaleString('fr-FR')} XOF</span></div>
                    <div className="text-muted-foreground">Reste : <span className="font-semibold text-amber-600">{(detailOuvert.montant_total - detailOuvert.montant_paye).toLocaleString('fr-FR')} XOF</span></div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={detailOuvert.montant_total - detailOuvert.montant_paye}
                      placeholder="Montant à régler"
                      value={montantPaiement}
                      onChange={(e) => setMontantPaiement(e.target.value)}
                    />
                    <Button onClick={() => payerCommande(detailOuvert)} disabled={isSaving}>
                      Payer
                    </Button>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                {detailOuvert.statut === 'en_attente' && userPeutGerer && (
                  <>
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => validerCommande(detailOuvert)}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Valider
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => annulerCommande(detailOuvert)}>
                      <XCircle className="w-4 h-4 mr-1" /> Annuler
                    </Button>
                  </>
                )}
                {detailOuvert.statut === 'en_cours' && userPeutGerer && (
                  <>
                    <Button className="flex-1" onClick={() => receptionner(detailOuvert)} disabled={isSaving}>
                      <Package className="w-4 h-4 mr-1" /> Réceptionner
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => annulerCommande(detailOuvert)}>
                      <XCircle className="w-4 h-4 mr-1" /> Annuler
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}