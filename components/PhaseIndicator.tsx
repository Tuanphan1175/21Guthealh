import React from 'react';

interface PhaseIndicatorProps {
  day: number;
}

const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({ day }) => {
  let phaseName = "Pha 1: Thanh Lọc & Giảm Viêm (Ngày 1-3)";
  let gradientClass = "from-emerald-400 to-teal-500";
  let textClass = "text-emerald-600";

  if (day >= 4 && day <= 21) {
    gradientClass = "from-amber-400 to-orange-500";
    textClass = "text-amber-600";
    phaseName = "Pha 2: Phục Hồi & Nuôi Dưỡng (Ngày 4-21)";
  } else if (day > 21) {
    gradientClass = "from-indigo-400 to-purple-500";
    textClass = "text-indigo-600";
    phaseName = "Pha 3: Duy Trì & Lối Sống Mới (Sau 21 ngày)";
  }

  // Calculate progress percentage within the 21 days (capped at 100%)
  const progress = Math.min((day / 21) * 100, 100);

  return (
    <div className="w-full mb-8 mt-4">
      <div className="flex justify-between items-end mb-3">
        <h2 className={`text-sm font-extrabold uppercase tracking-wide ${textClass}`}>
          {phaseName}
        </h2>
        <span className="text-xs text-slate-400 font-bold uppercase bg-slate-100 px-2 py-1 rounded-lg">Ngày {day}/21</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-5 overflow-hidden shadow-inner border border-slate-200">
        <div 
          className={`h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r ${gradientClass} shadow-sm relative`} 
          style={{ width: `${progress}%` }}
        >
            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
        </div>
      </div>
      <div className="mt-2 text-[10px] sm:text-xs font-bold text-slate-400 flex justify-between px-1 uppercase tracking-wider">
        <span>Ngày 1</span>
        <span>Ngày 4</span>
        <span>Ngày 21</span>
        <span>Duy trì</span>
      </div>
    </div>
  );
};

export default PhaseIndicator;