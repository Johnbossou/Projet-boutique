import React from "react";
import { StyleSheet, Text, StyleProp, TextStyle, View, ViewStyle } from "react-native";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

// 🎯 CHANGER ICI : export function → export default function
export default function Badge({
  children,
  variant = "default",
  style,
  textStyle,
}: BadgeProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "secondary":
        return {
          container: styles.secondaryContainer,
          text: styles.secondaryText,
        };
      case "destructive":
        return {
          container: styles.destructiveContainer,
          text: styles.destructiveText,
        };
      case "outline":
        return {
          container: styles.outlineContainer,
          text: styles.outlineText,
        };
      default:
        return {
          container: styles.defaultContainer,
          text: styles.defaultText,
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <View style={[styles.container, variantStyles.container, style]}>
      {typeof children === "string" ? (
        <Text style={[styles.text, variantStyles.text, textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
  // Variants
  defaultContainer: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  defaultText: {
    color: "#3b82f6",
  },
  secondaryContainer: {
    backgroundColor: "rgba(100, 116, 139, 0.1)",
    borderColor: "rgba(100, 116, 139, 0.2)",
  },
  secondaryText: {
    color: "#64748b",
  },
  destructiveContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  destructiveText: {
    color: "#ef4444",
  },
  outlineContainer: {
    backgroundColor: "transparent",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  outlineText: {
    color: "#ffffff",
  },
});
