# Adinchoo Dreeve v8.4 - iPhone 14 PWA Edition

## What's new for iPhone 14

### PWA Fixes (critical for iOS)
- ✅ `apple-mobile-web-app-capable`, `apple-touch-icon`, `apple-touch-startup-image` for iPhone 14 1170x2532
- ✅ `viewport-fit=cover` + `env(safe-area-inset-*)` for notch/Dynamic Island
- ✅ `100dvh` + `--vh` fallback using `visualViewport` (fixes iOS toolbar 100vh bug)
- ✅ Bottom tab bar in thumb zone (44px touch targets)
- ✅ All inputs `font-size:16px` to prevent auto-zoom on focus
- ✅ Custom iOS install banner (iOS has no auto prompt, must teach Share -> Add to Home Screen)
- ✅ Service Worker: network-first for Supabase/Puter, cache-first for assets, navigation fallback to index.html
- ✅ Leaflet `tap:true` + `invalidateSize()` on orientationchange
- ✅ Chart.js sampling to 400 points for iPhone performance
- ✅ Icons: 180, 167, 152, 120 + 192, 512 + maskable + splash 1170x2532

### How to install on iPhone 14
1. Open in Safari (must be Safari, not Chrome)
2. Tap Share icon ⎙ at bottom
3. Scroll -> Add to Home Screen
4. Launch from Home Screen -> standalone fullscreen, offline ready

### Test checklist
- Standalone detection: `window.navigator.standalone` or `display-mode: standalone`
- Safe area: content not hidden behind notch
- No zoom on input focus
- Bottom tabs visible only on mobile, sidebar hidden
- Map draggable with one finger
- File import opens Files app
- SW registered: Settings shows PWA Installed

### Files changed
- index.html: full iOS meta + banner + bottom tabs
- manifest.webmanifest: shortcuts, screenshots, display_override
- styles.css: safe-area, dvh, bottom-tabs, 44px targets, -webkit-overflow-scrolling
- sw.js: iOS-friendly caching strategy
- app.js: SW registration, visualViewport, orientationchange, standalone checks
- gpx-report.js: sampling for iOS perf, tap handling

Icons in `/assets/icons/` - replace with your own 1024x1024 source.
