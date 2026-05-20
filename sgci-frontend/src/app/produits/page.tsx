'use client';
/* eslint-disable @next/next/no-img-element */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Image as ImageIcon,
  Tag,
  AlertTriangle,
  BarChart3,
  Grid,
  List,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Produit {
  id: number;
  nom: string;
  description: string;
  prix: number;
  quantite_stock: number;
  seuil_alerte: number;
  categorie_id: number;
  est_perissable: boolean;
  unite_mesure: string;
  created_at: string;
  image_url?: string;
  images?: string[];
  categorie?: {
    id: number;
    nom: string;
    couleur: string;
  };
}

interface Categorie {
  id: number;
  nom: string;
  description?: string;
  couleur: string;
  icone?: string;
  produits_count?: number;
}

interface PaginationInfo {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

interface Stats {
  total_produits?: number;
  produits_en_alerte?: number;
  produits_en_rupture?: number;
  valeur_stock_total?: number;
}

// 🎯 BIBLIOTHÈQUE D'IMAGES PAR DÉFAUT PAR CATÉGORIE
const defaultImages = {
  electronique: [
    "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=400&h=300&fit=crop"
  ],
  alimentation: [
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop"
  ],
  vetements: [
    "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=300&fit=crop"
  ],
  maison: [
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=400&h=300&fit=crop"
  ],
  default: [
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=300&fit=crop"
  ]
};

export default function ProduitsPage() {
  const { user } = useAuth();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [rechercheTerm, setRechercheTerm] = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState<string>('all');
  const [filtreStock, setFiltreStock] = useState<string>('all');
  const [vue, setVue] = useState<'grid' | 'list'>('grid');
  const [produitSelectionne, setProduitSelectionne] = useState<Produit | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingProduit, setEditingProduit] = useState<Produit | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [produitToDelete, setProduitToDelete] = useState<Produit | null>(null);
  const [showCategoriesDialog, setShowCategoriesDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
    from: 0,
    to: 0
  });
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    prix: '',
    quantite_stock: '',
    seuil_alerte: '',
    categorie_id: '',
    est_perissable: false,
    unite_mesure: 'unité',
    image_url: '',
    images: [] as string[]
  });

  // 🎯 ÉTATS POUR LA GESTION DES CATÉGORIES
  const [showCategorieForm, setShowCategorieForm] = useState(false);
  const [editingCategorie, setEditingCategorie] = useState<Categorie | null>(null);
  const [categorieToDelete, setCategorieToDelete] = useState<Categorie | null>(null);
  const [showDeleteCategorieDialog, setShowDeleteCategorieDialog] = useState(false);
  const [categorieForm, setCategorieForm] = useState({
    nom: '',
    description: '',
    couleur: '#3b82f6',
    icone: 'Package'
  });

  // 🎯 DEBOUNCE RECHERCHE
  useEffect(() => {
    const timer = setTimeout(() => {
      setRechercheTerm(recherche);
      setPagination(prev => ({ ...prev, current_page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [recherche]);

  // 🎯 CHARGEMENT DES DONNÉES
  const chargerDonnees = useCallback(async () => {
    try {
      setIsLoading(true);

      // Construction des paramètres
      const params = new URLSearchParams();
      params.append('page', pagination.current_page.toString());
      
      if (rechercheTerm) params.append('search', rechercheTerm);
      if (filtreCategorie !== 'all') params.append('categorie_id', filtreCategorie);
      if (filtreStock !== 'all') params.append('statut_stock', filtreStock);

      // Charger les produits avec pagination
      const produitsResponse = await apiFetch(`/produits?${params}`, {
        headers: { 'Accept': 'application/json' }
      });

      if (!produitsResponse.ok) throw new Error('Erreur lors du chargement des produits');
      
      const produitsData = await produitsResponse.json();
      
      // 🔄 Gestion des formats de réponse
      const produitsList = produitsData.data || produitsData;
      setProduits(Array.isArray(produitsList) ? produitsList : []);
      
      // 📄 Pagination
      if (produitsData.meta) {
        setPagination({
          current_page: produitsData.meta.current_page,
          last_page: produitsData.meta.last_page,
          per_page: produitsData.meta.per_page,
          total: produitsData.meta.total,
          from: produitsData.meta.from,
          to: produitsData.meta.to
        });
      }

      // Charger les catégories
      const categoriesResponse = await apiFetch('/categories', {
        headers: { 'Accept': 'application/json' }
      });

      if (!categoriesResponse.ok) throw new Error('Erreur lors du chargement des catégories');
      
      const categoriesData = await categoriesResponse.json();
      setCategories(Array.isArray(categoriesData) ? categoriesData : (categoriesData.data || []));

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Erreur chargement données:', message);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  }, [rechercheTerm, filtreCategorie, filtreStock, pagination.current_page]);

  const chargerStats = useCallback(async () => {
    try {
      const response = await apiFetch('/produits/statistiques', {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const statsData = await response.json();
        setStats(statsData);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Erreur chargement stats:', message);
    }
  }, []);

  // 🎯 GESTION PRODUITS (CRUD)
  const handleCreateProduit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/produits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          prix: parseFloat(formData.prix),
          quantite_stock: parseInt(formData.quantite_stock),
          seuil_alerte: parseInt(formData.seuil_alerte),
          categorie_id: parseInt(formData.categorie_id),
          image_url: formData.image_url || null,
          images: formData.images
        }),
      });

      if (!response.ok) throw new Error('Erreur lors de la création');

      const newProduit = await response.json();
      setProduits(prev => [newProduit, ...prev]);
      setShowFormDialog(false);
      resetForm();
      toast.success('Produit créé avec succès');
      chargerStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la création du produit';
      toast.error(message);
    }
  };

  const handleUpdateProduit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduit) return;

    try {
      const payload = {
        nom: formData.nom,
        description: formData.description,
        prix: parseFloat(formData.prix),
        seuil_alerte: parseInt(formData.seuil_alerte),
        categorie_id: parseInt(formData.categorie_id),
        est_perissable: formData.est_perissable,
        unite_mesure: formData.unite_mesure,
        image_url: formData.image_url || null,
        images: formData.images,
      };

      const response = await apiFetch(`/produits/${editingProduit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Erreur lors de la modification');

      const updatedProduit = await response.json();
      setProduits(prev => prev.map(p => p.id === editingProduit.id ? updatedProduit : p));
      setShowFormDialog(false);
      setEditingProduit(null);
      resetForm();
      toast.success('Produit modifié avec succès');
      chargerStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la modification du produit';
      toast.error(message);
    }
  };

  const handleDeleteProduit = async () => {
    if (!produitToDelete) return;

    try {
      const response = await apiFetch(`/produits/${produitToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Erreur lors de la suppression');

      setProduits(prev => prev.filter(p => p.id !== produitToDelete.id));
      setShowDeleteDialog(false);
      setProduitToDelete(null);
      toast.success('Produit supprimé avec succès');
      chargerStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la suppression du produit';
      toast.error(message);
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      description: '',
      prix: '',
      quantite_stock: '',
      seuil_alerte: '',
      categorie_id: '',
      est_perissable: false,
      unite_mesure: 'unité',
      image_url: '',
      images: []
    });
    setEditingProduit(null);
  };

  const openEditDialog = (produit: Produit) => {
    setEditingProduit(produit);
    setFormData({
      nom: produit.nom,
      description: produit.description,
      prix: produit.prix.toString(),
      quantite_stock: produit.quantite_stock.toString(),
      seuil_alerte: produit.seuil_alerte.toString(),
      categorie_id: produit.categorie_id.toString(),
      est_perissable: produit.est_perissable,
      unite_mesure: produit.unite_mesure,
      image_url: produit.image_url || '',
      images: produit.images || []
    });
    setShowFormDialog(true);
  };

  const openDeleteDialog = (produit: Produit) => {
    setProduitToDelete(produit);
    setShowDeleteDialog(true);
  };

  // 🎯 GESTION DES IMAGES
  const getDefaultImage = (produit: Produit) => {
    const categorie = categories.find(c => c.id === produit.categorie_id);
    const categorieNom = categorie?.nom.toLowerCase() || 'default';
    
    if (categorieNom.includes('electronique') || categorieNom.includes('tech')) {
      return defaultImages.electronique[0];
    } else if (categorieNom.includes('aliment') || categorieNom.includes('nourriture')) {
      return defaultImages.alimentation[0];
    } else if (categorieNom.includes('vetement') || categorieNom.includes('habillement')) {
      return defaultImages.vetements[0];
    } else if (categorieNom.includes('maison') || categorieNom.includes('décoration')) {
      return defaultImages.maison[0];
    } else {
      return defaultImages.default[0];
    }
  };

  const addImageUrl = () => {
    if (formData.image_url.trim()) {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, prev.image_url.trim()],
        image_url: ''
      }));
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // 🎯 GESTION CATÉGORIES (CRUD)
  const handleCreateCategorie = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(categorieForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur création catégorie');
      }

      const newCategorie = await response.json();
      setCategories(prev => [...prev, newCategorie]);
      setShowCategorieForm(false);
      resetCategorieForm();
      toast.success('Catégorie créée avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création de la catégorie');
    }
  };

  const handleUpdateCategorie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategorie) return;

    try {
      const response = await apiFetch(`/categories/${editingCategorie.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(categorieForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur modification catégorie');
      }

      const updatedCategorie = await response.json();
      setCategories(prev => prev.map(c => 
        c.id === editingCategorie.id ? updatedCategorie : c
      ));
      setShowCategorieForm(false);
      setEditingCategorie(null);
      resetCategorieForm();
      toast.success('Catégorie modifiée avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification de la catégorie');
    }
  };

  const handleDeleteCategorie = async () => {
    if (!categorieToDelete) return;

    try {
      const response = await apiFetch(`/categories/${categorieToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur suppression catégorie');
      }

      setCategories(prev => prev.filter(c => c.id !== categorieToDelete.id));
      setShowDeleteCategorieDialog(false);
      setCategorieToDelete(null);
      toast.success('Catégorie supprimée avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression de la catégorie');
    }
  };

  const resetCategorieForm = () => {
    setCategorieForm({
      nom: '',
      description: '',
      couleur: '#3b82f6',
      icone: 'Package'
    });
    setEditingCategorie(null);
  };

  // 🎯 PAGINATION
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, current_page: newPage }));
  };

  // 🎯 STATUT STOCK
  const getStatutStock = (produit: Produit) => {
    if (produit.quantite_stock === 0) return { label: 'Rupture', color: 'bg-red-500' };
    if (produit.quantite_stock <= produit.seuil_alerte) return { label: 'Alerte', color: 'bg-orange-500' };
    return { label: 'Normal', color: 'bg-green-500' };
  };

  // 🎯 FORMATAGE PRIX
  const formatPrix = (prix: number) => {
    return new Intl.NumberFormat('fr-FR').format(prix) + ' FCFA';
  };

  // 🎯 COMPOSANT IMAGE AVEC FALLBACK
  const ProductImage = ({ produit, className = "w-full h-full object-cover" }: { produit: Produit; className?: string }) => {
    const [imageError, setImageError] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    
    const images = produit.images && produit.images.length > 0 
      ? produit.images 
      : produit.image_url 
        ? [produit.image_url] 
        : [getDefaultImage(produit)];

    const currentImage = images[currentImageIndex];

    if (imageError) {
      return (
        <div className={`${className} bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center`}>
          <div className="text-center">
            <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <span className="text-xs text-slate-500">Image non disponible</span>
          </div>
        </div>
      );
    }

    return (
      <div className="relative group">
        <img 
          src={currentImage} 
          alt={produit.nom}
          className={className}
          onError={() => setImageError(true)}
        />
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
              }}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentImageIndex((prev) => (prev + 1) % images.length);
              }}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
              {images.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  // 🎯 COMPOSANT CARD PRODUIT GRID
  const ProductCard = ({ produit, index }: { produit: Produit; index: number }) => {
    const statut = getStatutStock(produit);
    const categorie = categories.find(c => c.id === produit.categorie_id);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ scale: 1.02, y: -5 }}
        className="group cursor-pointer"
      >
        <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-2xl transition-all duration-300 overflow-hidden">
          {/* Header avec image et statut */}
          <div className="relative">
            <div className="h-48 overflow-hidden">
              <ProductImage produit={produit} />
            </div>
            
            {/* Badge Statut */}
            <div className={`absolute top-4 right-4 ${statut.color} text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg`}>
              {statut.label}
            </div>

            {/* Badge Catégorie */}
            {categorie && (
              <div className="absolute top-4 left-4">
                <Badge 
                  variant="secondary" 
                  className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-0"
                  style={{ color: categorie.couleur }}
                >
                  {categorie.nom}
                </Badge>
              </div>
            )}

            {/* Menu Actions */}
            <div className="absolute top-4 right-16">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    setProduitSelectionne(produit);
                    setShowDialog(true);
                  }}>
                    <Eye className="w-4 h-4 mr-2" />
                    Voir détails
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/arrivage?produit_id=${produit.id}`} className="cursor-pointer">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Ajouter arrivage
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openEditDialog(produit)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Modifier
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => openDeleteDialog(produit)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <CardContent className="p-6">
            {/* Nom et Description */}
            <div className="space-y-3">
              <h3 className="font-bold text-xl text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors">
                {produit.nom}
              </h3>
              
              <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2">
                {produit.description}
              </p>

              {/* Prix */}
              <div className="text-2xl font-bold text-green-600">
                {formatPrix(produit.prix)}
              </div>

              {/* Métriques Stock */}
              <div className="flex items-center justify-between text-sm">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${statut.color}`}></div>
                    <span className="text-slate-600 dark:text-slate-400">
                      Stock: <strong className="text-slate-900 dark:text-white">{produit.quantite_stock}</strong>
                    </span>
                  </div>
                  <div className="text-slate-500 text-xs">
                    Seuil alerte: {produit.seuil_alerte}
                  </div>
                </div>

                {produit.est_perissable && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    Périssable
                  </Badge>
                )}
              </div>

              {/* Barre de progression stock */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    statut.color === 'bg-red-500' ? 'bg-red-500' :
                    statut.color === 'bg-orange-500' ? 'bg-orange-500' : 'bg-green-500'
                  }`}
                  style={{ 
                    width: `${Math.min(100, (produit.quantite_stock / (produit.seuil_alerte * 3)) * 100)}%` 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // 🎯 COMPOSANT LIGNE PRODUIT LISTE
  const ProductRow = ({ produit, index }: { produit: Produit; index: number }) => {
    const statut = getStatutStock(produit);
    const categorie = categories.find(c => c.id === produit.categorie_id);

    return (
      <motion.tr
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors group"
      >
        <td className="px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
              <ProductImage produit={produit} className="w-10 h-10 object-cover" />
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                {produit.nom}
              </div>
              <div className="text-sm text-slate-500 line-clamp-1">
                {produit.description}
              </div>
            </div>
          </div>
        </td>

        <td className="px-6 py-4">
          {categorie && (
            <Badge 
              variant="secondary" 
              className="border-0"
              style={{ 
                backgroundColor: `${categorie.couleur}20`,
                color: categorie.couleur
              }}
            >
              {categorie.nom}
            </Badge>
          )}
        </td>

        <td className="px-6 py-4 text-right font-mono">
          {formatPrix(produit.prix)}
        </td>

        <td className="px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className={`w-2 h-2 rounded-full ${statut.color}`}></div>
            <span className={`font-medium ${
              statut.color === 'bg-red-500' ? 'text-red-600' :
              statut.color === 'bg-orange-500' ? 'text-orange-600' : 'text-green-600'
            }`}>
              {produit.quantite_stock}
            </span>
            <span className="text-sm text-slate-500">
              / {produit.seuil_alerte}
            </span>
          </div>
        </td>

        <td className="px-6 py-4">
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => {
                setProduitSelectionne(produit);
                setShowDialog(true);
              }}
            >
              <Eye className="w-3 h-3" />
            </Button>
            <Link href={`/arrivage?produit_id=${produit.id}`}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-green-600 hover:text-green-700"
              >
                <TrendingUp className="w-3 h-3" />
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => openEditDialog(produit)}
            >
              <Edit className="w-3 h-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700"
              onClick={() => openDeleteDialog(produit)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </td>
      </motion.tr>
    );
  };

  // 🎯 FORMULAIRE PRODUIT
  const ProductForm = () => (
    <form onSubmit={editingProduit ? handleUpdateProduit : handleCreateProduit}>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom du produit *</Label>
            <Input
              id="nom"
              value={formData.nom}
              onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
              placeholder="Nom du produit"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prix">Prix (FCFA) *</Label>
            <Input
              id="prix"
              type="number"
              step="0.01"
              min="0"
              value={formData.prix}
              onChange={(e) => setFormData(prev => ({ ...prev, prix: e.target.value }))}
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Description du produit"
            rows={3}
          />
        </div>

        {/* 🎯 SECTION IMAGES */}
        <div className="space-y-4">
          <Label>Images du produit</Label>
          
          {/* Aperçu des images existantes */}
          {formData.images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {formData.images.map((url, index) => (
                <div key={index} className="relative group">
                  <img 
                    src={url} 
                    alt={`Preview ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Champ URL d'image */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://example.com/image.jpg"
                type="url"
              />
            </div>
            <Button type="button" onClick={addImageUrl} variant="outline">
              <Link className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Collez l'URL d'une image existante sur le web. Vous pouvez ajouter plusieurs images.
          </p>

          {/* Suggestions d'images par défaut */}
          <div className="space-y-2">
            <Label className="text-sm">Images suggérées par catégorie</Label>
            <div className="grid grid-cols-3 gap-2">
              {formData.categorie_id && (() => {
                const categorie = categories.find(c => c.id === parseInt(formData.categorie_id));
                const categorieNom = categorie?.nom.toLowerCase() || 'default';
                let suggestedImages = defaultImages.default;

                if (categorieNom.includes('electronique') || categorieNom.includes('tech')) {
                  suggestedImages = defaultImages.electronique;
                } else if (categorieNom.includes('aliment') || categorieNom.includes('nourriture')) {
                  suggestedImages = defaultImages.alimentation;
                } else if (categorieNom.includes('vetement') || categorieNom.includes('habillement')) {
                  suggestedImages = defaultImages.vetements;
                } else if (categorieNom.includes('maison') || categorieNom.includes('décoration')) {
                  suggestedImages = defaultImages.maison;
                }

                return suggestedImages.map((url, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, images: [...prev.images, url] }))}
                    className="relative group"
                  >
                    <img 
                      src={url} 
                      alt={`Suggestion ${index + 1}`}
                      className="w-full h-16 object-cover rounded-lg border-2 border-transparent hover:border-blue-500 transition-colors"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <Plus className="w-4 h-4 text-white" />
                    </div>
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {!editingProduit ? (
            <div className="space-y-2">
              <Label htmlFor="quantite_stock">Quantité en stock *</Label>
              <Input
                id="quantite_stock"
                type="number"
                min="0"
                value={formData.quantite_stock}
                onChange={(e) => setFormData(prev => ({ ...prev, quantite_stock: e.target.value }))}
                placeholder="0"
                required
              />
            </div>
          ) : (
            <div className="col-span-3 rounded-xl border border-dashed border-slate-300 p-4 bg-slate-50 dark:bg-slate-900">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Le stock est géré via les mouvements d&apos;arrivage et de vente.
                Pour ajuster la quantité, utilisez la page d&apos;arrivage dédiée.
              </p>
              <Button
                className="mt-3"
                variant="secondary"
                onClick={() => window.location.href = '/arrivage'}
              >
                Ouvrir la page Arrivage
              </Button>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="seuil_alerte">Seuil d'alerte *</Label>
            <Input
              id="seuil_alerte"
              type="number"
              min="0"
              value={formData.seuil_alerte}
              onChange={(e) => setFormData(prev => ({ ...prev, seuil_alerte: e.target.value }))}
              placeholder="0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unite_mesure">Unité de mesure *</Label>
            <Select
              value={formData.unite_mesure}
              onValueChange={(value) => setFormData(prev => ({ ...prev, unite_mesure: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unité">Unité</SelectItem>
                <SelectItem value="kg">Kilogramme</SelectItem>
                <SelectItem value="g">Gramme</SelectItem>
                <SelectItem value="L">Litre</SelectItem>
                <SelectItem value="mL">Millilitre</SelectItem>
                <SelectItem value="m">Mètre</SelectItem>
                <SelectItem value="cm">Centimètre</SelectItem>
                <SelectItem value="paquet">Paquet</SelectItem>
                <SelectItem value="carton">Carton</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="categorie_id">Catégorie *</Label>
            <Select
              value={formData.categorie_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, categorie_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(categorie => (
                  <SelectItem key={categorie.id} value={categorie.id.toString()}>
                    {categorie.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex items-center justify-end pt-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="est_perissable"
                checked={formData.est_perissable}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, est_perissable: checked }))}
              />
              <Label htmlFor="est_perissable">Produit périssable</Label>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => {
          setShowFormDialog(false);
          resetForm();
        }}>
          Annuler
        </Button>
        <Button type="submit">
          <Save className="w-4 h-4 mr-2" />
          {editingProduit ? 'Modifier' : 'Créer'} le produit
        </Button>
      </DialogFooter>
    </form>
  );

  if (!user) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header Élite */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Gestion Produits Élite
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {pagination.total} produits dans votre catalogue
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              onClick={() => setShowStatsDialog(true)}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Statistiques
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowCategoriesDialog(true)}
            >
              <Tag className="w-4 h-4 mr-2" />
              Catégories
            </Button>
            <Button 
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold"
              onClick={() => setShowFormDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Produit
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 space-y-6">
        {/* Barre de Contrôle Avancée */}
        <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* Recherche */}
              <div className="flex-1 w-full lg:max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Rechercher un produit..."
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    className="pl-10 bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600"
                  />
                </div>
              </div>

              {/* Filtres */}
              <div className="flex flex-wrap gap-3">
                {/* Filtre Catégorie */}
                <select 
                  value={filtreCategorie}
                  onChange={(e) => setFiltreCategorie(e.target.value)}
                  className="px-3 py-2 bg-white/50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Toutes catégories</option>
                  {categories.map(categorie => (
                    <option key={categorie.id} value={categorie.id}>
                      {categorie.nom}
                    </option>
                  ))}
                </select>

                {/* Filtre Stock */}
                <select 
                  value={filtreStock}
                  onChange={(e) => setFiltreStock(e.target.value)}
                  className="px-3 py-2 bg-white/50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tous les stocks</option>
                  <option value="normal">Stock normal</option>
                  <option value="alerte">En alerte</option>
                  <option value="rupture">En rupture</option>
                  <option value="perissable">Périssables</option>
                </select>

                {/* Toggle Vue */}
                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                  <Button
                    variant={vue === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setVue('grid')}
                    className={vue === 'grid' ? 'bg-white dark:bg-slate-600 shadow-sm' : ''}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={vue === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setVue('list')}
                    className={vue === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm' : ''}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistiques Rapides */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { 
              label: 'Total Produits', 
              value: stats?.total_produits ?? produits.length, 
              color: 'text-blue-600', 
              icon: Package 
            },
            { 
              label: 'En Alerte', 
              value: stats?.produits_en_alerte ?? produits.filter(p => p.quantite_stock <= p.seuil_alerte && p.quantite_stock > 0).length, 
              color: 'text-orange-600', 
              icon: AlertTriangle 
            },
            { 
              label: 'En Rupture', 
              value: stats?.produits_en_rupture ?? produits.filter(p => p.quantite_stock === 0).length, 
              color: 'text-red-600', 
              icon: Package 
            },
            { 
              label: 'Périssables', 
              value: produits.filter(p => p.est_perissable).length, 
              color: 'text-green-600', 
              icon: Tag 
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {stat.label}
                      </p>
                      <p className={`text-2xl font-bold ${stat.color}`}>
                        {isLoading ? '-' : stat.value}
                      </p>
                    </div>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color.replace('text', 'bg').replace('-600', '-600/10')}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Liste des Produits */}
        {vue === 'grid' ? (
          // Vue Grid
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {isLoading ? (
                // Skeleton Grid
                Array.from({ length: 8 }).map((_, index) => (
                  <Card key={index} className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 animate-pulse">
                    <div className="h-48 bg-slate-200 dark:bg-slate-700"></div>
                    <CardContent className="p-6 space-y-3">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
                      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))
              ) : produits.length > 0 ? (
                <AnimatePresence>
                  {produits.map((produit, index) => (
                    <ProductCard key={produit.id} produit={produit} index={index} />
                  ))}
                </AnimatePresence>
              ) : (
                <div className="col-span-full text-center py-16">
                  <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    Aucun produit trouvé
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Aucun produit ne correspond à vos critères de recherche.
                  </p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {!isLoading && pagination.last_page > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Affichage de {pagination.from} à {pagination.to} sur {pagination.total} produits
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.current_page - 1)}
                    disabled={pagination.current_page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  {Array.from({ length: Math.min(5, pagination.last_page) }, (_, i) => {
                    let pageNum;
                    if (pagination.last_page <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.current_page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.current_page >= pagination.last_page - 2) {
                      pageNum = pagination.last_page - 4 + i;
                    } else {
                      pageNum = pagination.current_page - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.current_page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.current_page + 1)}
                    disabled={pagination.current_page === pagination.last_page}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Vue Liste
          <Card className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200/50 dark:border-slate-700/50">
                      <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">Produit</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">Catégorie</th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">Prix</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">Stock</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index} className="border-b border-slate-200/50 dark:border-slate-700/50 animate-pulse">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                              <div className="space-y-2">
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-auto"></div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex space-x-2">
                              <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                              <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                              <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : produits.length > 0 ? (
                      <AnimatePresence>
                        {produits.map((produit, index) => (
                          <ProductRow key={produit.id} produit={produit} index={index} />
                        ))}
                      </AnimatePresence>
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-16 text-center">
                          <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                            Aucun produit trouvé
                          </h3>
                          <p className="text-slate-600 dark:text-slate-400">
                            Aucun produit ne correspond à vos critères de recherche.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination pour la vue liste */}
              {!isLoading && pagination.last_page > 1 && (
                <div className="flex items-center justify-between p-6 border-t border-slate-200/50 dark:border-slate-700/50">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Affichage de {pagination.from} à {pagination.to} sur {pagination.total} produits
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.current_page - 1)}
                      disabled={pagination.current_page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    
                    {Array.from({ length: Math.min(5, pagination.last_page) }, (_, i) => {
                      let pageNum;
                      if (pagination.last_page <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.current_page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.current_page >= pagination.last_page - 2) {
                        pageNum = pagination.last_page - 4 + i;
                      } else {
                        pageNum = pagination.current_page - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={pagination.current_page === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.current_page + 1)}
                      disabled={pagination.current_page === pagination.last_page}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Dialog Formulaire Produit */}
      <Dialog open={showFormDialog} onOpenChange={(open) => {
        setShowFormDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduit ? 'Modifier le produit' : 'Ajouter un nouveau produit'}
            </DialogTitle>
            <DialogDescription>
              {editingProduit 
                ? 'Modifiez les informations du produit.' 
                : 'Remplissez les informations du produit à ajouter à votre catalogue.'
              }
            </DialogDescription>
          </DialogHeader>
          <ProductForm />
        </DialogContent>
      </Dialog>

      {/* Dialog Détails Produit */}
      <AnimatePresence>
        {showDialog && produitSelectionne && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Détails du Produit</DialogTitle>
                <DialogDescription>
                  Informations complètes sur le produit sélectionné
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Image et Métriques */}
                <div className="space-y-4">
                  <div className="h-64 rounded-xl overflow-hidden">
                    <ProductImage produit={produitSelectionne} className="w-full h-64" />
                  </div>
                  
                  {/* Miniatures si plusieurs images */}
                  {produitSelectionne.images && produitSelectionne.images.length > 1 && (
                    <div className="grid grid-cols-3 gap-2">
                      {produitSelectionne.images.map((url, index) => (
                        <img 
                          key={index}
                          src={url} 
                          alt={`${produitSelectionne.nom} ${index + 1}`}
                          className="w-full h-16 object-cover rounded-lg cursor-pointer border-2 border-transparent hover:border-blue-500 transition-colors"
                        />
                      ))}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Stock Actuel', value: produitSelectionne.quantite_stock, color: 'text-blue-600' },
                      { label: 'Seuil Alerte', value: produitSelectionne.seuil_alerte, color: 'text-orange-600' },
                      { label: 'Unité', value: produitSelectionne.unite_mesure, color: 'text-purple-600' },
                      { label: 'Statut', value: getStatutStock(produitSelectionne).label, color: getStatutStock(produitSelectionne).color.replace('bg-', 'text-') },
                    ].map((item, index) => (
                      <Card key={index} className="bg-slate-50 dark:bg-slate-700/50 border-0">
                        <CardContent className="p-4 text-center">
                          <div className={`text-2xl font-bold ${item.color} mb-1`}>
                            {item.value}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {item.label}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Informations */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                      {produitSelectionne.nom}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {produitSelectionne.description || 'Aucune description'}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <span className="text-slate-600 dark:text-slate-400">Prix de vente</span>
                      <span className="text-3xl font-bold text-green-600">
                        {formatPrix(produitSelectionne.prix)}
                      </span>
                    </div>

                    {produitSelectionne.est_perissable && (
                      <Badge variant="outline" className="w-full justify-center py-3 text-orange-600 border-orange-300">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Produit Périssable
                      </Badge>
                    )}

                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setShowDialog(false);
                          openEditDialog(produitSelectionne);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Modifier
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => {
                          setShowDialog(false);
                          openDeleteDialog(produitSelectionne);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Dialog Confirmation Suppression */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer le produit "{produitToDelete?.nom}" ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduit}>
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Statistiques */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Statistiques des Produits</DialogTitle>
            <DialogDescription>
              Vue d'ensemble de votre inventaire et indicateurs clés
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inventaire</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total produits:</span>
                  <strong>{stats?.total_produits ?? '-'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>En alerte:</span>
                  <strong className="text-orange-600">{stats?.produits_en_alerte ?? '-'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>En rupture:</span>
                  <strong className="text-red-600">{stats?.produits_en_rupture ?? '-'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Périssables:</span>
                  <strong>{produits.filter(p => p.est_perissable).length}</strong>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Valeur du Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 text-center">
                  {stats?.valeur_stock_total ? formatPrix(stats.valeur_stock_total) : '-'}
                </div>
                <p className="text-sm text-slate-500 text-center mt-2">
                  Valeur totale de l'inventaire
                </p>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Gestion Catégories */}
      <Dialog open={showCategoriesDialog} onOpenChange={setShowCategoriesDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Gestion des Catégories</DialogTitle>
            <DialogDescription>
              Créer et gérer les catégories de produits
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* En-tête avec statistiques */}
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-semibold">Liste des catégories</h4>
                <p className="text-sm text-slate-600">
                  {categories.length} catégorie(s) définie(s)
                </p>
              </div>
              <Button 
                size="sm"
                onClick={() => {
                  resetCategorieForm();
                  setShowCategorieForm(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle catégorie
              </Button>
            </div>

            {/* Tableau des catégories */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Nombre de produits</TableHead>
                    <TableHead>Couleur</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map(categorie => (
                    <TableRow key={categorie.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <span>{categorie.nom}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">
                          {categorie.description || 'Aucune description'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={categorie.produits_count && categorie.produits_count > 0 ? "default" : "secondary"}>
                          {categorie.produits_count || 0} produit(s)
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-6 h-6 rounded-full border"
                            style={{ backgroundColor: categorie.couleur }}
                          />
                          <span className="text-sm text-slate-600">
                            {categorie.couleur}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setEditingCategorie(categorie);
                              setCategorieForm({
                                nom: categorie.nom,
                                description: categorie.description || '',
                                couleur: categorie.couleur,
                                icone: categorie.icone || 'Package'
                              });
                              setShowCategorieForm(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              setCategorieToDelete(categorie);
                              setShowDeleteCategorieDialog(true);
                            }}
                            disabled={(categorie.produits_count || 0) > 0}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Message si aucune catégorie */}
            {categories.length === 0 && (
              <div className="text-center py-8">
                <Tag className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h4 className="font-semibold text-slate-900 mb-2">
                  Aucune catégorie définie
                </h4>
                <p className="text-slate-600 mb-4">
                  Créez votre première catégorie pour organiser vos produits
                </p>
                <Button onClick={() => {
                  resetCategorieForm();
                  setShowCategorieForm(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une catégorie
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Formulaire Catégorie */}
      <Dialog open={showCategorieForm} onOpenChange={(open) => {
        setShowCategorieForm(open);
        if (!open) resetCategorieForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategorie ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </DialogTitle>
            <DialogDescription>
              {editingCategorie 
                ? 'Modifiez les informations de la catégorie.' 
                : 'Remplissez les informations pour créer une nouvelle catégorie.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={editingCategorie ? handleUpdateCategorie : handleCreateCategorie}>
            <div className="grid gap-4 py-4">
              {/* Nom */}
              <div className="space-y-2">
                <Label htmlFor="nom-categorie">Nom de la catégorie *</Label>
                <Input
                  id="nom-categorie"
                  value={categorieForm.nom}
                  onChange={(e) => setCategorieForm(prev => ({ ...prev, nom: e.target.value }))}
                  placeholder="Nom de la catégorie"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description-categorie">Description</Label>
                <Textarea
                  id="description-categorie"
                  value={categorieForm.description}
                  onChange={(e) => setCategorieForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description de la catégorie"
                  rows={3}
                />
              </div>

              {/* Couleur */}
              <div className="space-y-2">
                <Label htmlFor="couleur-categorie">Couleur</Label>
                <div className="flex items-center space-x-3">
                  <Input
                    id="couleur-categorie"
                    type="color"
                    value={categorieForm.couleur}
                    onChange={(e) => setCategorieForm(prev => ({ ...prev, couleur: e.target.value }))}
                    className="w-20 h-10 p-1"
                  />
                  <div 
                    className="w-8 h-8 rounded border"
                    style={{ backgroundColor: categorieForm.couleur }}
                  />
                  <span className="text-sm text-slate-600">
                    {categorieForm.couleur}
                  </span>
                </div>
              </div>

              {/* Icône */}
              <div className="space-y-2">
                <Label htmlFor="icone-categorie">Icône</Label>
                <Select
                  value={categorieForm.icone}
                  onValueChange={(value) => setCategorieForm(prev => ({ ...prev, icone: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une icône" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Package">Package</SelectItem>
                    <SelectItem value="Tag">Tag</SelectItem>
                    <SelectItem value="ShoppingCart">ShoppingCart</SelectItem>
                    <SelectItem value="Home">Home</SelectItem>
                    <SelectItem value="Smartphone">Smartphone</SelectItem>
                    <SelectItem value="Shirt">Shirt</SelectItem>
                    <SelectItem value="Utensils">Utensils</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Aperçu */}
              <div className="p-4 border rounded-lg bg-slate-50">
                <Label>Aperçu de la catégorie</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge 
                    style={{ 
                      backgroundColor: `${categorieForm.couleur}20`,
                      color: categorieForm.couleur
                    }}
                  >
                    {categorieForm.nom || 'Nom de catégorie'}
                  </Badge>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowCategorieForm(false);
                  resetCategorieForm();
                }}
              >
                Annuler
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                {editingCategorie ? 'Modifier' : 'Créer'} la catégorie
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmation Suppression Catégorie */}
      <Dialog open={showDeleteCategorieDialog} onOpenChange={setShowDeleteCategorieDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              {categorieToDelete && (
                <>
                  Êtes-vous sûr de vouloir supprimer la catégorie 
                  <strong> "{categorieToDelete.nom}"</strong> ?
                  <br />
                  <span className="text-red-600 font-medium mt-2 block">
                    {(categorieToDelete.produits_count || 0) > 0 
                      ? `ATTENTION: ${categorieToDelete.produits_count} produit(s) utilisent cette catégorie. La suppression est impossible.`
                      : 'Cette action est irréversible.'
                    }
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteCategorieDialog(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteCategorie}
              disabled={categorieToDelete && (categorieToDelete.produits_count || 0) > 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}