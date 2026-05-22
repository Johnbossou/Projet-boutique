'use client';

import { useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface Produit {
  id: number;
  nom: string;
  prix: number;
  quantite_stock: number;
}

interface BarcodeScanFieldProps {
  onProduitFound: (produit: Produit) => void;
  placeholder?: string;
}

export function BarcodeScanField({ onProduitFound, placeholder }: BarcodeScanFieldProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/produits/code/${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Code inconnu');
      }
      const produit = await res.json();
      onProduitFound(produit);
      setCode('');
      toast.success(`Produit : ${produit.nom}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Scan échoué');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && lookup()}
        placeholder={placeholder ?? 'Scanner code-barres / QR / ID'}
        className="flex-1"
      />
      <Button type="button" variant="outline" onClick={lookup} disabled={loading}>
        <ScanBarcode className="w-4 h-4" />
      </Button>
    </div>
  );
}
