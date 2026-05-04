import React, { useState, useEffect, useCallback } from "react";

import { Popover, List, ListItem, ListItemButton, ListItemText, Checkbox, ListItemIcon } from "@mui/material";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";

import {
  Box,
  Paper,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";

import { useTheme } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { Typography } from "@mui/material";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";

import {
  detectSynchronizedVoices,
} from "../services/VoiceDetector";
import SyncController from "../services/SyncController";
import WindowManager from "../services/WindowManager";
import {
  SyncNavigationUIProps,
  VoiceData,
  WorkMetadataMap,
  PluginAction,
  ISyncController,
  IIIFManifest
} from "../types";

/**
 * SyncNavigationUI Component
 * Haupt-UI für synchronisierte Navigation zwischen Stimmen
 */
const SyncNavigationUI: React.FC<SyncNavigationUIProps> = ({
  windows,
  manifests,
  config: _config,
  setCanvas,
  updateViewport,
  addWindow,
  removeWindow,
  updateWindow,
  updateWorkspaceMosaicLayout,
  initController,
}) => {
  const theme = useTheme();

  // State
  const [syncController, setSyncController] = useState<ISyncController | null>(null);
  const [windowManager, setWindowManager] = useState<WindowManager | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [works, setWorks] = useState<WorkMetadataMap>({});
  const [voiceData, setVoiceData] = useState<VoiceData | null>(null);
  const [enabledVoices, setEnabledVoices] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [voiceAnchorEl, setVoiceAnchorEl] = useState<HTMLButtonElement | null>(null);
  // Neuer State für den View-Mode
  const [isVoiceMode, setIsVoiceMode] = useState<boolean>(false);
  const [originalWindowId, setOriginalWindowId] = useState<string | null>(null);

  // Dispatch-Funktion die die Props nutzt
  const dispatch = useCallback(
    (action: PluginAction) => {
      switch (action.type) {
        case "mirador/SET_CANVAS":
          if (setCanvas) {
            setCanvas(action.windowId, action.canvasId);
          }
          break;
        case "mirador/UPDATE_VIEWPORT":
          if (updateViewport) {
            updateViewport(action.windowId, action.payload);
          }
          break;
        case "mirador/ADD_WINDOW":
          if (addWindow) {
            addWindow(action.window);
          } 
          break;
        case "mirador/REMOVE_WINDOW":
          if (removeWindow) {
            removeWindow(action.windowId);
          }
          break;
        case "mirador/UPDATE_WINDOW":
          if (updateWindow) {
            updateWindow(action.windowId, action.payload);
          }
          break;
        case "mirador/UPDATE_WORKSPACE_MOSAIC_LAYOUT":
          if (updateWorkspaceMosaicLayout) {
            updateWorkspaceMosaicLayout(action.layout);
          }
          break;
        case "sync/initController":
          if (initController) {
            initController(action.controller);
          }
          break;
        default:
          console.log("Unhandled action:", action.type);
      }
    },
    [
      setCanvas,
      updateViewport,
      addWindow,
      removeWindow,
      updateWindow,
      updateWorkspaceMosaicLayout,
      initController,
    ]
  );

  /**
   * Initialisierung: Suche nach synchronized-voices Manifest
   */
  useEffect(() => {
    // Reset State
    setIsInitialized(false);
    setError(null);

    // Finde erstes Manifest mit synchronized-voices
    const manifestEntry = Object.entries(manifests || {}).find(
      ([, manifestData]) => {
        const manifest = manifestData?.json;
        if (!manifest) return false;

        const result = detectSynchronizedVoices(manifest as IIIFManifest);
        if (result) {
          setWorks(result.workMetadata);
        }
        return result !== null;
      }
    );

    if (!manifestEntry) {
      setError("Kein Stimmbuch-Manifest gefunden");
      return;
    }

    const [manifestId, manifestData] = manifestEntry;
    const manifest = (manifestData?.json || manifestData) as IIIFManifest;
    const detectedVoiceData = detectSynchronizedVoices(manifest) as VoiceData;
    setVoiceData(detectedVoiceData);
    setEnabledVoices(detectedVoiceData.voices);

async function initialize() {
  if (isInitialized || windowManager) return;
  try {
    // 1. Originales Window-ID merken (nicht entfernen!)
    const originalWindow = Object.values(windows || {}).find((w: any) =>
      w.manifestId === manifestId && !w.id.startsWith('voice-window')
    ) as any;
    if (originalWindow) {
      setOriginalWindowId(originalWindow.id);
    }

    // 2. WindowManager erstellen (aber noch keine Windows hinzufügen)
    const wm = new WindowManager(detectedVoiceData, manifestId, {
      windowIdPrefix: 'voice-window',
      allowClose: false,
      allowMaximize: false,
      allowWindowSideBar: false,
      thumbnailNavigationPosition: 'off',
    });
    wm.createWindows(0);

    // 3. SyncController erstellen
    const sc = new SyncController(manifest, detectedVoiceData);
    sc.addPageChangeListener((pageIndex) => {
      setCurrentPage(pageIndex + 1);
    });

    // 4. State setzen — aber isVoiceMode bleibt false
    setWindowManager(wm);
    setSyncController(sc);
    setCurrentPage(1);
    setIsInitialized(true);

  } catch (err: any) {
    setError(`Initialisierungsfehler: ${err.message}`);
  }
}

    initialize();

    // Cleanup
    return () => {
      // Logic for cleanup handled by Redux or parent if needed
    };
  }, [manifests, dispatch, removeWindow]); // added removeWindow to dependencies

  useEffect(() => {
    if (!syncController) {
      return;
    }

    dispatch({
      type: "sync/initController",
      controller: syncController,
    });
  }, [syncController, dispatch]);

  useEffect(() => {
    if (!syncController || !isInitialized || !windowManager) return;

    const workspace = document.querySelector(".mirador-workspace-viewport");
    if (!workspace) return;

    const observer = new ResizeObserver(() => {
      // 1. Recalculate Mosaic layout based on new viewport dimensions
      const windowConfigs = windowManager.getWindowConfigs();
      const ids = windowConfigs.map((c) => c.id);
      const layout = windowManager._buildMosaicLayout(ids);
      if (layout) {
        dispatch({ type: "mirador/UPDATE_WORKSPACE_MOSAIC_LAYOUT", layout });
      }
    });

    observer.observe(workspace);
    return () => observer.disconnect();
  }, [syncController, windowManager, isInitialized, dispatch]);

  /**
   * Navigation Handlers
   */
  const handleNext = useCallback(() => {
    if (syncController) {
      syncController.navigateNext(dispatch);
    }
  }, [syncController, dispatch]);

  const handlePrev = useCallback(() => {
    if (syncController) {
      syncController.navigatePrevious(dispatch);
    }
  }, [syncController, dispatch]);

  const handleFirst = useCallback(() => {
    if (syncController) {
      syncController.navigateToPage(0, dispatch);
    }
  }, [syncController, dispatch]);

  const handleLast = useCallback(() => {
    if (syncController) {
      syncController.navigateLast(dispatch);
    }
  }, [syncController, dispatch]);

  const handleJumpToWork = useCallback(
    (id: number) => {
      if (syncController) {
        syncController.navigateToWork(id, dispatch);
      }
    },
    [syncController, dispatch]
  );

  const handleToggleVoice = useCallback((voiceName: string) => {
    if (!windowManager || !syncController) return;

    const isEnabled = enabledVoices.includes(voiceName);
    const newEnabledVoices = isEnabled
      ? enabledVoices.filter(v => v !== voiceName)
      : [...enabledVoices, voiceName];

    if (newEnabledVoices.length === 0) return; // Mindestens eine Stimme muss aktiv bleiben

    setEnabledVoices(newEnabledVoices);

    if (isEnabled) {
      windowManager.removeVoiceWindow(voiceName, dispatch);
    } else {
      windowManager.addVoiceWindow(voiceName, currentPage - 1, dispatch);
    }

    // Update SyncController mapping
    syncController.setWindowMapping(windowManager.getWindowMapping());

    // Update Mosaic layout
    const windowConfigs = windowManager.getWindowConfigs();
    const ids = windowConfigs.map((c) => c.id);
    const layout = windowManager._buildMosaicLayout(ids);
    if (layout) {
      dispatch({ type: "mirador/UPDATE_WORKSPACE_MOSAIC_LAYOUT", layout });
    }
  }, [windowManager, syncController, enabledVoices, currentPage, dispatch]);


const handleToggleViewMode = useCallback(async () => {
  if (!windowManager || !syncController) return;

  if (!isVoiceMode) {
    // ── Normal → Voice ──────────────────────────────────────────

    // 1. Originales Fenster entfernen
    if (originalWindowId) {
      removeWindow(originalWindowId);
    }

    // 2. Alle evtl. noch vorhandenen Voice-Windows entfernen
    Object.keys(windows || {})
      .filter(id => id.startsWith('voice-window'))
      .forEach(id => removeWindow(id));

    // 3. Mosaic-Layout komplett zurücksetzen
    updateWorkspaceMosaicLayout(null);

    // 4. Warten bis Mirador State + Mosaic sauber sind
    await new Promise(resolve => setTimeout(resolve, 300));

    // 5. Voice-Windows frisch hinzufügen
    await windowManager.addWindowsToMirador(dispatch, []);

    // 6. SyncController-Mapping aktualisieren
    syncController.setWindowMapping(windowManager.getWindowMapping());
    dispatch({ type: 'sync/initController', controller: syncController });

    setIsVoiceMode(true);

  } else {
    // ── Voice → Normal ──────────────────────────────────────────

    // 1. Alle Voice-Windows entfernen
    windowManager.removeAllWindows(dispatch);

    windowManager.createWindows(currentPage - 1);

    // 2. Mosaic-Layout zurücksetzen
    updateWorkspaceMosaicLayout(null);

    // 3. Warten
    await new Promise(resolve => setTimeout(resolve, 300));

    // 4. Originales Fenster wiederherstellen
    if (originalWindowId) {
      const manifestEntry = Object.entries(manifests || {}).find(
        ([, m]) => detectSynchronizedVoices((m as any)?.json as IIIFManifest)
      );
      if (manifestEntry) {
        const [manifestId] = manifestEntry;
        const firstVoice = voiceData?.voices[0];
        const currentCanvasId = firstVoice
          ? voiceData?.voiceMapping[firstVoice][currentPage - 1]
          : undefined;

        addWindow({
          id: originalWindowId,
          manifestId,
          canvasId: currentCanvasId,
          allowClose: true,
          allowMaximize: true,
          allowWindowSideBar: true,
          thumbnailNavigationPosition: 'off',
          view: 'single',
        });
      }
    }

    setIsVoiceMode(false);
  }
}, [
  isVoiceMode, windowManager, syncController,
  originalWindowId, dispatch, removeWindow, addWindow,
  updateWorkspaceMosaicLayout, manifests, voiceData, currentPage, windows
]);

  const openPopover = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const closePopover = () => {
    setAnchorEl(null);
  };

  const openVoicePopover = (event: React.MouseEvent<HTMLButtonElement>) => {
    setVoiceAnchorEl(event.currentTarget);
  };

  const closeVoicePopover = () => {
    setVoiceAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const voiceOpen = Boolean(voiceAnchorEl);
  const hasWorks = works && Object.keys(works).length > 0;

  /**
   * Render: Error State
   */
  if (error) {
    return (
      <Paper
        elevation={2}
        sx={{
          p: 2,
          m: 2,
          bgcolor: "#fff3cd",
          borderLeft: "4px solid #ffc107",
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <InfoIcon color="warning" />
          <Typography variant="body2" color="text.secondary">
            {error}
          </Typography>
        </Box>
      </Paper>
    );
  }

  /**
   * Render: Loading State
   */
  if (!isInitialized) {
    return (
      <Paper elevation={2} sx={{ p: 2, m: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Lade Stimmen-Ansicht...
        </Typography>
      </Paper>
    );
  }

  /**
   * Render: Main UI
   */
  return (
    <Stack
      alignItems="center"
      spacing={0.5}
      sx={{
        paddingRight: theme.spacing(1),
        borderRadius: 1,
      }}
    >
      {/* Sync-Toggle */}
     <Divider flexItem />

     {/* View-Mode Toggle */}
     <Tooltip title={isVoiceMode ? 'Zur Normalansicht' : 'Stimmen-Ansicht'} arrow>
       <IconButton
         size="small"
         onClick={handleToggleViewMode}
         disabled={!isInitialized}
         sx={{
           color: isVoiceMode ? theme.palette.primary.main : 'inherit',
           bgcolor: isVoiceMode ? theme.palette.primary.light + '33' : 'transparent',
         }}
       >
         <RecordVoiceOverIcon fontSize="small" />
       </IconButton>
     </Tooltip>

     <Divider flexItem />

      {/* Blätter-Buttons */}
      <Tooltip title="erste Seite" arrow>
        <IconButton size="small" onClick={handleFirst}>
          <KeyboardDoubleArrowLeftIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 2,
          p: 0.5,
          mb: 1,
        }}
      >
        <Tooltip title="Vorherige Seite" arrow>
          <IconButton size="small" onClick={handlePrev}>
            <NavigateBeforeIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        <Tooltip title="Nächste Seite" arrow>
          <IconButton size="small" onClick={handleNext}>
            <NavigateNextIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Tooltip title="letzte Seite" arrow>
        <IconButton size="small" onClick={handleLast}>
          <KeyboardDoubleArrowRightIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider flexItem />




      <div>
        <Tooltip title="Stimmen auswählen">
          <span>
            <IconButton
              onClick={openVoicePopover}
              size="large"
              style={{
                marginLeft: 8,
                minWidth: 36,
                padding: "10px 8px",
              }}
            >
              <RecordVoiceOverIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Popover
          open={voiceOpen}
          anchorEl={voiceAnchorEl}
          onClose={closeVoicePopover}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "left",
          }}
          PaperProps={{
            style: {
              maxHeight: 400,
              maxWidth: 250,
              overflowY: "auto",
              padding: 0,
            },
          }}
        >
          <Paper square style={{ width: 250 }}>
            <List dense>
              {voiceData?.voices.map((voiceName) => (
                <ListItem
                  key={voiceName}
                  disablePadding
                >
                  <ListItemButton
                    onClick={() => handleToggleVoice(voiceName)}
                  >
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={enabledVoices.includes(voiceName)}
                        disableRipple
                        disabled={enabledVoices.length === 1 && enabledVoices.includes(voiceName)}
                      />
                    </ListItemIcon>
                    <ListItemText primary={voiceName} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Popover>

        <Tooltip title={hasWorks ? "Werke anzeigen" : "Keine Werke vorhanden"}>
          <span>
            <IconButton
              onClick={openPopover}
              size="large"
              disabled={!hasWorks}
              style={{
                marginLeft: 8,
                minWidth: 36,
                padding: "10px 8px",
              }}
            >
              <LibraryMusicIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={closePopover}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "left",
          }}
          PaperProps={{
            style: {
              maxHeight: 400,
              maxWidth: 350,
              overflowY: "auto",
              padding: 0,
            },
          }}
        >
          <Paper square style={{ width: 350 }}>
            <List dense>
              {Object.values(works).map((work) => (
                <ListItem
                  key={work.werkId}
                  disablePadding
                >
                  <ListItemButton
                    onClick={() => {
                      closePopover();
                      handleJumpToWork(work.werkId);
                    }}
                  >
                    <ListItemText
                      primary={work.label}
                      secondary={`Stimmen: ${Object.keys(work.occurrences).join(", ")}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Popover>
      </div>
    </Stack>
  );
};

export default SyncNavigationUI;
