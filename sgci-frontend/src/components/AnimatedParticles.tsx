'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ParticleConfig {
  id: number;
  x: string;
  y: string;
  duration: number;
  delay: number;
}

export default function AnimatedParticles({ count = 20 }: { count?: number }) {
  const [particles, setParticles] = useState<ParticleConfig[]>([]);

  useEffect(() => {
    // Génération des particules UNIQUEMENT côté client
    const generatedParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: `${Math.random() * 100}vw`,
      y: `${Math.random() * 100}vh`,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 2,
    }));
    
    setParticles(generatedParticles);
  }, [count]);

  // Rendu vide côté serveur et pendant le chargement initial
  if (particles.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 opacity-30 pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-1 h-1 bg-white rounded-full"
          initial={{
            x: particle.x,
            y: particle.y,
          }}
          animate={{
            y: [null, -30, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}