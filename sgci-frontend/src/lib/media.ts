import { apiUrl } from '@/lib/config';

export async function uploadProduitImage(
  produitId: number,
  file: File
): Promise<{ image_url: string }> {
  const form = new FormData();
  form.append('image', file);

  const response = await fetch(apiUrl(`/produits/${produitId}/image`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
    body: form,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Échec upload image');
  }

  const data = await response.json();
  return { image_url: data.image_url };
}

export async function downloadFacturePdf(venteId: number, filename?: string): Promise<void> {
  const response = await fetch(apiUrl(`/ventes/${venteId}/facture/pdf`), {
    credentials: 'include',
    headers: {
      Accept: 'application/pdf',
    },
  });

  if (!response.ok) throw new Error('Téléchargement facture impossible');

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `facture-${venteId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
