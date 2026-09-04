import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  KeyRound,
  Mail,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "" });
  const [isLoading, setIsLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideRightAnim = useRef(new Animated.Value(40)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.back(1.7)),
        useNativeDriver: true,
      }),
      Animated.timing(slideRightAnim, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const spinRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleSubmit = async () => {
    if (isLoading) return;
    if (!formData.email.trim()) {
      Alert.alert("Champs requis", "Veuillez entrer votre email.");
      return;
    }
    setIsLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiFetch("/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: formData.email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        Alert.alert(
          "Email envoyé",
          data.message ||
            "Si cet email existe, un lien de réinitialisation a été envoyé.",
          [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
        );
        setFormData({ email: "" });
      } else {
        const errors = data.errors;
        Alert.alert(
          "Erreur",
          errors
            ? (Object.values(errors)[0] as string[])[0]
            : data.message || "Une erreur est survenue"
        );
      }
    } catch {
      Alert.alert("Erreur", "Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#0f172a", "#4c1d95", "#0f172a"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
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
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <BlurView intensity={20} style={styles.blurView}>
                <LinearGradient
                  colors={[
                    "rgba(249, 115, 22, 0.1)",
                    "transparent",
                    "rgba(168, 85, 247, 0.1)",
                  ]}
                  style={StyleSheet.absoluteFill}
                />

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
                      <KeyRound size={28} color="#ffffff" />
                    </LinearGradient>
                  </Animated.View>
                  <Text style={styles.formTitle}>Mot de passe oublié</Text>
                  <Text style={styles.formSubtitle}>
                    Entrez votre email pour recevoir un lien de réinitialisation
                  </Text>
                </View>

                <View style={styles.formContent}>
                  <View style={styles.inputContainer}>
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
                  </View>

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.button}
                      onPress={handleSubmit}
                      disabled={isLoading}
                      activeOpacity={0.9}
                    >
                      <LinearGradient
                        colors={["#f97316", "#ef4444"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
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
                                transform: [{ rotate: spinRotation }],
                              },
                            ]}
                          />
                          <Text style={styles.buttonText}>
                            Envoi en cours...
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.buttonContent}>
                          <Mail size={20} color="#ffffff" />
                          <Text style={styles.buttonText}>
                            Envoyer le lien
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </BlurView>
            </Animated.View>

            <TouchableOpacity
              style={styles.backLinkContainer}
              onPress={() => router.replace("/(auth)/login")}
              disabled={isLoading}
            >
              <ChevronLeft size={16} color="#f97316" />
              <Text style={styles.backLinkText}>Retour à la </Text>
              <Text style={styles.backLinkStrong}>connexion</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                © 2025 SGCI Bénin - Système Premium
              </Text>
            </View>
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
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: "center",
  },
  formContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    maxWidth: 420,
  },
  blurView: {
    padding: 24,
  },
  formHeader: {
    alignItems: "center",
    marginBottom: 28,
  },
  formLogo: {
    width: 72,
    height: 72,
    borderRadius: 20,
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
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  formTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
    textAlign: "center",
  },
  formSubtitle: {
    fontSize: 15,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 22,
  },
  formContent: {
    gap: 20,
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
    paddingVertical: 15,
    fontSize: 15,
    color: "#ffffff",
  },
  buttonContainer: {
    marginTop: 4,
  },
  button: {
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
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#ffffff",
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
  footer: {
    marginTop: 32,
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
});
