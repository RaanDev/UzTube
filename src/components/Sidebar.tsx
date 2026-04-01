import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Home, 
  PlaySquare, 
  ThumbsUp, 
  Users, 
  Moon, 
  Sun, 
  X,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Channel } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, isDarkMode, toggleTheme }) => {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Channel[]>([]);

  useEffect(() => {
    if (user && isOpen) {
      const fetchSubscriptions = async () => {
        try {
          const res = await api.get('/me/subscriptions');
          setSubscriptions(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
          console.error('Obunalarni yuklashda xatolik:', err);
        }
      };
      fetchSubscriptions();
    }
  }, [user, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[60]"
          />

          {/* Sidebar Content */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed top-0 left-0 bottom-0 w-64 ${isDarkMode ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900'} z-[70] shadow-2xl overflow-y-auto`}
          >
            <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-zinc-800' : 'border-zinc-100'}`}>
              <Link to="/" onClick={onClose} className="flex items-center gap-1">
                <div className="w-8 h-6 bg-red-600 rounded-lg flex items-center justify-center">
                  <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[7px] border-l-white border-b-[4px] border-b-transparent ml-0.5"></div>
                </div>
                <span className="font-bold text-xl tracking-tighter">UzTube</span>
              </Link>
              <button onClick={onClose} className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}>
                <X size={20} />
              </button>
            </div>

            <div className="p-2">
              <Link to="/" onClick={onClose} className={`flex items-center gap-4 p-3 rounded-xl ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}>
                <Home size={20} />
                <span className="text-sm font-medium">Asosiy</span>
              </Link>

              {user && (
                <>
                  <Link to={`/profile/${user.id}`} onClick={onClose} className={`flex items-center gap-4 p-3 rounded-xl ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}>
                    <PlaySquare size={20} />
                    <span className="text-sm font-medium">Sizning videolaringiz</span>
                  </Link>

                  <Link to="/liked-videos" onClick={onClose} className={`flex items-center gap-4 p-3 rounded-xl ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}>
                    <ThumbsUp size={20} />
                    <span className="text-sm font-medium">Like qo'yilganlar</span>
                  </Link>
                </>
              )}

              <button 
                onClick={toggleTheme}
                className={`w-full flex items-center gap-4 p-3 rounded-xl ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                <span className="text-sm font-medium">Mode: {isDarkMode ? 'Light' : 'Dark'}</span>
              </button>

              <div className={`my-2 border-t ${isDarkMode ? 'border-zinc-800' : 'border-zinc-100'}`} />

              <div className="px-3 py-2">
                <h3 className="text-xs font-bold uppercase text-zinc-500 mb-2 flex items-center gap-2">
                  <Users size={14} /> Obunalar
                </h3>
                {user ? (
                  <div className="space-y-1">
                    {subscriptions.length > 0 ? (
                      subscriptions.map(channel => (
                        <Link 
                          key={channel.id} 
                          to={`/profile/${channel.id}`} 
                          onClick={onClose}
                          className={`flex items-center gap-3 p-2 rounded-xl ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
                        >
                          <div className="w-6 h-6 rounded-full bg-zinc-200 overflow-hidden flex items-center justify-center">
                            {channel.avatar ? (
                              <img src={channel.avatar} alt={channel.name} className="w-full h-full object-cover" />
                            ) : (
                              <User size={14} className="text-zinc-500" />
                            )}
                          </div>
                          <span className="text-sm truncate">{channel.name}</span>
                        </Link>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 italic p-2">Hali obunalar yo'q</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 p-2">Obunalarni ko'rish uchun tizimga kiring</p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Sidebar;
