import React, { useState, useEffect, useCallback, useMemo } from "react";

import { Popover, List, ListItem, ListItemText } from "@mui/material";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";

import {
  Button,
  Box,
  Switch,
  FormControlLabel,
  Paper,
  Chip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import LastPageIcon from "@mui/icons-material/LastPage";
import SyncDisabledIcon from "@mui/icons-material/SyncDisabled";
import InfoIcon from "@mui/icons-material/Info";

import { useTheme } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import SyncIcon from "@mui/icons-material/Sync";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { Typography } from "@mui/material";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";

import {
  detectSynchronizedVoices,
  detectWorks,
  detectWorksPerVoice,
} from "../services/VoiceDetector";
import SyncController from "../services/SyncController";
import WindowManager from "../services/WindowManager";

/**
 * SyncNavigationUI Component
 * Haupt-UI für synchronisierte Navigation zwischen Stimmen
 */
const SyncNavigationUI = ({
  windows,
  manifests,
  config,
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
  const [syncController, setSyncController] = useState(null);
  const [windowManager, setWindowManager] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [voices, setVoices] = useState([]);
  const [works, setWorks] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  // Dispatch-Funktion die die Props nutzt
  const dispatch = useCallback(
    (action) => {
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
      ([id, manifestData]) => {
        const manifest = manifestData?.json;
        if (!manifest) return false;

        const result = detectSynchronizedVoices(manifest);
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
    const manifest = manifestData?.json || manifestData;
    const voiceData = detectSynchronizedVoices(manifest);

    async function initialize() {
      try {
        // 1. WindowManager erstellen
        const wm = new WindowManager(voiceData, manifestId, {
          windowIdPrefix: "voice-window",
          allowClose: false,
          allowMaximize: false,
          allowWindowSideBar: false,
          thumbnailNavigationPosition: "off",
        });

        // 2. Windows erstellen
        wm.createWindows(0);

        // 3. Windows zu Mirador hinzufügen
        await wm.addWindowsToMirador(dispatch);

        // 4. SyncController erstellen
        const sc = new SyncController(manifest, voiceData);
        sc.setWindowMapping(wm.getWindowMapping());

        // 5. Page-Change-Listener
        sc.addPageChangeListener((pageIndex) => {
          setCurrentPage(pageIndex + 1);
        });

        // 6. State setzen
        setWindowManager(wm);
        setSyncController(sc);
        setVoices(voiceData.voices);
        setTotalPages(voiceData.minPages);
        setCurrentPage(1);
        //sc.autoZoomWindows(dispatch);
        setIsInitialized(true);

      } catch (err) {
        console.error("SyncNavigationUI: Fehler bei Initialisierung:", err);
        setError(`Initialisierungsfehler: ${err.message}`);
      }
    }

    initialize();

    // Cleanup
    return () => {
      if (windowManager) {
        windowManager.removeAllWindows(dispatch);
      }
    };
  }, [manifests, dispatch]); // dispatch zu dependencies hinzugefügt

  useEffect(() => {
    if (!syncController) {
      console.warn("SyncNavigationUI:: SyncController not defined.");
      return;
    }

    dispatch({
      type: "sync/initController",
      controller: syncController,
    });
  }, [syncController, dispatch]);

  useEffect(() => {
    if (!syncController || !isInitialized) return;

    const workspace = document.querySelector(".mirador-workspace-viewport");
    if (!workspace) return;

    const observer = new ResizeObserver(() => {
      syncController.autoZoomWindows(dispatch);
    });

    observer.observe(workspace);
    return () => observer.disconnect();
  }, [syncController, isInitialized, dispatch]);

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

  const toggleSync = useCallback(
    (event) => {
      const enabled = event.target.checked;
      setSyncEnabled(enabled);
      if (syncController) {
        syncController.setSyncEnabled(enabled);
      }
    },
    [syncController]
  );

  const handleJumpToWork = useCallback(
    (id) => {
      if (syncController) {
        syncController.navigateToWork(id, dispatch);
      }
    },
    [syncController, dispatch]
  );

  /**
   * Memoized values für Performance
   */
  const canNavigatePrev = useMemo(() => {
    return true;
  }, [syncController, currentPage]);

  const canNavigateNext = useMemo(() => {
    return true;
  }, [syncController, currentPage]);

  const layoutInfo = useMemo(() => {
    return null;
  }, [windowManager]);

  const openPopover = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const closePopover = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
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
        <Tooltip title={hasWorks ? "Werke anzeigen" : "Keine Werke vorhanden"}>
          <span>
            <IconButton
              onClick={openPopover}
              size="large"
              disabled={!hasWorks}
              style={{
                marginLeft: 8,
                minWidth: 36,
                padding: "20px 8px",
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
              {Object.values(works).map((work, idx) => (
                <ListItem
                  button
                  key={work.id}
                  onClick={() => {
                    closePopover();
                    handleJumpToWork(work.werkId);
                  }}
                >
                  <ListItemText
                    primary={work.label}
                    secondary={`Stimmen: ${Object.keys(work.occurrences)}`}
                  />
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
