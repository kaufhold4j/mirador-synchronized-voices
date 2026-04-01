

/**
 * IIIF Manifest Types (vereinfacht)
 */
export interface IIIFManifest {
  '@context': string;
  id: string;
  type: 'Manifest';
  label?: LanguageMap;
  metadata?: Metadata[];
  items: IIIFCanvas[];
  structures?: IIIFRange[];
}

export interface IIIFCanvas {
  id: string;
  type: 'Canvas';
  label?: LanguageMap;
  width: number;
  height: number;
  items?: any[];
}

export interface IIIFRange {
  id: string;
  type: 'Range';
  label?: LanguageMap;
  items?: (string | IIIFRange)[];
  behavior?: string[];
  metadata?: Metadata[];
}

export interface LanguageMap {
  [language: string]: string[];
}

export interface Metadata {
  label: LanguageMap;
  value: LanguageMap;
}
