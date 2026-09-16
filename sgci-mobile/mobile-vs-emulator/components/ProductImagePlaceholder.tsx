import { LinearGradient } from "expo-linear-gradient";
import { Package } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

interface ProductImagePlaceholderProps {
  nom: string;
  couleur?: string;
  size?: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ProductImagePlaceholder({
  nom,
  couleur = "#3b82f6",
  size = 96,
}: ProductImagePlaceholderProps) {
  const initial = nom?.charAt(0)?.toUpperCase() || "?";

  return (
    <LinearGradient
      colors={[hexToRgba(couleur, 0.35), hexToRgba(couleur, 0.12)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size * 0.15 },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
        {initial}
      </Text>
      <View style={styles.iconWrap}>
        <Package size={Math.max(12, size * 0.15)} color={couleur} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  initial: {
    fontWeight: "800",
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  iconWrap: {
    position: "absolute",
    bottom: 6,
    right: 6,
    opacity: 0.5,
  },
});