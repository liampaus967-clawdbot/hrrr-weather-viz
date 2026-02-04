import { SourceProps } from "react-map-gl";
import type { WeatherMetadata } from "@/hooks/useWeatherMetadata";

export const particleSource: SourceProps = {
  type: "raster-array",
  url: "mapbox://onwaterllc.wind-hrrr-daily-two",
  tileSize: 512,
};

export const particleSourceTwo: SourceProps = {
  type: "raster-array",
  url: "mapbox://onwaterllc.wind-hrrr-daily-two",
  tileSize: 512,
};

// Northeast resampled wind (6x resolution ~500m)
export const northeastWindSource: SourceProps = {
  type: "raster-array",
  url: "mapbox://onwaterllc.hrrr_wind_northeast",
  tileSize: 4096,
};

// Southeast resampled wind (6x resolution ~500m)
export const southeastWindSource: SourceProps = {
  type: "raster-array",
  url: "mapbox://onwaterllc.hrrr_wind_southeast",
  tileSize: 4096,
};

// Northwest resampled wind (6x resolution ~500m)
export const northwestWindSource: SourceProps = {
  type: "raster-array",
  url: "mapbox://onwaterllc.hrrr_wind_northwest",
  tileSize: 4096,
};

// Southwest resampled wind (6x resolution ~500m)
export const southwestWindSource: SourceProps = {
  type: "raster-array",
  url: "mapbox://onwaterllc.hrrr_wind_southwest",
  tileSize: 4096,
};

// West Coast resampled wind (6x resolution ~500m)
export const westCoastWindSource: SourceProps = {
  type: "raster-array",
  url: "mapbox://onwaterllc.hrrr_wind_west_coast",
  tileSize: 4096,
};

// TBOFS Tampa Bay ocean currents
export const tbofsCurrentSource: SourceProps = {
  type: "raster-array",
  url: "mapbox://onwaterllc.tbofs_currents",
  tileSize: 512,
};

/**
 * Create a dynamic raster source from weather metadata
 * @param metadata - Weather metadata from S3
 * @param variable - Variable ID (e.g., "temperature_2m")
 * @param timestamp - Timestamp string (e.g., "20260111T20z")
 * @param forecast - Forecast hour (e.g., "00")
 */
export function createWeatherSource(
  metadata: WeatherMetadata,
  variable: string,
  timestamp: string,
  forecast: string = "00"
): SourceProps {
  const tileUrl = metadata.tiles.url_template
    .replace("{variable}", variable)
    .replace("{timestamp}", timestamp)
    .replace("{forecast}", forecast)
    .replace("{z}", "{z}")
    .replace("{x}", "{x}")
    .replace("{y}", "{y}");

  return {
    type: "raster",
    tiles: [tileUrl],
    tileSize: metadata.tiles.tile_size || 256,
    minzoom: metadata.tiles.min_zoom || 0,
    maxzoom: metadata.tiles.max_zoom || 8,
    bounds: metadata.tiles.bounds,
  };
}

/**
 * Create source props for a specific variable using the latest timestamp
 */
export function createLatestWeatherSource(
  metadata: WeatherMetadata,
  variableId: string,
  forecast: string = "00"
): SourceProps | null {
  const variable = metadata.variables.find((v) => v.id === variableId);
  if (!variable || !variable.latest_timestamp) {
    return null;
  }

  return createWeatherSource(
    metadata,
    variableId,
    variable.latest_timestamp,
    forecast
  );
}

// // Legacy static source (kept for backwards compatibility)
// export const s3BandSource: SourceProps = {
//   type: "raster",
//   tiles: [
//     "https://sat-data-automation-test.s3.us-east-2.amazonaws.com/tiles/cloud_cover_total/20260111T20z/00/{z}/{x}/{y}.png",
//   ],
//   tileSize: 256,
//   minzoom: 0,
//   maxzoom: 6,
// };
