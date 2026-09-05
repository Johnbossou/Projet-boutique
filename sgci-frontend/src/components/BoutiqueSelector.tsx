'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Boutique } from '@/types';
import { Store, ChevronDown, Loader2 } from 'lucide-react';

export function BoutiqueSelector() {
  const { user, switchBoutique } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Only show when the user has access to multiple boutiques
  if (!user || !user.boutiques || user.boutiques.length <= 1) {
    return null;
  }

  const currentBoutique = user.current_boutique;
  const boutiques = user.boutiques || [];

  const handleSwitchBoutique = async (boutiqueId: number) => {
    if (boutiqueId === currentBoutique?.id) return;
    setIsLoading(true);
    setIsOpen(false);
    try {
      await switchBoutique(boutiqueId);
      // Recharger la page pour repartir sur un état propre avec la nouvelle boutique.
      window.location.reload();
    } catch (error) {
      console.error('Erreur lors du changement de boutique:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
        ) : (
          <Store className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        )}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {currentBoutique?.nom || 'Sélectionner une boutique'}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1">
              Vos boutiques
            </p>
            {boutiques.map((boutique: Boutique) => (
              <button
                key={boutique.id}
                onClick={() => handleSwitchBoutique(boutique.id)}
                disabled={isLoading || boutique.id === currentBoutique?.id}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  boutique.id === currentBoutique?.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>{boutique.nom}</span>
                {boutique.role_dans_boutique && (
                  <span className="text-xs capitalize text-muted-foreground">
                    {boutique.role_dans_boutique}
                  </span>
                )}
                {boutique.id === currentBoutique?.id && (
                  <span className="ml-auto text-xs text-blue-600 dark:text-blue-400">
                    Actuelle
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
