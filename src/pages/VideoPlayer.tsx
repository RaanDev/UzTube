import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ThumbsUp, Share2, MoreHorizontal, Send, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Video, Comment } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { uz } from 'date-fns/locale';
import { motion } from 'motion/react';

const VideoPlayer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const [video, setVideo] = useState<Video | null>(null);
  const [recommendedVideos, setRecommendedVideos] = useState<Video[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState(() => {
    const saved = localStorage.getItem(`comment_draft_${id}`);
    return saved || '';
  });

  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    const fetchVideo = async () => {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('videos')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        if (data) {
          setVideo(data as Video);
          
          // Increment views (non-atomic for simplicity, better to use RPC)
          await supabase
            .from('videos')
            .update({ views: (data.views || 0) + 1 })
            .eq('id', id);
        } else {
          setError('Video topilmadi');
        }
      } catch (err) {
        console.error('Error fetching video:', err);
        setError('Video yuklashda xatolik yuz berdi');
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();

    // Fetch comments
    const fetchComments = async () => {
      const { data, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('videoId', id)
        .order('created_at', { ascending: false });

      if (commentsError) {
        console.error('Error fetching comments:', commentsError);
      } else {
        setComments(data as Comment[]);
      }
    };
    fetchComments();

    // Subscribe to new comments
    const commentsSubscription = supabase
      .channel(`comments-${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'comments',
        filter: `videoId=eq.${id}`
      }, (payload) => {
        setComments(prev => [payload.new as Comment, ...prev]);
      })
      .subscribe();

    // Fetch recommendations
    const fetchRecommendations = async () => {
      try {
        const { data, error: recError } = await supabase
          .from('videos')
          .select('*')
          .neq('id', id)
          .limit(10);

        if (recError) throw recError;
        setRecommendedVideos(data as Video[]);
      } catch (err) {
        console.error('Error fetching recommendations:', err);
      }
    };
    fetchRecommendations();

    return () => {
      supabase.removeChannel(commentsSubscription);
    };
  }, [id]);

  useEffect(() => {
    if (!user || !id || !video) return;

    const checkStatus = async () => {
      // Check reaction
      const { data: likeData } = await supabase
        .from('video_likes')
        .select('*')
        .eq('userId', user.id)
        .eq('videoId', id)
        .single();
      setIsLiked(!!likeData);
      
      const { data: dislikeData } = await supabase
        .from('video_dislikes')
        .select('*')
        .eq('userId', user.id)
        .eq('videoId', id)
        .single();
      setIsDisliked(!!dislikeData);

      // Check subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('followerId', user.id)
        .eq('followingId', video.userId)
        .single();
      setIsSubscribed(!!subData);
    };

    checkStatus();
  }, [id, user, video]);

  const handleSubscribe = async () => {
    if (!user || !video) return setError('Obuna bo\'lish uchun tizimga kiring');
    if (user.id === video.userId) return setError('O\'zingizga obuna bo\'la olmaysiz');
    
    try {
      if (isSubscribed) {
        await supabase
          .from('subscriptions')
          .delete()
          .eq('followerId', user.id)
          .eq('followingId', video.userId);
        setIsSubscribed(false);
      } else {
        await supabase
          .from('subscriptions')
          .insert([{
            followerId: user.id,
            followingId: video.userId,
            created_at: new Date().toISOString()
          }]);
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error(err);
      setError('Amalni bajarishda xatolik yuz berdi');
    }
  };

  const handleLike = async () => {
    if (!user || !id || !video) return setError('Like bosish uchun tizimga kiring');

    try {
      if (isLiked) {
        await supabase
          .from('video_likes')
          .delete()
          .eq('userId', user.id)
          .eq('videoId', id);
        
        await supabase
          .from('videos')
          .update({ likes: Math.max(0, (video.likes || 0) - 1) })
          .eq('id', id);
          
        setIsLiked(false);
      } else {
        if (isDisliked) {
          await supabase
            .from('video_dislikes')
            .delete()
            .eq('userId', user.id)
            .eq('videoId', id);
            
          await supabase
            .from('videos')
            .update({ dislikes: Math.max(0, (video.dislikes || 0) - 1) })
            .eq('id', id);
          setIsDisliked(false);
        }
        
        await supabase
          .from('video_likes')
          .insert([{ userId: user.id, videoId: id }]);
          
        await supabase
          .from('videos')
          .update({ likes: (video.likes || 0) + 1 })
          .eq('id', id);
          
        setIsLiked(true);
      }
      
      // Refresh video data
      const { data: updatedVideo } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .single();
      if (updatedVideo) setVideo(updatedVideo as Video);
    } catch (err) {
      console.error(err);
      setError('Amalni bajarishda xatolik yuz berdi');
    }
  };

  const handleDislike = async () => {
    if (!user || !id || !video) return setError('Dislike bosish uchun tizimga kiring');

    try {
      if (isDisliked) {
        await supabase
          .from('video_dislikes')
          .delete()
          .eq('userId', user.id)
          .eq('videoId', id);
          
        await supabase
          .from('videos')
          .update({ dislikes: Math.max(0, (video.dislikes || 0) - 1) })
          .eq('id', id);
        setIsDisliked(false);
      } else {
        if (isLiked) {
          await supabase
            .from('video_likes')
            .delete()
            .eq('userId', user.id)
            .eq('videoId', id);
            
          await supabase
            .from('videos')
            .update({ likes: Math.max(0, (video.likes || 0) - 1) })
            .eq('id', id);
          setIsLiked(false);
        }
        
        await supabase
          .from('video_dislikes')
          .insert([{ userId: user.id, videoId: id }]);
          
        await supabase
          .from('videos')
          .update({ dislikes: (video.dislikes || 0) + 1 })
          .eq('id', id);
        setIsDisliked(true);
      }
      
      // Refresh video data
      const { data: updatedVideo } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .single();
      if (updatedVideo) setVideo(updatedVideo as Video);
    } catch (err) {
      console.error(err);
      setError('Amalni bajarishda xatolik yuz berdi');
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return setError('Izoh qoldirish uchun tizimga kiring');
    if (!newComment.trim()) return;

    try {
      const { error: commentError } = await supabase
        .from('comments')
        .insert([{
          videoId: id,
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar || '',
          text: newComment,
          created_at: new Date().toISOString()
        }]);

      if (commentError) throw commentError;
      
      setNewComment('');
      localStorage.removeItem(`comment_draft_${id}`);
      
      // Fetch comments again to be sure (though subscription should handle it)
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('videoId', id)
        .order('created_at', { ascending: false });
      if (data) setComments(data as Comment[]);
      
    } catch (err) {
      console.error(err);
      setError('Izoh qoldirishda xatolik yuz berdi');
    }
  };

  const formatCount = (num: number | undefined | null) => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' mln';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + ' ming';
    return num.toString();
  };

  const formatTime = (dateStr: string | undefined | null) => {
    if (!dateStr) return '';
    try {
      // ISO formatini aniq o'qish uchun parseISO dan foydalanamiz
      const date = parseISO(dateStr);
      if (isNaN(date.getTime())) {
        // Agar parseISO ishlamasa, oddiy Date dan foydalanamiz
        const fallbackDate = new Date(dateStr);
        if (isNaN(fallbackDate.getTime())) return dateStr;
        return formatDistanceToNow(fallbackDate, { addSuffix: true, locale: uz });
      }
      
      return formatDistanceToNow(date, { addSuffix: true, locale: uz });
    } catch (e) {
      return dateStr || '';
    }
  };

  if (loading) return <div className="p-4">Yuklanmoqda...</div>;
  if (!video) return <div className="p-4">Video topilmadi</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 max-w-[1600px] mx-auto">
      <div className="flex-1">
        <div className="aspect-video bg-black rounded-xl overflow-hidden mb-4 relative group">
          <video 
            key={video.id}
            controls 
            autoPlay 
            className="w-full h-full"
            crossOrigin="anonymous"
            preload="auto"
            onError={(e) => {
              console.error('Video playback error:', e);
              setError('Videoni qo\'yishda xatolik yuz berdi. Fayl o\'chirilgan yoki havola noto\'g\'ri bo\'lishi mumkin.');
            }}
          >
            <source src={video.videoUrl} type="video/mp4" />
            Sizning brauzeringiz videoni qo'llab-quvvatlamaydi.
          </video>
        </div>
        
        <h1 className={`text-xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>{video.title}</h1>
        
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Link to={`/profile/${video.userId}`} className={`w-10 h-10 rounded-full overflow-hidden ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
              {video.userAvatar ? (
                <img src={video.userAvatar} alt={video.userName} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center font-bold ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  {video.userName?.[0] || '?'}
                </div>
              )}
            </Link>
            <div>
              <Link to={`/profile/${video.userId}`} className={`font-semibold block ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>{video.userName}</Link>
              <span className="text-xs text-zinc-500">Obunachilar yo'q</span>
            </div>
            {user?.id !== video.userId && (
              <button 
                onClick={handleSubscribe}
                className={`ml-4 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isSubscribed 
                    ? (isDarkMode ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200')
                    : (isDarkMode ? 'bg-white text-zinc-900 hover:bg-zinc-100' : 'bg-zinc-900 text-white hover:bg-zinc-800')
                }`}
              >
                {isSubscribed ? 'Obuna bo\'lindi' : 'Obuna bo\'lish'}
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`flex items-center rounded-full overflow-hidden ${isLiked || isDisliked ? '' : (isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100')}`}>
              <button 
                onClick={handleLike}
                className={`flex items-center gap-2 px-4 py-2 border-r transition-colors ${
                  isLiked 
                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                    : (isDarkMode ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700' : 'bg-zinc-100 border-zinc-200 hover:bg-zinc-200')
                }`}
                title="Menga yoqdi"
              >
                <ThumbsUp size={18} fill={isLiked ? 'currentColor' : 'none'} />
                <span className="text-sm font-medium">{formatCount(video.likes)}</span>
              </button>
              <button 
                onClick={handleDislike}
                className={`flex items-center gap-2 px-4 py-2 transition-colors ${
                  isDisliked 
                    ? 'text-red-600 bg-red-50 dark:bg-red-900/20' 
                    : (isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200')
                }`}
                title="Menga yoqmadi"
              >
                <ThumbsUp size={18} className="rotate-180" fill={isDisliked ? 'currentColor' : 'none'} />
                <span className="text-sm font-medium">{formatCount(video.dislikes)}</span>
              </button>
            </div>
            <button className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'}`}>
              <Share2 size={18} />
              <span className="text-sm font-medium">Ulashish</span>
            </button>
            <button className={`p-2 rounded-full ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'}`}>
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>

        <div className={`rounded-xl p-3 mb-6 ${isDarkMode ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
          <div className="flex gap-2 text-sm font-semibold mb-1">
            <span>{formatCount(video.views)} marta ko'rildi</span>
            <span>{formatTime(video.created_at)}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{video.description}</p>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-bold mb-4">{comments.length} ta izoh</h3>
          
          {user ? (
            <form onSubmit={handleComment} className="flex gap-4 mb-6">
              <div className={`w-10 h-10 rounded-full overflow-hidden shrink-0 ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center font-bold ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {user.name?.[0] || '?'}
                  </div>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Izoh qoldiring..."
                  className={`w-full border-b focus:outline-none py-1 transition-colors bg-transparent ${
                    isDarkMode ? 'border-zinc-800 focus:border-white text-white' : 'border-zinc-300 focus:border-zinc-900 text-zinc-900'
                  }`}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => setNewComment('')}
                    className={`px-4 py-2 text-sm font-medium rounded-full ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
                  >
                    Bekor qilish
                  </button>
                  <button 
                    type="submit"
                    disabled={!newComment.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-full disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    Izoh qoldirish
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className={`mb-6 p-4 border rounded-xl text-center ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Izoh qoldirish uchun tizimga kiring</p>
              <Link to="/login" className="text-blue-600 font-medium hover:underline">Kirish</Link>
            </div>
          )}

          <div className="space-y-6">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-4">
                <Link to={`/profile/${comment.userId}`} className={`w-10 h-10 rounded-full overflow-hidden shrink-0 ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                  {comment.userAvatar ? (
                    <img src={comment.userAvatar} alt={comment.userName} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center font-bold ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {comment.userName?.[0] || '?'}
                    </div>
                  )}
                </Link>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Link to={`/profile/${comment.userId}`} className={`text-sm font-semibold hover:underline ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>@{comment.userName}</Link>
                    <span className="text-xs text-zinc-500">
                      {formatTime(comment.created_at)}
                    </span>
                  </div>
                  <p className={`text-sm ${isDarkMode ? 'text-zinc-300' : 'text-zinc-900'}`}>{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:w-[350px] xl:w-[400px]">
        <h3 className="font-bold mb-4">Tavsiya etilgan videolar</h3>
        <div className="space-y-4">
          {recommendedVideos.length > 0 ? (
            recommendedVideos.map((v) => (
              <Link 
                key={v.id} 
                to={`/video/${v.id}`} 
                className="flex gap-3 group"
                onClick={() => window.scrollTo(0, 0)}
              >
                <div className="relative w-40 h-24 shrink-0 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                  <img 
                    src={v.thumbnailUrl} 
                    alt={v.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <h4 className={`text-sm font-semibold line-clamp-2 leading-tight ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>
                    {v.title}
                  </h4>
                  <div className="text-xs text-zinc-500 mt-1">
                    <div className="hover:text-zinc-700 dark:hover:text-zinc-300 truncate">{v.userName}</div>
                    <div className="flex items-center gap-1">
                      <span>{formatCount(v.views)} marta ko'rildi</span>
                      <span>•</span>
                      <span>{formatTime(v.created_at)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-sm text-zinc-500 italic">Tavsiya etilgan videolar mavjud emas</p>
          )}
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-lg z-[100] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-sm font-medium">{error}</span>
          <button onClick={() => setError('')} className="hover:bg-white/20 rounded-full p-1">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
