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
};

export const herbieWindMagnitudeLayer: LayerProps = {
  id: "herbie-wind_u",
  type: "raster",
  source: "particleSourceTwo",
  paint: {
    "raster-opacity": 0,
    "raster-fade-duration": 0,
  },
};

/**
 * Create Vermont resampled wind layer with a specific band value
 * @param bandValue - The band timestamp string from the tileset
 */
export const createVermontWindLayer = (bandValue: string): LayerProps => {
  const band = String(bandValue);
  console.log("Creating Vermont wind layer with band:", band);

  return {
    id: "vermont-wind-layer",
    type: "raster-particle",
    source: "vermontWindSource",
    paint: {
      "raster-particle-array-band": band,
      "raster-particle-speed-factor": 0.3,
      "raster-particle-fade-opacity-factor": 0.85,
      "raster-particle-reset-rate-factor": 0.3,
      "raster-particle-count": 4000, // More particles for higher res
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
};

export const vermontWindMagnitudeLayer: LayerProps = {
  id: "vermont-wind_u",
  type: "raster",
  source: "vermontWindSource",
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
