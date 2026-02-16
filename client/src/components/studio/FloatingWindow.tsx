import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { X, Minus, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';

export interface FloatingWindowProps {
  id: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultX?: number;
  defaultY?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  onClose: () => void;
  onFocus: () => void;
  zIndex: number;
  minimized?: boolean;
  onMinimize?: () => void;
}

export default function FloatingWindow({
  id,
  title,
  icon,
  children,
  defaultX = 100,
  defaultY = 100,
  defaultWidth = 400,
  defaultHeight = 500,
  minWidth = 200,
  minHeight = 150,
  resizable = true,
  onClose,
  onFocus,
  zIndex,
  minimized = false,
  onMinimize,
}: FloatingWindowProps) {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
  const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight });
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaxState, setPreMaxState] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; edge: string } | null>(null);

  // Drag handling
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    onFocus();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
    };
  }, [pos, isMaximized, onFocus]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPos({
          x: Math.max(0, dragRef.current.startPosX + dx),
          y: Math.max(0, dragRef.current.startPosY + dy),
        });
      }
      if (resizeRef.current) {
        const dx = e.clientX - resizeRef.current.startX;
        const dy = e.clientY - resizeRef.current.startY;
        const edge = resizeRef.current.edge;
        let newW = resizeRef.current.startW;
        let newH = resizeRef.current.startH;

        if (edge.includes('e')) newW = Math.max(minWidth, resizeRef.current.startW + dx);
        if (edge.includes('s')) newH = Math.max(minHeight, resizeRef.current.startH + dy);
        if (edge.includes('w')) {
          const dw = Math.min(dx, resizeRef.current.startW - minWidth);
          newW = resizeRef.current.startW - dw;
          setPos(prev => ({ ...prev, x: Math.max(0, resizeRef.current!.startX - (resizeRef.current!.startW - newW) + (e.clientX - resizeRef.current!.startX) - dx + dw) }));
        }
        if (edge.includes('n')) {
          const dh = Math.min(dy, resizeRef.current.startH - minHeight);
          newH = resizeRef.current.startH - dh;
          setPos(prev => ({ ...prev, y: Math.max(0, resizeRef.current!.startY - (resizeRef.current!.startH - newH) + (e.clientY - resizeRef.current!.startY) - dy + dh) }));
        }

        setSize({ w: newW, h: newH });
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidth, minHeight]);

  const handleResizeStart = useCallback((e: React.MouseEvent, edge: string) => {
    if (!resizable || isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.w,
      startH: size.h,
      edge,
    };
  }, [resizable, isMaximized, size, onFocus]);

  const handleMaximize = useCallback(() => {
    if (isMaximized && preMaxState) {
      setPos({ x: preMaxState.x, y: preMaxState.y });
      setSize({ w: preMaxState.w, h: preMaxState.h });
      setIsMaximized(false);
      setPreMaxState(null);
    } else {
      setPreMaxState({ x: pos.x, y: pos.y, w: size.w, h: size.h });
      setPos({ x: 0, y: 0 });
      setSize({ w: window.innerWidth, h: window.innerHeight - 48 });
      setIsMaximized(true);
    }
  }, [isMaximized, preMaxState, pos, size]);

  const handleDoubleClickTitle = useCallback(() => {
    handleMaximize();
  }, [handleMaximize]);

  if (minimized) return null;

  const resizeEdgeClass = 'absolute hover:bg-purple-500/20 transition-colors';

  return (
    <div
      ref={windowRef}
      className="fixed flex flex-col rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-zinc-700/80 bg-zinc-900/95 backdrop-blur-md"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex,
      }}
      onMouseDown={onFocus}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/80 border-b border-zinc-700/50 cursor-grab active:cursor-grabbing select-none shrink-0"
        onMouseDown={handleDragStart}
        onDoubleClick={handleDoubleClickTitle}
      >
        {icon && <span className="shrink-0 text-zinc-400">{icon}</span>}
        <span className="text-xs font-semibold text-zinc-200 truncate flex-1">{title}</span>

        <div className="flex items-center gap-0.5 shrink-0">
          {onMinimize && (
            <button
              onClick={(e) => { e.stopPropagation(); onMinimize(); }}
              className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Minimize"
            >
              <Minus className="w-3 h-3" />
            </button>
          )}
          {resizable && (
            <button
              onClick={(e) => { e.stopPropagation(); handleMaximize(); }}
              className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>

      {/* Resize handles */}
      {resizable && !isMaximized && (
        <>
          <div className={`${resizeEdgeClass} top-0 left-0 right-0 h-1 cursor-n-resize`} onMouseDown={(e) => handleResizeStart(e, 'n')} />
          <div className={`${resizeEdgeClass} bottom-0 left-0 right-0 h-1 cursor-s-resize`} onMouseDown={(e) => handleResizeStart(e, 's')} />
          <div className={`${resizeEdgeClass} top-0 left-0 bottom-0 w-1 cursor-w-resize`} onMouseDown={(e) => handleResizeStart(e, 'w')} />
          <div className={`${resizeEdgeClass} top-0 right-0 bottom-0 w-1 cursor-e-resize`} onMouseDown={(e) => handleResizeStart(e, 'e')} />
          <div className={`${resizeEdgeClass} bottom-0 right-0 w-3 h-3 cursor-se-resize`} onMouseDown={(e) => handleResizeStart(e, 'se')} />
          <div className={`${resizeEdgeClass} bottom-0 left-0 w-3 h-3 cursor-sw-resize`} onMouseDown={(e) => handleResizeStart(e, 'sw')} />
          <div className={`${resizeEdgeClass} top-0 right-0 w-3 h-3 cursor-ne-resize`} onMouseDown={(e) => handleResizeStart(e, 'ne')} />
          <div className={`${resizeEdgeClass} top-0 left-0 w-3 h-3 cursor-nw-resize`} onMouseDown={(e) => handleResizeStart(e, 'nw')} />
        </>
      )}
    </div>
  );
}
