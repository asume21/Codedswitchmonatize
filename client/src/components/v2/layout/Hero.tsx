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

    // Create CodedSwitch logo shape with particles (Eye + Nodes + Frame)
    const createLogoPoints = () => {
      const points: Array<{ x: number; y: number }> = [];
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2 - 150;
      const size = 80;

      // SQUARE FRAME - connecting the nodes
      // Top edge
      for (let i = 0; i <= 15; i++) {
        points.push({
          x: centerX - size + (i / 15) * (size * 2),
          y: centerY - size,
        });
      }
      // Right edge
      for (let i = 0; i <= 15; i++) {
        points.push({
          x: centerX + size,
          y: centerY - size + (i / 15) * (size * 2),
        });
      }
      // Bottom edge
      for (let i = 0; i <= 15; i++) {
        points.push({
          x: centerX + size - (i / 15) * (size * 2),
          y: centerY + size,
        });
      }
      // Left edge
      for (let i = 0; i <= 15; i++) {
        points.push({
          x: centerX - size,
          y: centerY + size - (i / 15) * (size * 2),
        });
      }

      // TOP-RIGHT NODE (circle)
      for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
        points.push({
          x: centerX + size + Math.cos(angle) * 15,
          y: centerY - size + Math.sin(angle) * 15,
        });
      }

      // BOTTOM-LEFT NODE (circle)
      for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
        points.push({
          x: centerX - size + Math.cos(angle) * 15,
          y: centerY + size + Math.sin(angle) * 15,
        });
      }

      // CENTER EYE SHAPE
      // Outer eye outline (almond shape)
      for (let angle = 0; angle < Math.PI; angle += 0.15) {
        const x = Math.cos(angle) * 50;
        const y = Math.sin(angle) * 25;
        points.push({ x: centerX + x, y: centerY + y });
      }
      for (let angle = Math.PI; angle < Math.PI * 2; angle += 0.15) {
        const x = Math.cos(angle) * 50;
        const y = Math.sin(angle) * 25;
        points.push({ x: centerX + x, y: centerY + y });
      }

      // Eye pupil (circle)
      for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
        points.push({
          x: centerX + Math.cos(angle) * 20,
          y: centerY + Math.sin(angle) * 20,
        });
      }

      // Inner pupil detail
      for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
        points.push({
          x: centerX + Math.cos(angle) * 8,
          y: centerY + Math.sin(angle) * 8,
        });
      }

      return points;
    };

    const logoPoints = createLogoPoints();

    // Enhanced particle system with logo formation
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      targetX: number;
      targetY: number;
      size: number;
      color: string;
      formLogo: boolean;
    }> = [];

    // Create particles
    const colors = ['#7B61FF', '#00E0C6', '#FF9F6E'];
    const totalParticles = Math.min(logoPoints.length * 2, 120);
    
    for (let i = 0; i < totalParticles; i++) {
      const targetPoint = logoPoints[i % logoPoints.length];
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        targetX: targetPoint.x,
        targetY: targetPoint.y,
        size: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        formLogo: false,
      });
    }

    let time = 0;
    let cyclePhase = 0; // 0 = scatter, 1 = forming, 2 = hold logo, 3 = scatter

    // Animation loop
    let animationId: number;
    const animate = () => {
      time += 0.01;
      ctx.fillStyle = 'rgba(10, 15, 27, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cycle phases: 0-3s scatter, 3-6s form, 6-9s hold, 9-12s scatter
      const cycleDuration = 12;
      const phaseTime = time % cycleDuration;

      if (phaseTime < 3) {
        cyclePhase = 0; // Scattered
      } else if (phaseTime < 6) {
        cyclePhase = 1; // Forming logo
      } else if (phaseTime < 9) {
        cyclePhase = 2; // Holding logo
      } else {
        cyclePhase = 3; // Scattering from logo
      }

      particles.forEach((particle, i) => {
        // Apply logo formation force
        if (cyclePhase === 1 || cyclePhase === 2) {
          // Attract to target position
          const dx = particle.targetX - particle.x;
          const dy = particle.targetY - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 5) {
            const force = cyclePhase === 2 ? 0.15 : 0.08;
            particle.vx += (dx / distance) * force;
            particle.vy += (dy / distance) * force;
          } else {
            // Slow down when close to target
            particle.vx *= 0.9;
            particle.vy *= 0.9;
          }
        } else {
          // Random wandering
          particle.vx *= 0.98;
          particle.vy *= 0.98;
          particle.vx += (Math.random() - 0.5) * 0.1;
          particle.vy += (Math.random() - 0.5) * 0.1;
        }

        // Limit velocity
        const maxSpeed = cyclePhase === 2 ? 0.5 : 2;
        const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
        if (speed > maxSpeed) {
          particle.vx = (particle.vx / speed) * maxSpeed;
          particle.vy = (particle.vy / speed) * maxSpeed;
        }

        particle.x += particle.vx;
        particle.y += particle.vy;

        // Soft boundaries (bounce back gently)
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -0.5;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -0.5;
        particle.x = Math.max(0, Math.min(canvas.width, particle.x));
        particle.y = Math.max(0, Math.min(canvas.height, particle.y));

        // Draw particle with size variation based on phase
        const sizeMultiplier = cyclePhase === 2 ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * sizeMultiplier, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();

        // Glow effect in logo phase
        if (cyclePhase === 2) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = particle.color;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Draw connections (only in scattered phase for cleaner logo)
        if (cyclePhase === 0 || cyclePhase === 3) {
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
        }
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
