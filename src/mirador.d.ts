declare module "mirador" {
  export function viewer(
    config: Record<string, unknown>,
    plugins?: unknown[],
  ): void;

  export const actions: {
    setCanvas: (windowId: string, canvasId: string) => any;
    updateViewport: (windowId: string, payload: any) => any;
    addWindow: (window: any) => any;
    updateWorkspaceMosaicLayout: (layout: any) => any;
    removeWindow: (windowId: string) => any;
    updateWindow: (windowId: string, payload: any) => any;
  };
}
