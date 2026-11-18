/* ============================================
   Art Practice Reference — App Bootstrap
   ============================================ */

// Expose modules globally for cross-window PiP resolution
if (typeof UI !== 'undefined') window.UI = UI;
if (typeof ArtistToolbox !== 'undefined') window.ArtistToolbox = ArtistToolbox;
if (typeof SketchOverlay !== 'undefined') window.SketchOverlay = SketchOverlay;
if (typeof SketchComparison !== 'undefined') window.SketchComparison = SketchComparison;
if (typeof TimerManager !== 'undefined') window.TimerManager = TimerManager;
if (typeof SessionManager !== 'undefined') window.SessionManager = SessionManager;
if (typeof DeckManager !== 'undefined') window.DeckManager = DeckManager;
if (typeof BoardManager !== 'undefined') window.BoardManager = BoardManager;
if (typeof CardManager !== 'undefined') window.CardManager = CardManager;
if (typeof SoundFX !== 'undefined') window.SoundFX = SoundFX;
if (typeof PiPState !== 'undefined') window.PiPState = PiPState;
if (typeof ColorPaletteManager !== 'undefined') window.ColorPaletteManager = ColorPaletteManager;
if (typeof SmartCropManager !== 'undefined') window.SmartCropManager = SmartCropManager;
if (typeof PlumbTool !== 'undefined') window.PlumbTool = PlumbTool;
if (typeof FloatingWindowManager !== 'undefined') window.FloatingWindowManager = FloatingWindowManager;
if (typeof localDateStr !== 'undefined') window.localDateStr = localDateStr;
if (typeof isValidSketchUrl !== 'undefined') window.isValidSketchUrl = isValidSketchUrl;
if (typeof ExtensionHost !== 'undefined') window.ExtensionHost = ExtensionHost;
if (typeof StudioExtensions !== 'undefined') window.StudioExtensions = StudioExtensions;
if (typeof FlashRecallManager !== 'undefined') window.FlashRecallManager = FlashRecallManager;
if (typeof renderFilteredCanvas !== 'undefined') window.renderFilteredCanvas = renderFilteredCanvas;
if (typeof PiPCanvasStreamer !== 'undefined') window.PiPCanvasStreamer = PiPCanvasStreamer;
if (typeof Storage !== 'undefined') window.Storage = Storage;
if (typeof WallpaperManager !== 'undefined') window.WallpaperManager = WallpaperManager;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  UI.init();
});
