import React, { useState, useRef, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { WindowState, WindowSnapPosition } from '../../types/window';
import { APP_REGISTRY } from '../../data/appRegistry';
import { SnapLayoutFlyout } from './SnapLayoutFlyout';

interface AppWindowProps {
  windowState: WindowState;
  isActive: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onSnap: (position: WindowSnapPosition) => void;
  onUpdateBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  onDragMove?: (clientX: number, clientY: number) => void;
  onDragEnd?: () => void;
  children: React.ReactNode;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const AppWindow: React.FC<AppWindowProps> = ({
  windowState,
  isActive,
  onFocus,
  onClose,
  onMinimize,
  onToggleMaximize,
  onSnap,
  onUpdateBounds,
  onDragMove,
  onDragEnd,
  children,
}) => {
  const { id, isOpen, isMinimized, isMaximized, x, y, width, height, zIndex, snapPosition } = windowState;
  const appMeta = APP_REGISTRY[id];
  const AppIcon = appMeta.icon;

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showSnapFlyout, setShowSnapFlyout] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const dragStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    initialX: 0,
    initialY: 0,
    width: 0,
    height: 0,
  });

  const resizeStartRef = useRef<{
    direction: ResizeDirection;
    mouseX: number;
    mouseY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
  }>({
    direction: 'se',
    mouseX: 0,
    mouseY: 0,
    initialX: 0,
    initialY: 0,
    initialWidth: 0,
    initialHeight: 0,
  });

  const handleTitleBarMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isMobile) return;
    onFocus();

    let startX = x;
    let startY = y;
    let startW = width;
    let startH = height;

    // Seamless drag-out from maximized or snapped window
    if (isMaximized || snapPosition !== 'none') {
      const restoreW = windowState.prevBounds?.width ?? appMeta.defaultWidth;
      const restoreH = windowState.prevBounds?.height ?? appMeta.defaultHeight;
      startW = restoreW;
      startH = restoreH;
      startX = Math.max(0, e.clientX - Math.floor(restoreW / 2));
      startY = Math.max(0, e.clientY - 20);
      onUpdateBounds({ x: startX, y: startY, width: startW, height: startH });
    }

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: startX,
      initialY: startY,
      width: startW,
      height: startH,
    };
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      onUpdateBounds({
        x: dragStartRef.current.initialX + deltaX,
        y: dragStartRef.current.initialY + deltaY,
        width: dragStartRef.current.width,
        height: dragStartRef.current.height,
      });

      onDragMove?.(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onDragEnd?.();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onUpdateBounds, onDragMove, onDragEnd]);

  const handleResizeStart = (e: React.MouseEvent, direction: ResizeDirection) => {
    e.stopPropagation();
    e.preventDefault();
    onFocus();

    resizeStartRef.current = {
      direction,
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: x,
      initialY: y,
      initialWidth: width,
      initialHeight: height,
    };
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { direction, mouseX, mouseY, initialX, initialY, initialWidth, initialHeight } = resizeStartRef.current;
      const deltaX = e.clientX - mouseX;
      const deltaY = e.clientY - mouseY;

      let newX = initialX;
      let newY = initialY;
      let newW = initialWidth;
      let newH = initialHeight;

      const minW = appMeta.minWidth;
      const minH = appMeta.minHeight;

      if (direction.includes('e')) newW = Math.max(minW, initialWidth + deltaX);
      if (direction.includes('s')) newH = Math.max(minH, initialHeight + deltaY);
      if (direction.includes('w')) {
        const potentialW = initialWidth - deltaX;
        if (potentialW >= minW) {
          newW = potentialW;
          newX = initialX + deltaX;
        }
      }
      if (direction.includes('n')) {
        const potentialH = initialHeight - deltaY;
        if (potentialH >= minH) {
          newH = potentialH;
          newY = initialY + deltaY;
        }
      }

      onUpdateBounds({ x: newX, y: newY, width: newW, height: newH });
    };

    const handleMouseUp = () => setIsResizing(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, appMeta.minWidth, appMeta.minHeight, onUpdateBounds]);

  if (!isOpen) return null;

  const activeTabMeta = appMeta.tabs.find((t) => t.id === windowState.activeTab);

  return (
    <section
      aria-label={`Cửa sổ ${appMeta.title}`}
      data-testid={`window-${id}`}
      onMouseDown={onFocus}
      style={{
        position: 'absolute',
        left: isMobile ? '0px' : `${x}px`,
        top: isMobile ? '0px' : `${y}px`,
        width: isMobile ? '100%' : `${width}px`,
        height: isMobile ? '100%' : `${height}px`,
        zIndex,
        display: isMinimized ? 'none' : 'flex',
      }}
      className={`flex flex-col ${
        isMobile || isMaximized ? 'rounded-none' : 'rounded-2xl'
      } overflow-hidden win11-window border border-white/80 dark:border-white/15 ${
        isActive ? 'win11-window-active' : 'opacity-95'
      } ${isDragging ? 'select-none-during-drag' : ''}`}
    >
      {/* Window Title Bar */}
      <div
        data-testid={`window-titlebar-${id}`}
        onMouseDown={handleTitleBarMouseDown}
        onDoubleClick={() => !isMobile && onToggleMaximize()}
        className={`h-10 px-3 flex items-center justify-between shrink-0 border-b transition-colors ${
          isMobile ? '' : 'cursor-grab active:cursor-grabbing'
        } ${
          isActive
            ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-slate-200/70 dark:border-slate-700/70 text-slate-900 dark:text-slate-100'
            : 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-slate-200/50 dark:border-slate-800 text-slate-600 dark:text-slate-300'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-3">
          <AppIcon className="w-6 h-6 shrink-0" />
          <span className="font-bold text-xs tracking-tight truncate">{appMeta.title}</span>
          {activeTabMeta && (
            <span className="hidden sm:inline-flex items-center text-[11px] text-slate-400 dark:text-slate-500 truncate">
              · {activeTabMeta.label}
            </span>
          )}
        </div>

        <div
          className="flex items-center gap-1 shrink-0"
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onMinimize}
            data-testid={`window-minimize-${id}`}
            aria-label={`Thu nhỏ ${appMeta.title}`}
            title="Thu nhỏ"
            className="w-8 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {!isMobile && (
            <div className="relative" onMouseLeave={() => setShowSnapFlyout(false)}>
              <button
                type="button"
                onClick={onToggleMaximize}
                onMouseEnter={() => setShowSnapFlyout(true)}
                data-testid={`window-maximize-${id}`}
                aria-label={isMaximized ? `Khôi phục ${appMeta.title}` : `Phóng to ${appMeta.title}`}
                title={isMaximized ? 'Khôi phục' : 'Phóng to'}
                className="w-8 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
              </button>

              {showSnapFlyout && (
                <SnapLayoutFlyout
                  onSelectSnap={(snap) => {
                    onSnap(snap);
                    setShowSnapFlyout(false);
                  }}
                  onClose={() => setShowSnapFlyout(false)}
                />
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            data-testid={`window-close-${id}`}
            aria-label={`Đóng ${appMeta.title}`}
            title="Đóng"
            className="w-8 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* App Shell (Tabs pinned top + Content scrollable inside) */}
      <div className="flex-1 min-h-0 flex flex-col bg-white/92 dark:bg-slate-900/92 backdrop-blur-2xl text-slate-800 dark:text-slate-100 overflow-hidden">
        {children}
      </div>

      {/* 8-Direction Resize Handles */}
      {!isMobile && !isMaximized && snapPosition === 'none' && (
        <>
          <div onMouseDown={(e) => handleResizeStart(e, 'n')} className="absolute top-0 left-2 right-2 h-1.5 cursor-ns-resize z-20" />
          <div onMouseDown={(e) => handleResizeStart(e, 's')} className="absolute bottom-0 left-2 right-2 h-2 cursor-ns-resize z-20" />
          <div onMouseDown={(e) => handleResizeStart(e, 'w')} className="absolute top-2 bottom-2 left-0 w-1.5 cursor-ew-resize z-20" />
          <div onMouseDown={(e) => handleResizeStart(e, 'e')} className="absolute top-2 bottom-2 right-0 w-1.5 cursor-ew-resize z-20" />
          <div onMouseDown={(e) => handleResizeStart(e, 'nw')} className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize z-30" />
          <div onMouseDown={(e) => handleResizeStart(e, 'ne')} className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize z-30" />
          <div onMouseDown={(e) => handleResizeStart(e, 'sw')} className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize z-30" />
          <div onMouseDown={(e) => handleResizeStart(e, 'se')} className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize z-30" />
        </>
      )}
    </section>
  );
};
