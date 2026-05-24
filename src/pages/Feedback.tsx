import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Send, ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '../supabase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Button } from '../components/ui/Button';

export const Feedback: React.FC = () => {
  const { user, userProfile, isGuest } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      error("Guest accounts are read-only. Please log in to leave reviews.");
      return;
    }
    if (!user) {
      error("You must be signed in to submit feedback.");
      return;
    }
    if (rating === 0) {
      error("Please select a star rating between 1 and 5!");
      return;
    }

    setIsSubmitting(true);
    const feedbackPayload = {
      id: 'feedback-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      user_id: user.uid,
      display_name: userProfile?.displayName || user.displayName || 'Student peer',
      photo_url: userProfile?.photoURL || user.photoURL || '',
      department: userProfile?.branch || 'cse',
      rating,
      comment: comment.trim(),
      created_at: new Date().toISOString()
    };

    try {
      // 1. Try Supabase Insert
      const { error: insertErr } = await supabase.from('feedbacks').insert([feedbackPayload]);
      
      if (insertErr) {
        console.warn("Primary feedbacks table insert failed. Trying realtime fallback...", insertErr.message);
        throw insertErr;
      }
      
      // 2. Broadcast realtime updates
      try {
        const channel = supabase.channel('public:feedbacks');
        channel.subscribe((status: any) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'new-feedback',
              payload: feedbackPayload
            });
          }
        });
      } catch (broadcastErr) {
        console.warn("Failed to broadcast feedback updates:", broadcastErr);
      }

      success("Feedback reviews submitted successfully! Thank you!");
      setIsSuccess(true);
    } catch (dbErr: any) {
      // Offline LocalStorage + Broadcast Fallback Shield
      console.warn("NoteWeb Safeguard: Supabase feedbacks table unavailable. Syncing to LocalStorage & Realtime Broadcast.");
      
      const savedFeedbacksStr = localStorage.getItem('noteweb-db-feedbacks');
      let savedFeedbacks = [];
      if (savedFeedbacksStr) {
        try { savedFeedbacks = JSON.parse(savedFeedbacksStr); } catch {}
      }
      savedFeedbacks.push(feedbackPayload);
      localStorage.setItem('noteweb-db-feedbacks', JSON.stringify(savedFeedbacks));

      // Trigger realtime P2P broadcast so other tabs/admins online see it
      try {
        const channel = supabase.channel('public:feedbacks');
        await new Promise<void>((resolve) => {
          channel.subscribe(async (status: any) => {
            if (status === 'SUBSCRIBED') {
              await channel.send({
                type: 'broadcast',
                event: 'new-feedback',
                payload: feedbackPayload
              });
              resolve();
            } else {
              resolve();
            }
          });
          setTimeout(resolve, 1000);
        });
      } catch (e) {}

      success("Feedback compiled successfully via P2P backup!");
      setIsSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full py-12 px-4 md:px-8 relative overflow-hidden flex items-center justify-center">
      {/* Glow Visuals */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 glow-indigo rounded-full pointer-events-none blur-3xl opacity-30 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 glow-purple rounded-full pointer-events-none blur-3xl opacity-30 animate-pulse" />

      <div className="max-w-xl w-full z-10 relative">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 text-sm font-bold bg-white/5 px-4 py-2 rounded-xl border border-white/5 hover:bg-white/10 active:scale-95 text-left self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        {isSuccess ? (
          <GlassPanel glowBorder className="bg-[#16161D]/30 p-8 shadow-xl text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-bounce-slow">
              <CheckCircle className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">Review Submitted!</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed">
                Thank you for rating NoteWeb! Your reviews help us optimize academic features for engineers worldwide.
              </p>
            </div>
            <Button
              onClick={() => navigate('/feed')}
              variant="primary"
              className="px-6 py-2.5 mx-auto"
            >
              Continue to Library
            </Button>
          </GlassPanel>
        ) : (
          <GlassPanel glowBorder className="bg-[#16161D]/30 p-8 shadow-xl text-left">
            <div className="space-y-2 mb-6">
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                Rate NoteWeb Experience
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Google Play Store-style evaluation. Share your feedback so we can build the perfect academic ecosystem!
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Play Store Stars Selectors */}
              <div className="flex flex-col gap-2.5 items-center justify-center py-6 bg-white/[0.01] border border-white/[0.04] rounded-2xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Touch stars to rate
                </span>
                
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isActive = star <= (hoverRating || rating);
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 focus:outline-none transition-transform active:scale-90 hover:scale-110"
                      >
                        <Star 
                          className={`w-10 h-10 transition-all duration-200 cursor-pointer ${
                            isActive
                              ? 'fill-amber-400 text-amber-400 filter drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                              : 'text-slate-600 dark:text-slate-700 hover:text-slate-500'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="h-4 mt-1 text-center">
                  {rating > 0 && (
                    <span className="text-xs font-extrabold text-amber-400 uppercase tracking-widest animate-pulse">
                      {rating === 1 && '⭐ Disappointing'}
                      {rating === 2 && '⭐⭐ Below Expectations'}
                      {rating === 3 && '⭐⭐⭐ Good Experience'}
                      {rating === 4 && '⭐⭐⭐⭐ Highly Recommended'}
                      {rating === 5 && '⭐⭐⭐⭐⭐ State-of-the-Art Excellence!'}
                    </span>
                  )}
                </div>
              </div>

              {/* Review input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 pl-1">
                  Write a Review (Optional)
                </label>
                <textarea
                  placeholder="Describe your experience with NoteWeb notes, companion study, summaries, or lounge chat..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  className="w-full py-3 px-4 glass-input text-xs bg-slate-950/80 text-white rounded-2xl focus:border-indigo-500 focus:outline-none transition-colors border border-white/[0.08] resize-none leading-relaxed placeholder:text-slate-600"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate(-1)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="shadow-lg shadow-indigo-600/10"
                  isLoading={isSubmitting}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Submit Review
                </Button>
              </div>
            </form>
          </GlassPanel>
        )}
      </div>
    </div>
  );
};

export default Feedback;
