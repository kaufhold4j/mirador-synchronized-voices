// ============================================================================
// src/types/index.ts
// Zentrale Type-Definitionen für das Plugin
// ============================================================================

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

/**
 * VoiceDetector Types
 */
export interface VoiceData {
  voices: string[];
  voiceMapping: VoiceMapping;
  voiceMetadata: VoiceMetadataMap;
  workMetadata: WorkMetadataMap;
  totalPages: number;
  minPages: number;
  hasVariableLength: boolean;
}

export interface VoiceMapping {
  [voiceName: string]: string[]; // Canvas-IDs
}

export interface VoiceMetadataMap {
  [voiceName: string]: VoiceMetadata;
}

export interface VoiceMetadata {
  rangeId: string;
  index: number;
  startIndex: number;
  endIndex: number;
  pageCount: number;
  currentPosition: number;
}

export interface WorkMetadataMap {
  [werkId: number]: WorkMetadata;
}

export interface WorkMetadata {
  werkId: number;
  label: string;
  occurrences: WorkOccurrences;
}

export interface WorkOccurrences {
  [voiceName: string]: {
    offset: number;
    rangeIndex?: number;
  };
}

/**
 * WindowManager Types
 */
export interface WindowConfig {
  id: string;
  manifestId: string;
  canvasId: string;
  voiceName: string;
  layoutOrder: number;
  thumbnailNavigationPosition: string;
  view: string;
  companionWindows: any[];
  companionWindowIds: string[];
  allowClose: boolean;
  allowMaximize: boolean;
  allowFullscreen: boolean;
  allowWindowSideBar: boolean;
  sideBarPanel: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface WindowManagerOptions {
  windowIdPrefix?: string;
  thumbnailNavigationPosition?: string;
  allowClose?: boolean;
  allowMaximize?: boolean;
  allowWindowSideBar?: boolean;
  view?: string;
}

export interface WindowMapping {
  [voiceName: string]: string; // windowId
}

export interface LayoutInfo {
  rows: number;
  cols: number;
  layoutType: string;
  voiceCount: number;
  windowCount: number;
}

export type MosaicNode = {
  direction: 'row' | 'column';
  splitPercentage?: number;
  first: MosaicNode | string;
  second: MosaicNode | string;
} | string;

/**
 * SyncController Types
 */
export interface CanvasMap {
  [canvasId: string]: IIIFCanvas;
}

export interface ViewportPayload {
  x: number;
  y: number;
  zoom: number;
}

export type PageChangeListener = (pageIndex: number, canvases: CanvasesForPage) => void;

export interface CanvasesForPage {
  [voiceName: string]: string; // canvasId
}

export interface DebugInfo {
  currentPageNumber?: number;
  totalPages: number;
  syncEnabled: boolean;
  voices: string[];
  windowMapping: WindowMapping;
  canNavigateNext?: boolean;
  canNavigatePrevious?: boolean;
}

/**
 * Redux Action Types
 */
export interface SetCanvasAction {
  type: 'mirador/SET_CANVAS';
  windowId: string;
  canvasId: string;
}

export interface AddWindowAction {
  type: 'mirador/ADD_WINDOW';
  window: WindowConfig;
}

export interface RemoveWindowAction {
  type: 'mirador/REMOVE_WINDOW';
  windowId: string;
}

export interface UpdateWindowAction {
  type: 'mirador/UPDATE_WINDOW';
  windowId: string;
  payload: Partial<WindowConfig>;
}

export interface UpdateViewportAction {
  type: 'mirador/UPDATE_VIEWPORT';
  windowId: string;
  payload: ViewportPayload;
}

export interface UpdateWorkspaceMosaicLayoutAction {
  type: 'mirador/UPDATE_WORKSPACE_MOSAIC_LAYOUT';
  layout: MosaicNode;
}

export interface InitControllerAction {
  type: 'sync/initController';
  controller: any; // SyncController (circular dependency)
}

export interface AddVoiceWindowsAction {
  type: 'sync/ADD_VOICE_WINDOWS';
  windows: WindowConfig[];
  manifestId: string;
}

export interface VoiceWindowsReadyAction {
  type: 'sync/VOICE_WINDOWS_READY';
  windowIds: string[];
}

export type PluginAction =
  | SetCanvasAction
  | AddWindowAction
  | RemoveWindowAction
  | UpdateWindowAction
  | UpdateViewportAction
  | UpdateWorkspaceMosaicLayoutAction
  | InitControllerAction
  | AddVoiceWindowsAction
  | VoiceWindowsReadyAction;

/**
 * Redux State Types
 */
export interface MiradorWindow {
  id: string;
  manifestId: string;
  canvasId?: string;
  [key: string]: any;
}

export interface MiradorManifest {
  id: string;
  json: IIIFManifest;
  [key: string]: any;
}

export interface SynchronizedVoicesState {
  controller?: any; // SyncController
  windowsReady?: boolean;
  windowIds?: string[];
}

export interface PluginState {
  windows: { [windowId: string]: MiradorWindow };
  manifests: { [manifestId: string]: MiradorManifest };
  config: any;
  synchronizedVoices: SynchronizedVoicesState;
}

/**
 * Component Props Types
 */
export interface SyncNavigationUIProps {
  windows: { [windowId: string]: MiradorWindow };
  manifests: { [manifestId: string]: MiradorManifest };
  config: any;
  setCanvas: (windowId: string, canvasId: string) => void;
  updateViewport: (windowId: string, payload: ViewportPayload) => void;
  addWindow: (window: WindowConfig) => void;
  removeWindow: (windowId: string) => void;
  updateWindow: (windowId: string, payload: Partial<WindowConfig>) => void;
  updateWorkspaceMosaicLayout: (layout: MosaicNode) => void;
  initController: (controller: any) => void;
}

export interface WindowVoiceInfoProps {
  windowId: string;
  canvasId?: string;
  controller?: any; // SyncController
}

/**
 * Dispatch Function Type
 */
export type DispatchFunction = (action: PluginAction) => void;
