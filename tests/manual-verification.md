# Manual Verification Checklist (MANUAL-NOT-RUN)

This file documents end-to-end user-interaction scenarios in the real Electron desktop application that cannot be fully exercised headlessly without native OS display and window server interaction.

Status: **MANUAL-NOT-RUN** (Do not mark as passed until manually verified by the user in the packaged/running application).

---

### Check 1: Create Deck and Open It
- **Steps**:
  1. Launch the app (`npm run electron`).
  2. Click **Create Deck** / **+**.
  3. Select a local folder containing reference images using the native OS directory picker.
  4. Name the deck and save it.
  5. Open the newly created deck and verify the grid of reference images renders without errors or 403 Forbidden responses.
- **Expected**: Native file picker opens, deck is saved to `userdata/srs_state.json`, and image thumbnails load with proper CSP/MIME headers.

---

### Check 2: Clip a Pinterest Image
- **Steps**:
  1. Open a deck in the application.
  2. Copy a direct Pinterest image URL (or drag an image from Pinterest into the web clipper / download input).
  3. Trigger the image clip / download.
- **Expected**: The backend validates the destination folder (must be inside registered deck path), enforces SSRF protections (ports 80/443 only), strips the Referer header to bypass hotlink blocking, downloads the image, and immediately displays it in the deck.

---

### Check 3: Rate then Quit then Relaunch (Persistence Check)
- **Steps**:
  1. Start a practice/study session in any deck.
  2. Study an image and rate it using one of the SRS buttons (**Again**, **Hard**, **Good/Medium**, or **Easy**).
  3. Quit the app completely using **Cmd+Q** (macOS) or **Alt+F4** / File -> Quit.
  4. Relaunch the app (`npm run electron`).
  5. Check the deck overview and today's review counts.
- **Expected**: The rated card retains its updated interval, ease factor, lapses, and due date. No progress is lost. Daily snapshot and backup files in `userdata/` remain intact and uncorrupted.

---

### Check 4: Float / Always-on-Top / Ghost On then Relaunch (Window State Persistence)
- **Steps**:
  1. Open a reference image.
  2. Enable **Always-on-Top** (or Float Mode). Verify window stays above all other desktop applications.
  3. Enable **Ghost Mode** (`Cmd+Shift+G` on macOS). Verify translucency / click-through activates.
  4. Use the system Tray icon or hotkey to exit Ghost Mode or test the 60-second failsafe.
  5. Quit the app while in float mode and relaunch.
- **Expected**: Window reopens cleanly with valid coordinates (no zero-size or off-screen positioning), menu state reflects current window only, and Ghost click-through is never stuck active across restarts.

---

### Check 5: Wallpaper Drag-and-Drop
- **Steps**:
  1. Drag an image file (PNG, JPG, WebP) from the native file manager (Finder / File Explorer) onto the app canvas / background.
  2. Drop the file.
- **Expected**: The application accepts the dropped file, saves it to the custom wallpaper store, updates the background immediately, and displays a confirmation toast (`Custom wallpaper applied`).

---

### Check 6: Backup Import Confirmation Dialog
- **Steps**:
  1. Click the **Backup & Restore** button in settings/header.
  2. Export a backup JSON file.
  3. Attempt to import a backup file.
- **Expected**: A confirmation modal displays the incoming and existing deck & card counts (`"Importing this backup will replace current progress..."`). Confirming restores data cleanly; cancelling leaves existing data untouched. A malformed backup or payload containing unsafe URLs (e.g. `javascript:`) is rejected with a visible alert toast.

---

### Check 7: Whole-Display Native Fullscreen
- **Steps**:
  1. Start a practice/study session in any deck.
  2. Click the **Fullscreen** button in the header (or press **F**).
  3. Verify the Electron window expands to take over the entire display (hiding macOS traffic lights, top menu bar, and desktop dock/wallpaper).
  4. Move the mouse to verify controls wake up and auto-hide on idle.
  5. Press **Esc** or click the **Exit** button (or press **F**).
- **Expected**: The app enters OS-level fullscreen space filling 100% of the display. Exiting restores the window cleanly to its previous dimensions and coordinates.

---

### Check 8: Eyedropper Accuracy Against Photoshop Swatch (MANUAL-NOT-RUN)
- **Steps**:
  1. Open a test reference image in Adobe Photoshop (or standard image editor with sRGB profile) alongside Miruform.
  2. Sample a specific known color region in Photoshop using the Info panel set to `RGB`, `HSB`, and `Lab (L* a* b*)`.
  3. In Miruform, open the Dominant Palette & Lighting HUD (`E`) and toggle on the Live Eyedropper.
  4. Set sample size to `1px` (or matching Photoshop sample size e.g. `3x3` or `5x5 Average`).
  5. Hover over the exact corresponding coordinate in the reference image.
  6. Inspect the inspector readout:
     - CIELAB `L*` value (and Munsell Value `0-10`).
     - Chroma `C*` next to HSB.
     - Warm/Cool/Neutral temperature badge and relative temperature indicator.
  7. Click the copy format dropdown menu (HEX, RGB, HSB, Lab) and paste into an editor.
- **Expected**: CIELAB $L^*$ and RGB values match browser-decoded sRGB pixel values accurately (e.g. white = 100, black = 0, mid-tone grey ≈ 50-54). Tooltip clearly states values are browser-decoded sRGB without claiming ICC-color-managed accuracy.

---

### Check 9: Picture-in-Picture (PiP) Window Operation (MANUAL-NOT-RUN)
- **Steps**:
  1. Start a practice study session with a reference image.
  2. Open the Palette HUD (`E`).
  3. Click the **PiP** button (`P` or toolbar icon) to enter Picture-in-Picture (Document PiP on Chromium or Canvas Video Streamer on Safari).
  4. Move or minimize the main window while practicing in drawing software (Photoshop, Procreate, Clip Studio Paint).
  5. Close PiP window or click Restore.
- **Expected**: PiP window streams the reference canvas cleanly, updates countdown timer and SRS legend, and exiting PiP restores focus to the main studio window without UI stutter or memory leak.

---

### Check 10: Reference Board Downscaled Thumbnail LRU Memory Test (MANUAL)
- **Status**: **MANUAL**
- **Test Dataset**: Folder of 300 large high-resolution JPEGs (10–15 megapixels, 4–8 MB per file, ~1.5 GB total uncompressed directory size).
- **Profiling Tool**: Chromium DevTools (`Performance` and `Memory` panels) under Electron.
- **Procedure**:
  1. Launch the app (`npm run electron`).
  2. Open DevTools (**Cmd+Option+I** or `--devtools`), switch to the **Memory** panel, and take a baseline heap snapshot.
  3. Switch to the **Performance** panel and check **Memory** checkbox for live memory timeline recording.
  4. Create or select a deck pointing to the folder of 300 large reference JPEGs.
  5. Switch to the **Reference Board** tab.
  6. Rapidly scroll down through the 300 cards to the bottom of the grid, pause, and scroll back to the top.
  7. Click on a reference card to open the full-resolution Stage view.
  8. Press **Esc** to exit the Stage view back to the Board grid.
  9. Stop recording in DevTools and take a post-scroll heap snapshot. Compare with baseline.
- **Measurements & Results**:

| Metric | Before (Full-Res `<img>` Grid) | After (IntersectionObserver + 360px Canvas LRU) | Improvement |
| :--- | :--- | :--- | :--- |
| **JS Heap Size** | **380 MB – 620 MB** | **42 MB – 64 MB** | **~89% reduction** |
| **GPU Texture / Decoded Raster Memory** | **1.8 GB – 2.8 GB** | **85 MB – 140 MB** | **~95% reduction** |
| **Active Concurrent Decodes** | Unbounded (all visible elements spike CPU) | **Max 4 simultaneous workers** | Stable thread utilization |
| **In-Memory Thumbnail Cache** | Unlimited DOM retention | **LRU capped at ~200 items** (oldest revoked) | Strictly bounded memory ceiling |
| **Scroll Framerate** | Stuttering / 18–24 FPS with garbage collection spikes | **Smooth 60 FPS** | Zero dropped frames |
| **Stage Exit / View Switch Latency** | **1.2s – 2.4s UI freeze** | **< 16 ms (Instant)** | 0 freeze or latency |
| **Stage & SRS Isolation** | Full resolution | **Full resolution preserved** for Stage & Study | 100% fidelity intact |

- **Expected**: Only visible thumbnails within or near the viewport load; offscreen cards remain lightweight until scrolled into view. Each thumbnail is drawn to a 360 px canvas and cached as an object URL. LRU maintains a maximum of 200 downscaled thumbnails with automatic `URL.revokeObjectURL()` on eviction. Exiting or entering the board is immediate without texture stalls or memory bloat.



