import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Eye, EyeOff, UserPlus } from "lucide-react-native";
import { useRouter } from "expo-router";
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
import { apiFetch } from "@/lib/api-client";

const { width, height } = Dimensions.get("window");

export default function RegisterScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    telephone: "",
    boutique_nom: "",
    boutique_adresse: "",
    boutique_telephone: "",
    password: "",
    password_confirmation: "",
  });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideRightAnim = useRef(new Animated.Value(100)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animation d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
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

    // Animation pulse pour les effets de lumière
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
  }, []);

  const handleRegister = async () => {
    if (isLoading) return;
    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.boutique_nom.trim() ||
      !formData.password
    ) {
      Alert.alert("Champs requis", "Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (formData.password.length < 8) {
      Alert.alert("Mot de passe", "Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (formData.password !== formData.password_confirmation) {
      Alert.alert("Mot de passe", "Les mots de passe ne correspondent pas.");
      return;
    }
    setIsLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiFetch("/register", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok) {
        Alert.alert("Inscription réussie", data.message || "Vous pouvez maintenant vous connecter.", [
          { text: "Se connecter", onPress: () => router.replace("/(auth)/login") },
        ]);
      } else {
        const errors = data.errors as Record<string, string[]> | undefined;
        const firstError = errors ? Object.values(errors)[0]?.[0] : data.message;
        Alert.alert("Erreur", firstError || "Une erreur est survenue");
      }
    } catch {
      Alert.alert("Erreur", "Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

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

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Formulaire d'inscription */}
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
                      <UserPlus size={28} color="#ffffff" />
                    </LinearGradient>
                  </Animated.View>
                  <Text style={styles.formTitle}>Inscription</Text>
                  <Text style={styles.formSubtitle}>Créez votre boutique</Text>
                </View>

                {/* Champs du formulaire */}
                <View style={styles.formContent}>
                  {/* Champ Nom complet */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Nom complet</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="Jean Dupont"
                        placeholderTextColor="#94a3b8"
                        value={formData.name}
                        onChangeText={(text) => updateField("name", text)}
                        autoCapitalize="words"
                        autoComplete="name"
                        editable={!isLoading}
                      />
                    </View>
                  </View>

                  {/* Champ Email */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Adresse Email</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="vous@boutique.bj"
                        placeholderTextColor="#94a3b8"
                        value={formData.email}
                        onChangeText={(text) => updateField("email", text)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        editable={!isLoading}
                      />
                    </View>
                  </View>

                  {/* Champ Téléphone */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Téléphone</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="+229 ..."
                        placeholderTextColor="#94a3b8"
                        value={formData.telephone}
                        onChangeText={(text) => updateField("telephone", text)}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        editable={!isLoading}
                      />
                    </View>
                  </View>

                  {/* Champ Nom de la boutique */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Nom de la boutique</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="Ma Boutique"
                        placeholderTextColor="#94a3b8"
                        value={formData.boutique_nom}
                        onChangeText={(text) => updateField("boutique_nom", text)}
                        autoCapitalize="words"
                        editable={!isLoading}
                      />
                    </View>
                  </View>

                  {/* Champ Adresse de la boutique */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Adresse de la boutique (optionnel)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="Adresse de votre boutique"
                        placeholderTextColor="#94a3b8"
                        value={formData.boutique_adresse}
                        onChangeText={(text) => updateField("boutique_adresse", text)}
                        editable={!isLoading}
                      />
                    </View>
                  </View>

                  {/* Champ Téléphone de la boutique */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Téléphone de la boutique (optionnel)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="+229 ..."
                        placeholderTextColor="#94a3b8"
                        value={formData.boutique_telephone}
                        onChangeText={(text) => updateField("boutique_telephone", text)}
                        keyboardType="phone-pad"
                        editable={!isLoading}
                      />
                    </View>
                  </View>

                  {/* Champ Mot de passe */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Mot de passe</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={[styles.input, styles.passwordInput]}
                        placeholder="8 caractères min"
                        placeholderTextColor="#94a3b8"
                        value={formData.password}
                        onChangeText={(text) => updateField("password", text)}
                        secureTextEntry={!showPassword}
                        autoComplete="password"
                        editable={!isLoading}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                  </View>

                  {/* Champ Confirmer le mot de passe */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Confirmer le mot de passe</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={[styles.input, styles.passwordInput]}
                        placeholder="Confirmez votre mot de passe"
                        placeholderTextColor="#94a3b8"
                        value={formData.password_confirmation}
                        onChangeText={(text) => updateField("password_confirmation", text)}
                        secureTextEntry={!showPasswordConfirmation}
                        autoComplete="password"
                        editable={!isLoading}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setShowPasswordConfirmation(!showPasswordConfirmation);
                        }}
                        disabled={isLoading}
                      >
                        {showPasswordConfirmation ? (
                          <EyeOff size={20} color="#94a3b8" />
                        ) : (
                          <Eye size={20} color="#94a3b8" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Bouton d'inscription */}
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.loginButton}
                      onPress={handleRegister}
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
                            Inscription en cours...
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.buttonContent}>
                          <Text style={styles.buttonText}>Créer mon compte</Text>
                          <ChevronRight size={20} color="#ffffff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Lien vers la connexion */}
                  <TouchableOpacity
                    style={styles.backLinkContainer}
                    onPress={() => router.replace("/(auth)/login")}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.backLinkText}>Déjà un compte ?</Text>
                    <Text style={styles.backLinkStrong}>Se connecter</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
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
  // Section formulaire
  formContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
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
    width: "100%",
    maxWidth: 480,
  },
  blurView: {
    padding: 24,
  },
  formHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  formLogo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    marginBottom: 16,
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
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 16,
    color: "#cbd5e1",
    textAlign: "center",
  },
  formContent: {
    gap: 16,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
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
    paddingVertical: 14,
    fontSize: 15,
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
    marginTop: 4,
  },
  loginButton: {
    height: 54,
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
    fontSize: 17,
    fontWeight: "600",
    color: "#ffffff",
  },
  backLinkContainer: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  backLinkText: {
    fontSize: 15,
    color: "#94a3b8",
  },
  backLinkStrong: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f97316",
  },
});
