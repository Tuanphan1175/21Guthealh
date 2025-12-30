import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import GutIcon from '../components/GutIcon';
import { registerUser } from '../src/utils/userRegistration'; // Import the new utility function

const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartNow = async () => {
    setError(null);
    if (!name.trim() || !phoneNumber.trim()) {
      setError('Vui lòng nhập đầy đủ Tên và Số điện thoại.');
      return;
    }

    setIsLoading(true);
    try {
      await registerUser(name, phoneNumber);
      navigate('/onboarding'); // Navigate to onboarding after successful registration
    } catch (err) {
      setError('Đã xảy ra lỗi khi đăng ký. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-pink-50 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-200/30 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-200/30 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-emerald-600 mb-8 shadow-2xl shadow-emerald-100 ring-4 ring-white">
           <div className="bg-gradient-to-br from-emerald-500 to-teal-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-inner">
             <GutIcon size={36} />
           </div>
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4 tracking-tight leading-tight">
          21 Ngày <br/> 
          <span className="whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-pink-600">
            Phục Hồi Đường Ruột
          </span>
        </h1>
        
        <p className="text-lg sm:text-xl text-slate-700 font-bold mb-10 leading-relaxed max-w-[280px] sm:max-w-none">
          Trợ lý cá nhân hóa thực đơn dinh dưỡng, giúp cải thiện tiêu hóa & cân bằng hệ vi sinh.
        </p>

        {/* Registration Form */}
        <div className="w-full space-y-4 mb-6">
          <input
            type="text"
            placeholder="Tên của bạn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-lg focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all text-slate-900 shadow-sm"
          />
          <input
            type="tel" // Use type="tel" for phone numbers
            placeholder="Số điện thoại"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-lg focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all text-slate-900 shadow-sm"
          />
          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
        </div>

        <div className="space-y-4 w-full">
          <button 
            onClick={handleStartNow}
            className="w-full py-5 bg-gradient-to-r from-emerald-600 to-pink-600 hover:from-emerald-500 hover:to-pink-500 text-white rounded-2xl font-black text-xl shadow-xl shadow-emerald-200 hover:shadow-pink-200 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3"
            disabled={isLoading}
          >
            {isLoading ? 'Đang xử lý...' : (
              <>
                <span>Bắt đầu ngay</span>
                <ArrowRight size={24} />
              </>
            )}
          </button>
          
          <button 
             className="w-full py-5 bg-white hover:bg-slate-50 text-slate-800 font-black rounded-2xl border-2 border-slate-200 hover:border-slate-300 transition-all text-lg shadow-sm"
             onClick={() => alert("Tính năng đăng nhập đang phát triển.")}
             disabled={isLoading}
          >
            Tôi đã có hồ sơ
          </button>
        </div>

        <div className="mt-12 flex items-center gap-2 text-sm font-black text-slate-500">
           <Sparkles size={16} className="text-pink-500" />
           <span className="uppercase tracking-widest text-[10px]">Powered by Gemini</span>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;