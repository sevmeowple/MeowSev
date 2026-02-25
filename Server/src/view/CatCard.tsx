import React from 'react';

export interface CatCardProps {
  svgString: string;
  userName: string;
  traitLabels: string[];
  paletteName: string;
  patternName: string;
}

export default function CatCard({ svgString, userName, traitLabels, paletteName, patternName }: CatCardProps) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          body { font-family: 'Noto Sans SC', sans-serif; margin: 0; padding: 0; }
          .card-bg {
            background: linear-gradient(135deg, #FFF8F0 0%, #FFF0E6 50%, #F8F0FF 100%);
          }
          .stripe-overlay {
            background: repeating-linear-gradient(
              45deg, transparent, transparent 10px,
              rgba(255,150,50,0.05) 10px, rgba(255,150,50,0.05) 20px
            );
          }
          .glow { filter: blur(40px); }
          .badge {
            display: inline-block;
            padding: 4px 14px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
            background: rgba(255,255,255,0.7);
            border: 1px solid rgba(255,120,50,0.2);
            color: #8B5E3C;
            margin: 3px;
          }
        `}} />
      </head>
      <body>
        <div className="card-bg" style={{ width: 500, position: 'relative', overflow: 'hidden' }}>
          {/* Decorative stripe overlay */}
          <div className="stripe-overlay" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

          {/* Decorative dots */}
          <div style={{ position: 'absolute', top: 30, right: 40, width: 8, height: 8, background: '#FFD700', borderRadius: '50%', opacity: 0.4, zIndex: 1 }} />
          <div style={{ position: 'absolute', top: 60, right: 70, width: 5, height: 5, background: '#FF8C00', transform: 'rotate(45deg)', opacity: 0.3, zIndex: 1 }} />
          <div style={{ position: 'absolute', bottom: 80, left: 30, width: 6, height: 6, background: '#DDA0DD', borderRadius: '50%', opacity: 0.35, zIndex: 1 }} />

          {/* Header */}
          <div style={{ position: 'relative', zIndex: 2, padding: '28px 30px 0' }}>
            <div style={{ height: 4, width: 60, borderRadius: 2, background: 'linear-gradient(90deg, #FF8C42, #FFB347)', marginBottom: 12 }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: '#4A3728', letterSpacing: 1 }}>
              My Cat
            </div>
            <div style={{ fontSize: 13, color: '#A08060', marginTop: 2 }}>专属猫猫生成器</div>
          </div>

          {/* Cat SVG area */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center', padding: '20px 0 10px' }}>
            {/* Radial glow behind cat */}
            <div className="glow" style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 220, height: 220, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,180,100,0.3) 0%, transparent 70%)',
            }} />
            <div style={{ width: 300, height: 300, position: 'relative' }}
              dangerouslySetInnerHTML={{ __html: svgString }} />
          </div>

          {/* User name */}
          <div style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#4A3728' }}>{userName} 的猫猫</div>
          </div>

          {/* Trait badges */}
          <div style={{ textAlign: 'center', padding: '10px 30px', position: 'relative', zIndex: 2 }}>
            {traitLabels.map((label, i) => (
              <span key={i} className="badge">{label}</span>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            textAlign: 'center', padding: '12px 0 20px',
            position: 'relative', zIndex: 2,
            fontSize: 12, color: '#B0956E',
          }}>
            {paletteName} · {patternName} · MEOWSEV
          </div>
        </div>
      </body>
    </html>
  );
}
