
import React, { useState } from 'react';
import { SuggestionMeal } from '../types';
import { 
  RefreshCw, AlertCircle, ChevronDown, Info, 
  Image as ImageIcon, Sparkles, Loader2, Wand2, 
  Check, UtensilsCrossed, Leaf, Egg, Droplets, 
  Wheat, Pizza, Download 
} from 'lucide-react';
import { generateMealImage } from '../geminiService';
import GutIcon from './GutIcon';

interface RecipeCardProps {
  meal: SuggestionMeal;
  index: number;
  onReplace?: () => void;
  onUpdate?: (updatedMeal: SuggestionMeal) => void;
  loading?: boolean;
}

const Chip: React.FC<{ text: string }> = ({ text }) => (
  <span className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-lg text-[10px] font-black text-slate-700 mr-2 mb-2 uppercase tracking-widest">
    {text}
  </span>
);

const IngredientIcon: React.FC<{ name: string }> = ({ name }) => {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('thịt') || lowerName.includes('gà') || lowerName.includes('bò') || lowerName.includes('lợn') || lowerName.includes('cá') || lowerName.includes('tôm') || lowerName.includes('hải sản')) {
    return <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg border border-rose-200"><UtensilsCrossed size={14} /></div>;
  }
  if (lowerName.includes('rau') || lowerName.includes('cải') || lowerName.includes('xà lách') || lowerName.includes('quả') || lowerName.includes('táo') || lowerName.includes('chuối') || lowerName.includes('bơ')) {
    return <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200"><Leaf size={14} /></div>;
  }
  if (lowerName.includes('trứng') || lowerName.includes('sữa') || lowerName.includes('phô mai') || lowerName.includes('đậu phụ')) {
    return <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg border border-amber-200"><Egg size={14} /></div>;
  }
  if (lowerName.includes('dầu') || lowerName.includes('nước') || lowerName.includes('mắm') || lowerName.includes('tương') || lowerName.includes('giấm')) {
    return <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg border border-blue-200"><Droplets size={14} /></div>;
  }
  if (lowerName.includes('gạo') || lowerName.includes('bún') || lowerName.includes('phở') || lowerName.includes('mì') || lowerName.includes('ngũ cốc') || lowerName.includes('quinoa') || lowerName.includes('khoai')) {
    return <div className="p-1.5 bg-orange-100 text-orange-700 rounded-lg border border-orange-200"><Wheat size={14} /></div>;
  }
  if (lowerName.includes('hạt') || lowerName.includes('đậu') || lowerName.includes('lạc') || lowerName.includes('vừng')) {
    return <div className="p-1.5 bg-stone-200 text-stone-800 rounded-lg border border-stone-300"><Pizza size={14} /></div>;
  }
  
  return <div className="p-1.5 bg-slate-200 text-slate-700 rounded-lg border border-slate-300"><Check size={14} /></div>;
};

const RecipeCard: React.FC<RecipeCardProps> = ({ meal, index, onReplace, onUpdate, loading: parentLoading }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(meal.image_url || null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const n = meal.nutrition_estimate;
  
  const handleGenerateImage = async () => {
    if (generatingImage) return;
    setGeneratingImage(true);
    try {
      const url = await generateMealImage(meal);
      setImageUrl(url);
      if (onUpdate) {
        onUpdate({ ...meal, image_url: url });
      }
    } catch (err) {
      console.error("Failed to generate image", err);
    } finally {
      setGeneratingImage(false);
    }
  };

  const getOverallScore = () => {
    if (typeof meal.fit_score === 'number') return meal.fit_score;
    return meal.fit_score?.overall ?? 0;
  };

  const compactWarnings = () => {
    if (!meal.warnings_or_notes) return [];
    if (Array.isArray(meal.warnings_or_notes)) {
      return meal.warnings_or_notes.map(w => typeof w === 'string' ? w : w.message);
    }
    return [meal.warnings_or_notes];
  };

  const buildReason = () => {
    if (meal.short_reason) return meal.short_reason;
    if (meal.reason) return meal.reason.split('.')[0] + '.';
    return "Phù hợp với chỉ tiêu dinh dưỡng và mục tiêu phục hồi đường ruột của bạn.";
  };

  const warnings = compactWarnings();
  const overallScore = getOverallScore();

  return (
    <div className="bg-white border-2 border-slate-200 rounded-[2.5rem] overflow-hidden shadow-md hover:shadow-xl hover:border-indigo-200 transition-all duration-300">
      {/* Image Section */}
      <div className="relative h-72 sm:h-[32rem] bg-slate-100 flex items-center justify-center overflow-hidden border-b-2 border-slate-100">
        {imageUrl ? (
          <div className="relative w-full h-full group">
            <img 
              src={imageUrl} 
              alt={meal.recipe_name} 
              className="w-full h-full object-cover animate-in fade-in duration-700"
            />
            
            {/* Overlay Actions for existing image */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6">
               <button 
                 onClick={handleGenerateImage}
                 disabled={generatingImage}
                 className="p-5 bg-white rounded-full text-indigo-700 shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center gap-2"
                 title="Tạo lại ảnh"
               >
                 {generatingImage ? <Loader2 size={24} className="animate-spin" /> : <RefreshCw size={24} />}
               </button>
               <a 
                 href={imageUrl} 
                 download={`${meal.recipe_name}.png`}
                 className="p-5 bg-white rounded-full text-emerald-700 shadow-2xl hover:scale-110 active:scale-95 transition-all"
                 title="Tải ảnh về"
               >
                 <Download size={24} />
               </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 p-12 text-center w-full">
            <div className="p-8 bg-white rounded-[3rem] text-slate-300 shadow-inner ring-4 ring-slate-50 border border-slate-100">
              <ImageIcon size={56} />
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Hình ảnh trực quan</h4>
              <p className="text-xs font-bold text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                Hệ thống sẽ phác họa món ăn dựa trên nguyên liệu thật từ công thức của bạn.
              </p>
            </div>
            <button
              onClick={handleGenerateImage}
              disabled={generatingImage}
              className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-200 flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
            >
              <Wand2 size={18} />
              Tạo ảnh thực đơn
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {generatingImage && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-lg flex flex-col items-center justify-center gap-6 z-10 animate-in fade-in duration-300">
            <Loader2 size={64} className="text-indigo-600 animate-spin" />
            <div className="text-center space-y-2">
              <p className="text-sm font-black text-indigo-900 uppercase tracking-[0.2em] animate-pulse">Đang phác họa món ăn...</p>
              <p className="text-xs font-bold text-slate-500">Quá trình này có thể mất vài giây</p>
            </div>
          </div>
        )}
        
        {/* Fit Score Badge */}
        <div className="absolute top-8 left-8 z-10">
           <div className="px-5 py-2.5 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-white flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${overallScore > 80 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]'}`}></div>
              <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Độ khớp {Math.round(overallScore)}%</span>
           </div>
        </div>
      </div>

      <div className="p-8 sm:p-12">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-8 mb-10">
          <div className="flex-1 min-w-0">
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight mb-4 tracking-tight">
              {meal.recipe_name}
            </h3>
            <p className="text-lg text-slate-700 font-bold mb-6 line-clamp-2 leading-relaxed">
              {meal.short_description}
            </p>
            <div className="flex flex-wrap gap-2">
              <Chip text={`${Math.round(n.kcal)} kcal`} />
              <Chip text={`Đạm ${Math.round(n.protein_g)}g`} />
              <Chip text={`Carb ${Math.round(n.carb_g)}g`} />
              <Chip text={`Béo ${Math.round(n.fat_g)}g`} />
              <Chip text={`Xơ ${Math.round(n.fiber_g)}g`} />
            </div>
          </div>

          <div className="flex gap-4 shrink-0 self-end sm:self-start">
            <button
              onClick={handleGenerateImage}
              disabled={generatingImage}
              className={`p-5 rounded-2xl transition-all shadow-md active:scale-90 disabled:opacity-50 border-2 ${
                imageUrl 
                  ? 'bg-white border-slate-200 text-indigo-600 hover:text-indigo-800 hover:border-indigo-300' 
                  : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
              }`}
              title="Tạo ảnh món ăn"
            >
              {generatingImage ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onReplace?.(); }}
              disabled={parentLoading}
              className="p-5 bg-white border-2 border-slate-200 rounded-2xl text-slate-500 hover:text-emerald-700 hover:border-emerald-300 transition-all shadow-md active:scale-90 disabled:opacity-50"
              title="Đổi món khác"
            >
              <RefreshCw size={24} className={parentLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Expert Insights */}
        <div className="bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] p-8 mb-8">
          <div className="flex items-center gap-3 text-[11px] font-black text-emerald-700 uppercase tracking-[0.25em] mb-4">
            <div className="p-1.5 bg-white rounded-lg shadow-sm">
              <GutIcon size={16} />
            </div>
            Gợi ý phục hồi
          </div>
          <p className="text-xl text-slate-900 font-black leading-relaxed italic">
            "{buildReason()}"
          </p>
        </div>

        {/* Digestive Warnings */}
        {warnings.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-100 rounded-[2rem] p-8 mb-8">
            <div className="flex items-center gap-3 text-[11px] font-black text-orange-700 uppercase tracking-[0.25em] mb-4">
              <div className="p-1.5 bg-white rounded-lg shadow-sm">
                <AlertCircle size={16} />
              </div>
              Lưu ý tiêu hóa
            </div>
            <div className="space-y-3">
              {warnings.map((w, i) => (
                <p key={i} className="text-base text-slate-900 font-black leading-tight flex items-start gap-3">
                  <span className="text-orange-500 mt-1">•</span> {w}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Recipe Details Accordion */}
        <details className="group border-t-2 border-slate-200 pt-10">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <div className="flex items-center gap-4 text-xs font-black text-slate-700 uppercase tracking-[0.2em]">
              <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600"><Info size={20} /></div>
              Thành phần & Định lượng chi tiết
            </div>
            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600 group-open:rotate-180 transition-transform">
              <ChevronDown size={24} />
            </div>
          </summary>
          
          <div className="mt-10 space-y-8">
             <div className="bg-slate-50 border-2 border-slate-200 rounded-[2.5rem] p-8 sm:p-10 shadow-inner">
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  {meal.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-center justify-between gap-6 border-b-2 border-slate-200/50 pb-5 last:border-0 group/item">
                      <div className="flex items-center gap-4 min-w-0">
                        <IngredientIcon name={ing.name} />
                        <span className="text-base font-black text-slate-900 truncate">{ing.name}</span>
                      </div>
                      <span className="text-sm font-black text-indigo-700 whitespace-nowrap bg-white border-2 border-indigo-100 px-5 py-2 rounded-2xl shadow-sm group-hover/item:border-indigo-400 group-hover/item:shadow-md transition-all">
                        {ing.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
             </div>

             {meal.how_it_supports_gut && (
               <div className="p-8 border-l-8 border-emerald-500 bg-emerald-50/60 rounded-r-[2.5rem] shadow-sm">
                  <p className="text-base font-bold text-emerald-950 leading-relaxed">
                    <span className="uppercase text-[11px] font-black block mb-3 opacity-60 tracking-[0.2em]">Cơ chế phục hồi:</span>
                    {meal.how_it_supports_gut}
                  </p>
               </div>
             )}
          </div>
        </details>
      </div>
    </div>
  );
};

export default RecipeCard;
