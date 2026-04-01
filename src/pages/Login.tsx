import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err: any) {
      console.error('Login error details:', err);
      if (err.code === 'auth/popup-blocked') {
        setError('Popup bloklandi. Iltimos, brauzeringizda popuplarga ruxsat bering.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Ushbu domen Firebase-da ruxsat etilmagan. Iltimos, AIS preview URL-ni authorized domains ro\'yxatiga qo\'shing.');
      } else {
        setError(`Google orqali kirishda xatolik yuz berdi: ${err.message || 'Noma\'lum xato'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1 mb-4">
            <div className="w-8 h-6 bg-red-600 rounded-lg flex items-center justify-center">
              <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[7px] border-l-white border-b-[4px] border-b-transparent ml-0.5"></div>
            </div>
            <span className="font-bold text-2xl tracking-tighter text-zinc-900 dark:text-white">UzTube</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Kirish</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">UzTube hisobingizga kiring</p>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="space-y-2">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/30">
                {error}
              </div>
              <p className="text-xs text-zinc-500 text-center">
                Agar xatolik davom etsa, iltimos, saytni yangi tabda ochib ko'ring (popuplar bloklangan bo'lishi mumkin).
              </p>
            </div>
          )}
          
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 px-4 flex items-center justify-center gap-3 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            {loading ? 'Kirilmoqda...' : 'Google orqali kirish'}
          </button>
        </div>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400 mt-8">
          Tizimga kirish orqali siz bizning xizmat ko'rsatish shartlarimizga rozilik bildirasiz.
        </p>
      </div>
    </div>
  );
};

export default Login;
