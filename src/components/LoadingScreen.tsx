import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LoadingScreenProps {
  isDarkMode: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isDarkMode }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 1;
      });
    }, 25); // 3000ms / 100 = 30ms, but let's make it a bit faster to feel smoother

    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col ${isDarkMode ? 'bg-zinc-950' : 'bg-white'}`}>
      {/* YouTube Top Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-transparent">
        <motion.div 
          className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Skeleton Navbar */}
      <div className={`h-14 border-b flex items-center px-4 justify-between ${isDarkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-6 h-6 rounded-full ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
          <div className={`w-24 h-6 rounded ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
        </div>
        <div className={`w-1/3 h-8 rounded-full ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
        <div className="flex items-center gap-4">
          <div className={`w-8 h-8 rounded-full ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
          <div className={`w-8 h-8 rounded-full ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Centered UzTube Logo */}
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex items-center gap-1"
          >
            <div className="bg-red-600 px-2 py-1 rounded-lg">
              <span className="text-white font-bold text-4xl tracking-tighter">Uz</span>
            </div>
            <span className={`font-bold text-4xl tracking-tighter ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>Tube</span>
          </motion.div>
        </div>

        {/* Skeleton Sidebar */}
        <div className={`w-60 p-4 border-r hidden md:block ${isDarkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`h-10 mb-2 rounded ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
          ))}
          <div className={`h-[1px] my-4 ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`h-10 mb-2 rounded ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
          ))}
        </div>

        {/* Skeleton Content Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className={`aspect-video rounded-xl animate-pulse ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
                <div className="flex gap-3">
                  <div className={`w-9 h-9 rounded-full shrink-0 animate-pulse ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
                  <div className="flex flex-col gap-2 w-full">
                    <div className={`h-4 w-full rounded animate-pulse ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
                    <div className={`h-3 w-2/3 rounded animate-pulse ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
