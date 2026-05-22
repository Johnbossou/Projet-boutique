'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface BarcodeScannerProps {
  onCodeDetected: (code: string, produit?: any) => void;
  apiBaseUrl?: string;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ 
  onCodeDetected, 
  apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState('');
  const [lastDetection, setLastDetection] = useState<{ code: string; timestamp: number } | null>(null);
  const animationFrameRef = useRef<number>();

  // Démarrer le scanner caméra
  const startScanning = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
        scanFrame();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible d\'accéder à la caméra';
      setError(message);
      toast.error('Caméra non disponible: ' + message);
    }
  };

  // Arrêter le scanner
  const stopScanning = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsScanning(false);
  };

  // Capturer et analyser chaque frame
  const scanFrame = () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

    // Extraire les données image
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Utiliser jsQR si disponible, sinon fallback simple
    try {
      // @ts-ignore - jsQR peut ne pas être chargé
      if (window.jsQR) {
        // @ts-ignore
        const code = window.jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleDetectedCode(code.data);
        }
      }
    } catch (err) {
      // Ignorer les erreurs de parsing
    }

    // Continuer le scan
    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  // Gérer un code détecté
  const handleDetectedCode = async (code: string) => {
    const now = Date.now();
    
    // Éviter les détections multiples du même code trop rapprochées (anti-rebond)
    if (lastDetection && lastDetection.code === code && now - lastDetection.timestamp < 1000) {
      return;
    }

    setLastDetection({ code, timestamp: now });
    toast.success(`Code détecté: ${code}`);
    
    // Récupérer le produit via l'API
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBaseUrl}/produits/code/${encodeURIComponent(code)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const produit = await response.json();
        onCodeDetected(code, produit);
        stopScanning();
      } else if (response.status === 404) {
        toast.warning(`Produit non trouvé pour code: ${code}`);
        onCodeDetected(code);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération du produit:', err);
      onCodeDetected(code);
    }
  };

  // Gérer la saisie manuelle
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) {
      setError('Entrez un code');
      return;
    }
    handleDetectedCode(manualInput.trim());
    setManualInput('');
  };

  // Charger jsQR si nécessaire
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (!(window as any).jsQR) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      script.async = true;
      document.head.appendChild(script);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Scanner QR / Code-barres
        </CardTitle>
        <CardDescription>
          Scannez un code QR ou un code-barres produit
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {isScanning ? (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full aspect-square object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Overlay crosshair */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-green-400 rounded-lg opacity-50"></div>
              </div>
            </div>
            
            <Button 
              onClick={stopScanning} 
              variant="destructive" 
              className="w-full"
            >
              <X className="w-4 h-4 mr-2" />
              Arrêter le scan
            </Button>
          </div>
        ) : (
          <Button 
            onClick={startScanning} 
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <Camera className="w-4 h-4 mr-2" />
            Démarrer le scan
          </Button>
        )}

        {/* Saisie manuelle */}
        <div className="border-t pt-4">
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <p className="text-sm text-gray-600">Ou saisir manuellement:</p>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Code QR / Code-barres"
                value={manualInput}
                onChange={(e) => {
                  setManualInput(e.target.value);
                  setError('');
                }}
                disabled={isScanning}
              />
              <Button type="submit" disabled={isScanning}>
                <CheckCircle2 className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};

export default BarcodeScanner;
