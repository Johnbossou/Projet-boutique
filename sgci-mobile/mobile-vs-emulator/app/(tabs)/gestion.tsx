import { router } from 'expo-router';
import {
  ArrowDownUp,
  BarChart3,
  Brain,
  ClipboardList,
  FileText,
  MessageSquare,
  Settings,
  ShoppingBag,
  Users,
} from 'lucide-react-native';
import React from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, FontSize, Radii, Spacing } from '@/constants/theme';

interface Module {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  route: string;
  role: 'tous' | 'gerant';
}

const MODULES: Module[] = [
  {
    key: 'clients',
    label: 'Clients',
    description: 'Fiches et fidélisation',
    icon: Users,
    route: '/clients',
    role: 'tous',
  },
  {
    key: 'messages',
    label: 'Messages',
    description: 'Notifications clients',
    icon: MessageSquare,
    route: '/messages',
    role: 'tous',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Chiffres et tendances',
    icon: BarChart3,
    route: '/analytics',
    role: 'gerant',
  },
  {
    key: 'ia',
    label: 'Assistant IA',
    description: 'Prévisions de stock',
    icon: Brain,
    route: '/ia',
    role: 'gerant',
  },
  {
    key: 'inventaire',
    label: 'Inventaire',
    description: 'Comptage physique',
    icon: ClipboardList,
    route: '/inventaire',
    role: 'gerant',
  },
  {
    key: 'arrivage',
    label: 'Arrivage',
    description: 'Entrées de marchandise',
    icon: ArrowDownUp,
    route: '/arrivage',
    role: 'gerant',
  },
  {
    key: 'devis',
    label: 'Devis',
    description: 'Devis et devis clients',
    icon: FileText,
    route: '/devis',
    role: 'gerant',
  },
  {
    key: 'retours',
    label: 'Retours',
    description: 'Retours et remboursements',
    icon: ShoppingBag,
    route: '/retours',
    role: 'gerant',
  },
  {
    key: 'parametres',
    label: 'Paramètres',
    description: 'Compte et boutique',
    icon: Settings,
    route: '/parametres',
    role: 'tous',
  },
];

export default function GestionScreen() {
  const { user } = useAuth();
  const peutGerer = user?.role === 'gerant' || user?.role === 'proprietaire';

  const modules = MODULES.filter((m) => m.role === 'tous' || peutGerer);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion</Text>
        <Text style={styles.headerSubtitle}>
          {peutGerer
            ? 'Tous les outils de la boutique'
            : 'Vos outils de travail au quotidien'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}>
        {modules.map((m) => {
          const Icon = m.icon;
          const isGavant = m.role === 'gerant';
          return (
            <TouchableOpacity
              key={m.key}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push(m.route as never)}>
              <View style={styles.cardIcon}>
                <Icon size={22} color={Colors.dark.primary} />
              </View>
              <Text style={styles.cardLabel}>{m.label}</Text>
              <Text style={styles.cardDescription} numberOfLines={1}>
                {m.description}
              </Text>
              {isGavant && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>Gérant</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.bottomSpacer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? Spacing.lg : Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: Colors.dark.muted,
    fontSize: FontSize.md,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  card: {
    width: '48%',
    backgroundColor: Colors.dark.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.md,
    minHeight: 132,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  cardLabel: {
    color: Colors.dark.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  cardDescription: {
    color: Colors.dark.muted,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  roleBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderRadius: Radii.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleBadgeText: {
    color: Colors.dark.accent,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 8,
  },
});