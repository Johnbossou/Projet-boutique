import React, { useState, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Store, ChevronDown } from 'lucide-react-native';

const BoutiqueSelector = memo(function BoutiqueSelector() {
  const { user, switchBoutique } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Only show for proprietaires with multiple boutiques
  if (!user || user.role !== 'proprietaire' || !user.boutiques || user.boutiques.length <= 1) {
    return null;
  }

  const currentBoutique = user.current_boutique;
  const boutiques = user.boutiques || [];

  const handleSwitchBoutique = useCallback(async (boutiqueId: number) => {
    setIsLoading(true);
    try {
      await switchBoutique(boutiqueId);
      setIsOpen(false);
    } catch (error) {
      console.error('Erreur lors du changement de boutique:', error);
    } finally {
      setIsLoading(false);
    }
  }, [switchBoutique]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        style={styles.selectorButton}
      >
        <Store size={20} color="#3b82f6" />
        <Text style={styles.selectorText}>
          {currentBoutique?.nom || 'Sélectionner une boutique'}
        </Text>
        <ChevronDown size={20} color="#6b7280" />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Vos boutiques</Text>
            
            <ScrollView style={styles.boutiqueList}>
              {boutiques.map((boutique: any) => (
                <TouchableOpacity
                  key={boutique.id}
                  onPress={() => handleSwitchBoutique(boutique.id)}
                  disabled={isLoading || boutique.id === currentBoutique?.id}
                  style={[
                    styles.boutiqueItem,
                    boutique.id === currentBoutique?.id && styles.boutiqueItemActive,
                  ]}
                >
                  <View style={styles.boutiqueIcon}>
                    <Store size={20} color={boutique.id === currentBoutique?.id ? "#3b82f6" : "#f97316"} />
                  </View>
                  <View style={styles.boutiqueInfo}>
                    <Text style={styles.boutiqueName}>{boutique.nom}</Text>
                    <Text style={styles.boutiqueAddress}>{boutique.adresse || 'Adresse non renseignée'}</Text>
                  </View>
                  {boutique.id === currentBoutique?.id && (
                    <Text style={styles.currentBadge}>Actuelle</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setIsOpen(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
});

export default BoutiqueSelector;

const styles = StyleSheet.create({
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectorText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  boutiqueList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  boutiqueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  boutiqueItemActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  boutiqueIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boutiqueInfo: {
    flex: 1,
  },
  boutiqueName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  boutiqueAddress: {
    fontSize: 12,
    color: '#6b7280',
  },
  currentBadge: {
    fontSize: 12,
    color: '#3b82f6',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  closeButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});
