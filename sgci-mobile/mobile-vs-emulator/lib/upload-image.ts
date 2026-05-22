import { apiUrl } from "@/constants/api";
import * as SecureStore from "expo-secure-store";

export async function uploadProduitImage(
  produitId: number,
  uri: string,
  mimeType = "image/jpeg"
): Promise<string> {
  const token = await SecureStore.getItemAsync("auth_token");
  const form = new FormData();
  form.append("image", {
    uri,
    name: `produit-${produitId}.jpg`,
    type: mimeType,
  } as unknown as Blob);

  const response = await fetch(apiUrl(`/produits/${produitId}/image`), {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Upload échoué");
  }

  const data = await response.json();
  return data.image_url as string;
}
