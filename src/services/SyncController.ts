/**
 * SyncController Service
 * Verwaltet die synchronisierte Navigation zwischen mehreren Stimmen
 */

import {
  getCanvasesForCurrentPosition,
} from "./VoiceDetector";

const reverseMapping = (o) =>
  Object.keys(o).reduce(
    (r, k) => Object.assign(r, { [o[k]]: (r[o[k]] || []).concat(k) }),
    {}
  );

/**
 * SyncController Klasse
 * Zentrale Steuerung für synchronisiertes Blättern
 */
class SyncController {
  constructor(manifest, voiceData, windowMapping = {}) {
    if (!voiceData) {
      throw new Error("SyncController: voiceData ist erforderlich");
    }

    this.manifest = manifest;
    this.voiceData = voiceData;
    this.windowMapping = windowMapping; // Map von Stimme zu Mirador Window-ID
    this.windowIdToVoiceMapping = {}; // map von Windows Id nach voice
    this.syncEnabled = true;
    this.listeners = [];

  }

  /**
   * Setzt das Window-Mapping (Stimme -> Window-ID)
   * @param {Object} mapping - Map von Stimmen-Namen zu Window-IDs
   */
  setWindowMapping(mapping) {
    this.windowMapping = mapping;
    this.windowIdToVoiceMapping = reverseMapping(mapping);
  }

  /**
   * Registriert einen Listener für Page-Change-Events
   * @param {Function} callback - Callback(pageIndex, canvases)
   */
  addPageChangeListener(callback) {
    if (typeof callback === "function") {
      this.listeners.push(callback);
    }
  }

  /**
   * Entfernt einen Page-Change-Listener
   * @param {Function} callback - Der zu entfernende Callback
   */
  removePageChangeListener(callback) {
    this.listeners = this.listeners.filter((listener) => listener !== callback);
  }

  setCanvasForWindow(canvasId, windowId) {

    const voiceName = this.windowIdToVoiceMapping[windowId];

    const canvases = this.voiceData.voiceMapping[voiceName];
    const meta = this.voiceData.voiceMetadata[voiceName];
    const currentPosition = canvases.indexOf(canvasId);
    meta.currentPosition = currentPosition;
  }

  /**
   * Navigiert zur nächsten Seite
   * @param {Function} dispatch - Redux dispatch Funktion
   * @returns {boolean} - true wenn Navigation erfolgreich
   */
  navigateNext(dispatch) {
    Object.keys(this.voiceData.voiceMetadata).forEach((voiceName) => {
      const meta = this.voiceData.voiceMetadata[voiceName];
      // Nur erhöhen, wenn wir nicht am Ende der Stimme sind
      if (meta.currentPosition < meta.pageCount - 1) {
        meta.currentPosition += 1;
      }
    });
    if (this.syncEnabled) {
      this.updateAllWindows(dispatch);
    }
    return true;
  }

  /**
   * Navigiert zur vorherigen Seite
   * @param {Function} dispatch - Redux dispatch Funktion
   * @returns {boolean} - true wenn Navigation erfolgreich
   */
  navigatePrevious(dispatch) {
    Object.keys(this.voiceData.voiceMetadata).forEach((voiceName) => {
      const meta = this.voiceData.voiceMetadata[voiceName];
      // Nur erhöhen, wenn wir nicht am Ende der Stimme sind
      if (meta.currentPosition > 0) {
        meta.currentPosition -= 1;
      } 
    });

    if (this.syncEnabled) {
      this.updateAllWindows(dispatch);
    }
    return true;
  }

  navigateLast(dispatch) {
    Object.keys(this.voiceData.voiceMetadata).forEach((voiceName) => {
      const meta = this.voiceData.voiceMetadata[voiceName];

      meta.currentPosition = this.voiceData.voiceMapping[voiceName].length - 1;
    });

    if (this.syncEnabled) {
      this.updateAllWindows(dispatch);
    }

    return true;
  }

  /**
   * Navigiert zu einer bestimmten Seite
   * @param {number} pageIndex - Ziel-Seitenindex (0-basiert)
   * @param {Function} dispatch - Redux dispatch Funktion
   * @returns {boolean} - true wenn Navigation erfolgreich
   */
  navigateToPage(pageIndex, dispatch) {
    if (pageIndex < 0 || pageIndex >= this.voiceData.minPages) {
      console.warn(`SyncController: Ungültiger Seitenindex: ${pageIndex}`);
      return false;
    }

    Object.keys(this.voiceData.voiceMetadata).forEach((voiceName) => {
      const meta = this.voiceData.voiceMetadata[voiceName];
      // Nur erhöhen, wenn wir nicht am Ende der Stimme sind

      meta.currentPosition = pageIndex;
    });

    if (this.syncEnabled) {
      this.updateAllWindows(dispatch);
    }

    return true;
  }

  navigateToWork(workId, dispatch) {
    //const work = this.voiceData.workMetadata.find(w => w.id === workId);
    const work = this.voiceData.workMetadata[workId];
    if (!work) {
      return;
    } 

    Object.keys(this.voiceData.voiceMetadata).forEach((voiceName) => {
      const meta = this.voiceData.voiceMetadata[voiceName];
      const offset = work.occurrences[voiceName]?.offset;

      if (offset !== undefined && meta !== undefined) {
        meta.currentPosition = offset;
      }
    });

    if (this.syncEnabled) {
      this.updateAllWindows(dispatch);
    }

    return true;
  }

  /**
   * Aktualisiert alle gemappten Windows mit den aktuellen Canvases
   * @param {Function} dispatch - Redux dispatch Funktion
   * @private
   */
  updateAllWindows(dispatch) {
    const canvases = this.getCurrentCanvases();

    Object.entries(canvases).forEach(([voiceName, canvasId]) => {
      const windowId = this.windowMapping[voiceName];

      if (!windowId) {
        console.warn(
          `SyncController: Kein Window für Stimme "${voiceName}" gefunden`
        );
        return;
      }

      // Dispatche Mirador SET_CANVAS Action
      dispatch({
        type: "mirador/SET_CANVAS",
        windowId,
        canvasId,
      });
    });
  }

  /**
   * Gibt alle Canvas-IDs für die aktuelle Seite zurück
   * @returns {Object} - Map von Stimme zu Canvas-ID
   */
  getCurrentCanvases() {
    return getCanvasesForCurrentPosition(this.voiceData);
  }

  /**
   * Gibt die Gesamtanzahl der Seiten zurück
   * @returns {number}
   */
  getTotalPages() {
    return this.voiceData.minPages;
  }

  /**
   * Aktiviert oder deaktiviert die Synchronisation
   * @param {boolean} enabled
   */
  setSyncEnabled(enabled) {
    this.syncEnabled = enabled;
  }

  /**
   * Prüft ob Synchronisation aktiviert ist
   * @returns {boolean}
   */
  isSyncEnabled() {
    return this.syncEnabled;
  }

  /**
   * Gibt die Liste der Stimmen zurück
   * @returns {Array<string>}
   */
  getVoices() {
    return this.voiceData.voices;
  }

  getCanvasesForVoice(voiceName) {
    return this.voiceData.voiceMapping[voiceName];
  }

  getVoice(windowId) {
    return this.windowIdToVoiceMapping[windowId];
  }

  /**
   * Gibt Metadaten für eine bestimmte Stimme zurück
   * @param {string} voiceName - Name der Stimme
   * @returns {Object|null}
   */
  getVoiceMetadata(voiceName) {
    return this.voiceData.voiceMetadata[voiceName] || null;
  }

  getVoiceData() {
    return this.voiceData;
  }

  /**
   * Gibt Debugging-Informationen zurück
   * @returns {Object}
   */
  getDebugInfo() {
    return {
      currentPageNumber: this.getCurrentPageNumber(),
      totalPages: this.getTotalPages(),
      syncEnabled: this.syncEnabled,
      voices: this.getVoices(),
      windowMapping: this.windowMapping,
    };
  }
}

export default SyncController;
