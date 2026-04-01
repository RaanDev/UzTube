import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThumbsUp } from 'lucide-react';
import { Video } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { uz } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

const LikedVideos: React.FC = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchLikedVideos = async () => {
      try {
        const { data, error } = await supabase
          .from('video_likes')
          .select('*, videos(*)')
          .eq('userId', user.id);
        
        if (error) throw error;
        
        const likedVideos = data
          .map((item: any) => item.videos)
          .filter((v: any) => v !== null) as Video[];
          
        setVideos(likedVideos);
      } catch (err) {
        console.error('Liked videolarni yuklashda xatolik:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLikedVideos();
  }, [user, navigate]);

  const formatCount = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' mln';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + ' ming';
    return num.toString();
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return formatDistanceToNow(date, { addSuffix: true, locale: uz });
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) return <div className="p-4">Yuklanmoqda...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
          <ThumbsUp size={24} fill="currentColor" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Like qo'yilgan videolar</h1>
          <p className="text-zinc-500 text-sm">{videos.length} ta video</p>
        </div>
      </div>

      {videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <Link key={video.id} to={`/video/${video.id}`} className="group">
              <div className="aspect-video rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 mb-3 relative">
                <img 
                  src={video.thumbnailUrl} 
                  alt={video.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h3 className="font-semibold line-clamp-2 text-sm mb-1 group-hover:text-blue-600 transition-colors">
                {video.title}
              </h3>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                <p>{video.userName}</p>
                <p>{formatCount(video.views)} marta ko'rildi • {formatTime(video.created_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-zinc-500 italic">Hali birorta videoga like bosmagansiz</p>
          <Link to="/" className="text-blue-600 hover:underline mt-4 inline-block">Videolarni ko'rish</Link>
        </div>
      )}
    </div>
  );
};

export default LikedVideos;
