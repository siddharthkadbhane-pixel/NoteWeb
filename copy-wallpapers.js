const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\SIDHARTH\\.gemini\\antigravity-ide\\brain\\ab288f7a-c450-49e3-8381-200b8a826f3c';
const destDir = path.join(__dirname, 'public', 'wallpapers');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const wallpapers = [
  { src: 'chat_lofi_study_wallpaper_1782649635225.png', dest: 'chat_lofi_study.png' },
  { src: 'chat_gradient_wave_wallpaper_1782649648126.png', dest: 'chat_gradient_wave.png' },
  { src: 'chat_tech_doodle_wallpaper_1782649665299.png', dest: 'chat_tech_doodle.png' },
  { src: 'chat_cyberpunk_city_wallpaper_1782649729561.png', dest: 'chat_cyberpunk_city.png' },
  { src: 'chat_pastel_dream_wallpaper_1782649746844.png', dest: 'chat_pastel_dream.png' },
  { src: 'chat_cosmic_forest_wallpaper_1782649762616.png', dest: 'chat_cosmic_forest.png' },
  { src: 'chat_insta_bubblegum_wallpaper_1782649824281.png', dest: 'chat_insta_bubblegum.png' },
  { src: 'chat_insta_rainbow_wallpaper_1782649839262.png', dest: 'chat_insta_rainbow.png' },
  { src: 'chat_insta_autumn_wallpaper_1782649854841.png', dest: 'chat_insta_autumn.png' },
  { src: 'chat_synthwave_sunset_wallpaper_1782649925674.png', dest: 'chat_synthwave_sunset.png' },
  { src: 'chat_zen_ink_wallpaper_1782649943089.png', dest: 'chat_zen_ink.png' },
  { src: 'chat_matrix_code_wallpaper_1782649959467.png', dest: 'chat_matrix_code.png' },
  { src: 'chat_lavender_mist_wallpaper_1782649976385.png', dest: 'chat_lavender_mist.png' },
  { src: 'chat_abstract_geometric_wallpaper_1782649992073.png', dest: 'chat_abstract_geometric.png' }
];

wallpapers.forEach((wp) => {
  const srcPath = path.join(srcDir, wp.src);
  const destPath = path.join(destDir, wp.dest);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied: ${wp.src} -> ${wp.dest}`);
  } else {
    console.warn(`File not found: ${srcPath}`);
  }
});

console.log('All wallpapers copied to public/wallpapers/ successfully!');
