/**
 * WindowManager Service
 * Erstellt und verwaltet Mirador Windows für synchronisierte Stimmen
 */
 
 import {
  VoiceData,
  WindowConfig,
  WindowManagerOptions,
  WindowMapping,
  LayoutInfo,
  MosaicNode,
  DispatchFunction,
} from '../types';

/**
 * Erstellt Window-Konfiguration für Mirador
 * @param {string} manifestId - IIIF Manifest ID
 * @param {string} canvasId - Initiale Canvas ID
 * @param {string} voiceName - Name der Stimme
 * @param {Object} position - Position und Größe { x, y, width, height }
 * @param {Object} options - Zusätzliche Optionen
 * @returns {Object} - Mirador Window Config
 */
const createWindowConfig = (manifestId, canvasId, voiceName, position, options = {}) => {
  const windowId = `${options.windowIdPrefix || 'voice-window'}-${voiceName.toLowerCase().replace(/\s+/g, '-').replace(':', 'X')}`;

  return {
    id: windowId,
    manifestId,
    canvasId,
    thumbnailNavigationPosition: options.thumbnailNavigationPosition || 'off',
    view: options.view || 'single',
    companionWindows: [],
    companionWindowIds: [],
    allowClose: options.allowClose !== undefined ? options.allowClose : false,
    allowMaximize: options.allowMaximize !== undefined ? options.allowMaximize : false,
    allowFullscreen: options.allowFullscreen !== undefined ? options.allowFullscreen : true,
    allowWindowSideBar: options.allowWindowSideBar !== undefined ? options.allowWindowSideBar : false,
    sideBarPanel: options.sideBarPanel || null,
    // Layout-Position (wird von Mirador Mosaic verwendet)
    layoutOrder: options.layoutOrder,
    // Custom data für Identifikation
    voiceName,
    ...position,
  };
};

/**
 * WindowManager Klasse
 * Verwaltet die Erstellung und Anordnung von Mirador Windows
 */
class WindowManager {
  constructor(voiceData: VoiceData, manifestId: string, options: WindowManagerOptions = {}) {
    if (!voiceData) {
      throw new Error('WindowManager: voiceData ist erforderlich');
    }
    if (!manifestId) {
      throw new Error('WindowManager: manifestId ist erforderlich');
    }

    this.voiceData = voiceData;
    this.manifestId = manifestId;
    this.options = {
      windowIdPrefix: 'voice-window',
      thumbnailNavigationPosition: 'off',
      allowClose: false,
      allowMaximize: false,
      allowWindowSideBar: false,
      view: 'single',
      ...options,
    };

    this.windowConfigs = [];
    this.windowMapping = {}; // voiceName -> windowId

  }

  /**
   * Erstellt Window-Konfigurationen für alle Stimmen
   * @param {number} startPageIndex - Initiale Seite (0-basiert)
   * @returns {Array} - Array von Window-Konfigurationen
   */
  createWindows(startPageIndex = 0) {
    const { voices, voiceMapping } = this.voiceData;
    const layout = "";// calculateGridLayout(voices.length);


    this.windowConfigs = voices.map((voiceName, index) => {

      const canvases = voiceMapping[voiceName];
      if (!canvases || canvases.length === 0) {
        return null;
      }

      // Initiale Canvas (erste Seite oder startPageIndex)
      const initialCanvas = canvases[Math.min(startPageIndex, canvases.length - 1)];

      // Position berechnen
      //const position = calculateWindowPosition(index, voices.length, layout);

      // Window-Config erstellen
      const config = createWindowConfig(
        this.manifestId,
        initialCanvas,
        voiceName,
      );

      // Mapping speichern
      this.windowMapping[voiceName] = config.id;
      return config;
    }).filter(Boolean); // Filtere null-Werte

    return this.windowConfigs;
  }

  /**
     * Dispatcht ADD_WINDOW Actions für alle Windows und richtet ein 2x2 Mosaic Layout ein
     * @param {Function} dispatch - Redux dispatch Funktion
     * @returns {Promise<void>}
     */
    async addWindowsToMirador(dispatch) {
      if (this.windowConfigs.length === 0) {
        console.warn('WindowManager: Keine Windows zum Hinzufügen. Rufe createWindows() zuerst auf.');
        return;
      }

      // Windows hinzufügen
      for (let i = 0; i < this.windowConfigs.length; i++) {
        const config = { ...this.windowConfigs[i], companionWindows: [] };
         dispatch({ type: 'mirador/ADD_WINDOW', window: config});
        //await new Promise((resolve) => setTimeout(resolve, 1)); // kleine Pause für Store-Update
      }

      // Jetzt Mosaic-Layout erzeugen
      if (this.windowConfigs.length >= 2) {
        const layout = this._buildMosaicLayout(this.windowConfigs.map((c) => c.id));
        dispatch({type: 'mirador/UPDATE_WORKSPACE_MOSAIC_LAYOUT', layout});
      }
    }

/**
 * Erzeugt ein balanciertes Mosaic-Layout für beliebig viele Fenster.
 *
 * @param {string[]} ids - Fenster-IDs (Mosaic leaves)
 * @returns {Object|string} - Mosaic tree structure
 */
 _buildMosaicLayout(ids: string[]) {
  if (!ids || ids.length === 0) return null;
  if (ids.length === 1) return ids[0];

  const container = document.querySelector('.mirador-workspace-viewport'); 
  const W = container.clientWidth;
  const H = container.clientHeight;

  const canvas = this.voiceData.manifest.items[0];
  const { width, height } = canvas;

  const Vviewport = W / H;
  const Vscan = width / height;
  const n = ids.length;

  // 🎯 --- FORMEL + DISKRETE OPTIMIERUNG ---
  const r0 = Math.sqrt(n * (Vscan / Vviewport));

  const candidates = [
    Math.floor(r0),
    Math.round(r0),
    Math.ceil(r0),
  ].filter(r => r >= 1 && r <= n);

  let best = null;

  candidates.forEach(r => {
    const rows = Math.max(1, r);
    const cols = Math.ceil(n / rows);

    const Vcell = Vviewport * (rows / cols);
    const error = Math.abs(Vcell - Vscan);

    if (!best || error < best.error) {
      best = { rows, cols, error };
    }
  });

  const rows = best.rows;
  const cols = best.cols;
/*
  console.log(
    "buildMosaicLayout",
    "W", W,
    "H", H,
    "Vscan", Vscan.toFixed(3),
    "Vviewport", Vviewport.toFixed(3),
    "rows", rows,
    "cols", cols
  );
*/

  // 2. Fenster in Reihen einsortieren
  const rowsArr = [];
  for (let r = 0; r < rows; r++) {
      let slice = ids.slice(r * cols, (r + 1) * cols);
    if ( slice.length > 0) {
        rowsArr.push(slice);
    }
  }

  // 3. Hilfsfunktion zum Erzeugen eines Row- oder Column-Binary-Tree
  function buildAxisTree(items, direction) {
     if (items === undefined || items.length === 0) return items;
      
    if (items.length === 1) return items[0];

    if (items.length === 2) {
      return {
        direction,
        first: items[0],
        second: items[1],
      };
    }

    const mid = Math.floor(items.length / 2);
    const firstItems = items.slice(0, mid);
    const secondItems = items.slice(mid);

    const first = buildAxisTree(firstItems, direction);
    const second = buildAxisTree(secondItems, direction);

    const splitPercentage = 100 * (firstItems.length / items.length);

    return {
      direction,
      splitPercentage,
      first,
      second,
    };
  }

  // 4. Jede Reihe wird ein Row-Tree
  const rowTrees = rowsArr.map((row) => buildAxisTree(row, "row"));

  if (rowTrees.length === 1) return rowTrees[0];

  // 5. Reihen vertikal kombinieren
  const finalTree = buildAxisTree(rowTrees, "column");
  return finalTree;
}
  /**
   * Entfernt alle verwalteten Windows
   * @param {Function} dispatch - Redux dispatch Funktion
   */
  removeAllWindows(dispatch) {

    this.windowConfigs.forEach((config) => {
      dispatch({
        type: 'mirador/REMOVE_WINDOW',
        windowId: config.id,
      });
    });

    this.windowConfigs = [];
    this.windowMapping = {};
  }

  /**
   * Gibt das Window-Mapping zurück (voiceName -> windowId)
   * @returns {Object}
   */
  getWindowMapping() {
    return { ...this.windowMapping };
  }

  /**
   * Gibt alle Window-Konfigurationen zurück
   * @returns {Array}
   */
  getWindowConfigs() {
    return [...this.windowConfigs];
  }

  /**
   * Findet Window-ID für eine bestimmte Stimme
   * @param {string} voiceName - Name der Stimme
   * @returns {string|null}
   */
  getWindowIdForVoice(voiceName) {
    return this.windowMapping[voiceName] || null;
  }

  /**
   * Prüft ob Windows bereits erstellt wurden
   * @returns {boolean}
   */
  hasWindows() {
    return this.windowConfigs.length > 0;
  }

  /**
   * Gibt Debug-Informationen zurück
   * @returns {Object}
   */
  getDebugInfo() {
    return {
      manifestId: this.manifestId,
      voices: this.voiceData.voices,
      voiceCount: this.voiceData.voices.length,
      windowCount: this.windowConfigs.length,
      windowMapping: this.windowMapping,
      options: this.options,
    };
  }
}

/**
 * Hilfsfunktion: Erstellt und fügt Windows in einem Schritt hinzu
 * @param {Object} voiceData - Ergebnis von detectSynchronizedVoices()
 * @param {string} manifestId - IIIF Manifest ID
 * @param {Function} dispatch - Redux dispatch Funktion
 * @param {Object} options - WindowManager Optionen
 * @returns {Promise<WindowManager>} - WindowManager Instanz
 */
export const setupSynchronizedWindows = async (voiceData, manifestId, dispatch, options = {}) => {
  const manager = new WindowManager(voiceData, manifestId, options);
  manager.createWindows(0);
  await manager.addWindowsToMirador(dispatch);
  return manager;
};

export default WindowManager;