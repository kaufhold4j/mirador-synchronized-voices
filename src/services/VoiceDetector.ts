/**
 * VoiceDetector Service
 * Analysiert IIIF Manifests und extrahiert Informationen über synchronisierte Stimmen
 */

import {
  IIIFManifest,
  LanguageMap,
  VoiceData,
  VoiceMapping,
  VoiceMetadataMap,
  WorkMetadataMap,
  CanvasesForPage,
} from '../types';

/**
 * Extrahiert ein Label aus IIIF v3 LanguageMap
 */
function extractLabel(label: LanguageMap | string | undefined | null): string | null {
  if (!label) return null;
  if (typeof label === 'string') return label;

  if (label.none && Array.isArray(label.none) && label.none.length > 0) {
    return label.none[0];
  }

  if (label.de && Array.isArray(label.de) && label.de.length > 0) {
    return label.de[0];
  }

  // Fallback to first available language
  const keys = Object.keys(label);
  if (keys.length > 0) {
    const firstLang = label[keys[0]];
    if (Array.isArray(firstLang) && firstLang.length > 0) {
      return firstLang[0];
    }
  }

  return null;
}

/**
 * Neuer VoiceDetector:
 * - es gibt keinen synchronisierten Master-Range mehr
 * - jede Stimme ist ein Range mit Label "Stimme: XYZ"
 * - Range.items enthält nur die erste CanvasId der Stimme
 * - Ende der Stimme = nächster Stimmen-Range oder Ende des Buches
 */
export const detectSynchronizedVoices = (manifest: IIIFManifest): VoiceData | null => {
  if (!manifest || !Array.isArray(manifest.structures) || manifest.structures.length === 0) {
    console.warn("VoiceDetector: Manifest hat keine structures");
    return null;
  }

  const firstStructure = manifest.structures[0];
  if (!firstStructure.items) {
    console.warn("VoiceDetector: Erste structure hat keine items");
    return null;
  }

  // 1. Stimmen-Ranges anhand des Labels erkennen
  const voiceRanges = (firstStructure.items as any[]).filter((range) => {
    const label = extractLabel(range.label);
    return label && label.startsWith("Stimme:");
  });

  if (voiceRanges.length === 0) {
    console.warn("VoiceDetector: Keine Stimmen gefunden");
    return null;
  }

  // 2. Alle Canvas IDs im Manifest
  const allCanvas = manifest.items || [];
  const canvasIds = allCanvas.map((c) => c.id);

  if (canvasIds.length === 0) {
    console.error("VoiceDetector: Manifest hat keine Canvas");
    return null;
  }

  // Sortieren nach ID (bei dir entspricht das der Buchreihenfolge) canvases
  voiceRanges.sort((a, b) => {
    const aId = (a.items && a.items.length > 0) ? (typeof a.items[0] === 'string' ? a.items[0] : a.items[0].id) : null;
    const bId = (b.items && b.items.length > 0) ? (typeof b.items[0] === 'string' ? b.items[0] : b.items[0].id) : null;
    return canvasIds.indexOf(aId) - canvasIds.indexOf(bId);
  });

  const voiceMapping: VoiceMapping = {};
  const voiceMetadata: VoiceMetadataMap = {};

  // 3. Für jede Stimme Start- und Endbereiche bestimmen
  for (let i = 0; i < voiceRanges.length; i++) {
    const range = voiceRanges[i];
    const fullLabel = extractLabel(range.label);
    if (!fullLabel) continue;

    const voiceName = fullLabel.replace("Stimme:", "").trim();

    // Startcanvas = erstes Canvas in range.items
    const startCanvasItem = range.items && range.items.length
      ? range.items[0]
      : null;

    if (!startCanvasItem) {
      console.warn(`VoiceDetector: Stimme "${voiceName}" hat kein start Canvas`);
      continue;
    }

    const startCanvasId = typeof startCanvasItem === 'string' ? startCanvasItem : startCanvasItem.id;
    const startIndex = canvasIds.indexOf(startCanvasId);
    if (startIndex < 0) {
      continue;
    }

    // Endindex = Start der nächsten Stimme ODER Ende des Buches
    let nextStartCanvasId: string | null = null;
    if (i + 1 < voiceRanges.length) {
      const nextRange = voiceRanges[i + 1];
      const nextItem = nextRange.items?.[0];
      if (nextItem) {
        nextStartCanvasId = typeof nextItem === 'string' ? nextItem : nextItem.id;
      }
    }

    const endIndex = nextStartCanvasId
      ? canvasIds.indexOf(nextStartCanvasId)
      : canvasIds.length;

    const canvases = canvasIds.slice(startIndex, endIndex);

    voiceMapping[voiceName] = canvases;
    voiceMetadata[voiceName] = {
      rangeId: range.id,
      index: i,
      startIndex,
      endIndex: endIndex - 1,
      pageCount: canvases.length,
      currentPosition: 0, // Changed from 1 to 0 for consistency with 0-based indexing
    };
  }

  const voices = Object.keys(voiceMapping);
  if (voices.length === 0) return null;

  const pageCounts = Object.values(voiceMapping).map((x) => x.length);
  const works = detectWorksPerVoice(manifest, voiceMetadata, voices, voiceMapping);

  return {
    manifest,
    voices,
    voiceMapping,
    voiceMetadata,
    workMetadata: works,
    totalPages: Math.max(...pageCounts),
    minPages: Math.min(...pageCounts),
    hasVariableLength: Math.max(...pageCounts) !== Math.min(...pageCounts),
  };
};


/**
 * Erkennt Werke im Manifest und berechnet Offsets pro Stimme.
 *
 * @param {IIIFManifest} manifest - IIIF v3 Manifest
 * @param {VoiceMetadataMap} voiceMetadata - Metadaten der Stimmen
 * @param {string[]} voices - Liste der Stimmennamen
 * @param {VoiceMapping} voiceMapping - Mapping von Stimmen auf Canvases
 * @returns {WorkMetadataMap} works – keyed nach WerkId (Zahl)
 */
export function detectWorksPerVoice(
  manifest: IIIFManifest,
  _voiceMetadata: VoiceMetadataMap,
  voices: string[],
  voiceMapping: VoiceMapping
): WorkMetadataMap {
  if (!manifest.structures || !Array.isArray(manifest.structures) || manifest.structures.length === 0) {
    console.warn("detectWorksPerVoice: Keine structures im Manifest");
    return {};
  }

  const works: WorkMetadataMap = {}; // key = werkId (z.B. 2)
  const firstStructure = manifest.structures[0];
  if (!firstStructure.items) return {};

  (firstStructure.items as any[]).forEach((range) => {
    const rawLabel = extractLabel(range.label);
    if (!rawLabel || !rawLabel.startsWith("[Werk")) return;

    // ------------------------------------------------------
    // 1. Werknummer extrahieren
    //    Beispiel: "[Werk 2:]" → 2
    // ------------------------------------------------------
    const match = rawLabel.match(/\[Werk\s+(\d+)\s*:/i);
    if (!match) {
      console.warn("detectWorks: Konnte Werknummer nicht extrahieren:", rawLabel);
      return;
    }

    const werkId = parseInt(match[1], 10);

    // Initialer Eintrag pro Werk
    if (!works[werkId]) {
      works[werkId] = {
        werkId,
        label: rawLabel,
        occurrences: {},   // voiceName → { offset, rangeIndex }
      };
    }

    // ------------------------------------------------------
    // 2. Offset innerhalb jeder Stimme bestimmen
    //
    //    Ein Range eines Werks enthält *keine* Canvas-Liste mehr.
    //    Wir müssen also bestimmen:
    //
    //    "In welcher Stimme liegt dieser Range?"
    //    → anhand der Position in der structures-Liste
    //       relativ zu den Stimmenranges.
    // ------------------------------------------------------

    for (const voiceName of voices) {
      const voiceCanvases = voiceMapping[voiceName];
      const firstItem = range.items && range.items.length > 0 ? range.items[0] : null;
      if (!firstItem) continue;

      const firstItemId = typeof firstItem === 'string' ? firstItem : firstItem.id;
      const offset = voiceCanvases.indexOf(firstItemId);
      if (offset >= 0){
        works[werkId].occurrences[voiceName] = {
                 offset,
                 rangeIndex: 0
               };
      }
    }

  });

  return works;
}

/**
 * Hilfsfunktion: Prüft ob ein Manifest synchronisierte Stimmen enthält
 * @param {IIIFManifest} manifest - IIIF Manifest
 * @returns {boolean}
 */
export const hasSynchronizedVoices = (manifest: IIIFManifest): boolean => {
  return detectSynchronizedVoices(manifest) !== null;
};

/**
 * Hilfsfunktion: Gibt Canvas-ID für bestimmte Stimme und Seite zurück
 * @param {VoiceData} voiceData - Ergebnis von detectSynchronizedVoices()
 * @param {string} voiceName - Name der Stimme
 * @param {number} pageIndex - Seiten-Index (0-basiert)
 * @returns {string|null} Canvas-ID oder null
 */
export const getCanvasForVoiceAndPage = (voiceData: VoiceData, voiceName: string, pageIndex: number): string | null => {
  if (!voiceData || !voiceData.voiceMapping) {
    return null;
  }

  const canvases = voiceData.voiceMapping[voiceName];
  if (!canvases || pageIndex < 0 || pageIndex >= canvases.length) {
    return null;
  }

  return canvases[pageIndex];
};

/**
 * Hilfsfunktion: Gibt alle Canvas-IDs für eine bestimmte Seite zurück
 * @param {VoiceData} voiceData - Ergebnis von detectSynchronizedVoices()
 * @param {number} pageIndex - Seiten-Index (0-basiert)
 * @returns {CanvasesForPage} - Map von Stimme zu Canvas-ID
 */
export const getCanvasesForPage = (voiceData: VoiceData, pageIndex: number): CanvasesForPage => {
  if (!voiceData || !voiceData.voiceMapping) {
    return {};
  }

  const result: CanvasesForPage = {};
  Object.entries(voiceData.voiceMapping).forEach(([voiceName, canvases]) => {
    if (pageIndex >= 0 && pageIndex < canvases.length) {
      result[voiceName] = canvases[pageIndex];
    }
  });

  return result;
};

/**
 * Hilfsfunktion: Gibt alle Canvas-IDs für die aktuelle Position zurück
 * @param {VoiceData} voiceData - Ergebnis von detectSynchronizedVoices()
 * @returns {CanvasesForPage} - Map von Stimme zu Canvas-ID
 */
export const getCanvasesForCurrentPosition = (voiceData: VoiceData): CanvasesForPage => {
  if (!voiceData || !voiceData.voiceMapping) {
    return {};
  }

  const result: CanvasesForPage = {};
  Object.entries(voiceData.voiceMapping).forEach(([voiceName, canvases]) => {
    const currentPosition = voiceData.voiceMetadata[voiceName].currentPosition;
    if (currentPosition >= 0 && currentPosition < canvases.length) {
      result[voiceName] = canvases[currentPosition];
    }
  });

  return result;
};

/**
 * Hilfsfunktion: Validiert ob alle Stimmen genug Seiten haben
 * @param {VoiceData} voiceData - Ergebnis von detectSynchronizedVoices()
 * @param {number} requiredPages - Benötigte Seitenanzahl
 * @returns {boolean}
 */
export const validatePageCount = (voiceData: VoiceData, requiredPages: number): boolean => {
  if (!voiceData || !voiceData.minPages) {
    return false;
  }
  
  return voiceData.minPages >= requiredPages;
};
