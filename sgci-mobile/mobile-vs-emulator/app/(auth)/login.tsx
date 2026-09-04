import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
    BarChart3,
    ChevronRight,
    Eye,
    EyeOff,
    LogIn,
    ShieldCheck,
    Smartphone as MobileIcon,
    Sparkles,
    Store
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";

const { width, height } = Dimensions.get("window");

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [showBoutiqueSelection, setShowBoutiqueSelection] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const router = useRouter();
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);

  const { login, isLoading, user, switchBoutique } = useAuth();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideLeftAnim = useRef(new Animated.Value(-100)).current;
  const slideRightAnim = useRef(new Animated.Value(100)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Particules animées
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    left: useRef(new Animated.Value(Math.random() * width)).current,
    top: useRef(new Animated.Value(Math.random() * height)).current,
    size: useRef(new Animated.Value(Math.random() * 20 + 10)).current,
    opacity: useRef(new Animated.Value(Math.random() * 0.3 + 0.1)).current,
  }));

  useEffect(() => {
    // Animation d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideLeftAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideRightAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Animation de rotation continue pour le logo
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Animation pulse pour les effets
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Animation des particules
    particles.forEach((particle) => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(particle.left, {
            toValue: Math.random() * width,
            duration: Math.random() * 10000 + 5000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(particle.top, {
            toValue: Math.random() * height,
            duration: Math.random() * 10000 + 5000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.sequence([
            Animated.timing(particle.opacity, {
              toValue: 0.5,
              duration: Math.random() * 2000 + 1000,
              useNativeDriver: true,
            }),
            Animated.timing(particle.opacity, {
              toValue: 0.1,
              duration: Math.random() * 2000 + 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    });
  }, []);

  const handleLogin = async () => {
    if (isLoading) return;
    if (!formData.email.trim() || !formData.password) {
      Alert.alert("Champs requis", "Veuillez remplir votre email et votre mot de passe.");
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await login(formData.email, formData.password, twoFactorCode || undefined);
      if ("requiresTwoFactor" in result) {
        setTwoFactorRequired(true);
        Alert.alert("Code 2FA requis", "Entrez le code à 6 chiffres de votre application d'authentification.");
      } else if (!result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Erreur", result.message);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erreur de connexion", "Email ou mot de passe incorrect");
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleSwitchBoutique = async (boutiqueId: number) => {
    try {
      await switchBoutique(boutiqueId);
      setShowBoutiqueSelection(false);
      // Navigation will be handled by AuthContext
    } catch (error: any) {
      Alert.alert("Erreur", error.message || "Erreur lors du changement de boutique");
    }
  };

  // Show boutique selection modal for proprietaires with multiple boutiques
  if (showBoutiqueSelection && user && user.role === 'proprietaire' && user.boutiques && user.boutiques.length > 1) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={["#0f172a", "#4c1d95", "#0f172a"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.boutiqueSelectionContainer}>
          <Animated.View
            style={[
              styles.boutiqueSelectionCard,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <BlurView intensity={20} style={styles.boutiqueSelectionBlur}>
              <View style={styles.boutiqueSelectionHeader}>
                <LinearGradient
                  colors={["#f97316", "#ef4444"]}
                  style={styles.boutiqueSelectionLogo}
                >
                  <Store size={32} color="#ffffff" />
                </LinearGradient>
                <Text style={styles.boutiqueSelectionTitle}>Sélectionnez votre boutique</Text>
                <Text style={styles.boutiqueSelectionSubtitle}>
                  Vous avez accès à {user.boutiques.length} boutique(s)
                </Text>
              </View>

              <ScrollView style={styles.boutiqueList}>
                {user.boutiques.map((boutique: any) => (
                  <TouchableOpacity
                    key={boutique.id}
                    onPress={() => handleSwitchBoutique(boutique.id)}
                    style={[
                      styles.boutiqueListItem,
                      boutique.id === user.current_boutique_id && styles.boutiqueListItemActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.boutiqueListItemIcon}>
                      <Store 
                        size={24} 
                        color={boutique.id === user.current_boutique_id ? "#3b82f6" : "#f97316"} 
                      />
                    </View>
                    <View style={styles.boutiqueListItemInfo}>
                      <Text style={styles.boutiqueListItemName}>{boutique.nom}</Text>
                      <Text style={styles.boutiqueListItemAddress}>
                        {boutique.adresse || 'Adresse non renseignée'}
                      </Text>
                    </View>
                    {boutique.id === user.current_boutique_id && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Actuelle</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </BlurView>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={["#0f172a", "#4c1d95", "#0f172a"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Effets de lumière animés */}
      <Animated.View
        style={[
          styles.lightEffect1,
          {
            transform: [
              { scale: pulseAnim },
              {
                translateX: rotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 50],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.lightEffect2,
          {
            transform: [
              { scale: pulseAnim },
              {
                translateX: rotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -50],
                }),
              },
            ],
          },
        ]}
      />

      {/* Particules animées */}
      {particles.map((particle) => (
        <Animated.View
          key={particle.id}
          style={[
            styles.particle,
            {
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              opacity: particle.opacity,
              transform: [{ rotate: rotateInterpolate }],
            },
          ]}
        />
      ))}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Section présentation (masquée sur mobile sauf tablette) */}
          {width > 768 && (
            <Animated.View
              style={[
                styles.presentationSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideLeftAnim }],
                },
              ]}
            >
              {/* Logo et titre */}
              <View style={styles.logoContainer}>
                <Animated.View
                  style={[
                    styles.logoWrapper,
                    {
                      transform: [
                        { rotate: rotateInterpolate },
                        { scale: scaleAnim },
                      ],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={["#f97316", "#ef4444"]}
                    style={styles.logoGradient}
                  >
                    <Store size={28} color="#ffffff" />
                  </LinearGradient>
                </Animated.View>
                <View style={styles.titleContainer}>
                  <Text style={styles.mainTitle}>SGCI BÉNIN</Text>
                  <Text style={styles.subTitle}>Édition Premium</Text>
                </View>
              </View>

              {/* Message principal */}
              <View style={styles.messageContainer}>
                <Text style={styles.messageTitle}>
                  <Text style={styles.messageTitleLight}>L'intelligence</Text>
                  {"\n"}
                  <Text style={styles.messageTitleGradient}>commerciale</Text>
                  {"\n"}
                  <Text style={styles.messageTitleLight}>réinventée</Text>
                </Text>
                <Text style={styles.messageText}>
                  Système de Gestion Commerciale Intelligente conçu pour
                  propulser votre business vers de nouveaux sommets.
                </Text>
              </View>

              {/* Features */}
              <View style={styles.featuresContainer}>
                {[
                  {
                    icon: MobileIcon,
                    text: "Interface révolutionnaire mobile-first",
                    color: "#60a5fa",
                  },
                  {
                    icon: BarChart3,
                    text: "Analytics prédictifs en temps réel",
                    color: "#34d399",
                  },
                  {
                    icon: Sparkles,
                    text: "Expérience utilisateur ultime",
                    color: "#a78bfa",
                  },
                  {
                    icon: Store,
                    text: "Gestion multi-boutiques intelligente",
                    color: "#f97316",
                  },
                ].map((item, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.featureItem,
                      {
                        opacity: fadeAnim,
                        transform: [
                          {
                            translateX: slideLeftAnim.interpolate({
                              inputRange: [-100, 0],
                              outputRange: [-20, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.featureIconContainer,
                        { backgroundColor: `${item.color}20` },
                      ]}
                    >
                      <item.icon size={20} color={item.color} />
                    </View>
                    <Text style={styles.featureText}>{item.text}</Text>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Formulaire de connexion */}
          <Animated.View
            style={[
              styles.formContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateX: slideRightAnim }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.formCard,
                {
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <BlurView intensity={20} style={styles.blurView}>
                {/* Effet de brillance */}
                <LinearGradient
                  colors={[
                    "rgba(249, 115, 22, 0.1)",
                    "transparent",
                    "rgba(168, 85, 247, 0.1)",
                  ]}
                  style={StyleSheet.absoluteFill}
                />

                {/* En-tête du formulaire */}
                <View style={styles.formHeader}>
                  <Animated.View
                    style={[
                      styles.formLogo,
                      {
                        transform: [
                          { scale: scaleAnim },
                          {
                            rotate: scaleAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["-180deg", "0deg"],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={["#f97316", "#ef4444"]}
                      style={styles.formLogoGradient}
                    >
                      <LogIn size={28} color="#ffffff" />
                    </LinearGradient>
                  </Animated.View>
                  <Text style={styles.formTitle}>Connexion</Text>
                  <Text style={styles.formSubtitle}>
                    Accédez à votre espace premium
                  </Text>
                </View>

                {/* Champs du formulaire */}
                <View style={styles.formContent}>
                  {/* Champ Email */}
                  <Animated.View
                    style={[
                      styles.inputContainer,
                      {
                        opacity: fadeAnim,
                        transform: [
                          {
                            translateY: fadeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [20, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Text style={styles.inputLabel}>Adresse Email</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="gerant@sgci.bj"
                        placeholderTextColor="#94a3b8"
                        value={formData.email}
                        onChangeText={(text) =>
                          setFormData({ ...formData, email: text })
                        }
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        editable={!isLoading}
                      />
                    </View>
                  </Animated.View>

                  {/* Champ Mot de passe */}
                  <Animated.View
                    style={[
                      styles.inputContainer,
                      {
                        opacity: fadeAnim,
                        transform: [
                          {
                            translateY: fadeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [20, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Text style={styles.inputLabel}>Mot de passe</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={[styles.input, styles.passwordInput]}
                        placeholder="password"
                        placeholderTextColor="#94a3b8"
                        value={formData.password}
                        onChangeText={(text) =>
                          setFormData({ ...formData, password: text })
                        }
                        secureTextEntry={!showPassword}
                        autoComplete="password"
                        editable={!isLoading}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light
                          );
                          setShowPassword(!showPassword);
                        }}
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff size={20} color="#94a3b8" />
                        ) : (
                          <Eye size={20} color="#94a3b8" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </Animated.View>

                  {twoFactorRequired && (
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Code 2FA</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.input}
                          placeholder="123456"
                          placeholderTextColor="#94a3b8"
                          value={twoFactorCode}
                          onChangeText={setTwoFactorCode}
                          keyboardType="number-pad"
                          maxLength={6}
                          editable={!isLoading}
                        />
                      </View>
                    </View>
                  )}

                  {/* Bouton de connexion */}
                  <Animated.View
                    style={[
                      styles.buttonContainer,
                      {
                        opacity: fadeAnim,
                        transform: [
                          {
                            translateY: fadeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [20, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.loginButton}
                      onPress={handleLogin}
                      disabled={isLoading}
                      activeOpacity={0.9}
                    >
                      <LinearGradient
                        colors={["#f97316", "#ef4444"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />

                      {/* Effet de brillance */}
                      <Animated.View
                        style={[
                          styles.buttonShine,
                          {
                            transform: [
                              {
                                translateX: rotateAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [-100, 100],
                                }),
                              },
                            ],
                          },
                        ]}
                      />

                      {isLoading ? (
                        <View style={styles.loadingContainer}>
                          <Animated.View
                            style={[
                              styles.loadingSpinner,
                              {
                                transform: [
                                  {
                                    rotate: rotateAnim.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: ["0deg", "360deg"],
                                    }),
                                  },
                                ],
                              },
                            ]}
                          />
                          <Text style={styles.buttonText}>
                            Connexion en cours...
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.buttonContent}>
                          {twoFactorRequired ? (
                            <ShieldCheck size={20} color="#ffffff" />
                          ) : (
                            <Sparkles size={20} color="#ffffff" />
                          )}
                          <Text style={styles.buttonText}>{twoFactorRequired ? "Vérifier le code" : "Se connecter"}</Text>
                          <ChevronRight size={20} color="#ffffff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>

                  {/* Informations de test */}
                  <Animated.View
                    style={[
                      styles.testInfoContainer,
                      {
                        opacity: fadeAnim,
                      },
                    ]}
                  >
                    <View style={styles.testInfoCard}>
                      <Text style={styles.testInfoTitle}>
                        Comptes de test :
                      </Text>
                      <View style={styles.testAccounts}>
                        <View style={styles.testAccount}>
                          <Text style={styles.testAccountIcon}>📧</Text>
                          <Text style={styles.testAccountText}>
                            <Text style={styles.testAccountEmail}>
                              gerant@sgci.bj
                            </Text>
                            <Text style={styles.testAccountSeparator}> / </Text>
                            <Text style={styles.testAccountPassword}>
                              password
                            </Text>
                          </Text>
                        </View>
                        <View style={styles.testAccount}>
                          <Text style={styles.testAccountIcon}>📱</Text>
                          <Text style={styles.testAccountText}>
                            <Text style={styles.testAccountEmail}>
                              caissier@sgci.bj
                            </Text>
                            <Text style={styles.testAccountSeparator}> / </Text>
                            <Text style={styles.testAccountPassword}>
                              password
                            </Text>
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                </View>
              </BlurView>
            </Animated.View>

            <View style={styles.authLinks}>
              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(auth)/forgot-password"); }}>
                <Text style={styles.authLinkForgot}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/(auth)/register"); }}>
                <Text style={styles.authLink}>S'inscrire</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <Animated.View
              style={[
                styles.footer,
                {
                  opacity: fadeAnim,
                },
              ]}
            >
              <Text style={styles.footerText}>
                © 2025 SGCI Bénin - Système Premium
              </Text>
              <Text style={styles.footerSubText}>
                Optimisé pour l'excellence commerciale
              </Text>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: width > 768 ? 40 : 20,
    paddingVertical: 20,
  },
  // Effets de lumière
  lightEffect1: {
    position: "absolute",
    top: height * 0.25,
    left: width * 0.25,
    width: width * 0.5,
    height: width * 0.5,
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    borderRadius: width * 0.5,
    opacity: 0.6,
  },
  lightEffect2: {
    position: "absolute",
    bottom: height * 0.25,
    right: width * 0.25,
    width: width * 0.5,
    height: width * 0.5,
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderRadius: width * 0.5,
    opacity: 0.6,
  },
  // Particules
  particle: {
    position: "absolute",
    backgroundColor: "rgba(249, 115, 22, 0.3)",
    borderRadius: 100,
  },
  // Section présentation
  presentationSection: {
    flex: 1,
    marginBottom: 30,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 40,
  },
  logoWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  titleContainer: {
    marginLeft: 16,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 1,
  },
  subTitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 4,
  },
  messageContainer: {
    marginBottom: 40,
  },
  messageTitle: {
    fontSize: width > 768 ? 48 : 36,
    fontWeight: "bold",
    lineHeight: width > 768 ? 56 : 44,
    marginBottom: 20,
  },
  messageTitleLight: {
    color: "#e2e8f0",
  },
  messageTitleGradient: {
    color: "#f97316",
  },
  messageText: {
    fontSize: 18,
    color: "#cbd5e1",
    lineHeight: 28,
  },
  featuresContainer: {
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    color: "#e2e8f0",
    fontWeight: "500",
  },
  // Section formulaire
  formContainer: {
    flex: 1,
  },
  formCard: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  },
  blurView: {
    padding: 24,
  },
  formHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  formLogo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  formLogoGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  formTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 18,
    color: "#cbd5e1",
    textAlign: "center",
  },
  formContent: {
    gap: 24,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginLeft: 4,
  },
  inputWrapper: {
    position: "relative",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: "#ffffff",
  },
  passwordInput: {
    paddingRight: 56,
  },
  eyeButton: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonContainer: {
    marginTop: 8,
  },
  loginButton: {
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonShine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 50,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    transform: [{ skewX: "-12deg" }],
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  loadingSpinner: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderTopColor: "#ffffff",
    borderRadius: 10,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  testInfoContainer: {
    marginTop: 24,
  },
  testInfoCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  testInfoTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#cbd5e1",
    marginBottom: 12,
    textAlign: "center",
  },
  testAccounts: {
    gap: 8,
  },
  testAccount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  testAccountIcon: {
    fontSize: 14,
  },
  testAccountText: {
    fontSize: 13,
    color: "#94a3b8",
  },
  testAccountEmail: {
    fontWeight: "bold",
    color: "#ffffff",
  },
  testAccountSeparator: {
    color: "#64748b",
  },
  testAccountPassword: {
    color: "#f97316",
  },
  authLinks: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: 20 },
  authLinkForgot: { fontSize: 15, fontWeight: "600", color: "#94a3b8" },
  authLink: { fontSize: 15, fontWeight: "700", color: "#f97316", padding: 8 },
  footer: {
    marginTop: 40,
    alignItems: "center",
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  footerSubText: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  // Boutique Selection Styles
  boutiqueSelectionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  boutiqueSelectionCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  },
  boutiqueSelectionBlur: {
    padding: 24,
  },
  boutiqueSelectionHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  boutiqueSelectionLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  boutiqueSelectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
    textAlign: "center",
  },
  boutiqueSelectionSubtitle: {
    fontSize: 16,
    color: "#cbd5e1",
    textAlign: "center",
  },
  boutiqueList: {
    maxHeight: 400,
  },
  boutiqueListItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  boutiqueListItemActive: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "#3b82f6",
  },
  boutiqueListItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(249, 115, 22, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  boutiqueListItemInfo: {
    flex: 1,
  },
  boutiqueListItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  boutiqueListItemAddress: {
    fontSize: 14,
    color: "#94a3b8",
  },
  currentBadge: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  currentBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
});
