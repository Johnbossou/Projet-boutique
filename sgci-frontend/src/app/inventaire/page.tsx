'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Play, CheckCircle2, AlertTriangle, Eye, Loader2, ClipboardX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface InventaireLigne {
  id: number;
  quantite_systeme: number;
  quantite_physique: number | null;
  ecart: number | null;
  notes: string | null;
  produit: { id: number; nom: string; categorie?: { nom: string } } | null;
}

interface Inventaire {
  id: number;
  reference: string;
  statut: string;
  notes: string | null;
  total_produits: number;
  ecarts_detectes: number;
  created_at: string;
  user: { id: number; name: string } | null;
  lignes: InventaireLigne[];
}

const STATUT_COLORS: Record<string, string> = {
  en_cours: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  termine: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  valide: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  annule: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const STATUT_LABELS: Record<string, string> = {
  en_cours: 'En cours',
  termine: 'Terminé',
  valide: 'Validé',
  annule: 'Annulé',
};

export default function InventairePage() {
  const [inventaires, setInventaires] = useState<Inventaire[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<Inventaire | null>(null);
  const [comptages, setComptages] = useState<Record<string, number>>({});

  const chargerInventaires = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/inventaires?per_page=50');
      if (res.ok) {
        const data = await res.json();
        setInventaires(data.data ?? []);
      }
    } catch {
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { chargerInventaires(); }, [chargerInventaires]);

  const creerInventaire = async () => {
    try {
      const res = await apiFetch('/inventaires', { method: 'POST', body: JSON.stringify({}) });
      if (res.ok) {
        toast.success('Inventaire créé — comptage prêt');
        chargerInventaires();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Erreur');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const ouvrirDetail = async (inv: Inventaire) => {
    const res = await apiFetch(`/inventaires/${inv.id}`);
    if (res.ok) {
      const data = await res.json();
      setDetail(data);
      setComptages({});
    }
  };

  const soumettreComptage = async () => {
    if (!detail) return;
    const lignesPayload = Object.entries(comptages)
      .filter(([, val]) => val !== undefined && val !== null && val !== 0)
      .map(([ligneId, quantite]) => ({
        inventaire_ligne_id: Number(ligneId),
        quantite_physique: Number(quantite),
      }));

    if (lignesPayload.length === 0) {
      toast.error('Aucune quantité saisie');
      return;
    }

    try {
      const res = await apiFetch(`/inventaires/${detail.id}/compter`, {
        method: 'POST',
        body: JSON.stringify({ lignes: lignesPayload }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Comptage terminé');
        setDetail(data.data);
        chargerInventaires();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Erreur');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const validerInventaire = async () => {
    if (!detail) return;
    try {
      const res = await apiFetch(`/inventaires/${detail.id}/valider`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Inventaire validé — stock ajusté');
        setDetail(data.data);
        chargerInventaires();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Erreur');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Inventaire Physique</h1>
            <p className="text-sm text-muted-foreground">Comptez votre stock et ajustez automatiquement les écarts</p>
          </div>
        </div>
        <Button onClick={creerInventaire} className="bg-gradient-to-r from-orange-500 to-red-500">
          <Play className="w-4 h-4 mr-1" /> Nouvel inventaire
        </Button>
      </header>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Chargement des inventaires…</span>
            </div>
          ) : inventaires.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
                <ClipboardX className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium">Aucun inventaire</p>
              <p className="mt-1 text-sm text-muted-foreground">Cliquez sur « Nouvel inventaire » pour lancer un comptage.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Produits</TableHead>
                  <TableHead className="text-right">Écarts</TableHead>
                  <TableHead>Créé par</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventaires.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.reference}</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[inv.statut] ?? ''}`}>
                        {STATUT_LABELS[inv.statut] ?? inv.statut}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{inv.total_produits}</TableCell>
                    <TableCell className="text-right">
                      {inv.ecarts_detectes > 0 ? (
                        <span className="text-red-600 font-medium flex items-center justify-end gap-1">
                          <AlertTriangle className="w-3 h-3" /> {inv.ecarts_detectes}
                        </span>
                      ) : '0'}
                    </TableCell>
                    <TableCell className="text-sm">{inv.user?.name ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => ouvrirDetail(inv)}>
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

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetail(null)}>
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{detail.reference}</CardTitle>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[detail.statut] ?? ''}`}>
                  {STATUT_LABELS[detail.statut] ?? detail.statut}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Produits :</span> {detail.total_produits}</div>
                <div><span className="text-muted-foreground">Écarts :</span> {detail.ecarts_detectes}</div>
                <div><span className="text-muted-foreground">Créé par :</span> {detail.user?.name ?? '—'}</div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Système</TableHead>
                    {detail.statut === 'en_cours' ? (
                      <TableHead className="text-right">Physique</TableHead>
                    ) : (
                      <>
                        <TableHead className="text-right">Physique</TableHead>
                        <TableHead className="text-right">Écart</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.lignes.map((ligne) => (
                    <TableRow key={ligne.id}>
                      <TableCell>{ligne.produit?.nom ?? '—'}</TableCell>
                      <TableCell className="text-right">{ligne.quantite_systeme}</TableCell>
                      {detail.statut === 'en_cours' ? (
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            className="w-20 text-right ml-auto"
                            placeholder="—"
                            value={comptages[String(ligne.id)] ?? ''}
                            onChange={(e) => setComptages({ ...comptages, [String(ligne.id)]: Number(e.target.value) })}
                          />
                        </TableCell>
                      ) : (
                        <>
                          <TableCell className="text-right">{ligne.quantite_physique ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            {ligne.ecart !== null && ligne.ecart !== 0 ? (
                              <span className={ligne.ecart > 0 ? 'text-green-600' : 'text-red-600'}>
                                {ligne.ecart > 0 ? '+' : ''}{ligne.ecart}
                              </span>
                            ) : '0'}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {detail.statut === 'en_cours' && (
                <Button onClick={soumettreComptage} className="w-full bg-gradient-to-r from-orange-500 to-red-500">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Soumettre le comptage
                </Button>
              )}

              {detail.statut === 'termine' && detail.ecarts_detectes > 0 && (
                <Button onClick={validerInventaire} className="w-full bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Valider et ajuster le stock
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
