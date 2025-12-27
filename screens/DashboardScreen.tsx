
import React, { useState, useEffect } from 'react';
import { UserProfile, ComputedTargets, MealType, SuggestionResponse, UserInput, PersistRequest, SuggestionMeal, MealSlot, SnackTiming } from '../types';
import { calculateDailyNeeds, distributeTargetsByMeal } from '../nutritionService';
import { getMealSuggestions } from '../geminiService';

import RecipeCard from '../components/RecipeCard';
import PhaseIndicator from '../components/PhaseIndicator';
import GutIcon from '../components/GutIcon';
import { 
  Flame, Database, Droplet, Leaf, Utensils, Sparkles, 
  Calendar, Target, LogOut, RefreshCw, PlusCircle, 
  Loader2, AlertCircle, Edit3, Clock, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DashboardProps {
  userProfile: UserProfile;
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const MEAL_LABELS: Record<string, string> = {
    breakfast: 'Bữa sáng',
    lunch: 'Bữa trưa',
    dinner: 'Bữa tối',
    snack: 'Bữa phụ'
};

const DashboardScreen: React.FC<DashboardProps> = ({ userProfile }) => {
  const [day, setDay] = useState(1);
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [snackTiming, setSnackTiming] = useState<SnackTiming>('after_meal');
  const [dailyTargets, setDailyTargets] = useState<ComputedTargets | null>(null);
  const [mealTargets, setMealTargets] = useState<Record<MealType, ComputedTargets> | null>(null);
  const [runId, setRunId] = useState<string>("");
  const [personalNote, setPersonalNote] = useState<string>(userProfile.personal_note || "");
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<number | 'add' | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
        const daily = calculateDailyNeeds(userProfile);
        setDailyTargets(daily);
        setMealTargets(distributeTargetsByMeal(daily));

        let storedRunId = localStorage.getItem('guthealth_run_id');
        if (!storedRunId) {
            storedRunId = `run_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
            localStorage.setItem('guthealth_run_id', storedRunId);
        }
        setRunId(storedRunId);
    }
  }, [userProfile]);

  // Navigation Logic
  const handlePrevDay = () => {
    if (day > 1) {
      setDay(day - 1);
      setSuggestion(null);
    }
  };

  const handleNextDay = () => {
    if (day < 31) {
      setDay(day + 1);
      setSuggestion(null);
    }
  };

  const handlePrevMeal = () => {
    const currentIndex = MEAL_ORDER.indexOf(mealType);
    const prevIndex = (currentIndex - 1 + MEAL_ORDER.length) % MEAL_ORDER.length;
    setMealType(MEAL_ORDER[prevIndex]);
    setSuggestion(null);
  };

  const handleNextMeal = () => {
    const currentIndex = MEAL_ORDER.indexOf(mealType);
    const nextIndex = (currentIndex + 1) % MEAL_ORDER.length;
    setMealType(MEAL_ORDER[nextIndex]);
    setSuggestion(null);
  };

  // Persistent Helper
  const persistResults = async (updatedMeals: SuggestionMeal[], currentPhase: number, activeMeal: MealSlot) => {
    if (!runId) return;
    const persistPayload: PersistRequest = {
        run_id: runId,
        day_index: day,
        phase: String(currentPhase),
        replace_existing: true,
        replace_scope: 'meal_slot',
        meal_slot: activeMeal,
        suggestion_groups: [{
            meal_slot: activeMeal,
            items: updatedMeals.map(m => ({ 
               title: m.recipe_name, 
               description: m.short_description 
            }))
        }]
    };
    try {
        // await persistMealSuggestionsEdge(persistPayload);
    } catch (e) {
        console.warn("Auto-save failed", e);
    }
  };

  const handleMealUpdate = (updatedMeal: SuggestionMeal, index: number) => {
    if (!suggestion) return;
    const updatedMeals = suggestion.suggested_meals.map((m, i) => i === index ? updatedMeal : m);
    const newSuggestion = { ...suggestion, suggested_meals: updatedMeals };
    setSuggestion(newSuggestion);
    persistResults(updatedMeals, suggestion.phase, mealType as MealSlot);
  };

  async function generateOneItemForMeal(meal_slot: MealSlot, excludeTitles: string[]) {
    if (!mealTargets) throw new Error("Missing targets");
    
    const conditions = Object.keys(userProfile.health_conditions.flags).filter(k => userProfile.health_conditions.flags[k]);
    const restrictions = Object.keys(userProfile.dietary_preferences.restrictions).filter(k => userProfile.dietary_preferences.restrictions[k]);

    const input: UserInput = {
       day_number: day,
       meal_type: meal_slot,
       user_goal: userProfile.goals.primary_goal,
       conditions: conditions,
       dietary_restrictions: restrictions,
       user_profile: userProfile,
       targets: mealTargets[meal_slot],
       max_items: 1,
       exclude_titles: excludeTitles,
       personal_note: personalNote,
       snack_timing: meal_slot === 'snack' ? snackTiming : undefined
    };

    const result = await getMealSuggestions(input);
    if (!result.suggested_meals || result.suggested_meals.length === 0) {
        throw new Error("Dữ liệu trả về rỗng.");
    }
    return result.suggested_meals[0];
  }

  async function rerollThisCard(meal_slot: MealSlot, itemIndex: number) {
    if (!suggestion || !runId) return;
    setLoadingAction(itemIndex);
    setError(null);

    const excludeTitles = suggestion.suggested_meals.map(m => m.recipe_name).filter(Boolean);

    try {
        const newItem = await generateOneItemForMeal(meal_slot, excludeTitles);
        const updatedMeals = suggestion.suggested_meals.map((it, idx) => (idx === itemIndex ? newItem : it));
        const newSuggestion = { ...suggestion, suggested_meals: updatedMeals };
        setSuggestion(newSuggestion);
        await persistResults(updatedMeals, suggestion.phase, meal_slot);
    } catch (err: any) {
        setError(err.message || "Đổi món thất bại.");
        console.error(err);
    } finally {
        setLoadingAction(null);
    }
  }

  async function addOneMoreItem(meal_slot: MealSlot) {
    if (!suggestion || !runId) return;
    if (suggestion.suggested_meals.length >= 3) {
        alert("Bữa này đã đủ 3 món. Hãy dùng 'Đổi món này' để thay.");
        return;
    }
    setLoadingAction('add');
    setError(null);

    const excludeTitles = suggestion.suggested_meals.map(m => m.recipe_name).filter(Boolean);

    try {
        const newItem = await generateOneItemForMeal(meal_slot, excludeTitles);
        const updatedMeals = [...suggestion.suggested_meals, newItem];
        const newSuggestion = { ...suggestion, suggested_meals: updatedMeals };
        setSuggestion(newSuggestion);
        await persistResults(updatedMeals, suggestion.phase, meal_slot);
    } catch (err: any) {
        setError(err.message || "Thêm món thất bại.");
        console.error(err);
    } finally {
        setLoadingAction(null);
    }
  }

  const handleSuggest = async () => {
     if (!mealTargets || !runId) return;
     setLoading(true);
     setError(null);
     setSuggestion(null);
     
     const conditions = Object.keys(userProfile.health_conditions.flags).filter(k => userProfile.health_conditions.flags[k]);
     const restrictions = Object.keys(userProfile.dietary_preferences.restrictions).filter(k => userProfile.dietary_preferences.restrictions[k]);

     const input: UserInput = {
        day_number: day,
        meal_type: mealType,
        user_goal: userProfile.goals.primary_goal,
        conditions: conditions,
        dietary_restrictions: restrictions,
        user_profile: userProfile,
        targets: mealTargets[mealType],
        personal_note: personalNote,
        snack_timing: mealType === 'snack' ? snackTiming : undefined
     };

     try {
         const result = await getMealSuggestions(input);
         setSuggestion(result);
         persistResults(result.suggested_meals, result.phase, mealType);
     } catch (err) {
         setError("Không thể tạo thực đơn. Vui lòng thử lại.");
         console.error(err);
     } finally {
         setLoading(false);
     }
  };

  const MacroCard = ({ label, value, unit, icon: Icon, borderClass, textClass }: any) => (
      <div className={`flex flex-col items-center p-4 rounded-2xl border bg-white flex-1 min-w-[95px] shadow-sm ${borderClass}`}>
          <div className={`mb-2 p-2 rounded-xl bg-opacity-10 ${textClass.replace('text-', 'bg-')}`}>
            <Icon size={20} className={textClass} />
          </div>
          <div className="text-2xl font-black text-slate-900 leading-none mb-1">{value}</div>
          <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-center">{label} ({unit})</div>
      </div>
  );

  if (!dailyTargets) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
       <header className="bg-gradient-to-r from-emerald-600 to-indigo-700 sticky top-0 z-50 shadow-lg shadow-emerald-900/10">
           <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
               <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                   <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl text-white shadow-inner border border-white/30"><GutIcon size={24}/></div>
                   <div>
                       <span className="font-black text-white text-lg tracking-tight block leading-none">GutHealth21</span>
                       <span className="text-white/90 text-[10px] font-black uppercase tracking-widest">Hệ thống dinh dưỡng</span>
                   </div>
               </div>
               <div className="flex items-center gap-3">
                   <div className="hidden sm:block text-[10px] font-black uppercase tracking-widest bg-slate-900/40 backdrop-blur-md px-4 py-2 rounded-full text-white border border-white/10 shadow-sm">
                       {userProfile.demographics.sex === 'male' ? 'Nam' : 'Nữ'} • {userProfile.demographics.age_years}T • {userProfile.anthropometrics.weight_kg}KG
                   </div>
                   <button 
                        onClick={() => navigate('/onboarding')}
                        className="p-2.5 bg-white text-indigo-700 rounded-xl hover:bg-slate-100 transition-all shadow-md active:scale-95"
                   >
                       <LogOut size={20} />
                   </button>
               </div>
           </div>
       </header>

       <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8 mt-4">
           {/* Nutrition Section */}
           <section className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-200">
               <h2 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                   <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                   Chỉ tiêu dinh dưỡng / ngày
               </h2>
               <div className="flex flex-wrap gap-4">
                   <div className="w-full sm:w-auto sm:flex-1 flex gap-4 min-w-[200px]">
                       <div className="flex-1 bg-slate-900 text-white p-6 rounded-[2rem] flex items-center justify-between shadow-xl shadow-slate-200">
                           <div>
                               <div className="text-4xl font-black tracking-tighter leading-none">{dailyTargets.kcal}</div>
                               <div className="text-[10px] font-black opacity-70 uppercase tracking-widest mt-2">Calo mục tiêu (kcal)</div>
                           </div>
                           <div className="p-3 bg-white/10 rounded-2xl">
                               <Flame size={32} className="text-amber-400" />
                           </div>
                       </div>
                   </div>
                   <MacroCard label="Đạm" value={dailyTargets.protein_g} unit="g" icon={Database} borderClass="border-indigo-200/50" textClass="text-indigo-600" />
                   <MacroCard label="Carb" value={dailyTargets.carb_g} unit="g" icon={Droplet} borderClass="border-amber-200/50" textClass="text-amber-600" />
                   <MacroCard label="Béo" value={dailyTargets.fat_g} unit="g" icon={Droplet} borderClass="border-rose-200/50" textClass="text-rose-600" />
                   <MacroCard label="Xơ" value={dailyTargets.fiber_g} unit="g" icon={Leaf} borderClass="border-emerald-200/50" textClass="text-emerald-600" />
               </div>
           </section>

           {/* Date & Phase Section with Enhanced Navigation */}
           <section className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-200 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-8">
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] flex items-center gap-2 self-start">
                    <Calendar size={14} className="text-slate-500" /> Lịch trình phục hồi
                  </label>
                  
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={handlePrevDay}
                      disabled={day <= 1}
                      className="p-3 bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-full border border-slate-200 transition-all active:scale-90 disabled:opacity-20"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    
                    <div className="text-center">
                      <span className="text-5xl font-black text-slate-900 leading-none tracking-tighter">Ngày {day}</span>
                    </div>
                    
                    <button 
                      onClick={handleNextDay}
                      disabled={day >= 31}
                      className="p-3 bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-full border border-slate-200 transition-all active:scale-90 disabled:opacity-20"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </div>
                </div>
                
                <div className="relative h-4 bg-slate-100 rounded-full mb-8 border border-slate-200">
                     <input
                        type="range"
                        min="1"
                        max="31"
                        value={day}
                        onChange={(e) => {
                            setDay(parseInt(e.target.value));
                            setSuggestion(null);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-full pointer-events-none transition-all duration-200 shadow-sm"
                        style={{ width: `${(day/31)*100}%` }}
                    ></div>
                </div>
                <PhaseIndicator day={day} />
           </section>

           <section>
               <div className="flex items-center gap-4 mb-8">
                  <button 
                    onClick={handlePrevMeal}
                    className="p-3 bg-white text-slate-600 hover:text-slate-900 rounded-2xl border border-slate-200 shadow-sm transition-all active:scale-95"
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <div className="flex-1 flex p-1.5 bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-x-auto no-scrollbar">
                      {(Object.keys(MEAL_LABELS) as MealType[]).map((m) => (
                          <button
                              key={m}
                              onClick={() => {
                                  setMealType(m);
                                  setSuggestion(null);
                              }}
                              className={`flex-1 py-4 px-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 whitespace-nowrap ${
                                  mealType === m 
                                  ? 'bg-slate-900 text-white shadow-lg' 
                                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                              }`}
                          >
                              {MEAL_LABELS[m]}
                          </button>
                      ))}
                  </div>

                  <button 
                    onClick={handleNextMeal}
                    className="p-3 bg-white text-slate-600 hover:text-slate-900 rounded-2xl border border-slate-200 shadow-sm transition-all active:scale-95"
                  >
                    <ChevronRight size={20} />
                  </button>
               </div>

               {mealTargets && (
                   <div className="mb-8 p-6 bg-slate-100 border border-slate-200 rounded-[2rem] flex flex-col sm:flex-row gap-6 items-center justify-between">
                       <div className="font-black uppercase tracking-[0.2em] text-xs text-slate-700 flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                              <Utensils size={16}/>
                            </div>
                            Mục tiêu {MEAL_LABELS[mealType]}
                       </div>
                       <div className="flex gap-6 sm:gap-10">
                            <div className="text-center">
                                <div className="text-xl font-black text-slate-900 leading-none">{mealTargets[mealType].kcal}</div>
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Kcal</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-black text-slate-900 leading-none">{mealTargets[mealType].protein_g}g</div>
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Đạm</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-black text-slate-900 leading-none">{mealTargets[mealType].carb_g}g</div>
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Carb</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-black text-slate-900 leading-none">{mealTargets[mealType].fiber_g}g</div>
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Xơ</div>
                            </div>
                       </div>
                   </div>
               )}

               {/* Snack Timing Selection */}
               {mealType === 'snack' && (
                   <div className="bg-white rounded-2xl p-5 border border-slate-200 mb-6 shadow-sm animate-in fade-in slide-in-from-top-2">
                       <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                           <Clock size={12} className="text-indigo-600" />
                           Thời điểm ăn bữa phụ
                       </label>
                       <div className="flex gap-3">
                           {[
                               { id: 'before_meal', label: 'Trước bữa chính' },
                               { id: 'after_meal', label: 'Sau bữa chính' }
                           ].map((t) => (
                               <button
                                   key={t.id}
                                   onClick={() => {
                                       setSnackTiming(t.id as SnackTiming);
                                       setSuggestion(null);
                                   }}
                                   className={`flex-1 py-3 rounded-xl border-2 font-black text-xs transition-all ${
                                       snackTiming === t.id 
                                       ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                       : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                                   }`}
                               >
                                   {t.label}
                               </button>
                           ))}
                       </div>
                       <p className="mt-3 text-[10px] text-slate-500 font-bold italic">
                           * Thời điểm ăn ảnh hưởng đến quá trình hấp thu và phục hồi niêm mạc ruột.
                       </p>
                   </div>
               )}

               {/* Customization Input */}
               <div className="bg-white rounded-2xl p-5 border border-slate-200 mb-6 shadow-sm">
                   <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Edit3 size={12} className="text-indigo-600" />
                       Yêu cầu cụ thể của bạn
                   </label>
                   <textarea
                       value={personalNote}
                       onChange={(e) => setPersonalNote(e.target.value)}
                       placeholder="Ví dụ: tôi cần các món mềm dễ tiêu, không dùng ớt, ưu tiên các món hấp luộc..."
                       className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-300 transition-all min-h-[100px] resize-none shadow-inner placeholder:text-slate-400"
                   />
               </div>

               <div className="flex gap-3 mb-8">
                   <button
                       onClick={() => addOneMoreItem(mealType)}
                       disabled={loading || !suggestion || suggestion.suggested_meals.length >= 3}
                       className="flex-1 px-4 py-4 bg-white hover:bg-slate-50 text-slate-800 font-black uppercase tracking-widest text-[11px] rounded-2xl border-2 border-slate-200 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 active:scale-95"
                   >
                       {loadingAction === 'add' ? <Loader2 size={16} className="animate-spin text-indigo-600"/> : <PlusCircle size={16} className="text-indigo-600" />}
                       {loadingAction === 'add' ? "Đang xử lý..." : "Thêm món ăn"}
                   </button>

                   <button
                       onClick={handleSuggest}
                       disabled={loading}
                       className="flex-1 px-4 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl border-2 border-transparent transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-50 active:scale-95"
                   >
                       {loading && !loadingAction ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16} />}
                       {loading && !loadingAction ? "Đang tính toán..." : (suggestion ? "Đổi thực đơn mới" : "Tạo thực đơn")}
                   </button>
               </div>

               {!suggestion && !loading && (
                   <div className="text-center py-20 border-2 border-dashed border-slate-300 rounded-[3rem] bg-white shadow-inner">
                       <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-indigo-600 shadow-sm">
                            <GutIcon size={40} />
                       </div>
                       <h3 className="text-lg font-black text-slate-900 mb-2">Thực đơn đang chờ bạn</h3>
                       <p className="text-slate-500 font-bold mb-10 max-w-xs mx-auto">Hệ thống sẽ dựa trên hồ sơ của bạn để thiết kế các món ăn tối ưu nhất.</p>
                       <button 
                           onClick={handleSuggest}
                           className="px-12 py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-slate-300 flex items-center gap-3 mx-auto transition-all active:scale-95"
                       >
                           Tạo gợi ý ngay
                       </button>
                   </div>
               )}

               {loading && !loadingAction && (
                   <div className="py-28 text-center space-y-8 bg-white rounded-[3rem] border border-slate-200 shadow-xl">
                       <div className="relative inline-block">
                          <Loader2 size={64} className="mx-auto text-indigo-600 animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <GutIcon size={24} className="text-indigo-600 animate-pulse" />
                          </div>
                       </div>
                       <div className="space-y-2">
                        <p className="text-slate-900 font-black uppercase tracking-[0.2em] text-sm animate-pulse">Đang cá nhân hóa thực đơn...</p>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Dựa trên mục tiêu phục hồi đường ruột</p>
                       </div>
                   </div>
               )}

               {error && (
                   <div className="bg-rose-50 text-rose-700 p-8 rounded-[2rem] border-2 border-rose-200 mb-6 text-center font-black flex flex-col items-center gap-4 animate-in shake duration-500">
                       <div className="p-3 bg-white rounded-full text-rose-600 shadow-sm border border-rose-100">
                          <AlertCircle size={32} />
                       </div>
                       <div>
                        <p className="text-lg">{error}</p>
                        <button onClick={handleSuggest} className="mt-3 text-xs font-black uppercase tracking-widest underline decoration-2 underline-offset-4 hover:text-rose-900 transition-colors">Yêu cầu lại</button>
                       </div>
                   </div>
               )}

               {suggestion && (
                   <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                       <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 p-8 sm:p-10 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden border border-indigo-500/30">
                           <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12">
                            <GutIcon size={240} />
                           </div>
                           <div className="relative z-10">
                              <h3 className="text-indigo-200 font-black uppercase tracking-[0.25em] text-[11px] mb-4 flex items-center gap-3">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                                  Lời khuyên Pha {suggestion.phase}
                              </h3>
                              <p className="text-xl sm:text-2xl font-black leading-tight mb-4">{suggestion.explanation_for_phase}</p>
                              <div className="h-1 w-20 bg-emerald-400 rounded-full"></div>
                           </div>
                       </div>

                       <div className="grid gap-8">
                           {suggestion.suggested_meals.map((meal, idx) => (
                               <RecipeCard 
                                   key={idx} 
                                   meal={meal} 
                                   index={idx} 
                                   loading={loadingAction === idx}
                                   onReplace={() => rerollThisCard(mealType, idx)}
                                   onUpdate={(updatedMeal) => handleMealUpdate(updatedMeal, idx)}
                               />
                           ))}
                       </div>
                       
                       {/* Footer Navigation Buttons */}
                       <div className="flex justify-between items-center py-12 px-2">
                          <button 
                            onClick={handlePrevMeal}
                            className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-all active:scale-95 group"
                          >
                            <div className="p-2 bg-white border border-slate-200 rounded-lg group-hover:border-indigo-200 group-hover:bg-indigo-50">
                              <ChevronLeft size={16} />
                            </div>
                            <span>Bữa trước</span>
                          </button>
                          
                          <div className="h-1.5 w-16 bg-slate-200 rounded-full hidden sm:block"></div>
                          
                          <button 
                            onClick={handleNextMeal}
                            className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-all active:scale-95 group"
                          >
                            <span>Bữa sau</span>
                            <div className="p-2 bg-white border border-slate-200 rounded-lg group-hover:border-indigo-200 group-hover:bg-indigo-50">
                              <ChevronRight size={16} />
                            </div>
                          </button>
                       </div>
                   </div>
               )}
           </section>
       </main>
    </div>
  );
};

export default DashboardScreen;
