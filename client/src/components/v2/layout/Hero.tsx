import React, { useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Play, Sparkles } from 'lucide-react';
import './Hero.css';

export default function HeroV2() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Simple particle system
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
    }> = [];

    // Create particles
    const colors = ['#7B61FF', '#00E0C6', '#FF9F6E'];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // Animation loop
    let animationId: number;
    const animate = () => {
      ctx.fillStyle = 'rgba(10, 15, 27, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle, i) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around screen
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();

        // Draw connections
        particles.slice(i + 1).forEach((otherParticle) => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = `${particle.color}${Math.floor((1 - distance / 150) * 40).toString(16).padStart(2, '0')}`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <section className="hero-v2">
      <canvas ref={canvasRef} className="hero-v2__canvas" />
      
      <div className="hero-v2__overlay" />
      
      <div className="hero-v2__content">
        <div className="hero-v2__badge">
          <Sparkles className="hero-v2__badge-icon" />
          <span>AI-Powered Music Production</span>
        </div>

        <h1 className="hero-v2__title">
          Create Music with AI.
          <br />
          <span className="text-gradient">Collaborate in Real-Time.</span>
        </h1>

        <p className="hero-v2__subtitle">
          The web's most powerful music production studio. Generate beats,
          melodies, and lyrics with AI. Collaborate with producers worldwide.
        </p>

        <div className="hero-v2__cta">
          <Button
            variant="primary"
            size="xl"
            gradient
            glow
            icon={<Sparkles />}
          >
            Start Creating Free
          </Button>
          
          <Button
            variant="outline"
            size="xl"
            icon={<Play />}
          >
            Watch Demo
          </Button>
        </div>

        <div className="hero-v2__social-proof">
          <div className="hero-v2__avatars">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="hero-v2__avatar" />
            ))}
          </div>
          <p className="hero-v2__social-text">
            Join creators building the future of AI music production
          </p>
        </div>
      </div>
    </section>
  );
}
