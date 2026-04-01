import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Edit2, Trash2, X } from 'lucide-react';
import { User, Video } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { uz } from 'date-fns/locale';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  updateDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, deleteObject } from 'firebase/storage';

const Profile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const { isDarkMode } = useTheme();
  const [profile, setProfile] = useState<(User & { videos: Video[] }) | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [actionError, setActionError] = useState('');

  const isOwner = currentUser?.id === id;

  const fetchProfile = async () => {
    if (!id) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', id));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        
        // Fetch videos
        const vQuery = query(collection(db, 'videos'), where('userId', '==', id));
        const vSnapshot = await getDocs(vQuery);
        const videos = vSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Video[];
        
        setProfile({ ...userData, id, videos });
      } else {
        setProfile(null);
      }
      
      if (currentUser && !isOwner) {
        const subDoc = await getDoc(doc(db, 'subscriptions', `${currentUser.id}_${id}`));
        setIsSubscribed(subDoc.exists());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id, currentUser]);

  const handleSubscribe = async () => {
    if (!currentUser) return setActionError('Obuna bo\'lish uchun tizimga kiring');
    if (isOwner) return;
    if (!id) return;
    
    try {
      const subId = `${currentUser.id}_${id}`;
      if (isSubscribed) {
        await deleteDoc(doc(db, 'subscriptions', subId));
        setIsSubscribed(false);
      } else {
        await setDoc(doc(db, 'subscriptions', subId), {
          subscriberId: currentUser.id,
          channelId: id,
          created_at: new Date().toISOString()
        });
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error(err);
      setActionError('Amalni bajarishda xatolik yuz berdi');
    }
  };

  const handleDeleteClick = (videoId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingVideoId(videoId);
    setActionError('');
  };

  const confirmDelete = async () => {
    if (!deletingVideoId) return;

    try {
      const videoDoc = await getDoc(doc(db, 'videos', deletingVideoId));
      if (videoDoc.exists()) {
        const videoData = videoDoc.data() as Video;
        
        // Delete from Storage
        try {
          const videoRef = ref(storage, videoData.videoUrl);
          const thumbRef = ref(storage, videoData.thumbnailUrl);
          await deleteObject(videoRef);
          await deleteObject(thumbRef);
        } catch (storageErr) {
          console.warn('Storage deletion failed, continuing with Firestore deletion:', storageErr);
        }

        // Delete from Firestore
        await deleteDoc(doc(db, 'videos', deletingVideoId));
        
        // Cleanup likes, comments, etc. (optional but good practice)
        // For now, let's just refresh
        setDeletingVideoId(null);
        fetchProfile();
      }
    } catch (err: any) {
      console.error(err);
      setActionError('O\'chirishda xatolik yuz berdi');
    }
  };

  const handleEditClick = (video: Video, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingVideo(video);
    setEditTitle(video.title);
    setEditDescription(video.description);
    setActionError('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo) return;

    try {
      await updateDoc(doc(db, 'videos', editingVideo.id), {
        title: editTitle,
        description: editDescription
      });
      setEditingVideo(null);
      fetchProfile();
    } catch (err: any) {
      console.error(err);
      setActionError('Yangilashda xatolik yuz berdi');
    }
  };

  const formatCount = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' mln';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + ' ming';
    return num.toString();
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      if (isNaN(date.getTime())) {
        const fallbackDate = new Date(dateStr + ' UTC');
        if (isNaN(fallbackDate.getTime())) return dateStr;
        return formatDistanceToNow(fallbackDate, { addSuffix: true, locale: uz });
      }
      return formatDistanceToNow(date, { addSuffix: true, locale: uz });
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) return <div className="p-4 text-center">Yuklanmoqda...</div>;
  if (!profile) return <div className="p-4 text-center">Foydalanuvchi topilmadi</div>;

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex flex-col md:flex-row items-center gap-6 mb-8 pb-8 border-b border-zinc-200">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-zinc-200 overflow-hidden shrink-0">
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500 text-4xl font-bold">
              {profile.name[0]}
            </div>
          )}
        </div>
        <div className="text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold mb-1">{profile.name}</h1>
          <p className="text-zinc-500 mb-4">@{profile.name.toLowerCase().replace(/\s/g, '')} • {profile.videos.length} ta video</p>
          {!isOwner && (
            <button 
              onClick={handleSubscribe}
              className={`px-6 py-2 rounded-full font-medium transition-colors ${
                isSubscribed 
                  ? 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200' 
                  : 'bg-zinc-900 text-white hover:bg-zinc-800'
              }`}
            >
              {isSubscribed ? 'Obuna bo\'lindi' : 'Obuna bo\'lish'}
            </button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-6">Videolar</h2>
        {profile.videos.length === 0 ? (
          <p className="text-zinc-500 italic">Hali videolar yuklanmagan</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {profile.videos.map((video) => (
              <div key={video.id} className="group relative">
                <Link to={`/video/${video.id}`} className="block">
                  <div className="aspect-video rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 mb-2 relative">
                    <img 
                      src={video.thumbnailUrl} 
                      alt={video.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <h3 className="font-semibold text-sm line-clamp-2 mb-1">{video.title}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatCount(video.views)} marta ko'rildi • {formatTime(video.created_at)}
                  </p>
                </Link>
                {isOwner && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                    <button 
                      onClick={(e) => handleEditClick(video, e)}
                      className="p-2 bg-white/90 dark:bg-zinc-900/90 hover:bg-white dark:hover:bg-zinc-900 rounded-full shadow-sm text-zinc-700 dark:text-zinc-300 hover:text-blue-600 transition-colors"
                      title="Tahrirlash"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteClick(video.id, e)}
                      className="p-2 bg-white/90 dark:bg-zinc-900/90 hover:bg-white dark:hover:bg-zinc-900 rounded-full shadow-sm text-zinc-700 dark:text-zinc-300 hover:text-red-600 transition-colors"
                      title="O'chirish"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Error Toast (Simple) */}
      {actionError && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg z-[200] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="hover:bg-white/20 rounded-full p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVideoId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-xl p-6">
            <h3 className="font-bold text-lg mb-2">Videoni o'chirish</h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">Haqiqatan ham ushbu videoni o'chirmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingVideoId(null)}
                className="px-6 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
              >
                Bekor qilish
              </button>
              <button
                onClick={confirmDelete}
                className="px-6 py-2 bg-red-600 text-white text-sm font-medium rounded-full hover:bg-red-700"
              >
                O'chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingVideo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-bold text-lg">Videoni tahrirlash</h3>
              <button onClick={() => setEditingVideo(null)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Sarlavha</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tavsif</label>
                <textarea
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 bg-transparent rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-32 resize-none"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingVideo(null)}
                  className="px-6 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
