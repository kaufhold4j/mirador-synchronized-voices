import Mirador from "mirador";

import Plugin from ".";

const config = {
  catalog: [
    {
      manifestId:
        "https://api.digitale-sammlungen.de/iiif-v3/presentation/v3/bsb00083911/manifest",
      provider: "6 stimmen und 17 werke",
    },
    {
      manifestId:
        "https://api.digitale-sammlungen.de/iiif-v3/presentation/v3/bsb00075335/manifest",
      provider: "querformat 4 stimmen, keine werke",
    },
    {
      manifestId:
        "https://api.digitale-sammlungen.de/iiif-v3/presentation/v3/bsb00104653/manifest",
      provider: ", querformat , 4 stimmen , 193 werke",
    },
    {
      manifestId:
        "https://api.digitale-sammlungen.de/iiif-v3/presentation/v3/bsb00071107/manifest",
      provider: "18 Stimmbücher",
    },
  ],
  id: "demo",
  window: {
    allowFullscreen: true,
  },
  windows: [],
  synchronizedVoices: {
    manifestId: "https://api.digitale-sammlungen.de/iiif-v3/presentation/v3/bsb00083911/manifest",
  }
};

Mirador.viewer(config, [...Plugin]);
