import { apiUrl } from "@/constants/api";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as SecureStore from "expo-secure-store";

export async function downloadFacturePdf(venteId: number): Promise<void> {
  const token = await SecureStore.getItemAsync("auth_token");
  const uri = FileSystem.documentDirectory + `facture-${venteId}.pdf`;
  const result = await FileSystem.downloadAsync(
    apiUrl(`/ventes/${venteId}/facture/pdf`),
    uri,
    {
      headers: {
        Accept: "application/pdf",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );
  if (result.status !== 200) {
    throw new Error("PDF indisponible");
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, { mimeType: "application/pdf" });
  }
}
