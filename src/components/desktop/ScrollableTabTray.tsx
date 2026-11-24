import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';
import type { SuperAppId } from '../../types';
import type { AppTabDefinition } from '../../types/window';
import {
  computeNextDragScroll,
  computeStepScrollTarget,
  computeTabScrollState,
  type TabScrollState,
} from '../../utils/topBarNavigation';
import { TAB_ICONS } from '../shared/AppWindowShell';

interface ScrollableTabTrayProps {
  appId: SuperAppId;
  appTitle: string;
  tabs: AppTabDefinition[];
  activeTab: string;
  testIdPrefix: string;
  onSelectTab: (appId: SuperAppId, tabId: string) => void;
}

const INITIAL_SCROLL_STATE: TabScrollState = {
  canScrollLeft: false,
  canScrollRight: false,
  hasOverflow: false,
  maxScrollLeft: 0,
};

export const ScrollableTabTray: React.FC<ScrollableTabTrayProps> = ({
  appId,
  appTitle,
  tabs,
  activeTab,
  testIdPrefix,
  onSelectTab,
}) => {
  const scrollRef = useRef<HTMLElement>(null);
  const suppressNextClickRef = useRef(false);
  const clearSuppressTimerRef = useRef<number | null>(null);
  const prevClientWidthRef = useRef(0);
  const [scrollState, setScrollState] = useState<TabScrollState>(INITIAL_SCROLL_STATE);
  const [isDragging, setIsDragging] = useState(false);

  const measureOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prevWidth = prevClientWidthRef.current;
    prevClientWidthRef.current = el.clientWidth;

    if (prevWidth === 0 && el.clientWidth > 0) {
      const activeBtn = el.querySelector<HTMLElement>('[aria-selected="true"]');
      if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
        activeBtn.scrollIntoView({
          behavior: 'auto',
          inline: 'nearest',
          block: 'nearest',
        });
      }
    }

    const next = computeTabScrollState({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    });
    setScrollState((prev) =>
      prev.canScrollLeft === next.canScrollLeft &&
      prev.canScrollRight === next.canScrollRight &&
      prev.hasOverflow === next.hasOverflow &&
      prev.maxScrollLeft === next.maxScrollLeft
        ? prev
        : next
    );
  }, []);

  // Measure overflow on mount, tab list changes, window resize, and element resize
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const rafId = window.requestAnimationFrame(measureOverflow);
    const onResize = () => measureOverflow();
    window.addEventListener('resize', onResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measureOverflow());
      observer.observe(el);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [measureOverflow, appId, tabs.length]);

  // Auto-scroll active tab into view when switched or app changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const activeBtn = el.querySelector<HTMLElement>('[aria-selected="true"]');
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        inline: 'nearest',
        block: 'nearest',
      });
    }
    const timer = window.setTimeout(measureOverflow, 220);
    return () => window.clearTimeout(timer);
  }, [activeTab, appId, measureOverflow]);

  // Translate vertical mouse wheel over the tab tray into horizontal scrolling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const state = computeTabScrollState({
        scrollLeft: el.scrollLeft,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      });
      if (!state.hasOverflow) return;

      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
        measureOverflow();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [measureOverflow]);

  useEffect(() => {
    return () => {
      if (clearSuppressTimerRef.current !== null) {
        window.clearTimeout(clearSuppressTimerRef.current);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    // Allow native hardware touch momentum scroll (`touch-pan-x`) on touchscreens
    if (e.pointerType === 'touch' || e.button !== 0) return;

    const el = scrollRef.current;
    if (!el) return;
    const state = computeTabScrollState({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    });
    if (!state.hasOverflow) return;

    const startX = e.clientX;
    const startScrollLeft = el.scrollLeft;
    let didDrag = false;
    suppressNextClickRef.current = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const result = computeNextDragScroll({
        startX,
        currentX: moveEvent.clientX,
        startScrollLeft,
        maxScrollLeft: el.scrollWidth - el.clientWidth,
      });
      if (result.isDragging) {
        if (!didDrag) {
          didDrag = true;
          setIsDragging(true);
        }
        el.scrollLeft = result.nextScrollLeft;
        measureOverflow();
      }
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      setIsDragging(false);
    };

    const handlePointerUp = () => {
      cleanup();
      if (didDrag) {
        suppressNextClickRef.current = true;
        if (clearSuppressTimerRef.current !== null) {
          window.clearTimeout(clearSuppressTimerRef.current);
        }
        clearSuppressTimerRef.current = window.setTimeout(() => {
          suppressNextClickRef.current = false;
          clearSuppressTimerRef.current = null;
        }, 60);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (!suppressNextClickRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    suppressNextClickRef.current = false;
    if (clearSuppressTimerRef.current !== null) {
      window.clearTimeout(clearSuppressTimerRef.current);
      clearSuppressTimerRef.current = null;
    }
  };

  const handleStepScroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const target = computeStepScrollTarget({
      scrollLeft: el.scrollLeft,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      direction,
    });
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left: target, behavior: 'smooth' });
    } else {
      el.scrollLeft = target;
    }
  };

  return (
    <div
      data-testid={`${testIdPrefix}-tabs-tray-${appId}`}
      data-overflow={scrollState.hasOverflow ? 'true' : 'false'}
      className="glass-pill-tray relative inline-flex items-center min-w-0 max-w-full rounded-full p-1"
    >
      {scrollState.canScrollLeft && (
        <div className="absolute left-0.5 inset-y-0.5 flex items-center pl-1 pr-3 rounded-l-full bg-gradient-to-r from-white/90 via-white/65 to-transparent dark:from-slate-900/90 dark:via-slate-900/65 pointer-events-none z-10">
          <button
            type="button"
            data-testid={`${testIdPrefix}-scroll-left-${appId}`}
            onClick={() => handleStepScroll('left')}
            aria-label="Kéo tab sang trái"
            title="Kéo tab sang trái"
            className="pointer-events-auto w-7 h-7 rounded-full flex items-center justify-center bg-white/95 dark:bg-slate-800/95 text-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-white/15 shadow-sm hover:scale-105 hover:text-sky-600 dark:hover:text-sky-400 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <nav
        ref={scrollRef}
        aria-label={`Tính năng ${appTitle}`}
        data-testid={`${testIdPrefix}-tabs-${appId}`}
        role="tablist"
        onScroll={measureOverflow}
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
        onDragStart={(e) => e.preventDefault()}
        className={`flex items-center gap-1 min-w-0 max-w-full overflow-x-auto scrollbar-none flex-nowrap touch-pan-x scroll-px-10 select-none ${
          scrollState.hasOverflow
            ? isDragging
              ? 'cursor-grabbing [&>button]:cursor-grabbing'
              : 'cursor-grab'
            : ''
        }`}
      >
        {tabs.map((tab) => {
          const isTabActive = activeTab === tab.id;
          const IconComp = TAB_ICONS[tab.iconName] || LayoutDashboard;

          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`${testIdPrefix}-tab-${appId}-${tab.id}`}
              onClick={() => onSelectTab(appId, tab.id)}
              aria-selected={isTabActive}
              role="tab"
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-all ${
                isTabActive ? 'glass-pill-tab-active' : 'glass-pill-tab'
              }`}
            >
              <IconComp className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {scrollState.canScrollRight && (
        <div className="absolute right-0.5 inset-y-0.5 flex items-center pr-1 pl-3 rounded-r-full bg-gradient-to-l from-white/90 via-white/65 to-transparent dark:from-slate-900/90 dark:via-slate-900/65 pointer-events-none z-10">
          <button
            type="button"
            data-testid={`${testIdPrefix}-scroll-right-${appId}`}
            onClick={() => handleStepScroll('right')}
            aria-label="Kéo tab sang phải"
            title="Kéo tab sang phải"
            className="pointer-events-auto w-7 h-7 rounded-full flex items-center justify-center bg-white/95 dark:bg-slate-800/95 text-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-white/15 shadow-sm hover:scale-105 hover:text-sky-600 dark:hover:text-sky-400 transition-all cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
