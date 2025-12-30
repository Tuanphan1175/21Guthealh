import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, ActivityLevel, Sex } from '../types';
import { ChevronRight, ChevronLeft, Ruler, Weight, User, Activity, Target, AlertTriangle, Utensils, Check, Plus, X, Edit2, Sparkles, Ban } from 'lucide-react';
import { COMMON_CONDITIONS, COMMON_GOALS, COMMON_RESTRICTIONS, GOAL_DESCRIPTIONS } from '../constants';
import { ensureUsersTableAndSaveProfile } from '../utils/supabaseUtils';

interface WizardProps {
  onComplete: (profile: UserProfile) => void;
}

// Initial Empty State
const INITIAL_PROFILE: UserProfile = {
  demographics: { sex: 'female', age_years: 30 },
  anthropometrics: { height_cm: 160, weight_kg: 55 },
  activity: { level: 'moderate' },
  goals: { primary_goal: COMMON_GOALS[0] },
  health_conditions: { flags: {} },
  dietary_preferences: { restrictions: {}, avoid_ingredients: [], preferred_ingredients: [] },
  personal_note: ""
};

const OnboardingWizard: React.FC<WizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [customCondition, setCustomCondition] = useState("");
  const [customRestriction, setCustomRestriction] = useState("");
  const [avoidIngredientInput, setAvoidIngredientInput] = useState("");
  
  // Robust state management for custom goal
  const [isCustomGoal, setIsCustomGoal] = useState(() => {
    const currentGoal = profile.goals.primary_goal;
    return currentGoal === "Khác..." || !COMMON_GOALS.filter(g => g !== "Khác...").includes(currentGoal);
  });
  
  const [customGoalText, setCustomGoalText] = useState(() => {
    const currentGoal = profile.goals.primary_goal;
    const isCommon = COMMON_GOALS.filter(g => g !== "Khác...").includes(currentGoal);
    return isCommon ? "" : (currentGoal === "Khác..." ? "" : currentGoal);
  });

  const navigate = useNavigate();

  const handleNext = async () => {
    // Sync custom goal before proceeding
    const finalProfile = { ...profile };
    if (isCustomGoal && customGoalText.trim()) {
        finalProfile.goals.primary_goal = customGoalText.trim();
    } else if (isCustomGoal && !customGoalText.trim()) {
        finalProfile.goals.primary_goal = "Khác...";
    }
    
    setProfile(finalProfile);

    if (step < 4) {
      setStep(step + 1);
    } else {
      // Call the Supabase utility function here
      try {
        await ensureUsersTableAndSaveProfile(finalProfile);
        onComplete(finalProfile);
      } catch (error) {
        console.error("Không thể lưu hồ sơ người dùng:", error);
        // Optionally, show a toast notification to the user about the error
      }
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else navigate('/');
  };

  const updateProfile = (section: keyof UserProfile, data: any) => {
    setProfile(prev => ({ ...prev, [section]: { ...prev[section], ...data } }));
  };

  const addCustomCondition = () => {
    if (!customCondition.trim()) return;
    const newFlags = { ...profile.health_conditions.flags, [customCondition.trim()]: true };
    updateProfile('health_conditions', { flags: newFlags });
    setCustomCondition("");
  };

  const addCustomRestriction = () => {
    if (!customRestriction.trim()) return;
    const newRests = { ...profile.dietary_preferences.restrictions, [customRestriction.trim()]: true };
    updateProfile('dietary_preferences', { restrictions: newRests });
    setCustomRestriction("");
  };

  const addAvoidIngredient = () => {
    if (!avoidIngredientInput.trim()) return;
    const ingredient = avoidIngredientInput.trim();
    if (profile.dietary_preferences.avoid_ingredients.includes(ingredient)) {
        setAvoidIngredientInput("");
        return;
    }
    const newList = [...profile.dietary_preferences.avoid_ingredients, ingredient];
    updateProfile('dietary_preferences', { avoid_ingredients: newList });
    setAvoidIngredientInput("");
  };

  const removeAvoidIngredient = (ingredient: string) => {
    const newList = profile.dietary_preferences.avoid_ingredients.filter(i => i !== ingredient);
    updateProfile('dietary_preferences', { avoid_ingredients: newList });
  };

  const renderStep = () => {
    switch (step) {
      case 1: // Profile Input
        return (
           <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                 <div className="p-3 bg-blue-100 rounded-2xl text-blue-600 shadow-sm"><User size={28}/></div>
                 Thông tin cơ bản
              </h2>
              <div className="grid grid-cols-2 gap-5">
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Giới tính</label>
                    <div className="flex gap-3">
                       {['male', 'female'].map((s) => (
                          <button 
                             key={s}
                             onClick={() => updateProfile('demographics', { sex: s as Sex })}
                             className={`flex-1 py-4 rounded-2xl border-2 font-bold capitalize transition-all text-lg
                                ${profile.demographics.sex === s 
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'}`}
                          >
                             {s === 'male' ? 'Nam' : 'Nữ'}
                          </button>
                       ))}
                    </div>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tuổi</label>
                    <input 
                      type="number" 
                      value={profile.demographics.age_years}
                      onChange={(e) => updateProfile('demographics', { age_years: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-center text-slate-900 shadow-sm"
                    />
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Ruler size={14}/> Chiều cao (cm)</label>
                    <input 
                      type="number" 
                      value={profile.anthropometrics.height_cm}
                      onChange={(e) => updateProfile('anthropometrics', { height_cm: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-center text-slate-900 shadow-sm"
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Weight size={14}/> Cân nặng (kg)</label>
                    <input 
                      type="number" 
                      value={profile.anthropometrics.weight_kg}
                      onChange={(e) => updateProfile('anthropometrics', { weight_kg: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-center text-slate-900 shadow-sm"
                    />
                 </div>
              </div>
           </div>
        );
      case 2: // Activity
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                 <div className="p-3 bg-amber-100 rounded-2xl text-amber-600 shadow-sm"><Activity size={28}/></div>
                 Mức độ vận động
              </h2>
              <div className="space-y-4">
                 {[
                   { id: 'sedentary', label: 'Ít vận động', desc: 'Làm việc văn phòng, ít tập thể dục' },
                   { id: 'light', label: 'Nhẹ nhàng', desc: 'Tập 1-3 ngày/tuần' },
                   { id: 'moderate', label: 'Trung bình', desc: 'Tập 3-5 ngày/tuần' },
                   { id: 'active', label: 'Năng động', desc: 'Tập 6-7 ngày/tuần' },
                   { id: 'very_active', label: 'Rất năng động', desc: 'Vận động viên hoặc lao động nặng' }
                 ].map((opt) => (
                    <button
                       key={opt.id}
                       onClick={() => updateProfile('activity', { level: opt.id as ActivityLevel })}
                       className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
                           profile.activity.level === opt.id 
                           ? 'bg-amber-50 border-amber-500 shadow-lg shadow-amber-100' 
                           : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50'
                       }`}
                    >
                       <div className={`text-lg font-bold ${profile.activity.level === opt.id ? 'text-amber-700' : 'text-slate-800'}`}>{opt.label}</div>
                       <div className="text-sm font-medium text-slate-500 mt-1">{opt.desc}</div>
                    </button>
                 ))}
              </div>
            </div>
        );
      case 3: // Goals & Conditions
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                 <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600 shadow-sm"><Target size={28}/></div>
                 Mục tiêu & Sức khỏe
              </h2>
              
              <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
                  <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Mục tiêu chính (Chọn 1)</label>
                      <select 
                         value={isCustomGoal ? "Khác..." : profile.goals.primary_goal}
                         onChange={(e) => {
                             const val = e.target.value;
                             if (val === "Khác...") {
                                 setIsCustomGoal(true);
                             } else {
                                 setIsCustomGoal(false);
                                 updateProfile('goals', { primary_goal: val });
                             }
                         }}
                         className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-lg text-slate-800 outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all cursor-pointer shadow-sm"
                      >
                         {COMMON_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                  </div>

                  {isCustomGoal && (
                      <div className="animate-in slide-in-from-top-2 duration-300 space-y-3">
                         <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                             <Sparkles size={12} /> Tùy chỉnh mục tiêu của bạn
                         </label>
                         <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500">
                                <Edit2 size={18} />
                            </div>
                            <input 
                               type="text"
                               placeholder="Ví dụ: Giảm triệu chứng viêm đại tràng..."
                               value={customGoalText}
                               onChange={(e) => setCustomGoalText(e.target.value)}
                               autoFocus
                               className="w-full p-4 pl-12 bg-white border-2 border-emerald-200 rounded-2xl font-bold text-lg text-emerald-900 outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all shadow-sm"
                            />
                         </div>
                      </div>
                  )}

                  <div className="bg-white/80 p-4 rounded-xl border border-slate-200 flex gap-3 shadow-sm">
                      <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0 h-fit"><Target size={16}/></div>
                      <p className="text-sm font-medium text-slate-600 leading-relaxed">
                          {isCustomGoal ? "Hệ thống sẽ dựa vào mục tiêu tùy chỉnh này để thiết kế thực đơn phù hợp nhất với nhu cầu phục hồi của bạn." : GOAL_DESCRIPTIONS[profile.goals.primary_goal]}
                      </p>
                  </div>
              </div>

              <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tình trạng sức khỏe (Chọn nhiều)</label>
                  <div className="flex flex-wrap gap-3 mb-4">
                      {Object.keys(profile.health_conditions.flags).map(cond => {
                          const isSelected = profile.health_conditions.flags[cond];
                          if (!isSelected) return null;
                          return (
                            <button
                                key={cond}
                                onClick={() => {
                                    const newFlags = { ...profile.health_conditions.flags, [cond]: false };
                                    updateProfile('health_conditions', { flags: newFlags });
                                }}
                                className="px-4 py-2 bg-emerald-100 border-2 border-emerald-500 text-emerald-800 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm hover:scale-95"
                            >
                                {cond} <X size={14} />
                            </button>
                          );
                      })}
                      {COMMON_CONDITIONS.filter(c => !profile.health_conditions.flags[c]).map(cond => (
                          <button
                              key={cond}
                              onClick={() => {
                                  const newFlags = { ...profile.health_conditions.flags, [cond]: true };
                                  updateProfile('health_conditions', { flags: newFlags });
                              }}
                              className="px-4 py-2 bg-white border-2 border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:border-emerald-200 transition-all active:scale-95"
                          >
                              {cond}
                          </button>
                      ))}
                  </div>
                  
                  <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Thêm tình trạng khác..."
                        value={customCondition}
                        onChange={(e) => setCustomCondition(e.target.value)}
                        className="flex-1 p-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-medium outline-none focus:ring-4 focus:ring-emerald-50 transition-all shadow-inner"
                        onKeyDown={(e) => e.key === 'Enter' && addCustomCondition()}
                      />
                      <button 
                        onClick={addCustomCondition}
                        className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 active:scale-95"
                      >
                        <Plus size={20} />
                      </button>
                  </div>
              </div>
            </div>
        );
      case 4: // Restrictions & Avoid Ingredients
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                 <div className="p-3 bg-pink-100 rounded-2xl text-pink-600 shadow-sm"><Utensils size={28}/></div>
                 Hạn chế ăn uống
              </h2>
              
              <div className="grid grid-cols-1 gap-3 mb-6">
                 {COMMON_RESTRICTIONS.map(rest => {
                     const isSelected = profile.dietary_preferences.restrictions[rest];
                     return (
                        <button
                            key={rest}
                            onClick={() => {
                                const newRests = { ...profile.dietary_preferences.restrictions, [rest]: !isSelected };
                                updateProfile('dietary_preferences', { restrictions: newRests });
                            }}
                            className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${
                                isSelected 
                                ? 'bg-pink-50 border-pink-500 shadow-lg shadow-pink-100' 
                                : 'bg-white border-slate-200 hover:border-pink-300'
                            }`}
                        >
                            <span className={`text-lg font-bold ${isSelected ? 'text-pink-700' : 'text-slate-700'}`}>{rest}</span>
                            {isSelected && <div className="bg-pink-500 text-white rounded-full p-1"><Check size={20} /></div>}
                        </button>
                     );
                 })}
                 
                 {Object.keys(profile.dietary_preferences.restrictions).filter(r => !COMMON_RESTRICTIONS.includes(r)).map(rest => {
                     const isSelected = profile.dietary_preferences.restrictions[rest];
                     if (!isSelected) return null;
                     return (
                        <button
                            key={rest}
                            onClick={() => {
                                const newRests = { ...profile.dietary_preferences.restrictions, [rest]: false };
                                updateProfile('dietary_preferences', { restrictions: newRests });
                            }}
                            className="w-full flex items-center justify-between p-5 bg-pink-50 border-2 border-pink-500 rounded-2xl shadow-lg shadow-pink-100"
                        >
                            <span className="text-lg font-bold text-pink-700">{rest}</span>
                            <div className="bg-pink-500 text-white rounded-full p-1"><X size={20} /></div>
                        </button>
                     );
                 })}
              </div>

              {/* Enhanced Ingredients to Avoid Section */}
              <div className="space-y-4 pt-6 border-t-2 border-slate-100">
                  <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Ban size={14} className="text-rose-500" />
                        Nguyên liệu cần tránh
                      </label>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {profile.dietary_preferences.avoid_ingredients.length} món
                      </span>
                  </div>
                  
                  <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Nhập hành, tỏi, tôm, lạc..."
                        value={avoidIngredientInput}
                        onChange={(e) => setAvoidIngredientInput(e.target.value)}
                        className="flex-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-rose-50 focus:border-rose-200 transition-all shadow-inner"
                        onKeyDown={(e) => e.key === 'Enter' && addAvoidIngredient()}
                      />
                      <button 
                        onClick={addAvoidIngredient}
                        className="px-5 bg-rose-500 text-white rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-100 active:scale-95"
                      >
                        <Plus size={24} />
                      </button>
                  </div>

                  {profile.dietary_preferences.avoid_ingredients.length > 0 ? (
                      <div className="flex flex-wrap gap-2 p-2 min-h-[40px]">
                          {profile.dietary_preferences.avoid_ingredients.map((ing) => (
                              <div 
                                key={ing}
                                className="px-4 py-2 bg-white border-2 border-rose-100 text-rose-700 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm animate-in zoom-in-95 duration-200"
                              >
                                {ing}
                                <button 
                                    onClick={() => removeAvoidIngredient(ing)} 
                                    className="p-1 hover:bg-rose-50 rounded-full transition-colors text-rose-300 hover:text-rose-600"
                                >
                                    <X size={14} />
                                </button>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <p className="text-[11px] font-medium text-slate-400 italic text-center py-2">Chưa thêm nguyên liệu cần loại bỏ.</p>
                  )}
              </div>

              <div className="pt-6 border-t-2 border-slate-100">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Lưu ý bổ sung (Tùy chọn)</label>
                  <textarea 
                    value={profile.personal_note}
                    onChange={(e) => updateProfile('personal_note', e.target.value)}
                    placeholder="Ví dụ: tôi không có lò nướng, tôi thích ăn các món nhiều sốt, tôi cần thực đơn nấu nhanh dưới 15 phút..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-slate-100 transition-all min-h-[120px] resize-none shadow-inner"
                  />
              </div>
            </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 flex items-center justify-center font-sans">
        <div className="w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100 flex flex-col">
            {/* Progress Bar with Gradient Top Bar */}
            <div className="h-1.5 bg-slate-100 w-full flex">
                <div 
                    className="h-full bg-gradient-to-r from-emerald-400 via-indigo-500 to-pink-500 transition-all duration-500 ease-out" 
                    style={{ width: `${(step/4)*100}%` }}
                ></div>
            </div>
            
            <div className="p-8 sm:p-10 flex-1 overflow-y-auto max-h-[80vh]">
                {renderStep()}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-between bg-white items-center">
                <button 
                  onClick={handleBack}
                  className="px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] text-slate-400 hover:text-slate-800 transition-all flex items-center gap-2 active:scale-95"
                >
                   <ChevronLeft size={16} /> Quay lại
                </button>
                <button 
                  onClick={handleNext}
                  className="px-10 py-4 bg-gradient-to-r from-emerald-500 to-pink-600 hover:opacity-95 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-200/50 transition-all active:scale-95 flex items-center gap-2"
                >
                   {step === 4 ? 'Hoàn tất' : 'Tiếp tục'} <ChevronRight size={16} />
                </button>
            </div>
        </div>
    </div>
  );
};

export default OnboardingWizard;