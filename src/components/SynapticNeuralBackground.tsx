import React, { useEffect, useRef } from 'react';

interface SynapticNeuralBackgroundProps {
  interactive?: boolean;
}

export const SynapticNeuralBackground: React.FC<SynapticNeuralBackgroundProps> = ({ interactive = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initNodes();
    };
    window.addEventListener('resize', handleResize);

    // Mouse coordinates for magnetic interactive pulse
    const mouse = { x: width / 2, y: height / 2, active: false, radius: 180 };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const handleMouseLeave = () => {
      mouse.active = false;
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseleave', handleMouseLeave);
    }

    // Neural nodes & synaptic firing particles
    interface Node {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      glowColor: string;
      pulsePhase: number;
      pulseSpeed: number;
      hubType: 'cortical' | 'synapse' | 'axon';
    }

    interface Pulse {
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      progress: number;
      speed: number;
      color: string;
      size: number;
    }

    let nodes: Node[] = [];
    let pulses: Pulse[] = [];

    const nodeCount = Math.min(Math.floor((width * height) / 14000), 75);

    const colors = [
      { base: '#22d3ee', glow: 'rgba(34, 211, 238, 0.8)' },   // Cyan electrical
      { base: '#38bdf8', glow: 'rgba(56, 189, 248, 0.75)' },  // Sky action potential
      { base: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.75)' },  // Teal transmitter
      { base: '#818cf8', glow: 'rgba(129, 140, 248, 0.7)' },  // Indigo thalamic
      { base: '#c084fc', glow: 'rgba(192, 132, 252, 0.65)' }  // Violet synaptic hub
    ];

    function initNodes() {
      nodes = [];
      pulses = [];
      for (let i = 0; i < nodeCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const colorObj = colors[Math.floor(Math.random() * colors.length)];
        const isHub = Math.random() < 0.2;

        nodes.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          radius: isHub ? Math.random() * 2.5 + 3 : Math.random() * 1.8 + 1.2,
          color: colorObj.base,
          glowColor: colorObj.glow,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: Math.random() * 0.03 + 0.015,
          hubType: isHub ? 'cortical' : (Math.random() > 0.5 ? 'synapse' : 'axon')
        });
      }
    }

    initNodes();

    let time = 0;

    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      // 1. Hypnotic Synaptic Waves / Alpha-Theta Brain Rhythm Gradient
      const waveCount = 4;
      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        const baseOpacity = 0.04 + w * 0.02;
        ctx.strokeStyle = w % 2 === 0 ? `rgba(34, 211, 238, ${baseOpacity})` : `rgba(45, 212, 191, ${baseOpacity})`;
        ctx.lineWidth = 1.5;

        for (let x = 0; x <= width; x += 15) {
          const harmonic1 = Math.sin(x * 0.003 + time * 0.8 + w * 1.5) * 45;
          const harmonic2 = Math.cos(x * 0.006 - time * 0.5 + w) * 25;
          const harmonic3 = Math.sin((x + time * 30) * 0.001) * 60;
          const y = (height * (0.3 + w * 0.16)) + harmonic1 + harmonic2 + harmonic3;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // 2. Update & Draw Neural Nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];

        // Smooth sinusoidal drift
        n.pulsePhase += n.pulseSpeed;
        n.x += n.vx + Math.sin(time + i) * 0.15;
        n.y += n.vy + Math.cos(time + i) * 0.15;

        // Bounce on boundaries
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;

        // Mouse magnetic pulse interaction
        if (mouse.active) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const force = (1 - dist / mouse.radius) * 0.8;
            n.x -= (dx / dist) * force * 2;
            n.y -= (dy / dist) * force * 2;
          }
        }

        // Draw connections (axons/dendrites)
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n.x - n2.x;
          const dy = n.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 145;

          if (dist < maxDist) {
            const alpha = Math.pow(1 - dist / maxDist, 1.6) * 0.45;
            
            // Draw axon line with subtle gradient
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
            ctx.lineWidth = (1 - dist / maxDist) * 1.4;
            ctx.stroke();

            // Randomly trigger action potential pulses along axons
            if (Math.random() < 0.0018 && pulses.length < 24) {
              pulses.push({
                fromX: n.x,
                fromY: n.y,
                toX: n2.x,
                toY: n2.y,
                progress: 0,
                speed: Math.random() * 0.02 + 0.015,
                color: Math.random() > 0.5 ? '#67e8f9' : '#a7f3d0',
                size: Math.random() * 2 + 1.5
              });
            }
          }
        }

        // Pulsating node glow
        const pulseFactor = Math.sin(n.pulsePhase) * 0.4 + 0.6;
        const currentRadius = n.radius * (0.85 + pulseFactor * 0.35);

        // Ambient synaptic aura
        const gradient = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, currentRadius * 4.5);
        gradient.addColorStop(0, n.glowColor);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(n.x, n.y, currentRadius * 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Core neuron body
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // Synaptic halo ring for cortical hubs
        if (n.hubType === 'cortical') {
          ctx.strokeStyle = `rgba(34, 211, 238, ${0.35 * pulseFactor})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(n.x, n.y, currentRadius * 2.8 * pulseFactor, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 3. Action Potential Pulses (Traveling neurotransmitter sparks)
      for (let p = pulses.length - 1; p >= 0; p--) {
        const pulse = pulses[p];
        pulse.progress += pulse.speed;

        if (pulse.progress >= 1) {
          pulses.splice(p, 1);
          continue;
        }

        const curX = pulse.fromX + (pulse.toX - pulse.fromX) * pulse.progress;
        const curY = pulse.fromY + (pulse.toY - pulse.fromY) * pulse.progress;

        // Glowing pulse head
        ctx.fillStyle = pulse.color;
        ctx.shadowColor = pulse.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(curX, curY, pulse.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseleave', handleMouseLeave);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [interactive]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none -z-20 w-full h-full opacity-85 transition-opacity duration-1000"
    />
  );
};
