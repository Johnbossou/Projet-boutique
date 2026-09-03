'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Download, FileX2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface Devis {
  id: number;
  numero_devis: string;
  date_devis: string;
  date_validite: string;
  montant_total: number;
  statut: string;
  notes: string | null;
  client: { id: number; nom: string } | null;
  user: { id: number; name: string } | null;
  lignes: Array<{
    id: number;
    quantite: number;
    prix_unitaire: number;
    produit: { id: number; nom: string } | null;
  }>;
}

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  accepte: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  refuse: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  expire: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  accepte: 'Accepté',
  refuse: 'Refusé',
  expire: 'Expiré',
};

export default function DevisPage() {
  const [devis, setDevis] = useState<Devis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState('all');

  const chargerDevis = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ per_page: '50' });
      if (filtreStatut !== 'all') params.set('statut', filtreStatut);
      const res = await apiFetch(`/devis?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDevis(data.data ?? []);
      }
    } catch {
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  }, [filtreStatut]);

  useEffect(() => { chargerDevis(); }, [chargerDevis]);

  const telechargerPdf = async (d: Devis) => {
    try {
      const res = await apiFetch(`/devis/${d.id}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${d.numero_devis}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('PDF téléchargé');
      } else {
        toast.error('Erreur lors du téléchargement');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Devis</h1>
          <p className="text-sm text-muted-foreground">
            Proposés à vos clients et téléchargeables en PDF
          </p>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
            <SelectItem value="accepte">Accepté</SelectItem>
            <SelectItem value="refuse">Refusé</SelectItem>
            <SelectItem value="expire">Expiré</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Chargement des devis…</span>
            </div>
          ) : devis.length === 0 ? (
            <EmptyState
              icon={FileX2}
              title={filtreStatut === 'all' ? 'Aucun devis trouvé' : `Aucun devis au statut « ${filtreStatut} »`}
              description="Les devis que vous créez apparaîtront ici. Vous pourrez ensuite les télécharger en PDF."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Validité</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devis.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.numero_devis}</TableCell>
                    <TableCell>{d.client?.nom ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">{d.montant_total.toLocaleString('fr-FR')} XOF</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[d.statut] ?? ''}`}>
                        {STATUT_LABELS[d.statut] ?? d.statut}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.date_validite ? new Date(d.date_validite).toLocaleDateString('fr-FR') : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(d.date_devis).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => telechargerPdf(d)} title="Télécharger PDF">
                        <Download className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
