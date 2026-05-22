export const renderAvatar = (photoURL: string, className = "w-12 h-12 text-2xl") => {
  if (!photoURL) {
    return (
      <div className={`${className} bg-slate-700 flex items-center justify-center rounded-full text-white font-bold select-none`}>
        👤
      </div>
    );
  }
  
  if (photoURL.includes('|')) {
    const [emoji, gradient] = photoURL.split('|');
    return (
      <div className={`${className} bg-gradient-to-tr ${gradient} flex items-center justify-center rounded-full shadow-lg border border-white/20 select-none animate-pulse-slow`}>
        {emoji}
      </div>
    );
  }
  
  return (
    <img 
      src={photoURL} 
      alt="Avatar" 
      className={`${className} rounded-full object-cover shadow-lg border border-white/20`} 
    />
  );
};
