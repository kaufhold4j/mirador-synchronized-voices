// WindowVoiceInfo.tsx
import React from "react";
import { WindowVoiceInfoProps } from "../types";

const WindowVoiceInfo: React.FC<WindowVoiceInfoProps> = ({ windowId, canvasId, controller }) => {

  if (!controller || !canvasId) {
    return null;
  }

  // Stimme extrahieren
  const voiceName = controller.getVoice(windowId);
  const voiceData = controller.getVoiceData();
  if(!voiceData || !voiceName) return null;

  const meta = voiceData.voiceMetadata[voiceName];
  if (!meta) return null;

  const canvases = controller.getCanvasesForVoice(voiceName);
  const pageIndex = canvases.indexOf(canvasId);
  const pageNumber = pageIndex >= 0 ? pageIndex + 1 : "?";

  const works = voiceData.workMetadata;
  let workPageIndex: string | number = "-";
  let workLabel: string = "-";

   Object.keys(works).forEach(function (key) {
     const work = works[parseInt(key, 10)];
     if (!work) return;

     const occurrence = work.occurrences[voiceName];
     if ( !occurrence || occurrence.offset > pageIndex){
        return;
     }
     workPageIndex = (pageIndex - occurrence.offset) + 1;
     workLabel = key;
   });

  return (
      <div
        style={{
          padding: "2px 8px",
          fontSize: "1.2em",
          opacity: 0.85,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 500,
        }}
      >
        <span style={{ color: "#333" }}>{voiceName}</span>

        <span style={{ color: "#666" }}>
          {pageNumber}
        </span>

        <span style={{ color: "#aaa" }}>|</span>

        <span style={{ color: "#444" }}>
          Werk {workLabel}:{workPageIndex}
        </span>
      </div>
    );
}

export default WindowVoiceInfo;
