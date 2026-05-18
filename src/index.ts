import Mirador from "mirador";
import { useEffect } from "react";

import SyncNavigationUI from "./components/SyncNavigationUI";
import WindowVoiceInfo from "./components/WindowVoiceInfo";
import { OSDReferences, pluginSaga } from "./sagas";
import {
  ISyncController,
  PluginAction,
  SynchronizedVoicesState,
} from "./types";

const SynchronizedVoicesPlugin = {
  target: "WorkspaceControlPanelButtons",
  mode: "add",
  name: "SynchronizedVoicesPlugin",
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

    addWindow: (window: any) => dispatch(Mirador.actions.addWindow(window)),

    updateWorkspaceMosaicLayout: (layout: any) =>
      dispatch(Mirador.actions.updateWorkspaceMosaicLayout(layout)),

    removeWindow: (windowId: string) =>
      dispatch({ type: "mirador/REMOVE_WINDOW", windowId }),

    updateWindow: (windowId: string, payload: any) =>
      dispatch({ type: "mirador/UPDATE_WINDOW", windowId, payload }),

    initController: (controller: ISyncController) =>
      dispatch({ type: "sync/initController", controller }),
  }),
  reducers: {
    synchronizedVoices: (
      state: SynchronizedVoicesState = {},
      action: PluginAction,
    ) => {
      switch (action.type) {
        case "SET_SYNC_MODE":
          return { ...state, syncEnabled: (action as any).enabled };
        case "SET_VOICE_MAPPING":
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
  target: "WindowTopBarPluginArea",
  mode: "wrap",
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

const OpenSeadragonViewerPluginComponent = ({
  windowId,
  viewer,
}: {
  windowId: string;
  viewer: any;
}) => {
  useEffect(() => {
    if (viewer) {
      OSDReferences.set(windowId, viewer);
    }
    return () => {
      OSDReferences.delete(windowId);
    };
  }, [windowId, viewer]);
  return null;
};

const OpenSeadragonViewerPlugin = {
  target: "OpenSeadragonViewer",
  mode: "add",
  component: OpenSeadragonViewerPluginComponent,
  mapStateToProps: (_state: any, { windowId }: { windowId: string }) => ({
    windowId,
  }),
};

export default [
  SynchronizedVoicesPlugin,
  WindowVoiceInfoPlugin,
  OpenSeadragonViewerPlugin,
];
