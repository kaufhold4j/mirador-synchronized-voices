
import { takeEvery, select } from 'redux-saga/effects';

/*
import { setCanvas as setMiradorCanvas,
        addWindow as addMiradorWindow,
        updateViewport as updateMiradorViewport,
        updateWorkspaceMosaicLayout as updateMiradorWorkspaceMosaicLayout} from "mirador/dist/es/src/state/actions";
        */
/*import * as Mirador from 'mirador'; */
import Mirador from 'mirador';

/* const { actions, selectors } = Mirador; */

import SyncNavigationUI from './components/SyncNavigationUI';
import WindowVoiceInfo from './components/WindowVoiceInfo';

import { detectSynchronizedVoices } from './services/VoiceDetector';
import { setCanvasForWindow } from  './services/SyncController';

const onCanvasChange = function* (action) {
  const controller = yield select(state => state.synchronizedVoices.controller);

    if (!controller) {
      console.warn("No SyncController found yet.");
      return;
    }
    controller.setCanvasForWindow( action.canvasId, action.windowId);
}

const pluginSaga = function* () {
  /* `takeEvery` calls the associated function every time the action is dispatched */
  yield takeEvery('mirador/SET_CANVAS', onCanvasChange);
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

