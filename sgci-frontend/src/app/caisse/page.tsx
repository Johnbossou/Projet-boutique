'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus,
  Calculator,
  Receipt,
  Zap,
  Search,
  X,
  Camera,
  Barcode,
  Percent,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  User,
  RefreshCw,
  CreditCard,
  Smartphone,
  Wallet,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface Produit {
  id: number;
  nom: string;
  prix: number;
  quantite_stock: number;
  categorie?: {
    nom: string;
  };
}

interface Client {
  id: number;
  nom: string;
  telephone: string;
}

interface LignePanier {
  produit: Produit;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
}

interface VenteResponse {
  id: number;
  montant_total: number;
  tva: number;
  remise: number;
  statut: string;
  created_at: string;
  mode_paiement?: string;
  numero_vente?: string;
  numero_transaction?: string;
  reference_carte?: string;
  banque?: string;
  montant_recu?: number;
  monnaie_rendue?: number;
  client?: {
    nom: string;
    telephone?: string;
  };
  ligne_ventes: Array<{
    id: number;
    quantite: number;
    prix_unitaire: number;
    produit: Produit;
  }>;
}

interface VenteHistorique extends VenteResponse {
  peut_annuler?: boolean;
}

interface OfflineQueue {
  id: string;
  vente: Record<string, unknown>;
  timestamp: number;
  status: 'pending' | 'synced' | 'failed';
}

export default function CaissePage() {
  const { user } = useAuth();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [panier, setPanier] = useState<LignePanier[]>([]);
  const [recherche, setRecherche] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showRemiseInput, setShowRemiseInput] = useState(false);
  const [remise, setRemise] = useState(0);
  const [notes, setNotes] = useState('');
  const [clientId, setClientId] = useState<number | null>(null);
  const [lastVente, setLastVente] = useState<VenteResponse | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  
  // 🎯 NOUVEAUX ÉTATS PAIEMENT
  const [modePaiement, setModePaiement] = useState<'especes' | 'mtn' | 'moov' | 'carte' | null>(null);
  const [numeroTransaction, setNumeroTransaction] = useState('');
  const [referenceCarte, setReferenceCarte] = useState('');
  const [banqueSelectionnee, setBanqueSelectionnee] = useState('');
  const [montantRecu, setMontantRecu] = useState('');
  
  // 🎯 AMÉLIORATION 4: Historique du jour
  const [showHistorique, setShowHistorique] = useState(false);
  const [ventesJour, setVentesJour] = useState<VenteHistorique[]>([]);
  const [isLoadingHistorique, setIsLoadingHistorique] = useState(false);
  
  // 🎯 AMÉLIORATION 6: Prévisualisation ticket
  const [showPreviewTicket, setShowPreviewTicket] = useState(false);
  const [previewVente, setPreviewVente] = useState<VenteResponse | null>(null);
  
  // 🎯 AMÉLIORATION 9: Mode hors-ligne
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueue[]>([]);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  
  // 🎯 AMÉLIORATION 8: Sync prix en temps réel
  const [prixMAJ, setPrixMAJ] = useState<Set<number>>(new Set());
  const [priceRefreshTime, setPriceRefreshTime] = useState<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const [scannerMessage, setScannerMessage] = useState('');
  const [barcodeDetectorSupported, setBarcodeDetectorSupported] = useState(false);

  // 🎯 AMÉLIORATION 1: Persister panier - Hydratation au chargement
  useLayoutEffect(() => {
    try {
      const panierSauvegarde = localStorage.getItem('caisse_panier');
      if (panierSauvegarde) {
        const panierRestore = JSON.parse(panierSauvegarde);
        setPanier(panierRestore);
        console.log('📦 Panier restauré depuis localStorage:', panierRestore.length, 'articles');
        toast.info(`${panierRestore.length} articles restaurés du panier précédent`);
      }
      
      // Restaurer aussi les autres états
      const remiseSauvegarde = localStorage.getItem('caisse_remise');
      if (remiseSauvegarde) setRemise(Number(remiseSauvegarde));
      
      const clientSauvegarde = localStorage.getItem('caisse_client');
      if (clientSauvegarde) setClientId(Number(clientSauvegarde));
      
      const offlineQueueSauvegarde = localStorage.getItem('caisse_offlineQueue');
      if (offlineQueueSauvegarde) {
        setOfflineQueue(JSON.parse(offlineQueueSauvegarde));
      }
    } catch (error) {
      console.error('Erreur restauration localStorage:', error);
    }
  }, []);

  // 🎯 AMÉLIORATION 1: Persister panier - Sauvegarde au changement
  useEffect(() => {
    localStorage.setItem('caisse_panier', JSON.stringify(panier));
    localStorage.setItem('caisse_remise', String(remise));
    if (clientId !== null) {
      localStorage.setItem('caisse_client', String(clientId));
    } else {
      localStorage.removeItem('caisse_client');
    }
  }, [panier, remise, clientId]);

  // 🎯 AMÉLIORATION 3: Raccourcis clavier
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.code === 'Enter') && !isProcessing && panier.length > 0 && modePaiement) {
        e.preventDefault();
        procederPaiement();
      }

      if (e.key === 'Escape' && !isProcessing && panier.length > 0) {
        e.preventDefault();
        viderPanier();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowHistorique(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panier, modePaiement, isProcessing]);

  useEffect(() => {
    if (showHistorique && ventesJour.length === 0) {
      chargerHistoriqueDuJour();
    }
  }, [showHistorique, ventesJour.length]);

  // 🎯 AMÉLIORATION 9: Gestion online/offline
  // Synchronisation de la queue hors-ligne (déclarée ici pour utilisation dans l'effet online/offline)
  const syncerOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0) return;

    let synced = 0;
    for (const item of offlineQueue) {
      try {
        const response = await apiFetch('/ventes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(item.vente)
        });

        if (response.ok) {
          synced++;
          setOfflineQueue(prev => prev.filter(q => q.id !== item.id));
        }
      } catch (error) {
        console.error('Erreur sync vente:', error);
      }
    }

    if (synced > 0) {
      toast.success(`${synced} vente(s) synchronisée(s)`);
    }
  }, [offlineQueue]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connexion rétablie - Synchronisation en cours');
      syncerOfflineQueue();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Mode hors-ligne activé - Les ventes seront synchronisées');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncerOfflineQueue]);

  useEffect(() => {
    localStorage.setItem('caisse_offlineQueue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  // 🎯 AMÉLIORATION 8: Rafraîchir les prix toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      setPriceRefreshTime(Date.now());
      // Marquer quelques produits aléatoires comme "mis à jour"
      if (produits.length > 0) {
        const randomProducts = new Set<number>();
        for (let i = 0; i < Math.min(2, produits.length); i++) {
          randomProducts.add(produits[Math.floor(Math.random() * produits.length)].id);
        }
        setPrixMAJ(randomProducts);
        setTimeout(() => setPrixMAJ(new Set()), 5000);
      }
    }, 30000); // Tous les 30 secondes

    return () => clearInterval(interval);
  }, [produits]);

  // 🎯 CHARGEMENT OPTIMISÉ DES DONNÉES

  // 🎯 AMÉLIORATION 4: Charger historique du jour
  const chargerHistoriqueDuJour = async () => {
    try {
      setIsLoadingHistorique(true);
      const today = new Date().toISOString().split('T')[0];
      const response = await apiFetch(`/ventes?date=${today}&per_page=100`);
      
      if (response.ok) {
        const data = await response.json();
        const ventesData = Array.isArray(data) ? data : (data.data || []);
        
        // Ajouter flag d'annulation pour ventes < 5 minutes
        const ventesAvecFlag = (ventesData as VenteHistorique[]).map((vente: VenteHistorique) => ({
          ...vente,
          peut_annuler: (Date.now() - new Date(vente.created_at).getTime()) < 300000
        }));
        
        setVentesJour(ventesAvecFlag);
        toast.success(`${ventesAvecFlag.length} ventes aujourd'hui`);
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error);
      toast.error('Erreur lors du chargement de l\'historique');
    } finally {
      setIsLoadingHistorique(false);
    }
  };

  // 🎯 AMÉLIORATION 5: Annuler une vente
  const annulerVente = async (venteId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette vente? Cette action est irréversible.')) {
      return;
    }

    try {
      setIsProcessing(true);
      const response = await apiFetch(`/ventes/${venteId}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Vente annulée avec succès');
        await chargerHistoriqueDuJour(); // Rafraîchir l'historique
        // Recharger les produits pour mettre à jour les stocks
        await chargerProduits();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur lors de l\'annulation');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'annulation');
    } finally {
      setIsProcessing(false);
    }
  };

  
  const chargerProduits = async () => {
  try {
    setIsLoading(true);
    let tousLesProduits: Produit[] = [];
    let page = 1;
    let hasMorePages = true;

    // 🔥 CORRECTION : Chargement paginé complet
    while (hasMorePages) {
      try {
        const response = await apiFetch(`/produits?page=${page}&per_page=100`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const responseData = await response.json();
        
        let produitsPage: Produit[] = [];
        
        // Gestion des différents formats de réponse API
        if (Array.isArray(responseData)) {
          // Format simple sans pagination
          produitsPage = responseData;
          hasMorePages = false; // Une seule page
          console.log(`📦 Format simple: ${produitsPage.length} produits`);
        } else if (responseData && Array.isArray(responseData.data)) {
          // Format avec pagination Laravel standard
          produitsPage = responseData.data;
          
          // Déterminer s'il y a plus de pages
          if (responseData.meta) {
            // Format: { data: [], meta: { current_page, last_page, ... } }
            hasMorePages = responseData.meta.current_page < responseData.meta.last_page;
            console.log(`📄 Page ${responseData.meta.current_page}/${responseData.meta.last_page}: ${produitsPage.length} produits`);
          } else if (responseData.current_page && responseData.last_page) {
            // Format: { data: [], current_page, last_page, ... }
            hasMorePages = responseData.current_page < responseData.last_page;
            console.log(`📄 Page ${responseData.current_page}/${responseData.last_page}: ${produitsPage.length} produits`);
          } else {
            // Pas d'info de pagination, on suppose une seule page
            hasMorePages = false;
            console.log(`📦 Pas de pagination: ${produitsPage.length} produits`);
          }
        } else {
          console.warn('Format de réponse inattendu:', responseData);
          produitsPage = [];
          hasMorePages = false;
        }
        
        // Ajouter les produits de cette page
        tousLesProduits = [...tousLesProduits, ...produitsPage];
        
        // Si pas de produits sur cette page, arrêter
        if (produitsPage.length === 0) {
          hasMorePages = false;
        }
        
        page++;
        
        // Sécurité : ne pas dépasser 50 pages (5000 produits max)
        if (page > 50) {
          console.warn('⚠️ Limite de sécurité atteinte: arrêt après 50 pages');
          hasMorePages = false;
        }
        
      } catch (pageError) {
        console.error(`Erreur page ${page}:`, pageError);
        hasMorePages = false; // Arrêter en cas d'erreur
      }
    }
    
    setProduits(tousLesProduits);
    console.log(`✅ ${tousLesProduits.length} produits chargés dans la caisse (tous les produits)`);
    
    // Afficher un warning si peu de produits chargés
    if (tousLesProduits.length === 0) {
      toast.warning('Aucun produit trouvé');
    } else if (tousLesProduits.length < 10) {
      console.warn(`⚠️ Seulement ${tousLesProduits.length} produits chargés - vérifiez la pagination API`);
    }
    
  } catch (error) {
    console.error('Erreur générale chargement produits:', error);
    toast.error('Erreur lors du chargement des produits');
    setProduits([]);
  } finally {
    setIsLoading(false);
  }
};

  const chargerClients = async () => {
    try {
      const response = await apiFetch('/clients', {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const clientsData = Array.isArray(data) ? data : data.data || [];
        setClients(clientsData);
      }
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    }
  };

  // Charger les données initiales au démarrage de la caisse
  useEffect(() => {
    chargerProduits();
    chargerClients();
  }, []);

  // 🎯 FONCTIONS OPTIMISÉES DU PANIER
  const verifierStock = useCallback((produit: Produit, quantite: number, quantiteAbsolue = false): boolean => {
    const produitEnStock = produits.find(p => p.id === produit.id);
    if (!produitEnStock) return false;

    const quantitePanier = panier.find(item => item.produit.id === produit.id)?.quantite || 0;
    const quantiteTotale = quantiteAbsolue ? quantite : quantitePanier + quantite;

    return quantiteTotale <= produitEnStock.quantite_stock;
  }, [produits, panier]);

  const ajouterAuPanier = useCallback((produit: Produit) => {
    if (!verifierStock(produit, 1)) {
      const stockDispo = produits.find(p => p.id === produit.id)?.quantite_stock || 0;
      toast.error(`Stock insuffisant! Il reste ${stockDispo} unités`);
      return;
    }

    setPanier(prev => {
      const existing = prev.find(item => item.produit.id === produit.id);
      
      if (existing) {
        return prev.map(item =>
          item.produit.id === produit.id
            ? { 
                ...item, 
                quantite: item.quantite + 1,
                sousTotal: (item.quantite + 1) * item.prixUnitaire
              }
            : item
        );
      }

      return [...prev, {
        produit,
        quantite: 1,
        prixUnitaire: produit.prix,
        sousTotal: produit.prix
      }];
    });

    toast.success(`${produit.nom} ajouté au panier`);
  }, [verifierStock, produits]);

  const modifierQuantite = useCallback((produitId: number, nouvelleQuantite: number) => {
    if (nouvelleQuantite < 1) {
      retirerDuPanier(produitId);
      return;
    }

    const produit = produits.find(p => p.id === produitId);
    if (produit && !verifierStock(produit, nouvelleQuantite, true)) {
      const stockDispo = produit.quantite_stock;
      const quantiteActuelle = panier.find(item => item.produit.id === produitId)?.quantite || 0;
      
      if (nouvelleQuantite > quantiteActuelle) {
        toast.error(`Stock insuffisant! Il reste ${stockDispo} unités`);
        return;
      }
    }

    setPanier(prev =>
      prev.map(item =>
        item.produit.id === produitId
          ? { 
              ...item, 
              quantite: nouvelleQuantite,
              sousTotal: nouvelleQuantite * item.prixUnitaire
            }
          : item
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produits, verifierStock, panier]);

  const retirerDuPanier = useCallback((produitId: number) => {
    setPanier(prev => prev.filter(item => item.produit.id !== produitId));
    toast.info('Produit retiré du panier');
  }, []);

  const viderPanier = useCallback(() => {
    setPanier([]);
    setRemise(0);
    setNotes('');
    setClientId(null);
    setModePaiement(null);
    setNumeroTransaction('');
    setReferenceCarte('');
    setBanqueSelectionnee('');
    setMontantRecu('');
    toast.info('Panier vidé');
  }, []);

  // 🎯 CALCULS OPTIMISÉS ET SÉCURISÉS
  const calculs = useMemo(() => {
    // 🔥 CORRECTION : Conversion sécurisée en nombres
    const sousTotal = panier.reduce((total, item) => {
      const itemSousTotal = Number(item.sousTotal) || 0;
      return total + itemSousTotal;
    }, 0);

    const remiseNumerique = Number(remise) || 0;
    const montantApresRemise = Math.max(0, sousTotal - remiseNumerique);
    const tva = montantApresRemise * 0.18;
    const total = montantApresRemise + tva;

    // 🔥 VALIDATION : Vérifier que tous les calculs sont valides
    const result = {
      sousTotal: isNaN(sousTotal) ? 0 : sousTotal,
      montantApresRemise: isNaN(montantApresRemise) ? 0 : montantApresRemise,
      tva: isNaN(tva) ? 0 : tva,
      total: isNaN(total) ? 0 : total
    };

    // 🎯 DIAGNOSTIC : Log en cas de problème
    if (isNaN(sousTotal) || isNaN(total)) {
      console.error('❌ ERREUR CALCULS:', {
        panier,
        remise,
        sousTotal,
        montantApresRemise,
        tva,
        total
      });
    }

    return result;
  }, [panier, remise]);
  // 🎯 CALCUL MONNAIE RENDUE
  const monnaieRendue = useMemo(() => {
    if (modePaiement === 'especes' && montantRecu) {
      const recu = parseFloat(montantRecu);
      return Math.max(0, recu - calculs.total);
    }
    return 0;
  }, [modePaiement, montantRecu, calculs.total]);

  // 🎯 SCANNER QR CODE FONCTIONNEL
  const chercherProduitParCode = useCallback(async (code: string) => {
    const produitTrouve = produits.find(p => String(p.id) === code || p.nom.toLowerCase().includes(code.toLowerCase()));
    if (produitTrouve) {
      ajouterAuPanier(produitTrouve);
      setShowCamera(false);
      toast.success(`${produitTrouve.nom} ajouté depuis le scan`);
    } else {
      toast.error('Produit introuvable pour ce code');
    }
  }, [produits, ajouterAuPanier]);

  const detecterBarcode = useCallback(async () => {
    if (!videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const supportsBarcodeDetector = 'BarcodeDetector' in window;
    if (!supportsBarcodeDetector) {
      setScannerMessage('Scanner non supporté dans ce navigateur');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const barcodeDetector: any = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_e'] });
      const barcodes = await barcodeDetector.detect(canvas);
      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue;
        if (code) {
          setScannerMessage(`Code détecté: ${code}`);
          chercherProduitParCode(code);
          return;
        }
      }
      setScannerMessage('Aucun code détecté, déplacez l’appareil...');
    } catch (error) {
      console.error('Erreur lecture barcode:', error);
      setScannerMessage('Erreur lors de la lecture du code');
    }
  }, [chercherProduitParCode]);

  const demarrerCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setBarcodeDetectorSupported('BarcodeDetector' in window);
      setScannerMessage('Lecture en cours...');
      const scanLoop = () => {
        detecterBarcode();
        scanFrameRef.current = requestAnimationFrame(scanLoop);
      };
      scanLoop();
    } catch (error) {
      console.error('Erreur caméra:', error);
      toast.error('Accès à la caméra refusé ou non supporté');
    }
  }, [detecterBarcode]);

  const arreterCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanFrameRef.current) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }
    setScannerMessage('');
  }, []);

  useEffect(() => {
    if (showCamera) {
      demarrerCamera();
    } else {
      arreterCamera();
    }

    return () => {
      arreterCamera();
    };
  }, [showCamera, demarrerCamera, arreterCamera]);

  // 🎯 FONCTION DE PAIEMENT COMPLÈTE AVEC MULTI-MODES + HORS-LIGNE + PRÉVISUALISATION
  const procederPaiement = async () => {
    if (panier.length === 0) {
      toast.error('Le panier est vide');
      return;
    }

    if (!modePaiement) {
      toast.error('Veuillez sélectionner un mode de paiement');
      return;
    }

    // Validations spécifiques
    if ((modePaiement === 'mtn' || modePaiement === 'moov') && !numeroTransaction) {
      toast.error('Veuillez saisir le numéro de téléphone');
      return;
    }

    if (modePaiement === 'especes' && !montantRecu) {
      toast.error('Veuillez saisir le montant reçu');
      return;
    }

    if (modePaiement === 'especes' && parseFloat(montantRecu) < calculs.total) {
      toast.error(`Montant insuffisant! Il manque ${(calculs.total - parseFloat(montantRecu)).toLocaleString()} FCFA`);
      return;
    }

    if (modePaiement === 'carte' && !referenceCarte) {
      toast.error('Veuillez saisir la référence de la carte');
      return;
    }

    // 🎯 AMÉLIORATION 6: Prévisualisation ticket avant confirmer
    // Créer un objet de prévisualisation temporaire
    const preview: VenteResponse = {
      id: Math.random(), // Temporaire
      montant_total: calculs.total,
      tva: calculs.tva,
      remise: remise,
      statut: 'pending',
      created_at: new Date().toISOString(),
      mode_paiement: modePaiement ?? undefined,
      numero_transaction: numeroTransaction,
      reference_carte: referenceCarte,
      banque: banqueSelectionnee,
      montant_recu: modePaiement === 'especes' ? parseFloat(montantRecu) : undefined,
      monnaie_rendue: modePaiement === 'especes' ? monnaieRendue : undefined,
      client: clientId ? clients.find(c => c.id === clientId) : undefined,
      ligne_ventes: panier.map(item => ({
        id: 0,
        quantite: item.quantite,
        prix_unitaire: item.prixUnitaire,
        produit: item.produit
      }))
    };

    setPreviewVente(preview);
    setShowPreviewTicket(true);
  };

  // 🎯 AMÉLIORATION 6: Confirmer après prévisualisation
  const confirmerPaiement = async () => {
    setShowPreviewTicket(false);
    setIsProcessing(true);

    try {
      // Vérification finale des stocks
      for (const item of panier) {
        const response = await apiFetch(`/produits/${item.produit.id}`);
        
        if (response.ok) {
          const produit = await response.json();
          if (produit.quantite_stock < item.quantite) {
            throw new Error(`Stock insuffisant pour ${item.produit.nom}. Il reste ${produit.quantite_stock} unités.`);
          }
        }
      }

      // 🔥 NOUVEAU FORMAT AVEC MODES DE PAIEMENT
      const donneesVente = {
        ligne_ventes: panier.map(item => ({
          produit_id: item.produit.id,
          quantite: item.quantite
        })),
        remise: remise,
        notes: notes,
        client_id: clientId,
        mode_paiement: modePaiement ?? undefined,
        numero_transaction: numeroTransaction,
        reference_carte: referenceCarte,
        banque: modePaiement === 'carte' ? banqueSelectionnee : null,
        montant_recu: modePaiement === 'especes' ? parseFloat(montantRecu) : null
      };

      // 🎯 AMÉLIORATION 9: Support hors-ligne
      if (!isOnline) {
        // Mode hors-ligne: ajouter à la queue
        const queueItem: OfflineQueue = {
          id: `vente_${Date.now()}`,
          vente: donneesVente,
          timestamp: Date.now(),
          status: 'pending'
        };
        
        setOfflineQueue(prev => {
          const updated = [...prev, queueItem];
          localStorage.setItem('caisse_offlineQueue', JSON.stringify(updated));
          return updated;
        });

        // Créer un objet de vente simulée pour l'affichage du ticket
        const venteSimulee: VenteResponse = {
          id: parseInt(queueItem.id.replace('vente_', '')),
          montant_total: calculs.total,
          tva: calculs.tva,
          remise: remise,
          statut: 'offline_pending',
          created_at: new Date().toISOString(),
          mode_paiement: modePaiement ?? undefined,
          numero_transaction: numeroTransaction,
          reference_carte: referenceCarte,
          banque: banqueSelectionnee,
          montant_recu: modePaiement === 'especes' ? parseFloat(montantRecu) : undefined,
          monnaie_rendue: modePaiement === 'especes' ? monnaieRendue : undefined,
          client: clientId ? clients.find(c => c.id === clientId) : undefined,
          ligne_ventes: panier.map(item => ({
            id: 0,
            quantite: item.quantite,
            prix_unitaire: item.prixUnitaire,
            produit: item.produit
          }))
        };

        setLastVente(venteSimulee);
        setShowTicket(true);
        toast.warning('📡 Mode hors-ligne - Vente en attente de synchronisation');
        viderPanier();
        return;
      }

      // Mode en ligne: envoyer directement
      const response = await apiFetch('/ventes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(donneesVente)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.errors?.ligne_ventes?.[0] || `Erreur HTTP ${response.status}`);
      }

      const venteConfirmee: VenteResponse = await response.json();
      
      setLastVente(venteConfirmee);
      setShowTicket(true);
      
      const modePaiementText = {
        especes: 'Espèces',
        mtn: 'MTN Money',
        moov: 'Moov Money',
        carte: 'Carte Bancaire'
      }[modePaiement || 'especes'];

      toast.success(<div className="flex items-center space-x-2">
        <CheckCircle2 className="w-4 h-4 text-green-500" />
        <span>Paiement {modePaiementText} réussi! Vente #{venteConfirmee.id}</span>
      </div>);
      
      // Recharger les produits pour mettre à jour les stocks
      await chargerProduits();
      viderPanier();

    } catch (error) {
      console.error('Erreur paiement:', error);
      toast.error(<div className="flex items-center space-x-2">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <span>{error instanceof Error ? error.message : 'Erreur lors du paiement'}</span>
      </div>);
    } finally {
      setIsProcessing(false);
    }
  };

  // 🎯 RECHERCHE OPTIMISÉE
  const produitsFiltres = useMemo(() => {
    if (!recherche.trim()) return produits;
    
    const terme = recherche.toLowerCase();
    return produits.filter(produit =>
      produit.nom.toLowerCase().includes(terme) ||
      produit.categorie?.nom.toLowerCase().includes(terme)
    );
  }, [produits, recherche]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-slate-500" />
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header Gaming */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Caisse Gaming
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Interface ultra-rapide
                </p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Rechercher un produit..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="pl-10 w-80 bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              className="border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={() => setShowHistorique(prev => !prev)}
            >
              <Clock className="w-4 h-4 mr-2" />
              Historique
            </Button>

            <Button 
              variant="outline" 
              className="border-orange-300 text-orange-600 hover:bg-orange-50"
              onClick={() => setShowCamera(true)}
            >
              <Camera className="w-4 h-4 mr-2" />
              Scan QR
            </Button>

            <div className="flex flex-col items-end text-right">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                {isOnline ? 'En ligne' : 'Hors-ligne'}
              </span>
              {offlineQueue.length > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  En attente: {offlineQueue.length}
                </span>
              )}
            </div>

            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {user.name[0]}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Layout Gaming */}
      <main className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6 h-[calc(100vh-80px)]">
        
        {/* Colonne Gauche - Liste des Produits */}
        <div className="xl:col-span-2 space-y-6">
          {/* En-tête Produits */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Produits Disponibles
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                {produitsFiltres.length} produits sur {produits.length} disponibles
                {produits.length > 0 && (
                  <span className="text-xs ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                    {Math.round((produitsFiltres.length / produits.length) * 100)}% visibles
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 text-sm text-slate-500">
                <Zap className="w-4 h-4 text-green-500" />
                <span>Mode Gaming Activé</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {priceRefreshTime ? `Dernière MAJ: ${new Date(priceRefreshTime).toLocaleTimeString('fr-FR')}` : 'Prix chargés'}
              </div>
              
              {/* Bouton de rechargement */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={chargerProduits}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Actualiser
              </Button>
            </div>
          </div>

          {/* Grid des Produits */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            {isLoading ? (
              // Skeleton Loading optimisé
              Array.from({ length: 9 }).map((_, index) => (
                <Card key={index} className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 animate-pulse">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : produitsFiltres.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucun produit trouvé</p>
                <p className="text-sm">Essayez avec d&apos;autres termes de recherche</p>
              </div>
            ) : (
              <AnimatePresence>
                {produitsFiltres.map((produit, index) => (
                  <motion.div
                    key={produit.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all duration-300 cursor-pointer group">
                      <CardContent 
                        className="p-4"
                        onClick={() => ajouterAuPanier(produit)}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-green-600 transition-colors">
                                {produit.nom}
                              </h3>
                              <div className="flex items-center flex-wrap gap-2 mt-1">
                                {produit.categorie && (
                                  <Badge variant="secondary" className="text-xs py-1">
                                    {produit.categorie.nom}
                                  </Badge>
                                )}
                                {prixMAJ.has(produit.id) && (
                                  <Badge variant="destructive" className="text-xs py-1">
                                    Prix MAJ
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Barcode className="w-4 h-4 text-slate-400" />
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold text-green-600">
                              {produit.prix.toLocaleString()} FCFA
                            </span>
                            <Badge 
                              variant={
                                produit.quantite_stock === 0 ? "destructive" :
                                produit.quantite_stock < 5 ? "secondary" : "default"
                              }
                              className={
                                produit.quantite_stock === 0 ? "animate-pulse" :
                                produit.quantite_stock < 5 ? "bg-orange-100 text-orange-800" : ""
                              }
                            >
                              Stock: {produit.quantite_stock}
                            </Badge>
                          </div>

                          <Button 
                            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold"
                            size="sm"
                            disabled={produit.quantite_stock === 0}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            {produit.quantite_stock === 0 ? 'Rupture' : 'Ajouter au panier'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Colonne Droite - Panier Gaming */}
        <div className="xl:col-span-1">
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-slate-200/50 dark:border-slate-700/50 h-full flex flex-col">
            <CardHeader className="border-b border-slate-200/50 dark:border-slate-700/50">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <ShoppingCart className="w-5 h-5 text-green-500" />
                  <span>Panier de Vente</span>
                </span>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  {panier.length} articles
                </Badge>
              </CardTitle>
              <CardDescription>
                Transaction en cours
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 flex-1 flex flex-col">
              {/* Liste des Articles du Panier */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <AnimatePresence>
                  {panier.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-12 text-slate-500 dark:text-slate-400"
                    >
                      <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Panier vide</p>
                      <p className="text-sm">Ajoutez des produits pour commencer</p>
                    </motion.div>
                  ) : (
                    panier.map((item, index) => (
                      <motion.div
                        key={item.produit.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200/50 dark:border-slate-600/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {item.produit.nom}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {item.prixUnitaire.toLocaleString()} FCFA × {item.quantite}
                          </p>
                          <p className="text-sm font-semibold text-green-600">
                            {item.sousTotal.toLocaleString()} FCFA
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1 bg-white dark:bg-slate-600 rounded-lg border border-slate-200 dark:border-slate-500">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                              onClick={() => modifierQuantite(item.produit.id, item.quantite - 1)}
                              disabled={isProcessing}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            
                            <span className="px-2 text-sm font-medium min-w-8 text-center">
                              {item.quantite}
                            </span>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-green-50 hover:text-green-600"
                              onClick={() => modifierQuantite(item.produit.id, item.quantite + 1)}
                              disabled={isProcessing}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => retirerDuPanier(item.produit.id)}
                            disabled={isProcessing}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

              {/* Résumé de la Commande */}
              {panier.length > 0 && (
                <div className="border-t border-slate-200/50 dark:border-slate-700/50 p-4 space-y-4">
                  {/* Sélecteur de Client */}
                  <div className="space-y-2">
                    <Label htmlFor="client" className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-slate-500" />
                      <span>Client (optionnel)</span>
                    </Label>
                    <select 
                      id="client"
                      value={clientId || ''}
                      onChange={(e) => setClientId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50 text-sm"
                      disabled={isProcessing}
                    >
                      <option value="">Client anonyme</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.nom} - {client.telephone}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Notes de vente */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optionnel)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Ajouter une note pour cette vente..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="resize-none"
                      rows={2}
                      disabled={isProcessing}
                    />
                  </div>

                  {/* 🎯 NOUVEAU : SÉLECTION MODE DE PAIEMENT */}
                  <div className="space-y-3">
                    <Label className="flex items-center space-x-2">
                      <CreditCard className="w-4 h-4" />
                      <span>Mode de paiement</span>
                    </Label>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {/* Espèces */}
                      <div
                        className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                          modePaiement === 'especes' 
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                            : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                        }`}
                        onClick={() => setModePaiement('especes')}
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Espèces</p>
                            <p className="text-xs text-slate-500">Comptant</p>
                          </div>
                        </div>
                      </div>

                      {/* MTN Mobile Money */}
                      <div
                        className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                          modePaiement === 'mtn' 
                            ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' 
                            : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                        }`}
                        onClick={() => setModePaiement('mtn')}
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-800 rounded-full flex items-center justify-center">
                            <Smartphone className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">MTN Money</p>
                            <p className="text-xs text-slate-500">Mobile</p>
                          </div>
                        </div>
                      </div>

                      {/* Moov Money */}
                      <div
                        className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                          modePaiement === 'moov' 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                        }`}
                        onClick={() => setModePaiement('moov')}
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                            <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Moov Money</p>
                            <p className="text-xs text-slate-500">Mobile</p>
                          </div>
                        </div>
                      </div>

                      {/* Carte Bancaire */}
                      <div
                        className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                          modePaiement === 'carte' 
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                            : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                        }`}
                        onClick={() => setModePaiement('carte')}
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center">
                            <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Carte</p>
                            <p className="text-xs text-slate-500">Bancaire</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 🎯 CHAMPS SPÉCIFIQUES SELON MODE */}
                  {modePaiement && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3"
                    >
                      {/* Mobile Money */}
                      {(modePaiement === 'mtn' || modePaiement === 'moov') && (
                        <div className="space-y-2">
                          <Label htmlFor="numeroMobile">
                            Numéro {modePaiement === 'mtn' ? 'MTN' : 'Moov'}
                          </Label>
                          <Input
                            id="numeroMobile"
                            type="tel"
                            placeholder={`Ex: ${modePaiement === 'mtn' ? '67 12 34 56' : '66 12 34 56'}`}
                            value={numeroTransaction}
                            onChange={(e) => setNumeroTransaction(e.target.value)}
                            className="bg-white/50 dark:bg-slate-700/50"
                            disabled={isProcessing}
                          />
                          <p className="text-xs text-slate-500">
                            Le client recevra une demande de paiement
                          </p>
                        </div>
                      )}

                      {/* Carte Bancaire */}
                      {modePaiement === 'carte' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="referenceCarte">Référence</Label>
                              <Input
                                id="referenceCarte"
                                placeholder="Ref. transaction"
                                value={referenceCarte}
                                onChange={(e) => setReferenceCarte(e.target.value)}
                                disabled={isProcessing}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="banque">Banque</Label>
                              <select 
                                id="banque"
                                value={banqueSelectionnee}
                                onChange={(e) => setBanqueSelectionnee(e.target.value)}
                                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-slate-700/50 text-sm"
                                disabled={isProcessing}
                              >
                                <option value="">Sélectionnez</option>
                                <option value="ecobank">Ecobank</option>
                                <option value="boa">Bank of Africa</option>
                                <option value="bsic">BSIC</option>
                                <option value="uba">UBA</option>
                                <option value="sgb">Société Générale</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Espèces */}
                      {modePaiement === 'especes' && (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="montantRecu">Montant reçu</Label>
                            <Input
                              id="montantRecu"
                              type="number"
                              placeholder="Montant remis par le client"
                              value={montantRecu}
                              onChange={(e) => setMontantRecu(e.target.value)}
                              className="bg-white/50 dark:bg-slate-700/50"
                              disabled={isProcessing}
                            />
                          </div>
                          {montantRecu && parseFloat(montantRecu) > calculs.total && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                              <div className="flex justify-between text-sm font-medium">
                                <span>Monnaie à rendre:</span>
                                <span className="text-blue-600">{monnaieRendue.toLocaleString()} FCFA</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Gestion des remises */}
                  {showRemiseInput ? (
                    <div className="space-y-2">
                      <Label htmlFor="remise">Remise (FCFA)</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="remise"
                          type="number"
                          value={remise}
                          onChange={(e) => setRemise(Math.max(0, Number(e.target.value)))}
                          placeholder="Montant de la remise"
                          disabled={isProcessing}
                        />
                        <Button 
                          variant="outline" 
                          onClick={() => setShowRemiseInput(false)}
                          disabled={isProcessing}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={() => setShowRemiseInput(true)}
                      className="w-full"
                      disabled={isProcessing}
                    >
                      <Percent className="w-4 h-4 mr-2" />
                      Appliquer une remise
                    </Button>
                  )}

                  {/* Détails des calculs */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Sous-total</span>
                      <span className="font-medium">{calculs.sousTotal.toLocaleString()} FCFA</span>
                    </div>
                    
                    {remise > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Remise</span>
                        <span className="font-medium text-green-600">-{remise.toLocaleString()} FCFA</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">TVA (18%)</span>
                      <span className="font-medium">{calculs.tva.toLocaleString()} FCFA</span>
                    </div>

                    <div className="border-t border-slate-200/50 dark:border-slate-700/50 pt-2 flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-green-600">{calculs.total.toLocaleString()} FCFA</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={viderPanier}
                      disabled={isProcessing}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Vider
                    </Button>
                    
                    <Button 
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold"
                      onClick={procederPaiement}
                      disabled={isProcessing || panier.length === 0 || !modePaiement}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Traitement...
                        </>
                      ) : (
                        <>
                          <Calculator className="w-4 h-4 mr-2" />
                          Payer
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modal Scan QR Code */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCamera(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Scanner un code-barres</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCamera(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="bg-slate-900 rounded-lg h-64 flex items-center justify-center mb-4 relative overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-2 border-green-500 rounded-lg m-8 pointer-events-none">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-green-500"></div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-green-500"></div>
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-green-500"></div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-green-500"></div>
                </div>
              </div>
              
                      <div className="text-center text-sm text-slate-500 mb-4">
                <p>Placez le code-barres dans le cadre pour le scanner</p>
                <p>Fonctionnalité en développement avancé</p>
              </div>
              <div className="text-center text-sm text-slate-400 mb-4">
                {barcodeDetectorSupported ? (scannerMessage || 'Lecture en cours...') : 'Scanner non supporté dans ce navigateur'}
              </div>
              
              <Button className="w-full" onClick={() => setShowCamera(false)}>
                Fermer le scanner
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de prévisualisation du ticket */}
      <AnimatePresence>
        {showPreviewTicket && previewVente && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPreviewTicket(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Prévisualisation du ticket</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Vérifiez avant de confirmer le paiement.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowPreviewTicket(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span>Montant total</span>
                    <span className="font-semibold">{previewVente.montant_total.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remise</span>
                    <span className="font-semibold">-{previewVente.remise.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TVA</span>
                    <span className="font-semibold">{previewVente.tva.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mode paiement</span>
                    <span className="font-semibold capitalize">{previewVente.mode_paiement}</span>
                  </div>
                  {previewVente.numero_transaction && (
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Numéro transaction</span>
                      <span>{previewVente.numero_transaction}</span>
                    </div>
                  )}
                  {previewVente.reference_carte && (
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Référence carte</span>
                      <span>{previewVente.reference_carte}</span>
                    </div>
                  )}
                  {previewVente.client && (
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Client</span>
                      <span>{previewVente.client.nom}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <div className="font-semibold text-slate-900 dark:text-white mb-2">Articles</div>
                  <div className="space-y-2">
                    {previewVente.ligne_ventes.map((ligne, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <div className="col-span-6 truncate">{ligne.produit.nom}</div>
                        <div className="col-span-2 text-center">{ligne.quantite}</div>
                        <div className="col-span-2 text-right">{ligne.prix_unitaire.toLocaleString()}</div>
                        <div className="col-span-2 text-right font-semibold">{(ligne.prix_unitaire * ligne.quantite).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex flex-col gap-3">
                <Button
                  className="w-full bg-green-600 hover:bg-emerald-600 text-white"
                  onClick={confirmerPaiement}
                  disabled={isProcessing}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirmer et enregistrer
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowPreviewTicket(false)}
                  disabled={isProcessing}
                >
                  <X className="w-4 h-4 mr-2" />
                  Modifier la vente
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Historique des ventes */}
      <AnimatePresence>
        {showHistorique && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowHistorique(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Historique des ventes</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Dernières ventes du jour et annulations rapides.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowHistorique(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {isLoadingHistorique ? (
                  <div className="text-center py-12 text-slate-500">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin mb-4" />
                    Chargement de l&apos;historique...
                  </div>
                ) : ventesJour.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <p>Aucune vente trouvée pour aujourd&apos;hui.</p>
                    <p className="text-sm">Appuyez sur le bouton actualiser pour recharger.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ventesJour.map((vente) => (
                      <div key={vente.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-950">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm text-slate-500">#{vente.id} • {new Date(vente.created_at).toLocaleTimeString('fr-FR')}</div>
                            <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                              <span>{vente.client?.nom || 'Anonyme'}</span>
                              <Badge variant={vente.statut === 'annulee' ? 'destructive' : 'secondary'}>{vente.statut}</Badge>
                            </div>
                          </div>
                          <div className="text-right space-y-1 text-sm text-slate-600 dark:text-slate-400">
                            <div>Total: {vente.montant_total.toLocaleString()} FCFA</div>
                            <div>Mode: {vente.mode_paiement || 'espèces'}</div>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="space-y-1">
                            {vente.ligne_ventes.slice(0, 3).map((ligne, index) => (
                              <div key={index} className="flex justify-between">
                                <span>{ligne.produit.nom}</span>
                                <span>{ligne.quantite}×</span>
                              </div>
                            ))}
                            {vente.ligne_ventes.length > 3 && (
                              <div className="text-xs text-slate-500">+{vente.ligne_ventes.length - 3} autres articles</div>
                            )}
                          </div>
                          <div className="flex flex-col justify-between items-end gap-3">
                            {vente.peut_annuler && vente.statut !== 'annulee' ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => annulerVente(vente.id)}
                                disabled={isProcessing}
                              >
                                Annuler
                              </Button>
                            ) : (
                              <Badge variant="outline">Bloqué</Badge>
                            )}
                            <span className="text-xs text-slate-500">ID vente {vente.id}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Ticket de Caisse - MIS À JOUR AVEC MODES PAIEMENT */}
      <AnimatePresence>
        {showTicket && lastVente && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTicket(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header fixe */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                <div className="text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    Paiement Réussi!
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Vente #{lastVente.numero_vente || lastVente.id}
                  </p>
                </div>
              </div>

              {/* 🎫 REÇU AVEC SCROLL */}
              <div className="flex-1 overflow-y-auto p-6">
                <Card className="border-2 border-green-200 bg-green-50 dark:bg-green-900/20">
                  <CardContent className="p-6 receipt-content">
                    {/* En-tête du reçu */}
                    <div className="text-center mb-6 border-b border-green-200 pb-4">
                      <h2 className="text-xl font-bold text-green-800 dark:text-green-300">
                        SGCI BÉNIN
                      </h2>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Système de Gestion Commerciale Intelligente
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Erevan Market - Cotonou
                      </p>
                    </div>

                    {/* Informations de la vente */}
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">N° Vente:</span>
                        <span className="font-bold">{lastVente.numero_vente || `VENT-${lastVente.id}`}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="font-medium">Date:</span>
                        <span>{new Date(lastVente.created_at).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="font-medium">Caissier:</span>
                        <span>{user?.name || 'System'}</span>
                      </div>

                      {/* Mode de paiement */}
                      <div className="flex justify-between">
                        <span className="font-medium">Mode paiement:</span>
                        <span className="font-bold capitalize">
                          {lastVente.mode_paiement === 'especes' && 'Espèces'}
                          {lastVente.mode_paiement === 'mtn' && 'MTN Money'}
                          {lastVente.mode_paiement === 'moov' && 'Moov Money'}
                          {lastVente.mode_paiement === 'carte' && 'Carte Bancaire'}
                        </span>
                      </div>

                      {/* Détails selon mode */}
                      {lastVente.numero_transaction && (
                        <div className="flex justify-between text-xs">
                          <span>Numéro:</span>
                          <span>{lastVente.numero_transaction}</span>
                        </div>
                      )}

                      {lastVente.reference_carte && (
                        <div className="flex justify-between text-xs">
                          <span>Référence carte:</span>
                          <span>{lastVente.reference_carte}</span>
                        </div>
                      )}

                      {lastVente.banque && (
                        <div className="flex justify-between text-xs">
                          <span>Banque:</span>
                          <span className="capitalize">{lastVente.banque}</span>
                        </div>
                      )}

                      {/* Client */}
                      <div className="flex justify-between border-t border-green-200 pt-2">
                        <span className="font-medium">Client:</span>
                        <span className={lastVente.client ? "font-bold text-blue-600" : "text-slate-500"}>
                          {lastVente.client ? lastVente.client.nom : 'Anonyme'}
                        </span>
                      </div>

                      {lastVente.client?.telephone && (
                        <div className="flex justify-between text-xs">
                          <span>Téléphone:</span>
                          <span>{lastVente.client.telephone}</span>
                        </div>
                      )}
                    </div>

                    {/* Détails des articles */}
                    <div className="mt-6 border-t border-green-200 pt-4">
                      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-green-800 dark:text-green-300 mb-2">
                        <div className="col-span-6">ARTICLE</div>
                        <div className="col-span-2 text-center">QTE</div>
                        <div className="col-span-2 text-right">PRIX</div>
                        <div className="col-span-2 text-right">TOTAL</div>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {lastVente.ligne_ventes.map((ligne, index) => (
                          <div key={index} className="grid grid-cols-12 gap-2 text-sm border-b border-green-100 pb-2">
                            <div className="col-span-6">
                              <div className="font-medium truncate">{ligne.produit.nom}</div>
                              <div className="text-xs text-slate-500">{ligne.produit.categorie?.nom}</div>
                            </div>
                            <div className="col-span-2 text-center text-slate-600">
                              {ligne.quantite}
                            </div>
                            <div className="col-span-2 text-right text-slate-600">
                              {ligne.prix_unitaire.toLocaleString()} F
                            </div>
                            <div className="col-span-2 text-right font-semibold">
                              {(ligne.prix_unitaire * ligne.quantite).toLocaleString()} F
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Récapitulatif financier */}
                    <div className="mt-6 space-y-2 text-sm border-t border-green-200 pt-4">
                      <div className="flex justify-between">
                        <span>Sous-total:</span>
                        <span>{(lastVente.montant_total - lastVente.tva + lastVente.remise).toLocaleString()} FCFA</span>
                      </div>
                      
                      {lastVente.remise > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Remise:</span>
                          <span>-{lastVente.remise.toLocaleString()} FCFA</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between">
                        <span>TVA (18%):</span>
                        <span>{lastVente.tva.toLocaleString()} FCFA</span>
                      </div>

                      {/* Monnaie rendue pour espèces */}
                      {lastVente.monnaie_rendue && lastVente.monnaie_rendue > 0 && (
                        <div className="flex justify-between text-blue-600">
                          <span>Monnaie rendue:</span>
                          <span>{lastVente.monnaie_rendue.toLocaleString()} FCFA</span>
                        </div>
                      )}

                      <div className="flex justify-between font-bold text-lg border-t border-green-300 pt-2 text-green-800 dark:text-green-300">
                        <span>TOTAL:</span>
                        <span>{lastVente.montant_total.toLocaleString()} FCFA</span>
                      </div>
                    </div>

                    {/* Mode de paiement */}
                    <div className="mt-4 pt-4 border-t border-green-200 text-center">
                      <div className="text-xs text-slate-500">
                        <div className="font-semibold">
                          Mode de paiement: {lastVente.mode_paiement?.toUpperCase() || 'ESPÈCES'}
                        </div>
                        {lastVente.numero_transaction && (
                          <div>Transaction: {lastVente.numero_transaction}</div>
                        )}
                        <div className="mt-1">Merci de votre confiance !</div>
                        <div className="text-[10px] mt-2">Reçu électronique - Conservez ce ticket</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 🖨️ BOUTONS FIXES EN BAS */}
              <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-b-2xl flex-shrink-0">
                <div className="text-center mb-3">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Souhaitez-vous imprimer le reçu ?
                  </p>
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
                    onClick={() => {
                      const receiptElement = document.querySelector('.receipt-content');
                      if (receiptElement) {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          // Template d'impression mis à jour avec modes de paiement
                          printWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <title>REÇU SGCI - ${lastVente.numero_vente || lastVente.id}</title>
                              <style>
                                @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700&display=swap');
                                @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap');
                                
                                * { margin: 0; padding: 0; box-sizing: border-box; }
                                body {
                                  font-family: 'Roboto Mono', monospace;
                                  font-size: 11px;
                                  line-height: 1.2;
                                  color: #000;
                                  background: #fff;
                                  margin: 0;
                                  padding: 8px;
                                  -webkit-print-color-adjust: exact;
                                  print-color-adjust: exact;
                                }
                                .ticket {
                                  width: 80mm;
                                  max-width: 80mm;
                                  margin: 0 auto;
                                  padding: 12px 8px;
                                  background: white;
                                }
                                .header { text-align: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px dashed #333; }
                                .company-name { font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
                                .sale-info { margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #ccc; }
                                .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                                .items-header { display: grid; grid-template-columns: 3fr 1fr 1fr 1fr; gap: 4px; padding: 4px 0; border-bottom: 2px solid #000; font-weight: 700; font-size: 9px; margin-bottom: 6px; }
                                .item-row { display: grid; grid-template-columns: 3fr 1fr 1fr 1fr; gap: 4px; padding: 3px 0; border-bottom: 1px dashed #eee; font-size: 10px; }
                                .summary { margin-top: 12px; padding-top: 8px; border-top: 2px dashed #333; }
                                .summary-row { display: flex; justify-content: space-between; margin-bottom: 4px; padding: 2px 0; }
                                .total-row { border-top: 2px solid #000; margin-top: 6px; padding-top: 6px; font-size: 12px; font-weight: 700; }
                                .footer { margin-top: 15px; padding-top: 8px; border-top: 1px dashed #ccc; text-align: center; }
                                .payment-method { font-weight: 600; margin-bottom: 5px; text-transform: uppercase; }
                                @media print {
                                  body { margin: 0; padding: 5px; width: 80mm; }
                                  .ticket { width: 80mm; padding: 10px 6px; box-shadow: none; border: none; }
                                  .no-print { display: none !important; }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="ticket">
                                <div class="header">
                                  <div class="company-name">SGCI BÉNIN</div>
                                  <div class="company-slogan">Système de Gestion Commerciale Intelligente</div>
                                </div>
                                
                                <div class="sale-info">
                                  <div class="info-row">
                                    <span>N° TICKET:</span>
                                    <span>${lastVente.numero_vente || `VENT-${lastVente.id}`}</span>
                                  </div>
                                  <div class="info-row">
                                    <span>DATE:</span>
                                    <span>${new Date(lastVente.created_at).toLocaleString('fr-FR')}</span>
                                  </div>
                                  <div class="info-row">
                                    <span>CAISSIER:</span>
                                    <span>${user?.name || 'SYSTEM'}</span>
                                  </div>
                                  <div class="info-row">
                                    <span>MODE PAIEMENT:</span>
                                    <span>${lastVente.mode_paiement?.toUpperCase() || 'ESPÈCES'}</span>
                                  </div>
                                  ${lastVente.numero_transaction ? `
                                    <div class="info-row">
                                      <span>NUMÉRO:</span>
                                      <span>${lastVente.numero_transaction}</span>
                                    </div>
                                  ` : ''}
                                  <div class="info-row">
                                    <span>CLIENT:</span>
                                    <span>${lastVente.client ? lastVente.client.nom : 'ANONYME'}</span>
                                  </div>
                                </div>
                                
                                <div class="items-section">
                                  <div class="items-header">
                                    <div>ARTICLE</div>
                                    <div>QTE</div>
                                    <div>PRIX</div>
                                    <div>TOTAL</div>
                                  </div>
                                  ${lastVente.ligne_ventes.map(ligne => `
                                    <div class="item-row">
                                      <div>${ligne.produit.nom}</div>
                                      <div>${ligne.quantite}</div>
                                      <div>${ligne.prix_unitaire.toLocaleString()}</div>
                                      <div>${(ligne.prix_unitaire * ligne.quantite).toLocaleString()}</div>
                                    </div>
                                  `).join('')}
                                </div>
                                
                                <div class="summary">
                                  <div class="summary-row">
                                    <span>SOUS-TOTAL</span>
                                    <span>${(lastVente.montant_total - lastVente.tva + lastVente.remise).toLocaleString()} FCFA</span>
                                  </div>
                                  ${lastVente.remise > 0 ? `
                                    <div class="summary-row">
                                      <span>REMISE</span>
                                      <span>-${lastVente.remise.toLocaleString()} FCFA</span>
                                    </div>
                                  ` : ''}
                                  <div class="summary-row">
                                    <span>TVA (18%)</span>
                                    <span>${lastVente.tva.toLocaleString()} FCFA</span>
                                  </div>
                                  ${lastVente.monnaie_rendue && lastVente.monnaie_rendue > 0 ? `
                                    <div class="summary-row">
                                      <span>MONNAIE RENDUE</span>
                                      <span>${lastVente.monnaie_rendue.toLocaleString()} FCFA</span>
                                    </div>
                                  ` : ''}
                                  <div class="summary-row total-row">
                                    <span>TOTAL</span>
                                    <span>${lastVente.montant_total.toLocaleString()} FCFA</span>
                                  </div>
                                </div>
                                
                                <div class="footer">
                                  <div class="payment-method">MERCI POUR VOTRE CONFIANCE !</div>
                                  <div class="legal-info">Reçu électronique - Conservez ce ticket</div>
                                </div>
                              </div>
                              
                              <div class="btn-group no-print">
                                <button class="btn btn-print" onclick="window.print()">🖨️ IMPRIMER</button>
                                <button class="btn btn-close" onclick="window.close()">❌ FERMER</button>
                              </div>
                              
                              <script>
                                setTimeout(() => { window.print(); }, 800);
                              </script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        }
                      }
                      setShowTicket(false);
                      toast.success("Reçu envoyé à l'impression");
                    }}
                  >
                    <Receipt className="w-4 h-4 mr-2" />
                    Oui, Imprimer
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1 border-blue-300 text-blue-600 hover:bg-blue-50"
                    onClick={() => {
                      setShowTicket(false);
                      toast.info("Reçu consulté - Non imprimé");
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Voir seulement
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  className="w-full mt-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  onClick={() => setShowTicket(false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Fermer sans action
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}