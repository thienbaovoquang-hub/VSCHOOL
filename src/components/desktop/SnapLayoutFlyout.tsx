import React from 'react';
import { WindowSnapPosition } from '../../types/window';

interface SnapLayoutFlyoutProps {
  onSelectSnap: (position: WindowSnapPosition) => void;
  onClose: () => void;
}

export const SnapLayoutFlyout: React.FC<SnapLayoutFlyoutProps> = ({
  onSelectSnap,
  onClose
}) => {
  return (
    <div 
      className="absolute top-10 right-0 z-50 p-3 rounded-2xl win11-acrylic shadow-2xl border border-white/80 animate-in fade-in zoom-in-95 duration-150 w-72"
      onMouseLeave={onClose}
    >
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
        Bố cục Snap Layouts
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        {/* Layout 1: Left / Right 50% split */}
        <div className="p-2 rounded-xl bg-white/60 hover:bg-sky-50/80 border border-slate-200/80 transition-all flex flex-col gap-1 cursor-pointer group">
          <span className="text-[10px] font-medium text-slate-600 group-hover:text-sky-700">Chia đôi 1/2</span>
          <div className="grid grid-cols-2 gap-1 h-14">
            <button
              onClick={() => onSelectSnap('left')}
              className="h-full rounded-md bg-slate-200 hover:bg-sky-400 group-hover:border-sky-300 border border-transparent transition-colors"
              title="Snap sang trái 50%"
            />
            <button
              onClick={() => onSelectSnap('right')}
              className="h-full rounded-md bg-slate-200 hover:bg-sky-400 group-hover:border-sky-300 border border-transparent transition-colors"
              title="Snap sang phải 50%"
            />
          </div>
        </div>

        {/* Layout 2: 4 Quarters 25% each */}
        <div className="p-2 rounded-xl bg-white/60 hover:bg-sky-50/80 border border-slate-200/80 transition-all flex flex-col gap-1 cursor-pointer group">
          <span className="text-[10px] font-medium text-slate-600 group-hover:text-sky-700">Bốn góc 1/4</span>
          <div className="grid grid-cols-2 grid-rows-2 gap-1 h-14">
            <button
              onClick={() => onSelectSnap('top-left')}
              className="h-full rounded-md bg-slate-200 hover:bg-sky-400 border border-transparent transition-colors"
              title="Góc trên bên trái"
            />
            <button
              onClick={() => onSelectSnap('top-right')}
              className="h-full rounded-md bg-slate-200 hover:bg-sky-400 border border-transparent transition-colors"
              title="Góc trên bên phải"
            />
            <button
              onClick={() => onSelectSnap('bottom-left')}
              className="h-full rounded-md bg-slate-200 hover:bg-sky-400 border border-transparent transition-colors"
              title="Góc dưới bên trái"
            />
            <button
              onClick={() => onSelectSnap('bottom-right')}
              className="h-full rounded-md bg-slate-200 hover:bg-sky-400 border border-transparent transition-colors"
              title="Góc dưới bên phải"
            />
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 px-1">
        <span>Kéo cửa sổ đến mép màn hình để Snap tự động</span>
      </div>
    </div>
  );
};
