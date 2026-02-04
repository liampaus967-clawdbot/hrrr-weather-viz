// Using 'any' for LayerProps to support custom Mapbox layer types like raster-particle
type LayerProps = any;

// GRIB_VALID_TIME values for each forecast hour (Unix timestamps)
export const WIND_TIME_SLICES = {
  HOUR_03: 1763089200, // 03:00 UTC
  HOUR_07: 1763103600, // 07:00 UTC
  HOUR_12: 1763121600, // 12:00 UTC
  HOUR_16: 1763136000, // 16:00 UTC
  HOUR_20: 1763150400, // 20:00 UTC
  HOUR_24: 1763164800, // 24:00 UTC
} as const;

export const windLayer: LayerProps = {
  id: "wind-layer",
  type: "raster-particle",
  source: "particleSource",
  paint: {
    // Select which time slice to display using the GRIB_VALID_TIME value as a STRING
    // Change the number to select different forecast hours
    "raster-particle-array-band": WIND_TIME_SLICES.HOUR_03.toString(), // Default to first time slice
    "raster-particle-speed-factor": 0.4,
    "raster-particle-fade-opacity-factor": 0.9,
    "raster-particle-reset-rate-factor": 0.4,
    "raster-particle-count": 3000,
    "raster-particle-max-speed": 40,
    "raster-particle-color": [
      "interpolate",
      ["linear"],
      ["raster-particle-speed"],
      1.5,
      "rgba(134,163,171,256)",
      2.5,
      "rgba(126,152,188,256)",
      4.12,
      "rgba(110,143,208,256)",
      4.63,
      "rgba(110,143,208,256)",
      6.17,
      "rgba(15,147,167,256)",
      7.72,
      "rgba(15,147,167,256)",
      9.26,
      "rgba(57,163,57,256)",
      10.29,
      "rgba(57,163,57,256)",
      11.83,
      "rgba(194,134,62,256)",
      13.37,
      "rgba(194,134,63,256)",
      14.92,
      "rgba(200,66,13,256)",
      16.46,
      "rgba(200,66,13,256)",
      18.0,
      "rgba(210,0,50,256)",
      20.06,
      "rgba(215,0,50,256)",
      21.6,
      "rgba(175,80,136,256)",
      23.66,
      "rgba(175,80,136,256)",
      25.21,
      "rgba(117,74,147,256)",
      27.78,
      "rgba(117,74,147,256)",
      29.32,
      "rgba(68,105,141,256)",
      31.89,
      "rgba(68,105,141,256)",
      33.44,
      "rgba(194,251,119,256)",
      42.18,
      "rgba(194,251,119,256)",
      43.72,
      "rgba(241,255,109,256)",
      48.87,
      "rgba(241,255,109,256)",
      50.41,
      "rgba(256,256,256,256)",
      57.61,
      "rgba(256,256,256,256)",
      59.16,
      "rgba(0,256,256,256)",
      68.93,
      "rgba(0,256,256,256)",
      69.44,
      "rgba(256,37,256,256)",
    ],
  },
};

export const windMagnitudeLayer: LayerProps = {
  id: "wind_u",
  type: "raster",
  source: "particleSource",
  paint: {
    "raster-opacity": 0,
    "raster-fade-duration": 0,
  },
};

/**
 * Create a Herbie wind layer with a specific band value
 * @param bandValue - The band timestamp string from the tileset (e.g., "1763089200")
 */
export const createHerbieWindLayer = (bandValue: string): LayerProps => {
  const band = String(bandValue);
  console.log("Creating Herbie wind layer with band:", band);

  return {
    id: "herbie-wind-layer",
    type: "raster-particle",
    source: "particleSourceTwo",
    maxzoom: 7, // Stop showing at zoom level 7
    paint: {
      "raster-particle-array-band": band,
      "raster-particle-speed-factor": 0.4,
      "raster-particle-fade-opacity-factor": 0.9,
      "raster-particle-reset-rate-factor": 0.4,
      "raster-particle-count": 3000,
      "raster-particle-max-speed": 40,
      "raster-particle-color": [
        "interpolate",
        ["linear"],
        ["raster-particle-speed"],
        1.5,
        "rgba(100,200,255,256)", // Bright cyan-blue
        2.5,
        "rgba(50,150,255,256)", // Vibrant blue
        4.12,
        "rgba(0,200,255,256)", // Bright sky blue
        4.63,
        "rgba(0,200,255,256)", // Bright sky blue
        6.17,
        "rgba(0,255,200,256)", // Bright turquoise
        7.72,
        "rgba(0,255,200,256)", // Bright turquoise
        9.26,
        "rgba(0,255,100,256)", // Bright green
        10.29,
        "rgba(0,255,100,256)", // Bright green
        11.83,
        "rgba(255,200,0,256)", // Bright yellow-orange
        13.37,
        "rgba(255,180,0,256)", // Bright orange
        14.92,
        "rgba(255,120,0,256)", // Vibrant orange-red
        16.46,
        "rgba(255,120,0,256)", // Vibrant orange-red
        18.0,
        "rgba(255,50,50,256)", // Bright red
        20.06,
        "rgba(255,0,100,256)", // Bright pink-red
        21.6,
        "rgba(255,0,150,256)", // Bright magenta
        23.66,
        "rgba(255,0,150,256)", // Bright magenta
        25.21,
        "rgba(200,0,255,256)", // Bright purple
        27.78,
        "rgba(200,0,255,256)", // Bright purple
        29.32,
        "rgba(150,0,255,256)", // Bright violet
        31.89,
        "rgba(150,0,255,256)", // Bright violet
        33.44,
        "rgba(100,255,200,256)", // Bright mint
        42.18,
        "rgba(100,255,200,256)", // Bright mint
        43.72,
        "rgba(255,255,100,256)", // Bright yellow
        48.87,
        "rgba(255,255,100,256)", // Bright yellow
        50.41,
        "rgba(255,255,255,256)", // White
        57.61,
        "rgba(255,255,255,256)", // White
        59.16,
        "rgba(0,255,255,256)", // Bright cyan
        68.93,
        "rgba(0,255,255,256)", // Bright cyan
        69.44,
        "rgba(255,0,255,256)", // Bright magenta
      ],
    },
  };
};

export const herbieWindMagnitudeLayer: LayerProps = {
  id: "herbie-wind_u",
  type: "raster",
  source: "particleSourceTwo",
  maxzoom: 7, // Stop showing at zoom level 7
  paint: {
    "raster-opacity": 0,
    "raster-fade-duration": 0,
  },
};

/**
 * Create Northeast resampled wind layer with a specific band value
 * @param bandValue - The band timestamp string from the tileset
 */
export const createNortheastWindLayer = (bandValue: string | null): LayerProps => {
  console.log("Creating Northeast wind layer with band:", bandValue);

  // Build paint object dynamically
  const paint: any = {
    "raster-particle-speed-factor": 0.6,
    "raster-particle-fade-opacity-factor": 0.85,
    "raster-particle-reset-rate-factor": 0.3,
    "raster-particle-count": 16000, // Will be updated dynamically based on zoom
    "raster-particle-max-speed": 40,
    "raster-particle-color": [
        "interpolate",
        ["linear"],
        ["raster-particle-speed"],
        1.5,
        "rgba(100,200,255,256)", // Bright cyan-blue
        2.5,
        "rgba(50,150,255,256)", // Vibrant blue
        4.12,
        "rgba(0,200,255,256)", // Bright sky blue
        4.63,
        "rgba(0,200,255,256)", // Bright sky blue
        6.17,
        "rgba(0,255,200,256)", // Bright turquoise
        7.72,
        "rgba(0,255,200,256)", // Bright turquoise
        9.26,
        "rgba(0,255,100,256)", // Bright green
        10.29,
        "rgba(0,255,100,256)", // Bright green
        11.83,
        "rgba(255,200,0,256)", // Bright yellow-orange
        13.37,
        "rgba(255,180,0,256)", // Bright orange
        14.92,
        "rgba(255,120,0,256)", // Vibrant orange-red
        16.46,
        "rgba(255,120,0,256)", // Vibrant orange-red
        18.0,
        "rgba(255,50,50,256)", // Bright red
        20.06,
        "rgba(255,0,100,256)", // Bright pink-red
        21.6,
        "rgba(255,0,150,256)", // Bright magenta
        23.66,
        "rgba(255,0,150,256)", // Bright magenta
        25.21,
        "rgba(200,0,255,256)", // Bright purple
        27.78,
        "rgba(200,0,255,256)", // Bright purple
        29.32,
        "rgba(150,0,255,256)", // Bright violet
        31.89,
        "rgba(150,0,255,256)", // Bright violet
        33.44,
        "rgba(100,255,200,256)", // Bright mint
        42.18,
        "rgba(100,255,200,256)", // Bright mint
        43.72,
        "rgba(255,255,100,256)", // Bright yellow
        48.87,
        "rgba(255,255,100,256)", // Bright yellow
        50.41,
        "rgba(255,255,255,256)", // White
        57.61,
        "rgba(255,255,255,256)", // White
        59.16,
        "rgba(0,255,255,256)", // Bright cyan
        68.93,
        "rgba(0,255,255,256)", // Bright cyan
        69.44,
        "rgba(255,0,255,256)", // Bright magenta
      ],
  };

  // Only add band if we have a valid value (allows fallback to first band)
  if (bandValue) {
    paint["raster-particle-array-band"] = String(bandValue);
  }

  return {
    id: "northeast-wind-layer",
    type: "raster-particle",
    source: "northeastWindSource",
    paint,
  };
};

export const northeastWindMagnitudeLayer: LayerProps = {
  id: "northeast-wind_u",
  type: "raster",
  source: "northeastWindSource",
  paint: {
    "raster-opacity": 0,
    "raster-fade-duration": 0,
  },
};

/**
 * Create Southeast resampled wind layer with a specific band value
 * @param bandValue - The band timestamp string from the tileset
 */
export const createSoutheastWindLayer = (bandValue: string | null): LayerProps => {
  console.log("Creating Southeast wind layer with band:", bandValue);

  const paint: any = {
    "raster-particle-speed-factor": 0.6,
    "raster-particle-fade-opacity-factor": 0.85,
    "raster-particle-reset-rate-factor": 0.3,
    "raster-particle-count": 16000,
    "raster-particle-max-speed": 40,
    "raster-particle-color": [
        "interpolate",
        ["linear"],
        ["raster-particle-speed"],
        1.5,
        "rgba(100,200,255,256)",
        2.5,
        "rgba(50,150,255,256)",
        4.12,
        "rgba(0,200,255,256)",
        4.63,
        "rgba(0,200,255,256)",
        6.17,
        "rgba(0,255,200,256)",
        7.72,
        "rgba(0,255,200,256)",
        9.26,
        "rgba(0,255,100,256)",
        10.29,
        "rgba(0,255,100,256)",
        11.83,
        "rgba(255,200,0,256)",
        13.37,
        "rgba(255,180,0,256)",
        14.92,
        "rgba(255,120,0,256)",
        16.46,
        "rgba(255,120,0,256)",
        18.0,
        "rgba(255,50,50,256)",
        20.06,
        "rgba(255,0,100,256)",
        21.6,
        "rgba(255,0,150,256)",
        23.66,
        "rgba(255,0,150,256)",
        25.21,
        "rgba(200,0,255,256)",
        27.78,
        "rgba(200,0,255,256)",
        29.32,
        "rgba(150,0,255,256)",
        31.89,
        "rgba(150,0,255,256)",
        33.44,
        "rgba(100,255,200,256)",
        42.18,
        "rgba(100,255,200,256)",
        43.72,
        "rgba(255,255,100,256)",
        48.87,
        "rgba(255,255,100,256)",
        50.41,
        "rgba(255,255,255,256)",
        57.61,
        "rgba(255,255,255,256)",
        59.16,
        "rgba(0,255,255,256)",
        68.93,
        "rgba(0,255,255,256)",
        69.44,
        "rgba(255,0,255,256)",
      ],
  };

  if (bandValue) {
    paint["raster-particle-array-band"] = String(bandValue);
  }

  return {
    id: "southeast-wind-layer",
    type: "raster-particle",
    source: "southeastWindSource",
    paint,
  };
};

export const southeastWindMagnitudeLayer: LayerProps = {
  id: "southeast-wind_u",
  type: "raster",
  source: "southeastWindSource",
  paint: {
    "raster-opacity": 0,
    "raster-fade-duration": 0,
  },
};

/**
 * Create Northwest resampled wind layer with a specific band value
 */
export const createNorthwestWindLayer = (bandValue: string | null): LayerProps => {
  const paint: any = {
    "raster-particle-speed-factor": 0.6,
    "raster-particle-fade-opacity-factor": 0.85,
    "raster-particle-reset-rate-factor": 0.3,
    "raster-particle-count": 16000,
    "raster-particle-max-speed": 40,
    "raster-particle-color": [
        "interpolate", ["linear"], ["raster-particle-speed"],
        1.5, "rgba(100,200,255,256)", 2.5, "rgba(50,150,255,256)",
        4.12, "rgba(0,200,255,256)", 6.17, "rgba(0,255,200,256)",
        9.26, "rgba(0,255,100,256)", 11.83, "rgba(255,200,0,256)",
        14.92, "rgba(255,120,0,256)", 18.0, "rgba(255,50,50,256)",
        21.6, "rgba(255,0,150,256)", 25.21, "rgba(200,0,255,256)",
        29.32, "rgba(150,0,255,256)", 33.44, "rgba(100,255,200,256)",
        43.72, "rgba(255,255,100,256)", 50.41, "rgba(255,255,255,256)",
        59.16, "rgba(0,255,255,256)", 69.44, "rgba(255,0,255,256)",
      ],
  };
  if (bandValue) paint["raster-particle-array-band"] = String(bandValue);
  return { id: "northwest-wind-layer", type: "raster-particle", source: "northwestWindSource", paint };
};

export const northwestWindMagnitudeLayer: LayerProps = {
  id: "northwest-wind_u",
  type: "raster",
  source: "northwestWindSource",
  paint: { "raster-opacity": 0, "raster-fade-duration": 0 },
};

/**
 * Create Southwest resampled wind layer with a specific band value
 */
export const createSouthwestWindLayer = (bandValue: string | null): LayerProps => {
  const paint: any = {
    "raster-particle-speed-factor": 0.6,
    "raster-particle-fade-opacity-factor": 0.85,
    "raster-particle-reset-rate-factor": 0.3,
    "raster-particle-count": 16000,
    "raster-particle-max-speed": 40,
    "raster-particle-color": [
        "interpolate", ["linear"], ["raster-particle-speed"],
        1.5, "rgba(100,200,255,256)", 2.5, "rgba(50,150,255,256)",
        4.12, "rgba(0,200,255,256)", 6.17, "rgba(0,255,200,256)",
        9.26, "rgba(0,255,100,256)", 11.83, "rgba(255,200,0,256)",
        14.92, "rgba(255,120,0,256)", 18.0, "rgba(255,50,50,256)",
        21.6, "rgba(255,0,150,256)", 25.21, "rgba(200,0,255,256)",
        29.32, "rgba(150,0,255,256)", 33.44, "rgba(100,255,200,256)",
        43.72, "rgba(255,255,100,256)", 50.41, "rgba(255,255,255,256)",
        59.16, "rgba(0,255,255,256)", 69.44, "rgba(255,0,255,256)",
      ],
  };
  if (bandValue) paint["raster-particle-array-band"] = String(bandValue);
  return { id: "southwest-wind-layer", type: "raster-particle", source: "southwestWindSource", paint };
};

export const southwestWindMagnitudeLayer: LayerProps = {
  id: "southwest-wind_u",
  type: "raster",
  source: "southwestWindSource",
  paint: { "raster-opacity": 0, "raster-fade-duration": 0 },
};

/**
 * Create West Coast resampled wind layer with a specific band value
 */
export const createWestCoastWindLayer = (bandValue: string | null): LayerProps => {
  const paint: any = {
    "raster-particle-speed-factor": 0.6,
    "raster-particle-fade-opacity-factor": 0.85,
    "raster-particle-reset-rate-factor": 0.3,
    "raster-particle-count": 16000,
    "raster-particle-max-speed": 40,
    "raster-particle-color": [
        "interpolate", ["linear"], ["raster-particle-speed"],
        1.5, "rgba(100,200,255,256)", 2.5, "rgba(50,150,255,256)",
        4.12, "rgba(0,200,255,256)", 6.17, "rgba(0,255,200,256)",
        9.26, "rgba(0,255,100,256)", 11.83, "rgba(255,200,0,256)",
        14.92, "rgba(255,120,0,256)", 18.0, "rgba(255,50,50,256)",
        21.6, "rgba(255,0,150,256)", 25.21, "rgba(200,0,255,256)",
        29.32, "rgba(150,0,255,256)", 33.44, "rgba(100,255,200,256)",
        43.72, "rgba(255,255,100,256)", 50.41, "rgba(255,255,255,256)",
        59.16, "rgba(0,255,255,256)", 69.44, "rgba(255,0,255,256)",
      ],
  };
  if (bandValue) paint["raster-particle-array-band"] = String(bandValue);
  return { id: "westcoast-wind-layer", type: "raster-particle", source: "westCoastWindSource", paint };
};

export const westCoastWindMagnitudeLayer: LayerProps = {
  id: "westcoast-wind_u",
  type: "raster",
  source: "westCoastWindSource",
  paint: { "raster-opacity": 0, "raster-fade-duration": 0 },
};

/**
 * Create TBOFS ocean current layer with a specific band value
 * @param bandValue - The band timestamp string from the tileset
 */
export const createTbofsCurrentLayer = (bandValue: string): LayerProps => {
  const band = String(bandValue);
  console.log("Creating TBOFS current layer with band:", band);

  return {
    id: "tbofs-current-layer",
    type: "raster-particle",
    source: "tbofsCurrentSource",
    paint: {
      "raster-particle-array-band": band,
      "raster-particle-speed-factor": 0.15,  // Slower for ocean currents
      "raster-particle-fade-opacity-factor": 0.92,
      "raster-particle-reset-rate-factor": 0.2,
      "raster-particle-count": 8000,
      "raster-particle-max-speed": 3,  // Ocean currents are much slower than wind
      "raster-particle-color": [
        "interpolate",
        ["linear"],
        ["raster-particle-speed"],
        0.0,
        "rgba(60,60,180,255)",   // Dark blue - very slow
        0.2,
        "rgba(80,120,200,255)",  // Blue
        0.4,
        "rgba(80,180,180,255)",  // Cyan
        0.6,
        "rgba(80,200,120,255)",  // Teal-green
        0.8,
        "rgba(180,200,80,255)",  // Yellow-green
        1.2,
        "rgba(220,180,60,255)",  // Orange
        1.8,
        "rgba(220,100,80,255)",  // Red-orange
        2.5,
        "rgba(200,60,100,255)",  // Red - fast current
      ],
    },
  };
};

export const tbofsCurrentMagnitudeLayer: LayerProps = {
  id: "tbofs-current_u",
  type: "raster",
  source: "tbofsCurrentSource",
  paint: {
    "raster-opacity": 0,
    "raster-fade-duration": 0,
  },
};

export const s3BandLayer: LayerProps = {
  id: "s3-band-layer",
  type: "raster",
  source: "s3BandSource",
  paint: {
    "raster-opacity": 0.7,
    "raster-contrast": 0.3, // Increase contrast (-1 to 1)
    "raster-brightness-min": 0, // Adjust brightness (0 to 1)
    "raster-brightness-max": 1, // Adjust brightness (0 to 1)
    "raster-saturation": 0.3, // Adjust color saturation (-1 to 1)
    "raster-resampling": "linear", // Smoothing: "linear" or "nearest"
    "raster-color": [
      "interpolate",
      ["linear"],
      ["raster-value"],
      0,
      "rgba(115, 12, 133, 0.5)", // Transparent for black/dark pixels
      0.1,
      "rgba(31, 93, 160, 0.7)",
      0.2,
      "rgba(31, 93, 160, 0.7)",
      0.5,
      "rgba(197, 163, 13, 0.7)",
      0.8,
      "rgba(197, 163, 13, .7)",
      1,
      "rgba(186, 25, 25, .5)",
    ] as any,
  },
};
