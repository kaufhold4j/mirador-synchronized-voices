/**
 * SyncController Service
 * Verwaltet die synchronisierte Navigation zwischen mehreren Stimmen
 */

import {
  IIIFManifest,
  VoiceData,
  WindowMapping,
  PageChangeListener,
  CanvasesForPage,
  DebugInfo,
  DispatchFunction,
  ISyncController,
  VoiceMetadata,
} from '../types';
import {
  getCanvasesForCurrentPosition,
} from "./VoiceDetector";

const reverseMapping = (o: Record<string, string>): Record<string, string[]> =>
  Object.keys(o).reduce(
    (r: Record<string, string[]>, k: string) => Object.assign(r, { [o[k]]: (r[o[k]] || []).concat(k) }),
    {}
  );

/**
 * SyncController Klasse
 * Zentrale Steuerung für synchronisiertes Blättern
 */
class SyncController implements ISyncController {
  public manifest: IIIFManifest;
  public voiceData: VoiceData;
  public windowMapping: WindowMapping; // Map von Stimme zu Mirador Window-ID
  public windowIdToVoiceMapping: Record<string, string[]> = {}; // map von Windows Id nach voice
  public syncEnabled: boolean = true;
  public standardWindowId: string | null = null;
  private listeners: PageChangeListener[] = [];

  constructor(manifest: IIIFManifest, voiceData: VoiceData, windowMapping: WindowMapping = {}) {
    if (!voiceData) {
      throw new Error("SyncController: voiceData ist erforderlich");
    }

    this.manifest = manifest;
    this.voiceData = voiceData;
    this.windowMapping = windowMapping;
    this.setWindowMapping(windowMapping);
  }

  /**
   * Setzt das Window-Mapping (Stimme -> Window-ID)
   * @param {WindowMapping} mapping - Map von Stimmen-Namen zu Window-IDs
   */
  public setWindowMapping(mapping: WindowMapping): void {
    this.windowMapping = mapping;
    this.windowIdToVoiceMapping = reverseMapping(mapping);
  }

  public setStandardWindowId(windowId: string | null): void {
    this.standardWindowId = windowId;
  }

  /**
   * Registriert einen Listener für Page-Change-Events
   * @param {PageChangeListener} callback - Callback(pageIndex, canvases)
   */
  public addPageChangeListener(callback: PageChangeListener): void {
    if (typeof callback === "function") {
      this.listeners.push(callback);
    }
  }

  /**
   * Entfernt einen Page-Change-Listener
   * @param {PageChangeListener} callback - Der zu entfernende Callback
   */
  public removePageChangeListener(callback: PageChangeListener): void {
    this.listeners = this.listeners.filter((listener) => listener !== callback);
  }

  public setCanvasForWindow(canvasId: string, windowId: string): void {
    let voiceNames = this.windowIdToVoiceMapping[windowId];

    // If it's the standard window, we treat it as updating all voices based on the canvasId
    if (windowId === this.standardWindowId) {
      // Find which page this canvasId corresponds to in the first voice (as a reference)
      const firstVoice = this.voiceData.voices[0];
      const canvases = this.voiceData.voiceMapping[firstVoice];
      const pageIndex = canvases.indexOf(canvasId);

      if (pageIndex >= 0) {
        this.navigateToPage(pageIndex, (_action) => {
          // We don't have a real dispatch here, but navigateToPage updates internal state
          // and usually calls updateAllWindows which we want to avoid infinite loops.
          // But navigateToPage in SyncController updates metadata and then optionally updates windows.
        });
        return;
      }
    }

    if (!voiceNames) return;

    voiceNames.forEach(voiceName => {
      const canvases = this.voiceData.voiceMapping[voiceName];
      const meta = this.voiceData.voiceMetadata[voiceName];
      if (canvases && meta) {
        const currentPosition = canvases.indexOf(canvasId);
        if (currentPosition >= 0) {
          meta.currentPosition = currentPosition;

          // Notify listeners if this is the primary voice or something changed
          this.notifyListeners();
        }
      }
    });
  }

  private notifyListeners(): void {
    // We assume the first voice's position for global page index
    const firstVoice = this.voiceData.voices[0];
    const pageIndex = this.voiceData.voiceMetadata[firstVoice]?.currentPosition || 0;
    const currentCanvases = this.getCurrentCanvases();

    this.listeners.forEach(listener => listener(pageIndex, currentCanvases));
  }

  /**
   * Navigiert zur nächsten Seite
   * @param {DispatchFunction} dispatch - Redux dispatch Funktion
   * @returns {boolean} - true wenn Navigation erfolgreich
   */
  public navigateNext(dispatch: DispatchFunction): boolean {
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
    this.notifyListeners();
    return true;
  }

  /**
   * Navigiert zur vorherigen Seite
   * @param {DispatchFunction} dispatch - Redux dispatch Funktion
   * @returns {boolean} - true wenn Navigation erfolgreich
   */
  public navigatePrevious(dispatch: DispatchFunction): boolean {
    Object.keys(this.voiceData.voiceMetadata).forEach((voiceName) => {
      const meta = this.voiceData.voiceMetadata[voiceName];
      // Nur verringern, wenn wir nicht am Anfang der Stimme sind
      if (meta.currentPosition > 0) {
        meta.currentPosition -= 1;
      } 
    });

    if (this.syncEnabled) {
      this.updateAllWindows(dispatch);
    }
    this.notifyListeners();
    return true;
  }

  public navigateLast(dispatch: DispatchFunction): boolean {
    Object.keys(this.voiceData.voiceMetadata).forEach((voiceName) => {
      const meta = this.voiceData.voiceMetadata[voiceName];
      meta.currentPosition = this.voiceData.voiceMapping[voiceName].length - 1;
    });

    if (this.syncEnabled) {
      this.updateAllWindows(dispatch);
    }
    this.notifyListeners();
    return true;
  }

  /**
   * Navigiert zu einer bestimmten Seite
   * @param {number} pageIndex - Ziel-Seitenindex (0-basiert)
   * @param {DispatchFunction} dispatch - Redux dispatch Funktion
   * @returns {boolean} - true wenn Navigation erfolgreich
   */
  public navigateToPage(pageIndex: number, dispatch: DispatchFunction): boolean {
    if (pageIndex < 0 || pageIndex >= this.voiceData.minPages) {
      console.warn(`SyncController: Ungültiger Seitenindex: ${pageIndex}`);
      return false;
    }

    Object.keys(this.voiceData.voiceMetadata).forEach((voiceName) => {
      const meta = this.voiceData.voiceMetadata[voiceName];
      meta.currentPosition = Math.min(pageIndex, meta.pageCount - 1);
    });

    if (this.syncEnabled) {
      this.updateAllWindows(dispatch);
    }
    this.notifyListeners();
    return true;
  }

  public navigateToWork(workId: number, dispatch: DispatchFunction): boolean {
    const work = this.voiceData.workMetadata[workId];
    if (!work) {
      return false;
    } 

    Object.keys(this.voiceData.voiceMetadata).forEach((voiceName) => {
      const meta = this.voiceData.voiceMetadata[voiceName];
      const offset = work.occurrences[voiceName]?.offset;

      if (offset !== undefined && meta !== undefined) {
        meta.currentPosition = Math.min(offset, meta.pageCount - 1);
      }
    });

    if (this.syncEnabled) {
      this.updateAllWindows(dispatch);
    }
    this.notifyListeners();
    return true;
  }

  /**
   * Aktualisiert alle gemappten Windows mit den aktuellen Canvases
   * @param {DispatchFunction} dispatch - Redux dispatch Funktion
   */
  public updateAllWindows(dispatch: DispatchFunction): void {
    const canvases = this.getCurrentCanvases();

    // Update standard window if it exists
    if (this.standardWindowId) {
      const firstVoice = this.voiceData.voices[0];
      const canvasId = canvases[firstVoice];
      if (canvasId) {
        dispatch({
          type: "mirador/SET_CANVAS",
          windowId: this.standardWindowId,
          canvasId,
        });
      }
    }

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
   * @returns {CanvasesForPage} - Map von Stimme zu Canvas-ID
   */
  public getCurrentCanvases(): CanvasesForPage {
    return getCanvasesForCurrentPosition(this.voiceData);
  }

  /**
   * Gibt die Gesamtanzahl der Seiten zurück
   * @returns {number}
   */
  public getTotalPages(): number {
    return this.voiceData.minPages;
  }

  /**
   * Aktiviert oder deaktiviert die Synchronisation
   * @param {boolean} enabled
   */
  public setSyncEnabled(enabled: boolean): void {
    this.syncEnabled = enabled;
  }

  /**
   * Prüft ob Synchronisation aktiviert ist
   * @returns {boolean}
   */
  public isSyncEnabled(): boolean {
    return this.syncEnabled;
  }

  /**
   * Gibt die Liste der Stimmen zurück
   * @returns {string[]}
   */
  public getVoices(): string[] {
    return this.voiceData.voices;
  }

  public getCanvasesForVoice(voiceName: string): string[] {
    return this.voiceData.voiceMapping[voiceName] || [];
  }

  public getVoice(windowId: string): string | undefined {
    const voices = this.windowIdToVoiceMapping[windowId];
    return voices && voices.length > 0 ? voices[0] : undefined;
  }

  /**
   * Gibt Metadaten für eine bestimmte Stimme zurück
   * @param {string} voiceName - Name der Stimme
   * @returns {VoiceMetadata | null}
   */
  public getVoiceMetadata(voiceName: string): VoiceMetadata | null {
    return this.voiceData.voiceMetadata[voiceName] || null;
  }

  public getVoiceData(): VoiceData {
    return this.voiceData;
  }

  /**
   * Gibt Debugging-Informationen zurück
   * @returns {DebugInfo}
   */
  public getDebugInfo(): DebugInfo {
    const firstVoice = this.voiceData.voices[0];
    const currentPageNumber = (this.voiceData.voiceMetadata[firstVoice]?.currentPosition || 0) + 1;

    return {
      currentPageNumber,
      totalPages: this.getTotalPages(),
      syncEnabled: this.syncEnabled,
      voices: this.getVoices(),
      windowMapping: this.windowMapping,
    };
  }
}

export default SyncController;
