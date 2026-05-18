import { takeEvery, select, delay } from 'redux-saga/effects';
import {
  PluginState,
  ISyncController,
  SetCanvasAction,
  AddWindowAction
} from './types';

export const OSDReferences = new Map<string, any>();

const onCanvasChange = function* (action: SetCanvasAction): any {
  const controller: ISyncController | undefined = yield select((state: PluginState) => state.synchronizedVoices.controller);

  if (!controller) {
    console.warn("No SyncController found yet.");
    return;
  }
  // daten in sync mit darstellung halten
  controller.setCanvasForWindow(action.canvasId, action.windowId);
}

const onLayoutChange = function* (): any {
  yield delay(100);
  const windows: any = yield select((state: PluginState) => state.windows);
  if (!windows) return;

  Object.keys(windows).forEach(windowId => {
    const viewer = OSDReferences.get(windowId);
    if (viewer && viewer.viewport) {
      viewer.viewport.goHome(true);
    }
  });
}

const onWindowAdd = function* (action: AddWindowAction): any {
  const windowId = action.window?.id;
  if (!windowId) return;
}

export const pluginSaga = function* (): any {
  /* `takeEvery` calls the associated function every time the action is dispatched */
  yield takeEvery('mirador/SET_CANVAS', onCanvasChange);
  yield takeEvery('mirador/UPDATE_WORKSPACE_MOSAIC_LAYOUT', onLayoutChange);
  yield takeEvery('mirador/ADD_WINDOW', onWindowAdd);
}
