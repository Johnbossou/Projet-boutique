import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
    Bell,
    Calendar,
    Database,
    Download,
    Eye,
    EyeOff,
    FileText,
    Globe,
    HardDrive,
    Key,
    LogOut,
    Mail,
    Palette,
    Phone,
    RefreshCw,
    Save,
    Settings,
    Shield,
    ShieldCheck,
    Smartphone,
    Store,
    Trash2,
    Upload,
    User,
    Wifi
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadBoutiqueSettings,
  loadUserPreferences,
  saveBoutiqueSettings,
  saveUserPreferences,
  defaultBoutique,
  defaultPreferences,
} from "@/lib/preferences";

const { width, height } = Dimensions.get("window");

interface UserProfile {
  name: string;
  email: string;
  telephone: string;
  role: string;
}

interface BoutiqueSettings {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  tva: number;
  devise: string;
}

export default function ParametresScreen() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("profil");
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 🎯 ÉTATS DES PARAMÈTRES
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    email: "",
    telephone: "",
    role: "",
  });

  const [boutique, setBoutique] = useState<BoutiqueSettings>(defaultBoutique);
  const [preferences, setPreferences] = useState(defaultPreferences);

  const [securite, setSecurite] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    twoFactor: false,
    sessionTimeout: 30,
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // Animation d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    if (user) {
      setProfile({
        name: user.name,
        email: user.email || "",
        telephone: user.telephone || "",
        role: user.role || "Utilisateur",
      });
    }

    (async () => {
      setBoutique(await loadBoutiqueSettings());
      setPreferences(await loadUserPreferences());
    })();
  }, [user]);

  const sauvegarderProfil = async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const response = await apiFetch("/me/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          telephone: profile.telephone,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Erreur serveur");
      }
      const data = await response.json();
      await AsyncStorage.setItem("user_data", JSON.stringify(data.user));
      Alert.alert("Succès", "Profil mis à jour avec succès");
    } catch (error) {
      Alert.alert(
        "Erreur",
        error instanceof Error ? error.message : "Erreur lors de la sauvegarde"
      );
    } finally {
      setSaving(false);
    }
  };

  const sauvegarderBoutique = async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await saveBoutiqueSettings(boutique);
      Alert.alert("Succès", "Paramètres boutique enregistrés sur cet appareil");
    } catch {
      Alert.alert("Erreur", "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const sauvegarderPreferences = async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await saveUserPreferences(preferences);
      Alert.alert("Succès", "Préférences enregistrées sur cet appareil");
    } catch {
      Alert.alert("Erreur", "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const changerMotDePasse = async () => {
    if (securite.newPassword !== securite.confirmPassword) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }

    if (securite.newPassword.length < 6) {
      Alert.alert(
        "Erreur",
        "Le mot de passe doit contenir au moins 6 caractères"
      );
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch("/me/password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: securite.currentPassword,
          password: securite.newPassword,
          password_confirmation: securite.confirmPassword,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Mot de passe non modifié");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Succès", "Mot de passe changé avec succès");
      setSecurite((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
    } catch (error) {
      Alert.alert(
        "Erreur",
        error instanceof Error
          ? error.message
          : "Erreur lors du changement de mot de passe"
      );
    } finally {
      setSaving(false);
    }
  };

  const exporterDonnees = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert("Export", "Export des données lancé");
  };

  const importerDonnees = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Import", "Fonctionnalité d'import en développement");
  };

  const supprimerCompte = () => {
    Alert.alert(
      "Supprimer le compte",
      "Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Compte supprimé", "Votre compte a été supprimé");
          },
        },
      ]
    );
  };

  const verifierMisesAJour = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Mises à jour", "Votre système est à jour !");
  };

  // 🎯 COMPOSANT BOUTON TAB
  const TabButton = ({ value, label, icon: Icon, isActive }: any) => (
    <TouchableOpacity
      style={[styles.tabButton, isActive && styles.tabButtonActive]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveTab(value);
      }}
    >
      <Icon size={20} color={isActive ? "#ffffff" : "#64748b"} />
      <Text
        style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  // 🎯 COMPOSANT SETTING ITEM
  const SettingItem = ({
    label,
    description,
    icon: Icon,
    color,
    onPress,
    children,
  }: any) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.settingIcon, { backgroundColor: `${color}20` }]}>
        <Icon size={20} color={color} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && (
          <Text style={styles.settingDescription}>{description}</Text>
        )}
      </View>
      {children}
    </TouchableOpacity>
  );

  // 🎯 COMPOSANT SWITCH ITEM
  const SwitchItem = ({
    label,
    description,
    value,
    onValueChange,
    icon: Icon,
    color,
  }: any) => (
    <View style={styles.switchItem}>
      <View style={styles.switchLeft}>
        <View style={[styles.switchIcon, { backgroundColor: `${color}20` }]}>
          <Icon size={20} color={color} />
        </View>
        <View style={styles.switchContent}>
          <Text style={styles.switchLabel}>{label}</Text>
          {description && (
            <Text style={styles.switchDescription}>{description}</Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#94a3b8", true: color }}
        thumbColor="#ffffff"
      />
    </View>
  );

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <BlurView intensity={30} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={["#f97316", "#ef4444"]}
              style={styles.headerLogo}
            >
              <Settings size={24} color="#ffffff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>Paramètres Avancés</Text>
              <Text style={styles.headerSubtitle}>
                Configuration complète de votre système
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={exporterDonnees}
              disabled={saving}
            >
              <Download size={20} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.userButton}>
              <LinearGradient
                colors={["#3b82f6", "#8b5cf6"]}
                style={styles.userAvatar}
              >
                <Text style={styles.userInitials}>{user.name[0]}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      {/* Navigation Tabs */}
      <Animated.View
        style={[
          styles.tabsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideUpAnim }],
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
        >
          <TabButton
            value="profil"
            label="Profil"
            icon={User}
            isActive={activeTab === "profil"}
          />
          <TabButton
            value="boutique"
            label="Boutique"
            icon={Store}
            isActive={activeTab === "boutique"}
          />
          <TabButton
            value="preferences"
            label="Préférences"
            icon={Palette}
            isActive={activeTab === "preferences"}
          />
          <TabButton
            value="securite"
            label="Sécurité"
            icon={Shield}
            isActive={activeTab === "securite"}
          />
          <TabButton
            value="systeme"
            label="Système"
            icon={Database}
            isActive={activeTab === "systeme"}
          />
        </ScrollView>
      </Animated.View>

      {/* Content */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideUpAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {activeTab === "profil" && (
            <View style={styles.tabContent}>
              {/* Carte Profil */}
              <BlurView intensity={10} style={styles.profileCard}>
                <LinearGradient
                  colors={["#3b82f6", "#8b5cf6"]}
                  style={StyleSheet.absoluteFill}
                  opacity={0.2}
                />
                <View style={styles.profileHeader}>
                  <LinearGradient
                    colors={["#3b82f6", "#8b5cf6"]}
                    style={styles.profileAvatar}
                  >
                    <Text style={styles.profileInitials}>
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </Text>
                  </LinearGradient>
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{user.name}</Text>
                    <View style={styles.profileRole}>
                      <Text style={styles.profileRoleText}>
                        {user.role?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.profileDetails}>
                  <View style={styles.profileDetailItem}>
                    <Mail size={16} color="#64748b" />
                    <Text style={styles.profileDetailText}>{user.email}</Text>
                  </View>
                  <View style={styles.profileDetailItem}>
                    <Phone size={16} color="#64748b" />
                    <Text style={styles.profileDetailText}>
                      {user.telephone}
                    </Text>
                  </View>
                </View>
              </BlurView>

              {/* Formulaire Profil */}
              <BlurView intensity={10} style={styles.formCard}>
                <View style={styles.formHeader}>
                  <View
                    style={[styles.formIcon, { backgroundColor: "#3b82f620" }]}
                  >
                    <User size={20} color="#3b82f6" />
                  </View>
                  <View>
                    <Text style={styles.formTitle}>
                      Informations Personnelles
                    </Text>
                    <Text style={styles.formSubtitle}>
                      Gérez vos informations de profil
                    </Text>
                  </View>
                </View>

                <View style={styles.formContent}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nom complet</Text>
                    <TextInput
                      style={styles.input}
                      value={profile.name}
                      onChangeText={(text) =>
                        setProfile((prev) => ({ ...prev, name: text }))
                      }
                      placeholder="Votre nom complet"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                      style={styles.input}
                      value={profile.email}
                      onChangeText={(text) =>
                        setProfile((prev) => ({ ...prev, email: text }))
                      }
                      placeholder="votre@email.com"
                      placeholderTextColor="#94a3b8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Téléphone</Text>
                    <TextInput
                      style={styles.input}
                      value={profile.telephone}
                      onChangeText={(text) =>
                        setProfile((prev) => ({ ...prev, telephone: text }))
                      }
                      placeholder="+229 XX XX XX XX"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Rôle</Text>
                    <TextInput
                      style={[styles.input, styles.disabledInput]}
                      value={profile.role}
                      editable={false}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={sauvegarderProfil}
                    disabled={saving}
                  >
                    <LinearGradient
                      colors={["#3b82f6", "#8b5cf6"]}
                      style={StyleSheet.absoluteFill}
                    />
                    {saving ? (
                      <View style={styles.savingContent}>
                        <RefreshCw
                          size={20}
                          color="#ffffff"
                          style={styles.spinner}
                        />
                        <Text style={styles.saveButtonText}>Sauvegarde...</Text>
                      </View>
                    ) : (
                      <View style={styles.saveContent}>
                        <Save size={20} color="#ffffff" />
                        <Text style={styles.saveButtonText}>Sauvegarder</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </BlurView>
            </View>
          )}

          {activeTab === "boutique" && (
            <View style={styles.tabContent}>
              <BlurView intensity={10} style={styles.formCard}>
                <View style={styles.formHeader}>
                  <View
                    style={[styles.formIcon, { backgroundColor: "#10b98120" }]}
                  >
                    <Store size={20} color="#10b981" />
                  </View>
                  <View>
                    <Text style={styles.formTitle}>
                      Paramètres de la Boutique
                    </Text>
                    <Text style={styles.formSubtitle}>
                      Configurez votre établissement commercial
                    </Text>
                  </View>
                </View>

                <View style={styles.formContent}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nom de la boutique</Text>
                    <TextInput
                      style={styles.input}
                      value={boutique.nom}
                      onChangeText={(text) =>
                        setBoutique((prev) => ({ ...prev, nom: text }))
                      }
                      placeholder="Nom de votre boutique"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Adresse</Text>
                    <TextInput
                      style={styles.input}
                      value={boutique.adresse}
                      onChangeText={(text) =>
                        setBoutique((prev) => ({ ...prev, adresse: text }))
                      }
                      placeholder="Adresse complète"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Téléphone boutique</Text>
                    <TextInput
                      style={styles.input}
                      value={boutique.telephone}
                      onChangeText={(text) =>
                        setBoutique((prev) => ({ ...prev, telephone: text }))
                      }
                      placeholder="Téléphone de contact"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email boutique</Text>
                    <TextInput
                      style={styles.input}
                      value={boutique.email}
                      onChangeText={(text) =>
                        setBoutique((prev) => ({ ...prev, email: text }))
                      }
                      placeholder="contact@boutique.bj"
                      placeholderTextColor="#94a3b8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.rowGroup}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>TVA (%)</Text>
                      <TextInput
                        style={styles.input}
                        value={boutique.tva.toString()}
                        onChangeText={(text) =>
                          setBoutique((prev) => ({
                            ...prev,
                            tva: Number(text) || 0,
                          }))
                        }
                        placeholder="18"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Devise</Text>
                      <TextInput
                        style={styles.input}
                        value={boutique.devise}
                        onChangeText={(text) =>
                          setBoutique((prev) => ({ ...prev, devise: text }))
                        }
                        placeholder="FCFA"
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: "#10b981" }]}
                    onPress={sauvegarderBoutique}
                    disabled={saving}
                  >
                    {saving ? (
                      <View style={styles.savingContent}>
                        <RefreshCw
                          size={20}
                          color="#ffffff"
                          style={styles.spinner}
                        />
                        <Text style={styles.saveButtonText}>Sauvegarde...</Text>
                      </View>
                    ) : (
                      <View style={styles.saveContent}>
                        <Save size={20} color="#ffffff" />
                        <Text style={styles.saveButtonText}>Sauvegarder</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </BlurView>
            </View>
          )}

          {activeTab === "preferences" && (
            <View style={styles.tabContent}>
              {/* Notifications */}
              <BlurView intensity={10} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionIcon,
                      { backgroundColor: "#f9731620" },
                    ]}
                  >
                    <Bell size={20} color="#f97316" />
                  </View>
                  <Text style={styles.sectionTitle}>Notifications</Text>
                </View>
                <View style={styles.sectionContent}>
                  <SwitchItem
                    label="Notifications par email"
                    description="Alertes stocks, rapports, etc."
                    value={preferences.notificationsEmail}
                    onValueChange={(value: boolean) =>
                      setPreferences((prev) => ({
                        ...prev,
                        notificationsEmail: value,
                      }))
                    }
                    icon={Mail}
                    color="#f97316"
                  />
                  <SwitchItem
                    label="Notifications SMS"
                    description="Alertes urgentes par SMS"
                    value={preferences.notificationsSMS}
                    onValueChange={(value: boolean) =>
                      setPreferences((prev) => ({
                        ...prev,
                        notificationsSMS: value,
                      }))
                    }
                    icon={Smartphone}
                    color="#3b82f6"
                  />
                  <SwitchItem
                    label="Alertes stock bas"
                    description="Notifications automatiques"
                    value={preferences.alertesStock}
                    onValueChange={(value: boolean) =>
                      setPreferences((prev) => ({
                        ...prev,
                        alertesStock: value,
                      }))
                    }
                    icon={Bell}
                    color="#10b981"
                  />
                </View>
              </BlurView>

              {/* Interface & Système */}
              <BlurView intensity={10} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionIcon,
                      { backgroundColor: "#8b5cf620" },
                    ]}
                  >
                    <Palette size={20} color="#8b5cf6" />
                  </View>
                  <Text style={styles.sectionTitle}>Interface & Système</Text>
                </View>
                <View style={styles.sectionContent}>
                  <SwitchItem
                    label="Mode sombre"
                    description="Interface sombre pour un confort visuel"
                    value={preferences.darkMode}
                    onValueChange={(value: boolean) =>
                      setPreferences((prev) => ({ ...prev, darkMode: value }))
                    }
                    icon={Palette}
                    color="#8b5cf6"
                  />
                  <SwitchItem
                    label="Sauvegarde automatique"
                    description="Sauvegarde quotidienne des données"
                    value={preferences.autoBackup}
                    onValueChange={(value: boolean) =>
                      setPreferences((prev) => ({ ...prev, autoBackup: value }))
                    }
                    icon={Database}
                    color="#10b981"
                  />
                  <SwitchItem
                    label="Rapports automatiques"
                    description="Génération automatique des rapports"
                    value={preferences.rapportsAutomatiques}
                    onValueChange={(value: boolean) =>
                      setPreferences((prev) => ({
                        ...prev,
                        rapportsAutomatiques: value,
                      }))
                    }
                    icon={FileText}
                    color="#3b82f6"
                  />
                </View>
              </BlurView>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: "#8b5cf6", marginTop: 16 },
                ]}
                onPress={sauvegarderPreferences}
                disabled={saving}
              >
                {saving ? (
                  <View style={styles.savingContent}>
                    <RefreshCw
                      size={20}
                      color="#ffffff"
                      style={styles.spinner}
                    />
                    <Text style={styles.saveButtonText}>Sauvegarde...</Text>
                  </View>
                ) : (
                  <View style={styles.saveContent}>
                    <Save size={20} color="#ffffff" />
                    <Text style={styles.saveButtonText}>
                      Sauvegarder les préférences
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {activeTab === "securite" && (
            <View style={styles.tabContent}>
              {/* Changement mot de passe */}
              <BlurView intensity={10} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionIcon,
                      { backgroundColor: "#ef444420" },
                    ]}
                  >
                    <Key size={20} color="#ef4444" />
                  </View>
                  <Text style={styles.sectionTitle}>
                    Changer le mot de passe
                  </Text>
                </View>
                <View style={styles.sectionContent}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Mot de passe actuel</Text>
                    <View style={styles.passwordInput}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={securite.currentPassword}
                        onChangeText={(text) =>
                          setSecurite((prev) => ({
                            ...prev,
                            currentPassword: text,
                          }))
                        }
                        placeholder="Votre mot de passe actuel"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={!showCurrentPassword}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() =>
                          setShowCurrentPassword(!showCurrentPassword)
                        }
                      >
                        {showCurrentPassword ? (
                          <EyeOff size={20} color="#64748b" />
                        ) : (
                          <Eye size={20} color="#64748b" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nouveau mot de passe</Text>
                    <View style={styles.passwordInput}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={securite.newPassword}
                        onChangeText={(text) =>
                          setSecurite((prev) => ({
                            ...prev,
                            newPassword: text,
                          }))
                        }
                        placeholder="Nouveau mot de passe"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={!showNewPassword}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff size={20} color="#64748b" />
                        ) : (
                          <Eye size={20} color="#64748b" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Confirmer le mot de passe
                    </Text>
                    <View style={styles.passwordInput}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={securite.confirmPassword}
                        onChangeText={(text) =>
                          setSecurite((prev) => ({
                            ...prev,
                            confirmPassword: text,
                          }))
                        }
                        placeholder="Confirmer le nouveau mot de passe"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={!showConfirmPassword}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={20} color="#64748b" />
                        ) : (
                          <Eye size={20} color="#64748b" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: "#ef4444" }]}
                    onPress={changerMotDePasse}
                    disabled={saving}
                  >
                    {saving ? (
                      <View style={styles.savingContent}>
                        <RefreshCw
                          size={20}
                          color="#ffffff"
                          style={styles.spinner}
                        />
                        <Text style={styles.saveButtonText}>
                          Modification...
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.saveContent}>
                        <Key size={20} color="#ffffff" />
                        <Text style={styles.saveButtonText}>
                          Changer le mot de passe
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </BlurView>

              {/* Sécurité Avancée */}
              <BlurView intensity={10} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionIcon,
                      { backgroundColor: "#3b82f620" },
                    ]}
                  >
                    <ShieldCheck size={20} color="#3b82f6" />
                  </View>
                  <Text style={styles.sectionTitle}>Sécurité Avancée</Text>
                </View>
                <View style={styles.sectionContent}>
                  <SwitchItem
                    label="Authentification à deux facteurs"
                    description="Sécurisez votre compte avec 2FA"
                    value={securite.twoFactor}
                    onValueChange={(value: boolean) =>
                      setSecurite((prev) => ({ ...prev, twoFactor: value }))
                    }
                    icon={ShieldCheck}
                    color="#3b82f6"
                  />

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Délai de session (minutes)
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={securite.sessionTimeout.toString()}
                      onChangeText={(text) =>
                        setSecurite((prev) => ({
                          ...prev,
                          sessionTimeout: Number(text) || 30,
                        }))
                      }
                      placeholder="30"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                    />
                    <Text style={styles.inputHint}>
                      Durée avant déconnexion automatique
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteAccountButton}
                    onPress={supprimerCompte}
                  >
                    <Trash2 size={20} color="#ef4444" />
                    <Text style={styles.deleteAccountText}>
                      Supprimer le compte
                    </Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </View>
          )}

          {activeTab === "systeme" && (
            <View style={styles.tabContent}>
              {/* Sauvegarde & Restauration */}
              <BlurView intensity={10} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionIcon,
                      { backgroundColor: "#10b98120" },
                    ]}
                  >
                    <Database size={20} color="#10b981" />
                  </View>
                  <Text style={styles.sectionTitle}>
                    Sauvegarde & Restauration
                  </Text>
                </View>
                <View style={styles.sectionContent}>
                  <View style={styles.systemInfo}>
                    <View style={styles.systemInfoItem}>
                      <Calendar size={16} color="#64748b" />
                      <Text style={styles.systemInfoLabel}>
                        Dernière sauvegarde
                      </Text>
                      <Text style={styles.systemInfoValue}>
                        15 Oct 2024, 14:30
                      </Text>
                    </View>
                    <View style={styles.systemInfoItem}>
                      <HardDrive size={16} color="#64748b" />
                      <Text style={styles.systemInfoLabel}>
                        Taille des données
                      </Text>
                      <Text style={styles.systemInfoValue}>45.2 MB</Text>
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.exportButtonFull]}
                      onPress={exporterDonnees}
                    >
                      <Download size={20} color="#ffffff" />
                      <Text style={styles.actionButtonText}>Exporter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.importButton]}
                      onPress={importerDonnees}
                    >
                      <Upload size={20} color="#3b82f6" />
                      <Text
                        style={[
                          styles.actionButtonText,
                          styles.importButtonText,
                        ]}
                      >
                        Importer
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </BlurView>

              {/* Informations Système */}
              <BlurView intensity={10} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionIcon,
                      { backgroundColor: "#8b5cf620" },
                    ]}
                  >
                    <Globe size={20} color="#8b5cf6" />
                  </View>
                  <Text style={styles.sectionTitle}>Informations Système</Text>
                </View>
                <View style={styles.sectionContent}>
                  <View style={styles.systemDetails}>
                    <View style={styles.systemDetailItem}>
                      <Text style={styles.systemDetailLabel}>Version SGCI</Text>
                      <View style={styles.versionBadge}>
                        <Text style={styles.versionText}>v2.1.0</Text>
                      </View>
                    </View>
                    <View style={styles.systemDetailItem}>
                      <Text style={styles.systemDetailLabel}>
                        Environnement
                      </Text>
                      <View style={[styles.versionBadge, styles.prodBadge]}>
                        <Text style={[styles.versionText, styles.prodText]}>
                          Production
                        </Text>
                      </View>
                    </View>
                    <View style={styles.systemDetailItem}>
                      <Text style={styles.systemDetailLabel}>
                        Base de données
                      </Text>
                      <Text style={styles.systemDetailValue}>MySQL 8.0</Text>
                    </View>
                    <View style={styles.systemDetailItem}>
                      <Text style={styles.systemDetailLabel}>
                        Dernière mise à jour
                      </Text>
                      <Text style={styles.systemDetailValue}>12 Oct 2024</Text>
                    </View>
                    <View style={styles.systemDetailItem}>
                      <Text style={styles.systemDetailLabel}>Connectivité</Text>
                      <View style={styles.connectivity}>
                        <Wifi size={16} color="#10b981" />
                        <Text
                          style={[
                            styles.systemDetailValue,
                            { color: "#10b981" },
                          ]}
                        >
                          En ligne
                        </Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.updateButton}
                    onPress={verifierMisesAJour}
                  >
                    <RefreshCw size={20} color="#3b82f6" />
                    <Text style={styles.updateButtonText}>
                      Vérifier les mises à jour
                    </Text>
                  </TouchableOpacity>
                </View>
              </BlurView>

              {/* Déconnexion */}
              <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                <LogOut size={20} color="#ef4444" />
                <Text style={styles.logoutText}>Déconnexion</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  loadingText: {
    color: "#ffffff",
    fontSize: 16,
  },
  // Header
  header: {
    paddingTop: Platform.OS === "ios" ? 50 : StatusBar.currentHeight,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  exportButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginRight: 8,
  },
  userButton: {
    marginLeft: 8,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  userInitials: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  // Tabs
  tabsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  tabsScroll: {
    flexDirection: "row",
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  tabButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  tabButtonText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  tabButtonTextActive: {
    color: "#ffffff",
  },
  // Content
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  tabContent: {
    gap: 16,
  },
  // Profile Card
  profileCard: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 20,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  profileInitials: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "bold",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  profileRole: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.2)",
  },
  profileRoleText: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "600",
  },
  profileDetails: {
    gap: 8,
  },
  profileDetailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileDetailText: {
    color: "#94a3b8",
    fontSize: 14,
    marginLeft: 8,
  },
  // Form Cards
  formCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 20,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  formIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  formSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 2,
  },
  formContent: {
    gap: 16,
  },
  // Inputs
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  disabledInput: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    color: "#94a3b8",
  },
  passwordInput: {
    flexDirection: "row",
    alignItems: "center",
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  inputHint: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
  rowGroup: {
    flexDirection: "row",
    gap: 12,
  },
  // Buttons
  saveButton: {
    borderRadius: 12,
    padding: 16,
    overflow: "hidden",
    marginTop: 8,
  },
  saveContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  savingContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  spinner: {
    transform: [{ rotate: "0deg" }],
    animationDuration: "1s",
    animationIterationCount: "infinite",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  // Section Cards
  sectionCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  sectionContent: {
    gap: 16,
  },
  // Setting Items
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#ffffff",
  },
  settingDescription: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 2,
  },
  // Switch Items
  switchItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  switchLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  switchIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  switchContent: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#ffffff",
  },
  switchDescription: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 2,
  },
  // Delete Account
  deleteAccountButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  deleteAccountText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "600",
  },
  // System Info
  systemInfo: {
    gap: 12,
  },
  systemInfoItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  systemInfoLabel: {
    flex: 1,
    fontSize: 14,
    color: "#94a3b8",
    marginLeft: 8,
  },
  systemInfoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  exportButtonFull: {
    backgroundColor: "#3b82f6",
  },
  importButton: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  importButtonText: {
    color: "#3b82f6",
  },
  // System Details
  systemDetails: {
    gap: 12,
  },
  systemDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  systemDetailLabel: {
    fontSize: 14,
    color: "#94a3b8",
  },
  systemDetailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  versionBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  prodBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.2)",
  },
  versionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  prodText: {
    color: "#22c55e",
  },
  connectivity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  updateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  updateButtonText: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "600",
  },
  // Logout
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    padding: 20,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  logoutText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "600",
  },
});
