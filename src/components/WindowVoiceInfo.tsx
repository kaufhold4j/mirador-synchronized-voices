// WindowVoiceInfo.js
import React from "react";

export default function WindowVoiceInfo({ windowId, canvasId, controller }) {

  if (!controller) {
    return;
  }
  // Stimme extrahieren
  const voiceName = controller.getVoice(windowId);
  const voiceData = controller.getVoiceData();
  if(!voiceData) return;
  const meta = voiceData.voiceMetadata[voiceName];
  if (!meta) return;
  const canvases = controller.getCanvasesForVoice(voiceName);
  const pageIndex = canvases.indexOf(canvasId);
  const pageNumber = pageIndex >= 0 ? pageIndex + 1 : "?";

  const works = voiceData.workMetadata;
  let workPageIndex = "-";
  let workLabel = "-";

   Object.keys(works).forEach(function (key) {
     const work = works[key];

     const occurrence = work.occurrences[voiceName];
     if ( !occurrence || occurrence.offset > pageIndex){
        return;
     }
     workPageIndex = pageNumber - occurrence.offset;
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
