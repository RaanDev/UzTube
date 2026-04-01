import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import { Video } from '../types';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { uz } from 'date-fns/locale';
import { motion } from 'motion/react';

const Home: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/videos${query ? `?q=${query}` : ''}`);
        setVideos(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, [query]);

  const formatCount = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' mln';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + ' ming';
    return num.toString();
  };

  const formatTime = (dateStr: string) => {
    try {
      // ISO formatini aniq o'qish uchun parseISO dan foydalanamiz
      const date = parseISO(dateStr);
      if (isNaN(date.getTime())) {
        // Agar parseISO ishlamasa, oddiy Date dan foydalanamiz
        const fallbackDate = new Date(dateStr + ' UTC');
        if (isNaN(fallbackDate.getTime())) return dateStr;
        return formatDistanceToNow(fallbackDate, { addSuffix: true, locale: uz });
      }
      
      return formatDistanceToNow(date, { addSuffix: true, locale: uz });
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-video bg-zinc-200 dark:bg-zinc-800 rounded-xl mb-3"></div>
            <div className="flex gap-3">
              <div className="w-9 h-9 bg-zinc-200 dark:bg-zinc-800 rounded-full shrink-0"></div>
              <div className="flex-1">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full mb-2"></div>
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4">
      {query && (
        <h2 className="text-lg font-medium mb-4">
          "{query}" uchun qidiruv natijalari
        </h2>
      )}
      
      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <p className="text-lg">Videolar topilmadi</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
          {videos.map((video) => (
            <motion.div 
              key={video.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="group"
            >
              <Link to={`/video/${video.id}`} className="block">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-100 mb-3">
                  <img 
                    src={video.thumbnailUrl} 
                    alt={video.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </Link>
              <div className="flex gap-3">
                <Link to={`/profile/${video.userId}`} className="shrink-0">
                  <div className="w-9 h-9 rounded-full bg-zinc-200 overflow-hidden">
                    {video.userAvatar ? (
                      <img src={video.userAvatar} alt={video.userName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold">
                        {video.userName[0]}
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/video/${video.id}`} className="block">
                    <h3 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
                      {video.title}
                    </h3>
                  </Link>
                  <Link to={`/profile/${video.userId}`} className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white block mb-0.5">
                    {video.userName}
                  </Link>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    {formatCount(video.views)} marta ko'rildi • {formatTime(video.created_at)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
