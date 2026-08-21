import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect } from "react";
import {
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { X } from "lucide-react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
};

export function BarcodeScannerModal({ visible, onClose, onScan }: Props) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!visible) return;
    if (permission?.granted) return;
    (async () => {
      const { granted } = await requestPermission();
      if (!granted) return;
    })();
  }, [visible, permission, requestPermission]);

  const hasPermission = permission?.granted ?? false;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Scanner code produit</Text>
          <View style={{ width: 24 }} />
        </View>
        {!hasPermission && (
          <Text style={styles.msg}>
            {permission === null
              ? "Demande d'accès caméra..."
              : "Autorisez la caméra dans les réglages"}
          </Text>
        )}
        {hasPermission && (
          <CameraView
            onBarcodeScanned={({ data }) => {
              onScan(data);
              onClose();
            }}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a"],
            }}
            style={StyleSheet.absoluteFillObject}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    zIndex: 2,
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "600" },
  msg: { color: "#94a3b8", textAlign: "center", marginTop: 40, padding: 20 },
});
