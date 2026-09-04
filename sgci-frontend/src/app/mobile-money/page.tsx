'use client';

import { useState, useCallback } from 'react';
import {
  Loader2,
  Smartphone,
  Send,
  XCircle,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Phone,
  CreditCard,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface MobileMoneyPayment {
  id: number;
  numero_paiement: string;
  montant: number;
  statut: string;
  provider: string;
  phone_number: string;
  description?: string;
  created_at: string;
  transaction?: unknown;
}

type Provider = 'auto' | 'mtn' | 'orange';

const PROVIDER_LABELS: Record<string, string> = {
  mtn: 'MTN MoMo',
  orange: 'Orange Money',
};

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 animate-pulse',
  reussi: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  echoue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  annule: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  reussi: 'Réussi',
  echoue: 'Échoué',
  annule: 'Annulé',
};

const PROVIDER_BADGE_COLORS: Record<string, string> = {
  mtn: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800',
};

export default function MobileMoneyPage() {
  const [payments, setPayments] = useState<MobileMoneyPayment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [actionEnCours, setActionEnCours] = useState<number | null>(null);

  const [montant, setMontant] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [provider, setProvider] = useState<Provider>('auto');
  const [description, setDescription] = useState('');
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const detectProvider = useCallback(async (phone: string) => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 8) {
      setDetectedProvider(null);
      return;
    }

    setIsDetecting(true);
    try {
      const res = await apiFetch('/mobile-money/detect-provider', {
        method: 'POST',
        body: JSON.stringify({ phone_number: cleaned }),
      });
      if (res.ok) {
        const data = await res.json();
        setDetectedProvider(data.provider ?? null);
      } else {
        setDetectedProvider(null);
      }
    } catch {
      setDetectedProvider(null);
    } finally {
      setIsDetecting(false);
    }
  }, []);

  const handlePhoneBlur = useCallback(() => {
    if (provider === 'auto' && phoneNumber) {
      detectProvider(phoneNumber);
    }
  }, [provider, phoneNumber, detectProvider]);

  const handleProviderChange = (value: string) => {
    const p = value as Provider;
    setProvider(p);
    if (p !== 'auto') {
      setDetectedProvider(null);
    }
  };

  const resetForm = () => {
    setMontant('');
    setPhoneNumber('');
    setProvider('auto');
    setDescription('');
    setDetectedProvider(null);
  };

  const initiatePayment = async () => {
    const montantNum = parseFloat(montant);
    if (!montantNum || montantNum < 100) {
      toast.error('Le montant minimum est 100 FCFA');
      return;
    }
    if (!phoneNumber.trim()) {
      toast.error('Veuillez saisir un numéro de téléphone');
      return;
    }

    const effectiveProvider = provider === 'auto' ? detectedProvider : provider;

    setIsSending(true);
    try {
      const body: Record<string, unknown> = {
        amount: montantNum,
        phone_number: phoneNumber.trim(),
        description: description.trim() || undefined,
      };
      if (effectiveProvider) {
        body.provider = effectiveProvider;
      }

      const res = await apiFetch('/mobile-money/initiate', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Erreur HTTP ${res.status}`);
      }

      const data = await res.json();
      const paiement: MobileMoneyPayment = data.data?.paiement ?? data.paiement;

      if (paiement) {
        setPayments((prev) => [paiement, ...prev]);
      }

      toast.success(
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span>Paiement initié — {paiement?.numero_paiement ?? '#' + paiement?.id}</span>
        </div>
      );

      resetForm();
    } catch (error) {
      toast.error(
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span>{error instanceof Error ? error.message : "Erreur lors de l'initiation"}</span>
        </div>
      );
    } finally {
      setIsSending(false);
    }
  };

  const checkStatus = async (payment: MobileMoneyPayment) => {
    setActionEnCours(payment.id);
    try {
      const res = await apiFetch(`/mobile-money/status/${payment.id}`);
      if (!res.ok) {
        throw new Error(`Erreur HTTP ${res.status}`);
      }
      const data = await res.json();
      const updatedStatut = data.data?.paiement?.statut ?? data.paiement?.statut;

      setPayments((prev) =>
        prev.map((p) =>
          p.id === payment.id ? { ...p, statut: updatedStatut ?? p.statut } : p
        )
      );

      toast.success(`Statut mis à jour : ${STATUT_LABELS[updatedStatut] ?? updatedStatut}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la vérification');
    } finally {
      setActionEnCours(null);
    }
  };

  const cancelPayment = async (payment: MobileMoneyPayment) => {
    if (!confirm(`Annuler le paiement ${payment.numero_paiement} ?`)) return;

    setActionEnCours(payment.id);
    try {
      const res = await apiFetch(`/mobile-money/cancel/${payment.id}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Erreur HTTP ${res.status}`);
      }

      setPayments((prev) =>
        prev.map((p) =>
          p.id === payment.id ? { ...p, statut: 'annule' } : p
        )
      );

      toast.success('Paiement annulé');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'annulation");
    } finally {
      setActionEnCours(null);
    }
  };

  const formatMontant = (m: number) => m.toLocaleString('fr-FR') + ' FCFA';

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mobile Money</h1>
            <p className="text-sm text-muted-foreground">
              Paiements MTN MoMo &amp; Orange Money
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
          <Smartphone className="w-3 h-3 mr-1" />
          {payments.length} paiement{payments.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Formulaire d'initiation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="w-4 h-4 text-green-500" />
            Initier un paiement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="montant">
                Montant <span className="text-destructive">*</span>
              </Label>
              <Input
                id="montant"
                type="number"
                min={100}
                step={100}
                placeholder="Ex: 5000"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                disabled={isSending}
              />
              <p className="text-xs text-muted-foreground">Minimum 100 FCFA</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Numéro de téléphone <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Ex: 6XXXXXXXX"
                  className="pl-9"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  onBlur={handlePhoneBlur}
                  disabled={isSending}
                />
              </div>
              {provider === 'auto' && isDetecting && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Détection du provider…
                </p>
              )}
              {provider === 'auto' && detectedProvider && !isDetecting && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Provider détecté : {PROVIDER_LABELS[detectedProvider] ?? detectedProvider}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={handleProviderChange} disabled={isSending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-détection</SelectItem>
                  <SelectItem value="mtn">MTN MoMo</SelectItem>
                  <SelectItem value="orange">Orange Money</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Input
                id="description"
                placeholder="Ex: Paiement fournisseur"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSending}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={initiatePayment}
              disabled={isSending}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              {isSending ? 'Envoi en cours…' : 'Initier le paiement'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des paiements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-500" />
              Paiements initiés
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {payments.length} résultat{payments.length !== 1 ? 's' : ''}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <EmptyState
              icon={Smartphone}
              title="Aucun paiement"
              description="Initiez un paiement Mobile Money pour le voir apparaître ici."
              compact
            />
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => {
                const isPending = payment.statut === 'en_attente';
                const isActionable = actionEnCours !== payment.id;

                return (
                  <div
                    key={payment.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/60 dark:border-slate-700/60"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                          {payment.numero_paiement}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            PROVIDER_BADGE_COLORS[payment.provider] ??
                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }
                        >
                          {PROVIDER_LABELS[payment.provider] ?? payment.provider}
                        </Badge>
                        <Badge
                          className={
                            STATUT_COLORS[payment.statut] ??
                            'bg-slate-100 text-slate-700'
                          }
                        >
                          {STATUT_LABELS[payment.statut] ?? payment.statut}
                        </Badge>
                      </div>
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          {formatMontant(payment.montant)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {payment.phone_number}
                        </span>
                        {payment.description && (
                          <span className="text-xs italic">{payment.description}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isPending && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => checkStatus(payment)}
                          disabled={!isActionable}
                          title="Vérifier le statut"
                        >
                          {actionEnCours === payment.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 text-blue-500" />
                          )}
                        </Button>
                      )}
                      {isPending && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelPayment(payment)}
                          disabled={!isActionable}
                          title="Annuler le paiement"
                        >
                          {actionEnCours === payment.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </Button>
                      )}
                      {!isPending && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => checkStatus(payment)}
                          disabled={!isActionable}
                          title="Vérifier le statut"
                        >
                          {actionEnCours === payment.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 text-slate-400" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
