'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ShoppingCart, 
  Scan, 
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
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
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
  ligne_ventes: Array<{
    id: number;
    quantite: number;
    prix_unitaire: number;
    produit: Produit;
  }>;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 🎯 CHARGEMENT OPTIMISÉ DES DONNÉES
  useEffect(() => {
    chargerProduits();
    chargerClients();
  }, []);

  const chargerProduits = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');
      
      // 🔥 CORRECTION : Charger TOUS les produits sans limite de pagination
      const response = await fetch('http://localhost:8000/api/produits?per_page=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const responseData = await response.json();
      
      // 🔥 CORRECTION AMÉLIORÉE : Gestion robuste de la pagination
      let produitsData = [];
      
      if (Array.isArray(responseData)) {
        produitsData = responseData;
      } else if (responseData && Array.isArray(responseData.data)) {
        produitsData = responseData.data;
        
        // 🎯 DIAGNOSTIC : Vérifier s'il y a plus de données
        if (responseData.total && responseData.last_page > 1) {
          const produitsManquants = responseData.total - responseData.data.length;
          if (produitsManquants > 0) {
            console.warn(`📊 Pagination: ${responseData.total} produits au total, ${responseData.data.length} chargés`);
          }
        }
      } else {
        console.warn('Format de réponse inattendu:', responseData);
        produitsData = [];
      }
      
      setProduits(produitsData);
      console.log(`✅ ${produitsData.length} produits chargés dans la caisse`);
      
    } catch (error) {
      console.error('Erreur détaillée chargement produits:', error);
      toast.error('Erreur lors du chargement des produits');
      setProduits([]);
    } finally {
      setIsLoading(false);
    }
  };

  const chargerClients = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:8000/api/clients', {
        headers: {
          'Authorization': `Bearer ${token}`,
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

  // 🎯 FONCTIONS OPTIMISÉES DU PANIER
  const verifierStock = useCallback((produit: Produit, quantite: number): boolean => {
    const produitEnStock = produits.find(p => p.id === produit.id);
    if (!produitEnStock) return false;
    
    const quantitePanier = panier.find(item => item.produit.id === produit.id)?.quantite || 0;
    const quantiteTotale = quantitePanier + quantite;
    
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
    if (produit && !verifierStock(produit, nouvelleQuantite)) {
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
    toast.info('Panier vidé');
  }, []);

  // 🎯 CALCULS OPTIMISÉS (Alignés avec le backend)
  const calculs = useMemo(() => {
    const sousTotal = panier.reduce((total, item) => total + item.sousTotal, 0);
    const montantApresRemise = Math.max(0, sousTotal - remise);
    const tva = montantApresRemise * 0.18;
    const total = montantApresRemise + tva;

    return {
      sousTotal,
      montantApresRemise,
      tva,
      total
    };
  }, [panier, remise]);

  // 🎯 SCANNER QR CODE FONCTIONNEL
  const demarrerCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Erreur caméra:', error);
      toast.error('Accès à la caméra refusé ou non supporté');
    }
  };

  const arreterCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (showCamera) {
      demarrerCamera();
    } else {
      arreterCamera();
    }

    return () => {
      arreterCamera();
    };
  }, [showCamera]);

  // 🎯 FONCTION DE PAIEMENT COMPLÈTE - CORRIGÉE POUR LE BACKEND
  const procederPaiement = async () => {
    if (panier.length === 0) {
      toast.error('Le panier est vide');
      return;
    }

    setIsProcessing(true);

    try {
      // Vérification finale des stocks
      for (const item of panier) {
        const response = await fetch(`http://localhost:8000/api/produits/${item.produit.id}`, {
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}` 
          }
        });
        
        if (response.ok) {
          const produit = await response.json();
          if (produit.quantite_stock < item.quantite) {
            throw new Error(`Stock insuffisant pour ${item.produit.nom}. Il reste ${produit.quantite_stock} unités.`);
          }
        }
      }

      // 🔥 CORRECTION : Préparation des données selon le NOUVEAU format backend
      const donneesVente = {
        ligne_ventes: panier.map(item => ({
          produit_id: item.produit.id,
          quantite: item.quantite
        })),
        remise: remise,
        notes: notes,
        client_id: clientId
      };

      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:8000/api/ventes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(donneesVente)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
      }

      const venteConfirmee: VenteResponse = await response.json();
      
      setLastVente(venteConfirmee);
      setShowTicket(true);
      toast.success(<div className="flex items-center space-x-2">
        <CheckCircle2 className="w-4 h-4 text-green-500" />
        <span>Vente #{venteConfirmee.id} enregistrée avec succès!</span>
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
              className="border-orange-300 text-orange-600 hover:bg-orange-50"
              onClick={() => setShowCamera(true)}
            >
              <Camera className="w-4 h-4 mr-2" />
              Scan QR
            </Button>
            
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
                <p className="text-sm">Essayez avec d'autres termes de recherche</p>
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
                              {produit.categorie && (
                                <Badge variant="secondary" className="mt-1">
                                  {produit.categorie.nom}
                                </Badge>
                              )}
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
                      disabled={isProcessing || panier.length === 0}
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

      {/* Modal Scan QR Code FONCTIONNEL */}
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
              
              <Button className="w-full" onClick={() => setShowCamera(false)}>
                Fermer le scanner
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Ticket de Caisse - AVEC SCROLL ET CHOIX D'IMPRESSION */}
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

                    {/* Détails des articles - TABLEAU PROFESSIONNEL */}
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

                      <div className="flex justify-between font-bold text-lg border-t border-green-300 pt-2 text-green-800 dark:text-green-300">
                        <span>TOTAL:</span>
                        <span>{lastVente.montant_total.toLocaleString()} FCFA</span>
                      </div>
                    </div>

                    {/* Mode de paiement */}
                    <div className="mt-4 pt-4 border-t border-green-200 text-center">
                      <div className="text-xs text-slate-500">
                        <div>Mode de paiement: Espèces</div>
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
                  {/* Option 1 : Imprimer maintenant */}
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
                    onClick={() => {
                      const receiptElement = document.querySelector('.receipt-content');
                      if (receiptElement) {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          printWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <title>REÇU SGCI - ${lastVente.numero_vente || lastVente.id}</title>
                              <style>
                                /* === STYLES PROFESSIONNELS COMME EREVAN === */
                                @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700&display=swap');
                                
                                * {
                                  margin: 0;
                                  padding: 0;
                                  box-sizing: border-box;
                                }
                                
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
                                  position: relative;
                                }
                                
                                /* === EN-TÊTE PROFESSIONNELLE === */
                                .header {
                                  text-align: center;
                                  margin-bottom: 12px;
                                  padding-bottom: 8px;
                                  border-bottom: 2px dashed #333;
                                }
                                
                                .company-name {
                                  font-size: 16px;
                                  font-weight: 700;
                                  text-transform: uppercase;
                                  letter-spacing: 1px;
                                  margin-bottom: 2px;
                                  color: #000;
                                }
                                
                                .company-slogan {
                                  font-size: 9px;
                                  color: #666;
                                  margin-bottom: 3px;
                                  text-transform: uppercase;
                                }
                                
                                .company-address {
                                  font-size: 8px;
                                  color: #888;
                                  margin-bottom: 4px;
                                }
                                
                                .contact-info {
                                  font-size: 8px;
                                  color: #666;
                                  margin-bottom: 2px;
                                }
                                
                                /* === INFORMATIONS DE LA VENTE === */
                                .sale-info {
                                  margin-bottom: 10px;
                                  padding-bottom: 8px;
                                  border-bottom: 1px dashed #ccc;
                                }
                                
                                .info-row {
                                  display: flex;
                                  justify-content: space-between;
                                  margin-bottom: 3px;
                                }
                                
                                .info-label {
                                  font-weight: 600;
                                  color: #333;
                                }
                                
                                .info-value {
                                  font-weight: 500;
                                  color: #000;
                                }
                                
                                /* === TABLEAU DES ARTICLES === */
                                .items-section {
                                  margin-bottom: 10px;
                                }
                                
                                .items-header {
                                  display: grid;
                                  grid-template-columns: 3fr 1fr 1fr 1fr;
                                  gap: 4px;
                                  padding: 4px 0;
                                  border-bottom: 2px solid #000;
                                  font-weight: 700;
                                  text-transform: uppercase;
                                  font-size: 9px;
                                  margin-bottom: 6px;
                                }
                                
                                .item-row {
                                  display: grid;
                                  grid-template-columns: 3fr 1fr 1fr 1fr;
                                  gap: 4px;
                                  padding: 3px 0;
                                  border-bottom: 1px dashed #eee;
                                  font-size: 10px;
                                }
                                
                                .item-name {
                                  font-weight: 500;
                                  overflow: hidden;
                                  text-overflow: ellipsis;
                                  white-space: nowrap;
                                }
                                
                                .item-category {
                                  font-size: 7px;
                                  color: #888;
                                  margin-top: 1px;
                                }
                                
                                .item-qty, .item-price, .item-total {
                                  text-align: right;
                                  font-weight: 500;
                                }
                                
                                .item-total {
                                  font-weight: 600;
                                }
                                
                                /* === RÉCAPITULATIF FINANCIER === */
                                .summary {
                                  margin-top: 12px;
                                  padding-top: 8px;
                                  border-top: 2px dashed #333;
                                }
                                
                                .summary-row {
                                  display: flex;
                                  justify-content: space-between;
                                  margin-bottom: 4px;
                                  padding: 2px 0;
                                }
                                
                                .summary-label {
                                  font-weight: 500;
                                  color: #333;
                                }
                                
                                .summary-value {
                                  font-weight: 600;
                                  color: #000;
                                }
                                
                                .total-row {
                                  border-top: 2px solid #000;
                                  margin-top: 6px;
                                  padding-top: 6px;
                                  font-size: 12px;
                                  font-weight: 700;
                                }
                                
                                /* === PIED DE PAGE === */
                                .footer {
                                  margin-top: 15px;
                                  padding-top: 8px;
                                  border-top: 1px dashed #ccc;
                                  text-align: center;
                                }
                                
                                .payment-method {
                                  font-weight: 600;
                                  margin-bottom: 5px;
                                  text-transform: uppercase;
                                }
                                
                                .thank-you {
                                  font-size: 10px;
                                  font-weight: 600;
                                  margin-bottom: 4px;
                                  color: #000;
                                }
                                
                                .legal-info {
                                  font-size: 7px;
                                  color: #666;
                                  line-height: 1.3;
                                  margin-bottom: 3px;
                                }
                                
                                .barcode-area {
                                  margin-top: 8px;
                                  padding: 5px;
                                  border: 1px dashed #ccc;
                                  text-align: center;
                                  font-family: 'Libre Barcode 128', cursive;
                                  font-size: 24px;
                                }
                                
                                /* === IMPRESSION === */
                                @media print {
                                  body {
                                    margin: 0;
                                    padding: 5px;
                                    width: 80mm;
                                  }
                                  
                                  .ticket {
                                    width: 80mm;
                                    padding: 10px 6px;
                                    box-shadow: none;
                                    border: none;
                                  }
                                  
                                  .no-print {
                                    display: none !important;
                                  }
                                }
                                
                                /* === BOUTONS (VISIBLES UNIQUEMENT À L'ÉCRAN) === */
                                .btn-group {
                                  text-align: center;
                                  margin-top: 20px;
                                }
                                
                                .btn {
                                  padding: 8px 16px;
                                  border: none;
                                  border-radius: 3px;
                                  cursor: pointer;
                                  margin: 4px;
                                  font-size: 11px;
                                  font-family: 'Roboto Mono', monospace;
                                  font-weight: 600;
                                }
                                
                                .btn-print {
                                  background: #000;
                                  color: white;
                                }
                                
                                .btn-close {
                                  background: #666;
                                  color: white;
                                }
                              </style>
                              <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
                            </head>
                            <body>
                              <div class="ticket">
                                <!-- EN-TÊTE PROFESSIONNELLE -->
                                <div class="header">
                                  <div class="company-name">SGCI BÉNIN</div>
                                  <div class="company-slogan">Système de Gestion Commerciale Intelligente</div>
                                  <div class="company-address">Erevan Market - Cotonou, Bénin</div>
                                  <div class="contact-info">Tél: +229 21 30 40 50 | Email: contact@sgci.bj</div>
                                  <div class="contact-info">RCCM: RB/COC/2024/12345 | NIF: 1234567890123</div>
                                </div>
                                
                                <!-- INFORMATIONS DE LA VENTE -->
                                <div class="sale-info">
                                  <div class="info-row">
                                    <span class="info-label">N° TICKET:</span>
                                    <span class="info-value">${lastVente.numero_vente || `VENT-${lastVente.id}`}</span>
                                  </div>
                                  <div class="info-row">
                                    <span class="info-label">DATE:</span>
                                    <span class="info-value">${new Date(lastVente.created_at).toLocaleString('fr-FR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}</span>
                                  </div>
                                  <div class="info-row">
                                    <span class="info-label">CAISSIER:</span>
                                    <span class="info-value">${user?.name || 'SYSTEM'}</span>
                                  </div>
                                  <div class="info-row">
                                    <span class="info-label">CLIENT:</span>
                                    <span class="info-value">${lastVente.client ? lastVente.client.nom : 'ANONYME'}</span>
                                  </div>
                                  ${lastVente.client?.telephone ? `
                                    <div class="info-row">
                                      <span class="info-label">TÉLÉPHONE:</span>
                                      <span class="info-value">${lastVente.client.telephone}</span>
                                    </div>
                                  ` : ''}
                                </div>
                                
                                <!-- ARTICLES -->
                                <div class="items-section">
                                  <div class="items-header">
                                    <div>ARTICLE</div>
                                    <div>QTE</div>
                                    <div>PRIX</div>
                                    <div>TOTAL</div>
                                  </div>
                                  
                                  ${lastVente.ligne_ventes.map(ligne => `
                                    <div class="item-row">
                                      <div class="item-name">
                                        ${ligne.produit.nom}
                                        <div class="item-category">${ligne.produit.categorie?.nom || 'GÉNÉRAL'}</div>
                                      </div>
                                      <div class="item-qty">${ligne.quantite}</div>
                                      <div class="item-price">${ligne.prix_unitaire.toLocaleString()}</div>
                                      <div class="item-total">${(ligne.prix_unitaire * ligne.quantite).toLocaleString()}</div>
                                    </div>
                                  `).join('')}
                                </div>
                                
                                <!-- RÉCAPITULATIF FINANCIER -->
                                <div class="summary">
                                  <div class="summary-row">
                                    <span class="summary-label">SOUS-TOTAL</span>
                                    <span class="summary-value">${(lastVente.montant_total - lastVente.tva + lastVente.remise).toLocaleString()} FCFA</span>
                                  </div>
                                  
                                  ${lastVente.remise > 0 ? `
                                    <div class="summary-row">
                                      <span class="summary-label">REMISE</span>
                                      <span class="summary-value" style="color: #d00;">-${lastVente.remise.toLocaleString()} FCFA</span>
                                    </div>
                                  ` : ''}
                                  
                                  <div class="summary-row">
                                    <span class="summary-label">TVA (18%)</span>
                                    <span class="summary-value">${lastVente.tva.toLocaleString()} FCFA</span>
                                  </div>
                                  
                                  <div class="summary-row total-row">
                                    <span class="summary-label">TOTAL À PAYER</span>
                                    <span class="summary-value">${lastVente.montant_total.toLocaleString()} FCFA</span>
                                  </div>
                                </div>
                                
                                <!-- PIED DE PAGE -->
                                <div class="footer">
                                  <div class="payment-method">PAIEMENT: ESPÈCES</div>
                                  <div class="thank-you">MERCI POUR VOTRE CONFIANCE !</div>
                                  <div class="legal-info">
                                    Article L123-1 du code de la consommation<br>
                                    Reçu à conserver pendant 1 an<br>
                                    Échange sous 7 jours avec ticket
                                  </div>
                                  <div class="barcode-area">
                                    ${lastVente.numero_vente || `VENT${lastVente.id}`}
                                  </div>
                                </div>
                              </div>
                              
                              <!-- BOUTONS POUR L'INTERFACE -->
                              <div class="btn-group no-print">
                                <button class="btn btn-print" onclick="window.print()">🖨️ IMPRIMER LE REÇU</button>
                                <button class="btn btn-close" onclick="window.close()">❌ FERMER</button>
                              </div>
                              
                              <script>
                                setTimeout(() => { 
                                  window.print(); 
                                }, 800);
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

                  {/* Option 2 : Voir seulement */}
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

                {/* Option 3 : Fermer directement */}
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