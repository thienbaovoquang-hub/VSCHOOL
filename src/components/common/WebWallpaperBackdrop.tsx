import React from 'react';
import type { SystemWallpaperConfig } from '../../types';
import {
  DEFAULT_SYSTEM_WALLPAPER,
  findWallpaperPreset,
  isSafeWallpaperUrl,
} from '../../utils/wallpaper';

interface WebWallpaperBackdropProps {
  wallpaper?: SystemWallpaperConfig | null;
}

export const WebWallpaperBackdrop: React.FC<WebWallpaperBackdropProps> = ({ wallpaper }) => {
  const active = wallpaper || DEFAULT_SYSTEM_WALLPAPER;
  const preset = findWallpaperPreset(active.presetId);
  const safeImageUrl =
    active.mode === 'image' && isSafeWallpaperUrl(active.imageUrl)
      ? active.imageUrl!.trim()
      : null;

  const hasPresetGradient = active.mode === 'preset' && Boolean(preset?.gradient);
  const blurPx = Math.max(0, Math.min(24, Number(active.blurPx) || 0));
  const overlayAlpha = Math.max(0, Math.min(0.7, (Number(active.overlayOpacity) || 0) / 100));

  return (
    <div
      data-testid="web-wallpaper-backdrop"
      data-wallpaper-mode={active.mode}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    >
      {/* Base Atmospheric Aurora Mesh */}
      <div className="aurora-mesh" />

      {/* Custom Preset Mesh Gradient Layer */}
      {hasPresetGradient && preset?.gradient && (
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{
            backgroundImage: preset.gradient,
            filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
            transform: blurPx > 0 ? 'scale(1.06)' : undefined,
          }}
        />
      )}

      {/* Custom / Campus Wallpaper Photo Layer */}
      {safeImageUrl && (
        <img
          src={safeImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
          style={{
            filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
            transform: blurPx > 0 ? 'scale(1.06)' : undefined,
          }}
        />
      )}

      {/* Subtle Adaptive Veil to protect Liquid Glass typography contrast */}
      {(safeImageUrl || hasPresetGradient) && overlayAlpha > 0 && (
        <>
          <div
            className="absolute inset-0 dark:hidden transition-opacity duration-300"
            style={{ backgroundColor: `rgba(241, 247, 255, ${overlayAlpha})` }}
          />
          <div
            className="absolute inset-0 hidden dark:block transition-opacity duration-300"
            style={{ backgroundColor: `rgba(6, 11, 22, ${Math.min(0.8, overlayAlpha + 0.16)})` }}
          />
        </>
      )}
    </div>
  );
};
