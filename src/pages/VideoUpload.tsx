import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Image as ImageIcon, Film } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const VideoUpload: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState(() => localStorage.getItem('upload_draft_title') || '');
  const [description, setDescription] = useState(() => localStorage.getItem('upload_draft_description') || '');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  React.useEffect(() => {
    localStorage.setItem('upload_draft_title', title);
  }, [title]);

  React.useEffect(() => {
    localStorage.setItem('upload_draft_description', description);
  }, [description]);

  if (!user) {
    navigate('/login');
    return null;
  }

  const validate = () => {
    const errors: { [key: string]: string } = {};
    if (!title.trim()) {
      errors.title = 'Sarlavha kiritilishi shart';
    } else if (title.trim().length < 5) {
      errors.title = 'Sarlavha kamida 5 ta belgidan iborat bo\'lishi kerak';
    }

    if (!videoFile) {
      errors.video = 'Video fayl tanlanishi shart';
    } else if (videoFile.size > 2048 * 1024 * 1024) { // 2GB limit
      errors.video = 'Video hajmi 2GB dan oshmasligi kerak';
    }

    if (!thumbnailFile) {
      errors.thumbnail = 'Muqova rasmi tanlanishi shart';
    } else if (thumbnailFile.size > 10 * 1024 * 1024) { // 10MB limit
      errors.thumbnail = 'Rasm hajmi 10MB dan oshmasligi kerak';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      setError('Iltimos, barcha maydonlarni to\'g\'ri to\'ldiring');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');
    setFieldErrors({});

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('video', videoFile!);
    formData.append('thumbnail', thumbnailFile!);

    try {
      await api.post('/videos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(percentCompleted);
        }
      });
      localStorage.removeItem('upload_draft_title');
      localStorage.removeItem('upload_draft_description');
      navigate('/');
    } catch (err: any) {
      console.error('Upload error:', err);
      if (err.code === 'ECONNABORTED') {
        setError('Yuklash vaqti tugadi (Timeout). Internet aloqangizni tekshiring.');
      } else if (err.response?.status === 413) {
        setError('Fayl hajmi juda katta (Server cheklovi).');
      } else {
        setError(err.response?.data?.error || 'Yuklashda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-zinc-900 dark:text-white">
          <Upload className="text-blue-600" /> Video yuklash
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/30">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Sarlavha *</label>
            <input
              type="text"
              className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white ${
                fieldErrors.title ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-zinc-300 dark:border-zinc-700'
              }`}
              placeholder="Video sarlavhasini kiriting"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (fieldErrors.title) setFieldErrors({ ...fieldErrors, title: '' });
              }}
            />
            {fieldErrors.title && <p className="text-red-500 text-xs mt-1">{fieldErrors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Tavsif</label>
            <textarea
              className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none h-32 resize-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              placeholder="Video haqida ma'lumot bering"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Video fayl *</label>
              <div className={`relative border-2 border-dashed rounded-xl p-4 hover:border-blue-500 transition-colors cursor-pointer group ${
                fieldErrors.video ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-zinc-300 dark:border-zinc-700'
              }`}>
                <input
                  type="file"
                  accept="video/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    setVideoFile(e.target.files?.[0] || null);
                    if (fieldErrors.video) setFieldErrors({ ...fieldErrors, video: '' });
                  }}
                />
                <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 group-hover:text-blue-600">
                  <Film size={32} className="mb-2" />
                  <span className="text-xs text-center truncate w-full px-2">
                    {videoFile ? videoFile.name : 'Video tanlang'}
                  </span>
                </div>
              </div>
              {fieldErrors.video && <p className="text-red-500 text-xs mt-1">{fieldErrors.video}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Muqova (Thumbnail) *</label>
              <div className={`relative border-2 border-dashed rounded-xl p-4 hover:border-blue-500 transition-colors cursor-pointer group ${
                fieldErrors.thumbnail ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-zinc-300 dark:border-zinc-700'
              }`}>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    setThumbnailFile(e.target.files?.[0] || null);
                    if (fieldErrors.thumbnail) setFieldErrors({ ...fieldErrors, thumbnail: '' });
                  }}
                />
                <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 group-hover:text-blue-600">
                  <ImageIcon size={32} className="mb-2" />
                  <span className="text-xs text-center truncate w-full px-2">
                    {thumbnailFile ? thumbnailFile.name : 'Rasm tanlang'}
                  </span>
                </div>
              </div>
              {fieldErrors.thumbnail && <p className="text-red-500 text-xs mt-1">{fieldErrors.thumbnail}</p>}
            </div>
          </div>

          <div className="pt-4 space-y-4">
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Yuklanmoqda...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={uploading}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Yuklanmoqda...
                </>
              ) : (
                'Nashr qilish'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VideoUpload;
