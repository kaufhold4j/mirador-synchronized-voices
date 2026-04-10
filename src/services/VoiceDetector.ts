/**
 * VoiceDetector Service
 * Analysiert IIIF Manifests und extrahiert Informationen über synchronisierte Stimmen
 */

/**
 * Extrahiert ein Label aus IIIF v3 LanguageMap
 */
function extractLabel(label) {
  if (!label) return null;
  if (typeof label === 'string') return label;

  if (label.none && Array.isArray(label.none) && label.none.length > 0) {
    return label.none[0];
  }

if (label.de && Array.isArray(label.de) && label.de.length > 0) {
    return label.de[0];
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
export const detectSynchronizedVoices = (manifest) => {
  if (!manifest) {
    return null;
  }

  if (!Array.isArray(manifest.structures) || manifest.structures.length === 0) {
    console.warn("VoiceDetector: Manifest hat keine structures", manifest.id);
    return null;
  }

  // 1. Stimmen-Ranges anhand des Labels erkennen
  // Wir schauen in structures[0].items
  if (!Array.isArray(manifest.structures[0].items)) {
     console.warn("VoiceDetector: structures[0] hat keine items", manifest.id);
     return null;
  }

  const voiceRanges = manifest.structures[0].items.filter((range) => {
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

  // Sortieren nach ID (bei dir entspricht das der Buchreihenfolge) canvases
   voiceRanges.sort((a, b) => canvasIds.indexOf(a.id) - canvasIds.indexOf(b.id));

  if (canvasIds.length === 0) {
    console.error("VoiceDetector: Manifest hat keine Canvas");
    return null;
  }

  const voiceMapping = {};
  const voiceMetadata = {};

  // 3. Für jede Stimme Start- und Endbereiche bestimmen
  for (let i = 0; i < voiceRanges.length; i++) {
    const range = voiceRanges[i];
    const fullLabel = extractLabel(range.label);
    const voiceName = fullLabel.replace("Stimme:", "").trim();

    // Startcanvas = erstes Canvas in range.items
    const startCanvasId = range.items && range.items.length
      ? range.items[0]
      : null;

    if (!startCanvasId) {
      console.warn(`VoiceDetector: Stimme "${voiceName}" hat kein start Canvas`);
      continue;
    }

    const startIndex = canvasIds.indexOf(startCanvasId.id);
    if (startIndex < 0) {
      continue;
    }

    // Endindex = Start der nächsten Stimme ODER Ende des Buches
    const endIndex =
      i + 1 < voiceRanges.length
        ? canvasIds.indexOf(voiceRanges[i + 1].items?.[0]?.id)
        : canvasIds.length;

    const canvases = canvasIds.slice(startIndex, endIndex);

    voiceMapping[voiceName] = canvases;
    voiceMetadata[voiceName] = {
      rangeId: range.id,
      index: i,
      startIndex,
      endIndex: endIndex - 1,
      pageCount: canvases.length,
      currentPosition: 1,
    };
  }

  const voices = Object.keys(voiceMapping);
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
 * @param {Object} manifest - IIIF v3 Manifest
 * @param {Object} voiceData - Ergebnis von detectSynchronizedVoices
 * @returns {Object} works – keyed nach WerkId (Zahl)
 */
export function detectWorksPerVoice(manifest, voiceMetadata, voices, voiceMapping) {    
  if (!manifest.structures || !Array.isArray(manifest.structures)) {
    console.warn("detectWorksPerVoice: Keine structures im Manifest");
    return {};
  }

  const works = {}; // key = werkId (z.B. 2)

  manifest.structures[0].items.forEach((range) => {
    const rawLabel = extractLabel(range.label);
    if (!rawLabel.startsWith("[Werk")) return;

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
        occurrences: {},   // voiceName → { startIndex, endIndex }
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

    //const voices = voiceData.voices;
    const voiceMeta = voiceMetadata;

    // Stimme finden, zu der dieser Werk-Range gehört
    // anhand der Range-Positionen
    let foundVoice = null;

    for (const voiceName of voices) {
      const vMeta = voiceMeta[voiceName];

      const voiceCanvses = voiceMapping[voiceName];
      const offset = voiceCanvses.indexOf(range.items[0].id);
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
 * @param {Object} manifest - IIIF Manifest
 * @returns {boolean}
 */
export const hasSynchronizedVoices = (manifest) => {
  return detectSynchronizedVoices(manifest) !== null;
};

/**
 * Hilfsfunktion: Gibt Canvas-ID für bestimmte Stimme und Seite zurück
 * @param {Object} voiceData - Ergebnis von detectSynchronizedVoices()
 * @param {string} voiceName - Name der Stimme
 * @param {number} pageIndex - Seiten-Index (0-basiert)
 * @returns {string|null} Canvas-ID oder null
 */
export const getCanvasForVoiceAndPage = (voiceData, voiceName, pageIndex) => {
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
 * @param {Object} voiceData - Ergebnis von detectSynchronizedVoices()
 * @param {number} pageIndex - Seiten-Index (0-basiert)
 * @returns {Object} - Map von Stimme zu Canvas-ID
 */
export const getCanvasesForPage = (voiceData, pageIndex) => {
  if (!voiceData || !voiceData.voiceMapping) {
    return {};
  }

  const result = {};
  Object.entries(voiceData.voiceMapping).forEach(([voiceName, canvases]) => {
    if (pageIndex >= 0 && pageIndex < canvases.length) {
      result[voiceName] = canvases[pageIndex];
    }
  });

  return result;
};

export const getCanvasesForCurrentPosition = (voiceData) => {
  if (!voiceData || !voiceData.voiceMapping) {
    return {};
  }

  const result = {};
  Object.entries(voiceData.voiceMapping).forEach(([voiceName, canvases]) => {
    let currentPosition = voiceData.voiceMetadata[voiceName].currentPosition;
    if (currentPosition >= 0 && currentPosition < canvases.length) {
      result[voiceName] = canvases[currentPosition];
    }
  });

  return result;
};

/**
 * Hilfsfunktion: Validiert ob alle Stimmen genug Seiten haben
 * @param {Object} voiceData - Ergebnis von detectSynchronizedVoices()
 * @param {number} requiredPages - Benötigte Seitenanzahl
 * @returns {boolean}
 */
export const validatePageCount = (voiceData, requiredPages) => {
  if (!voiceData || !voiceData.minPages) {
    return false;
  }
  
  return voiceData.minPages >= requiredPages;
};