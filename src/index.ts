
import { delay, put, select, takeEvery } from 'redux-saga/effects';
import Mirador from 'mirador';

import SyncNavigationUI from './components/SyncNavigationUI';
import WindowVoiceInfo from './components/WindowVoiceInfo';

import { detectSynchronizedVoices } from './services/VoiceDetector';
import { setCanvasForWindow } from  './services/SyncController';

const getViewerForWindow = (state, windowId) => state.viewers[windowId];

const onCanvasChange = function* (action) {
    console.log("onCanvasChange", action);
  const controller = yield select(state => state.synchronizedVoices.controller);

  if (!controller) {
    console.warn("No SyncController found yet.");
    return;
  }
  controller.setCanvasForWindow(action.canvasId, action.windowId);

  // Reset zoom to "fit" after canvas change with a small delay
  /*
  yield delay(100);
  yield put(Mirador.actions.updateViewport(action.windowId, {
    zoom: undefined,
    x: undefined,
    y: undefined,
  }));
*/
}

const onLayoutChange = function* () {

  const windows = yield select(state => state.windows);
  console.log("onLayoutChange", windows);
  if (!windows) return;

    /*
  yield delay(100);
  for (const windowId of Object.keys(windows)) {
      console.log(windowId);
      const viewerState = yield select(getViewerForWindow, windowId);
        if (viewerState && viewerState.osdInstance) {
          viewerState.osdInstance.viewport.goHome();
        } else {
    yield put(Mirador.actions.updateViewport(windowId, {
      zoom: 1,
      x: undefined,
      y: undefined,
    }));
    }

  }
*/


}

const onWindowAdd = function* (action) {
    console.log("onWindowAdd", action);
  const windowId = action.window?.id;
  if (!windowId) return;
/*
  yield delay(100);
  yield put(Mirador.actions.updateViewport(windowId, {
    zoom: undefined,
    x: undefined,
    y: undefined,
  }));
*/
}

const onStartup = function* () {
  const manifestId: string | undefined = yield select((state: any) => state.config?.synchronizedVoices?.manifestId);
  if (manifestId) {
    yield put({
      type: 'mirador/ADD_RESOURCE',
      manifestId,
      manifestJson: null,
    });
  }
}

const pluginSaga = function* () {
  /* `takeEvery` calls the associated function every time the action is dispatched */
  yield takeEvery('mirador/SET_CANVAS', onCanvasChange);
  yield takeEvery('mirador/UPDATE_WORKSPACE_MOSAIC_LAYOUT', onLayoutChange);
  yield takeEvery('mirador/ADD_WINDOW', onWindowAdd);
  yield* onStartup();
}


const SynchronizedVoicesPlugin = {
  target: 'WorkspaceControlPanelButtons',
  mode: 'add',
  name: 'SynchronizedVoicesPlugin',
  saga: pluginSaga,
  component: SyncNavigationUI,
  mapStateToProps: (state) => ({
    windows: state.windows,
    manifests: state.manifests,
    config: state.config,
  }),

  mapDispatchToProps: (dispatch) => ({

    setCanvas: (windowId, canvasId) =>
      dispatch(Mirador.actions.setCanvas(windowId, canvasId)),

    updateViewport: (windowId, payload) =>
      dispatch(Mirador.actions.updateViewport(windowId, payload)),

    addWindow: (window) =>
      dispatch(Mirador.actions.addWindow(window)),

    updateWorkspaceMosaicLayout: (layout) =>
      dispatch(Mirador.actions.updateWorkspaceMosaicLayout(layout)),

    removeWindow: (windowId) =>
      dispatch({ type: 'mirador/REMOVE_WINDOW', windowId }),

    updateWindow: (windowId, payload) =>
      dispatch({ type: 'mirador/UPDATE_WINDOW', windowId, payload }),

    initController: (controller) =>
      dispatch({ type: 'sync/initController', controller }),
  }),
  reducers: {
    synchronizedVoices: (state = {}, action) => {
      switch (action.type) {
        case 'SET_SYNC_MODE':
          return { ...state, syncEnabled: action.enabled };
        case 'SET_VOICE_MAPPING':
          return { ...state, voiceMapping: action.mapping };
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
  mapStateToProps: (state, { windowId }) => {
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

