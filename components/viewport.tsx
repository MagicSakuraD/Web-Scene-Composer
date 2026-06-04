'use client'

import {
  MousePointer2,
  Move,
  RotateCcw,
  Maximize2,
  Grid3X3,
  Camera,
} from 'lucide-react'

export function Viewport() {
  return (
    <div className="h-full flex flex-col bg-[oklch(0.18_0_0)]">
      {/* Viewport toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-[oklch(0.16_0_0)]">
        <button className="p-1.5 rounded hover:bg-accent text-primary">
          <MousePointer2 className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-accent text-muted-foreground">
          <Move className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-accent text-muted-foreground">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-accent text-muted-foreground">
          <Maximize2 className="h-4 w-4" />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button className="p-1.5 rounded hover:bg-accent text-muted-foreground">
          <Grid3X3 className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-accent text-muted-foreground">
          <Camera className="h-4 w-4" />
        </button>
      </div>

      {/* Viewport content - 3D scene placeholder */}
      <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-[oklch(0.25_0.01_220)] to-[oklch(0.18_0_0)]">
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
        
        {/* Placeholder 3D scene representation */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-4/5 h-3/4 max-w-3xl">
            {/* Ground plane */}
            <div 
              className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-full aspect-[2/1]"
              style={{
                background: 'linear-gradient(135deg, oklch(0.45 0.12 180) 0%, oklch(0.35 0.08 200) 100%)',
                transform: 'translateX(-50%) perspective(1000px) rotateX(60deg)',
                borderRadius: '8px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              }}
            />
            
            {/* Scene label */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/50 font-mono">
              3D Viewport
            </div>
          </div>
        </div>

        {/* Camera gizmo - top right */}
        <div className="absolute top-3 right-3 w-16 h-16 rounded bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="relative w-10 h-10">
            <div className="absolute top-1/2 left-1/2 w-8 h-0.5 bg-red-500 -translate-x-1/2 -translate-y-1/2 rotate-0" />
            <div className="absolute top-1/2 left-1/2 w-0.5 h-8 bg-green-500 -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] text-green-500 font-bold">Y</div>
            <div className="absolute top-1/2 right-0 -translate-y-1/2 text-[8px] text-red-500 font-bold">X</div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] text-blue-500 font-bold">Z</div>
          </div>
        </div>
      </div>
    </div>
  )
}
