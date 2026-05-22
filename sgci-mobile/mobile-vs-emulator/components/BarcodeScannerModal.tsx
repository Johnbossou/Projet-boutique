import { BarCodeScanner } from "expo-barcode-scanner";
import { useEffect, useState } from "react";
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
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, [visible]);

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
        {hasPermission === null && (
          <Text style={styles.msg}>Demande d&apos;accès caméra...</Text>
        )}
        {hasPermission === false && (
          <Text style={styles.msg}>Autorisez la caméra dans les réglages</Text>
        )}
        {hasPermission && (
          <BarCodeScanner
            onBarCodeScanned={({ data }) => {
              onScan(data);
              onClose();
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
