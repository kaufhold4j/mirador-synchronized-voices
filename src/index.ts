import { takeEvery, select, put, delay } from 'redux-saga/effects';
import Mirador from 'mirador';

import SyncNavigationUI from './components/SyncNavigationUI';
import WindowVoiceInfo from './components/WindowVoiceInfo';

import {
  PluginAction,
  PluginState,
  ISyncController,
  SynchronizedVoicesState,
  SetCanvasAction,
  AddWindowAction
} from './types';

const onCanvasChange = function* (action: SetCanvasAction): any {
  const controller: ISyncController | undefined = yield select((state: PluginState) => state.synchronizedVoices.controller);

  if (!controller) {
    console.warn("No SyncController found yet.");
    return;
  }
  // daten in sync mit darstellung halten
  controller.setCanvasForWindow(action.canvasId, action.windowId);

  // Viewport anpassen (fit to window)
  yield delay(100);
  yield put(Mirador.actions.updateViewport(action.windowId, {
    x: undefined,
    y: undefined,
    zoom: undefined
  }));
}

const onLayoutChange = function* (): any {
  const windows: any = yield select((state: PluginState) => state.windows);
  if (!windows) return;

  yield delay(100);

  // Alle Stimmen-Fenster anpassen
  for (const windowId of Object.keys(windows)) {
    if (windowId.startsWith('voice-window')) {
      yield put(Mirador.actions.updateViewport(windowId, {
        x: undefined,
        y: undefined,
        zoom: undefined
      }));
    }
  }
}

const onWindowAdd = function* (action: AddWindowAction): any {
  const windowId = action.window?.id;
  if (!windowId || !windowId.startsWith('voice-window')) return;

  yield delay(100);
  yield put(Mirador.actions.updateViewport(windowId, {
    x: undefined,
    y: undefined,
    zoom: undefined
  }));
}

const pluginSaga = function* (): any {
  /* `takeEvery` calls the associated function every time the action is dispatched */
  yield takeEvery('mirador/SET_CANVAS', onCanvasChange);
  yield takeEvery('mirador/UPDATE_WORKSPACE_MOSAIC_LAYOUT', onLayoutChange);
  yield takeEvery('mirador/ADD_WINDOW', onWindowAdd);
}

const SynchronizedVoicesPlugin = {
  target: 'WorkspaceControlPanelButtons',
  mode: 'add',
  name: 'SynchronizedVoicesPlugin',
  saga: pluginSaga,
  component: SyncNavigationUI,
  mapStateToProps: (state: any) => ({
    windows: state.windows,
    manifests: state.manifests,
    config: state.config,
  }),

  mapDispatchToProps: (dispatch: any) => ({
    setCanvas: (windowId: string, canvasId: string) =>
      dispatch(Mirador.actions.setCanvas(windowId, canvasId)),

    updateViewport: (windowId: string, payload: any) =>
      dispatch(Mirador.actions.updateViewport(windowId, payload)),

    addWindow: (window: any) =>
      dispatch(Mirador.actions.addWindow(window)),

    updateWorkspaceMosaicLayout: (layout: any) =>
      dispatch(Mirador.actions.updateWorkspaceMosaicLayout(layout)),

    removeWindow: (windowId: string) =>
      dispatch({ type: 'mirador/REMOVE_WINDOW', windowId }),

    updateWindow: (windowId: string, payload: any) =>
      dispatch({ type: 'mirador/UPDATE_WINDOW', windowId, payload }),

    initController: (controller: ISyncController) =>
      dispatch({ type: 'sync/initController', controller }),
  }),
  reducers: {
    synchronizedVoices: (state: SynchronizedVoicesState = {}, action: PluginAction) => {
      switch (action.type) {
        case 'SET_SYNC_MODE':
          return { ...state, syncEnabled: (action as any).enabled };
        case 'SET_VOICE_MAPPING':
          return { ...state, voiceMapping: (action as any).mapping };
        case "sync/initController":
          return {
            ...state,
            controller: action.controller,
          };
        default:
          return state;
      }
    },
  },
};

const WindowVoiceInfoPlugin = {
  target: 'WindowTopBarPluginArea',
  mode: 'wrap',
  component: WindowVoiceInfo,
  mapStateToProps: (state: any, { windowId }: { windowId: string }) => {
    const window = state.windows[windowId];
    const canvasId = window?.canvasId;
    return {
      windowId,
      canvasId,
      controller: state.synchronizedVoices?.controller,
    };
  },
};

export default [
  SynchronizedVoicesPlugin,
  WindowVoiceInfoPlugin,
];
