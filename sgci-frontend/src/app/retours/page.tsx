'use client';

import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, CheckCircle2, XCircle, Eye, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface RetourLigne {
  id: number;
  quantite_retournee: number;
  prix_unitaire: number;
  montant_retourne: number;
  produit: { id: number; nom: string } | null;
}

interface Retour {
  id: number;
  type: string;
  motif: string;
  motif_detail: string | null;
  montant_rembourse: number;
  statut: string;
  notes: string | null;
  created_at: string;
  user: { id: number; name: string } | null;
  vente: { id: number; numero_vente: string; montant_total: number } | null;
  lignes: RetourLigne[];
}

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  valide: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  refuse: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const MOTIF_LABELS: Record<string, string> = {
  defectueux: 'Produit défectueux',
  erreur_commande: 'Erreur de commande',
  insatisfait: 'Insatisfaction client',
  autre: 'Autre',
};

export default function RetoursPage() {
  const [retours, setRetours] = useState<Retour[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState('all');
  const [detailOuvert, setDetailOuvert] = useState<Retour | null>(null);

  const chargerRetours = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ per_page: '50' });
      if (filtreStatut !== 'all') params.set('statut', filtreStatut);
      const res = await apiFetch(`/retours?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRetours(data.data ?? []);
      }
    } catch {
      toast.error('Erreur lors du chargement des retours');
    } finally {
      setIsLoading(false);
    }
  }, [filtreStatut]);

  useEffect(() => { chargerRetours(); }, [chargerRetours]);

  const validerRetour = async (retour: Retour) => {
    try {
      const res = await apiFetch(`/retours/${retour.id}/valider`, { method: 'POST' });
      if (res.ok) {
        toast.success('Retour validé — stock remis à jour');
        chargerRetours();
        setDetailOuvert(null);
      } else {
        const data = await res.json();
        toast.error(data.message || 'Erreur lors de la validation');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const refuserRetour = async (retour: Retour) => {
    try {
      const res = await apiFetch(`/retours/${retour.id}/refuser`, { method: 'POST' });
      if (res.ok) {
        toast.success('Retour refusé');
        chargerRetours();
        setDetailOuvert(null);
      } else {
        const data = await res.json();
        toast.error(data.message || 'Erreur lors du refus');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const totalRembourse = retours.filter(r => r.statut === 'valide').reduce((s, r) => s + r.montant_rembourse, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <RotateCcw className="w-6 h-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Retours & Remboursements</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total retours</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{retours.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">En attente</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-600">{retours.filter(r => r.statut === 'en_attente').length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Remboursé</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{totalRembourse.toLocaleString('fr-FR')} XOF</p></CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
            <SelectItem value="valide">Validé</SelectItem>
            <SelectItem value="refuse">Refusé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-center text-muted-foreground">Chargement…</p>
          ) : retours.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Aucun retour trouvé</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Réf.</TableHead>
                  <TableHead>Vente</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {retours.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">RET-{String(r.id).padStart(5, '0')}</TableCell>
                    <TableCell>{r.vente?.numero_vente ?? '—'}</TableCell>
                    <TableCell className="capitalize">{r.type}</TableCell>
                    <TableCell>{MOTIF_LABELS[r.motif] ?? r.motif}</TableCell>
                    <TableCell className="text-right font-mono">{r.montant_rembourse.toLocaleString('fr-FR')} XOF</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[r.statut] ?? ''}`}>
                        {r.statut}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setDetailOuvert(r)}>
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

      {detailOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetailOuvert(null)}>
          <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto mx-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Retour RET-{String(detailOuvert.id).padStart(5, '0')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Vente :</span> {detailOuvert.vente?.numero_vente ?? '—'}</div>
                <div><span className="text-muted-foreground">Type :</span> <span className="capitalize">{detailOuvert.type}</span></div>
                <div><span className="text-muted-foreground">Motif :</span> {MOTIF_LABELS[detailOuvert.motif] ?? detailOuvert.motif}</div>
                <div><span className="text-muted-foreground">Montant :</span> <span className="font-bold">{detailOuvert.montant_rembourse.toLocaleString('fr-FR')} XOF</span></div>
                <div><span className="text-muted-foreground">Créé par :</span> {detailOuvert.user?.name ?? '—'}</div>
                <div><span className="text-muted-foreground">Date :</span> {new Date(detailOuvert.created_at).toLocaleString('fr-FR')}</div>
              </div>

              {detailOuvert.motif_detail && (
                <p className="text-sm text-muted-foreground italic">« {detailOuvert.motif_detail} »</p>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Lignes retournées :</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Qté</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailOuvert.lignes.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.produit?.nom ?? '—'}</TableCell>
                        <TableCell className="text-right">{l.quantite_retournee}</TableCell>
                        <TableCell className="text-right font-mono">{l.montant_retourne.toLocaleString('fr-FR')} XOF</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {detailOuvert.statut === 'en_attente' && (
                <div className="flex gap-3 pt-2">
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => validerRetour(detailOuvert)}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Valider
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={() => refuserRetour(detailOuvert)}>
                    <XCircle className="w-4 h-4 mr-1" /> Refuser
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
