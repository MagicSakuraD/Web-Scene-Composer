'use client'

import {
  MousePointer2,
  Crosshair,
  Move,
  Globe,
  ZoomIn,
  Video,
  Mountain,
} from 'lucide-react'

export function Viewport() {
  return (
    <div className="h-full flex flex-col bg-viewport">
      {/* Viewport content - 3D scene placeholder */}
      <div className="flex-1 relative overflow-hidden">
        {/* Perspective grid background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(var(--color-border) 1px, transparent 1px),
              linear-gradient(90deg, var(--color-border) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            opacity: 0.5,
          }}
        />
        {/* Center axis lines */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-muted-foreground/30" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-muted-foreground/30" />

        {/* Placeholder 3D object */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-40 h-40 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 35% 30%, oklch(0.99 0 0), oklch(0.78 0 0))',
              boxShadow: '0 30px 60px rgba(0,0,0,0.25)',
            }}
          />
        </div>

        {/* Viewport controls overlay - bottom left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-md bg-card/80 backdrop-blur-sm border border-border p-0.5 shadow-sm">
          <button className="p-1.5 rounded text-primary hover:bg-accent" title="选择">
            <MousePointer2 className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded text-muted-foreground hover:bg-accent" title="中心">
            <Crosshair className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded text-muted-foreground hover:bg-accent" title="平移">
            <Move className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded text-muted-foreground hover:bg-accent" title="环绕">
            <Globe className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded text-muted-foreground hover:bg-accent" title="缩放">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded text-muted-foreground hover:bg-accent" title="相机">
            <Video className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded text-muted-foreground hover:bg-accent" title="地形">
            <Mountain className="h-4 w-4" />
          </button>
        </div>

        {/* Axis indicator - bottom right */}
        <div className="absolute bottom-3 right-3 w-16 h-16 rounded-full bg-card/70 backdrop-blur-sm border border-border flex items-center justify-center shadow-sm">
          <div className="relative w-9 h-9">
            <div className="absolute top-1/2 left-1/2 w-7 h-0.5 bg-red-500 -translate-y-1/2" />
            <div className="absolute top-1/2 left-1/2 w-0.5 h-7 bg-green-500 -translate-x-1/2 -translate-y-full" />
            <div className="absolute top-1/2 left-1/2 w-4 h-0.5 bg-blue-500 origin-left -translate-y-1/2 rotate-[135deg]" />
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] text-green-500 font-bold">
              Y
            </div>
            <div className="absolute top-1/2 -right-2 -translate-y-1/2 text-[8px] text-red-500 font-bold">
              X
            </div>
            <div className="absolute bottom-0 left-0 text-[8px] text-blue-500 font-bold">
              Z
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
