import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Menu, Video, Bell, User, LogOut, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { AppNotification } from '../types';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { uz } from 'date-fns/locale';

interface NavbarProps {
  onMenuClick: () => void;
  isDarkMode: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick, isDarkMode }) => {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const wsRef = useRef<WebSocket | null>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      connectWebSocket();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
      }
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
      setUnreadCount(res.data.filter((n: AppNotification) => !n.isRead).length);
    } catch (err) {
      console.error('Bildirishnomalarni yuklashda xato:', err);
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('token');
    if (!token) return;

    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${token}`);
    
    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Browser notification (optional)
      if (Notification.permission === 'granted') {
        new window.Notification('UzTube', {
          body: notification.message,
          icon: '/favicon.ico'
        });
      }
    };

    ws.onclose = () => {
      // Reconnect after 5 seconds
      setTimeout(connectWebSocket, 5000);
    };

    wsRef.current = ws;
  };

  const markAsRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = (notification: AppNotification) => {
    markAsRead(notification.id);
    setShowNotifications(false);
    if (notification.videoId) {
      navigate(`/video/${notification.videoId}`);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return formatDistanceToNow(date, { addSuffix: true, locale: uz });
    } catch (e) {
      return '';
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Save to search history
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      const newHistory = [searchQuery.trim(), ...history.filter((s: string) => s !== searchQuery.trim())].slice(0, 10);
      localStorage.setItem('searchHistory', JSON.stringify(newHistory));
      
      navigate(`/?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 h-14 border-b z-50 flex items-center justify-between px-4 transition-colors duration-300 ${isDarkMode ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'}`}>
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
        >
          <Menu size={20} />
        </button>
        <Link to="/" className="flex items-center gap-1">
          <div className="w-8 h-6 bg-red-600 rounded-lg flex items-center justify-center">
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[7px] border-l-white border-b-[4px] border-b-transparent ml-0.5"></div>
          </div>
          <span className={`font-bold text-xl tracking-tighter ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>UzTube</span>
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-4 hidden sm:flex">
        <div className="flex w-full">
          <input
            type="text"
            placeholder="Qidirish"
            className={`w-full px-4 py-2 border rounded-l-full focus:outline-none focus:border-blue-500 transition-colors ${
              isDarkMode ? 'bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500' : 'bg-white border-zinc-300 text-zinc-900'
            }`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className={`px-6 py-2 border border-l-0 rounded-r-full transition-colors ${
            isDarkMode ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-400' : 'bg-zinc-50 border-zinc-300 hover:bg-zinc-100 text-zinc-600'
          }`}>
            <Search size={18} />
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2">
        {user ? (
          <>
            <Link to="/upload" className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`} title="Video yuklash">
              <Video size={20} />
            </Link>
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-full relative ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className={`absolute right-0 mt-2 w-80 sm:w-96 border rounded-xl shadow-xl z-[100] overflow-hidden ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                  <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-zinc-800' : 'border-zinc-100'}`}>
                    <h3 className="font-bold">Bildirishnomalar</h3>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                      >
                        <Check size={14} /> Hammasini o'qilgan deb belgilash
                      </button>
                    )}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div 
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`p-4 border-b cursor-pointer transition-colors flex gap-3 ${
                            isDarkMode ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-100 hover:bg-zinc-50'
                          } ${!notification.isRead ? (isDarkMode ? 'bg-blue-900/10' : 'bg-blue-50/50') : ''}`}
                        >
                          <div className="flex-1">
                            <p className={`text-sm leading-snug ${!notification.isRead ? 'font-semibold' : ''}`}>
                              {notification.message}
                            </p>
                            <span className={`text-[11px] mt-1 block ${isDarkMode ? 'text-zinc-500' : 'text-zinc-500'}`}>
                              {formatTime(notification.created_at)}
                            </span>
                          </div>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 shrink-0"></div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-zinc-500">
                        <Bell size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Bildirishnomalar yo'q</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="relative group">
              <Link to={`/profile/${user.id}`} className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={18} className={isDarkMode ? 'text-zinc-400' : 'text-zinc-600'} />
                )}
              </Link>
              <div className={`absolute right-0 mt-2 w-48 border rounded-lg shadow-lg hidden group-hover:block z-[100] ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                <div className={`p-3 border-b ${isDarkMode ? 'border-zinc-800' : 'border-zinc-100'}`}>
                  <p className="font-medium text-sm truncate">{user.name}</p>
                  <p className={`text-xs truncate ${isDarkMode ? 'text-zinc-500' : 'text-zinc-500'}`}>{user.email}</p>
                </div>
                <Link to={`/profile/${user.id}`} className={`block px-4 py-2 text-sm ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50'}`}>Kanalim</Link>
                <button 
                  onClick={logout}
                  className={`w-full text-left px-4 py-2 text-sm text-red-600 flex items-center gap-2 ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50'}`}
                >
                  <LogOut size={16} /> Chiqish
                </button>
              </div>
            </div>
          </>
        ) : (
          <Link 
            to="/login" 
            className={`flex items-center gap-2 px-3 py-1.5 text-blue-600 border rounded-full font-medium text-sm transition-colors ${
              isDarkMode ? 'border-zinc-800 hover:bg-blue-900/20' : 'border-zinc-200 hover:bg-blue-50'
            }`}
          >
            <User size={18} /> Kirish
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
