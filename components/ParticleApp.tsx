import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import Map, { NavigationControl, Source, Layer } from "react-map-gl";
import type { MapRef } from "react-map-gl";
import type { LayerProps } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  windMagnitudeLayer,
  createHerbieWindLayer,
  herbieWindMagnitudeLayer,
  createVermontWindLayer,
  vermontWindMagnitudeLayer,
  createTbofsCurrentLayer,
  tbofsCurrentMagnitudeLayer,
  s3BandLayer,
} from "@/layers/layer";
import { createWindLayer } from "@/layers/layer-with-time-control";
import {
  particleSource,
  particleSourceTwo,
  vermontWindSource,
  tbofsCurrentSource,
} from "@/layers/source";
import { useWeatherMetadata } from "@/hooks/useWeatherMetadata";
import type { WeatherVariable, ColorStop } from "@/hooks/useWeatherMetadata";
import { useGfsWaveMetadata } from "@/hooks/useGfsWaveMetadata";
import type { WaveVariable } from "@/hooks/useGfsWaveMetadata";
import ForecastAnimationController from "@/components/ForecastAnimationController";
import WindForecastPopup from "@/components/WindForecastPopup";
import { useTilePreloader } from "@/hooks/useTilePreloader";
import { usePreloadedRasterLayers } from "@/hooks/usePreloadedRasterLayers";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// Use the public token for tileset metadata fetching
// Note: This only works for public tilesets - private tilesets need a secret token
const MAPBOX_SECRET_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

/**
 * Convert Unix timestamp to UTC time string
 */
const formatUnixToUTC = (unixTimestamp: string): string => {
  const timestamp = parseInt(unixTimestamp, 10);
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
};

interface TimeBand {
  index: number;
  label: string;
  bandValue: string;
}

// =============================================================================
// Weather Legend Component
// =============================================================================

interface WeatherLegendProps {
  variable: WeatherVariable | WaveVariable | null;
  modelRun: string | null;
  ageMinutes: number;
  modelName?: string;
}

const WeatherLegend: React.FC<WeatherLegendProps> = ({
  variable,
  modelRun,
  ageMinutes,
  modelName = "HRRR",
}) => {
  const colorStops = variable?.color_stops || [];

  const gradient = useMemo(() => {
    if (colorStops.length < 2) return "linear-gradient(to right, #333, #666)";
    const stops = colorStops
      .map((stop, i) => {
        const percent = (i / (colorStops.length - 1)) * 100;
        return `${stop.color} ${percent}%`;
      })
      .join(", ");
    return `linear-gradient(to right, ${stops})`;
  }, [colorStops]);

  const minValue = colorStops.length > 0 ? colorStops[0].value : 0;
  const maxValue =
    colorStops.length > 0 ? colorStops[colorStops.length - 1].value : 100;

  const ageText = useMemo(() => {
    if (ageMinutes < 0) return "";
    if (ageMinutes < 60) return `${ageMinutes}m ago`;
    if (ageMinutes < 1440) return `${Math.floor(ageMinutes / 60)}h ago`;
    return `${Math.floor(ageMinutes / 1440)}d ago`;
  }, [ageMinutes]);

  if (!variable) return null;

  return (
    <div className="weather-legend">
      <div className="legend-title">{variable.name}</div>

      {/* Color bar */}
      {colorStops.length >= 2 && (
        <>
          <div className="legend-gradient" style={{ background: gradient }} />
          <div className="legend-labels">
            <span>{minValue}{variable.units}</span>
            <span>{maxValue}{variable.units}</span>
          </div>
        </>
      )}

      <div className="legend-meta">
        {modelRun && <div>{modelName} {modelRun}</div>}
        {ageText && <div style={{ color: "#10b981" }}>{ageText}</div>}
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

const ParticleApp = () => {
  const [viewport, setViewport] = useState({
    latitude: 41.163,
    longitude: -98.163,
    zoom: 6,
    projection: "mercator",
  });

  const [mapStyle, setMapStyle] = useState(
    "mapbox://styles/onwaterllc/clscdey6q001c01r650hfavmf"
  );

  // State for available bands (dynamically fetched and sorted)
  const [timeBands, setTimeBands] = useState<TimeBand[]>([]);
  const [bandsLoaded, setBandsLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tilesetError, setTilesetError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // State for time slice selection
  const [selectedTimeSlice, setSelectedTimeSlice] = useState<number | null>(
    null
  );

  // State for Herbie wind layer
  const [herbieWindEnabled, setHerbieWindEnabled] = useState(false);
  const [herbieBandValue, setHerbieBandValue] = useState<string | null>(null);
  const [herbieBandLoaded, setHerbieBandLoaded] = useState(false);

  // State for Vermont resampled wind layer
  const [vermontWindEnabled, setVermontWindEnabled] = useState(false);
  const [vermontBandValue, setVermontBandValue] = useState<string | null>(null);
  const [vermontBandLoaded, setVermontBandLoaded] = useState(false);

  // State for TBOFS ocean currents particle layer
  const [tbofsCurrentEnabled, setTbofsCurrentEnabled] = useState(false);
  const [tbofsCurrentBandValue, setTbofsCurrentBandValue] = useState<string | null>(null);
  const [tbofsCurrentBandLoaded, setTbofsCurrentBandLoaded] = useState(false);

  // Weather metadata from S3
  const {
    metadata: weatherMetadata,
    loading: weatherLoading,
    error: weatherError,
    refresh: refreshWeather,
  } = useWeatherMetadata();

  // GFS-Wave (Ocean) metadata from S3
  const {
    metadata: oceanMetadata,
    loading: oceanLoading,
    error: oceanError,
    refresh: refreshOcean,
  } = useGfsWaveMetadata();

  // State for S3 ocean layer
  const [oceanLayerEnabled, setOceanLayerEnabled] = useState(false);
  const [selectedOceanVariableId, setSelectedOceanVariableId] = useState<string | null>(null);
  const [selectedOceanForecast, setSelectedOceanForecast] = useState<string>("000");
  const [oceanOpacity, setOceanOpacity] = useState<number>(0.7);

  // State for S3 weather layer
  const [weatherLayerEnabled, setWeatherLayerEnabled] = useState(false);
  
  // Wind forecast popup state
  const [forecastPopup, setForecastPopup] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedVariableId, setSelectedVariableId] = useState<string | null>(
    null
  );
  const [selectedForecast, setSelectedForecast] = useState<string>("00");
  const [weatherOpacity, setWeatherOpacity] = useState<number>(0.7);

  // Map ref for error handling
  const mapRef = useRef<MapRef>(null);

  // Auto-select first variable when metadata loads
  useEffect(() => {
    if (
      weatherMetadata &&
      weatherMetadata.variables.length > 0 &&
      !selectedVariableId
    ) {
      setSelectedVariableId(weatherMetadata.variables[0].id);
    }
  }, [weatherMetadata, selectedVariableId]);

  // Auto-select first ocean variable when metadata loads
  useEffect(() => {
    if (
      oceanMetadata &&
      oceanMetadata.variables.length > 0 &&
      !selectedOceanVariableId
    ) {
      setSelectedOceanVariableId(oceanMetadata.variables[0].id);
    }
  }, [oceanMetadata, selectedOceanVariableId]);

  // Get selected variable details (must be defined before buildTileUrlForHook)
  const selectedVariable = useMemo(() => {
    if (!weatherMetadata || !selectedVariableId) return null;
    return (
      weatherMetadata.variables.find((v) => v.id === selectedVariableId) || null
    );
  }, [weatherMetadata, selectedVariableId]);

  // Get selected ocean variable details
  const selectedOceanVariable = useMemo(() => {
    if (!oceanMetadata || !selectedOceanVariableId) return null;
    return (
      oceanMetadata.variables.find((v) => v.id === selectedOceanVariableId) || null
    );
  }, [oceanMetadata, selectedOceanVariableId]);

  // Preloaded raster layers for instant forecast transitions
  const weatherSourceConfig = useMemo(() => {
    if (!weatherMetadata) return null;
    return {
      tileSize: weatherMetadata.tiles.tile_size || 256,
      minzoom: weatherMetadata.tiles.min_zoom || 0,
      maxzoom: weatherMetadata.tiles.max_zoom || 8,
      bounds: weatherMetadata.tiles.bounds as [number, number, number, number] | undefined,
    };
  }, [weatherMetadata]);

  // Ocean source config for GFS-Wave
  const oceanSourceConfig = useMemo(() => {
    if (!oceanMetadata) return null;
    return {
      tileSize: oceanMetadata.tiles.tile_size || 256,
      minzoom: oceanMetadata.tiles.min_zoom || 0,
      maxzoom: oceanMetadata.tiles.max_zoom || 8,
      bounds: oceanMetadata.tiles.bounds as [number, number, number, number] | undefined,
    };
  }, [oceanMetadata]);

  // Build tile URL helper for preloaded layers hook
  const buildTileUrlForHook = useCallback(
    (forecast: string) => {
      if (!weatherMetadata || !selectedVariable?.latest_timestamp) return null;
      return weatherMetadata.tiles.url_template
        .replace("{variable}", selectedVariable.id)
        .replace("{timestamp}", selectedVariable.latest_timestamp)
        .replace("{forecast}", forecast);
    },
    [weatherMetadata, selectedVariable]
  );

  // Build tile URL helper for ocean preloaded layers hook
  const buildOceanTileUrlForHook = useCallback(
    (forecast: string) => {
      if (!oceanMetadata || !selectedOceanVariable?.latest_timestamp) return null;
      return oceanMetadata.tiles.url_template
        .replace("{variable}", selectedOceanVariable.id)
        .replace("{timestamp}", selectedOceanVariable.latest_timestamp)
        .replace("{forecast}", forecast);
    },
    [oceanMetadata, selectedOceanVariable]
  );

  const {
    initialize: initializeWeatherLayers,
    setActiveForecast,
    isReady: weatherLayersReady,
    loadProgress: weatherLoadProgress,
    loadedCount: weatherLoadedCount,
    totalCount: weatherTotalCount,
    cleanup: cleanupWeatherLayers,
    setOpacity: setWeatherLayerOpacity,
    reinitialize: reinitializeWeatherLayers,
  } = usePreloadedRasterLayers({
    mapRef,
    sourceConfig: weatherSourceConfig || { tileSize: 256 },
    baseOpacity: weatherOpacity,
    buildTileUrl: buildTileUrlForHook,
    forecastHours: weatherMetadata?.forecast_hours || [],
    enabled: weatherLayerEnabled,
  });

  // Ocean preloaded layers
  const {
    initialize: initializeOceanLayers,
    setActiveForecast: setActiveOceanForecast,
    isReady: oceanLayersReady,
    loadProgress: oceanLoadProgress,
    loadedCount: oceanLoadedCount,
    totalCount: oceanTotalCount,
    cleanup: cleanupOceanLayers,
    setOpacity: setOceanLayerOpacity,
    reinitialize: reinitializeOceanLayers,
  } = usePreloadedRasterLayers({
    mapRef,
    sourceConfig: oceanSourceConfig || { tileSize: 256 },
    baseOpacity: oceanOpacity,
    buildTileUrl: buildOceanTileUrlForHook,
    forecastHours: oceanMetadata?.forecast_hours || [],
    enabled: oceanLayerEnabled,
    layerIdPrefix: "ocean",
  });

  // Tile preloader configuration
  // Use zoom level 4 for faster preloading (only ~8 tiles per forecast vs ~28 at zoom 5)
  const preloadConfig = useMemo(() => {
    if (!weatherMetadata || !selectedVariable?.latest_timestamp) return null;
    return {
      urlTemplate: weatherMetadata.tiles.url_template,
      variable: selectedVariable.id,
      timestamp: selectedVariable.latest_timestamp,
      forecastHours: weatherMetadata.forecast_hours,
      zoomLevel: 4,
    };
  }, [weatherMetadata, selectedVariable]);

  // Tile preloader hook
  const {
    preloadTiles,
    progress: preloadProgress,
    isPreloading,
  } = useTilePreloader(preloadConfig);

  // Preload tiles when variable changes
  useEffect(() => {
    if (preloadConfig && weatherLayerEnabled) {
      preloadTiles();
    }
  }, [preloadConfig, weatherLayerEnabled, preloadTiles]);

  // Switch active forecast when slider changes (instant - all layers pre-loaded)
  useEffect(() => {
    if (weatherLayersReady && weatherLayerEnabled) {
      setActiveForecast(selectedForecast);
    }
  }, [selectedForecast, weatherLayersReady, weatherLayerEnabled, setActiveForecast]);

  // Sync opacity changes with the preloaded layers
  useEffect(() => {
    setWeatherLayerOpacity(weatherOpacity);
  }, [weatherOpacity, setWeatherLayerOpacity]);

  // Cleanup weather layers when disabled
  useEffect(() => {
    if (!weatherLayerEnabled) {
      cleanupWeatherLayers();
    }
  }, [weatherLayerEnabled, cleanupWeatherLayers]);

  // Reinitialize layers when variable changes
  useEffect(() => {
    if (weatherLayerEnabled && selectedVariable?.latest_timestamp) {
      reinitializeWeatherLayers();
    }
  }, [selectedVariableId]); // Only trigger on variable ID change

  // Switch active ocean forecast when slider changes
  useEffect(() => {
    if (oceanLayersReady && oceanLayerEnabled) {
      setActiveOceanForecast(selectedOceanForecast);
    }
  }, [selectedOceanForecast, oceanLayersReady, oceanLayerEnabled, setActiveOceanForecast]);

  // Sync ocean opacity changes
  useEffect(() => {
    setOceanLayerOpacity(oceanOpacity);
  }, [oceanOpacity, setOceanLayerOpacity]);

  // Cleanup ocean layers when disabled
  useEffect(() => {
    if (!oceanLayerEnabled) {
      cleanupOceanLayers();
    }
  }, [oceanLayerEnabled, cleanupOceanLayers]);

  // Reinitialize ocean layers when variable changes
  useEffect(() => {
    if (oceanLayerEnabled && selectedOceanVariable?.latest_timestamp) {
      reinitializeOceanLayers();
    }
  }, [selectedOceanVariableId]); // Only trigger on variable ID change

  // Fetch tileset metadata and extract bands
  const fetchBands = () => {
    const tilesetId = "onwaterllc.wind-hrrr-daily-two";
    const cacheBuster = `&_t=${Date.now()}`;
    const url = `https://api.mapbox.com/v4/${tilesetId}.json?access_token=${MAPBOX_SECRET_TOKEN}${cacheBuster}`;

    setBandsLoaded(false);
    fetch(url, {
      cache: "no-cache",
      headers: {
        "Cache-Control": "no-cache",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch tileset metadata");
        return res.json();
      })
      .then((data) => {
        const rasterLayer = data.raster_layers?.[0];
        if (rasterLayer?.fields?.bands) {
          const bands: string[] = rasterLayer.fields.bands;
          const sortedBands = [...bands].sort(
            (a, b) => parseInt(a) - parseInt(b)
          );
          // Filter out bands that are too recent (tiles may still be processing)
          const oneHourAgo = Date.now() - (60 * 60 * 1000);
          const mappedBands: TimeBand[] = sortedBands
            .map((bandValue, index) => ({
              index,
              label: formatUnixToUTC(bandValue),
              bandValue,
            }))
            .filter((band) => !band.label.includes("00:00 UTC"))
            // Exclude bands less than 1 hour old to ensure tiles are processed
            .filter((band) => {
              const bandTimestamp = parseInt(band.bandValue) * 1000;
              return bandTimestamp < oneHourAgo;
            })
            .map((band, newIndex) => ({
              ...band,
              index: newIndex,
            }));
          setTimeBands(mappedBands);
        }
        setBandsLoaded(true);
      })
      .catch((err) => {
        console.error("Error fetching tileset metadata:", err);
        setBandsLoaded(true);
      });
  };

  // Fetch first band from Herbie tileset
  const fetchHerbieBand = () => {
    const tilesetId = "onwaterllc.wind-hrrr-herbie-48h";
    const cacheBuster = `&_t=${Date.now()}&_r=${Math.random()}`;
    const url = `https://api.mapbox.com/v4/${tilesetId}.json?access_token=${MAPBOX_SECRET_TOKEN}${cacheBuster}`;

    setHerbieBandLoaded(false);
    setHerbieBandValue(null); // Clear old value immediately
    fetch(url, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch Herbie tileset metadata");
        return res.json();
      })
      .then((data) => {
        const rasterLayer = data.raster_layers?.[0];
        if (rasterLayer?.fields?.bands) {
          const bands: string[] = rasterLayer.fields.bands;
          const sortedBands = [...bands].sort(
            (a, b) => parseInt(a) - parseInt(b)
          );
          // Filter out bands less than 1 hour old to ensure tiles are processed
          const oneHourAgo = Date.now() - (60 * 60 * 1000);
          const validBands = sortedBands.filter((bandValue) => {
            const bandTimestamp = parseInt(bandValue) * 1000;
            return bandTimestamp < oneHourAgo;
          });
          if (validBands.length > 0) {
            setHerbieBandValue(validBands[0]);
          } else if (sortedBands.length > 0) {
            // Fallback to oldest band if all are too recent
            setHerbieBandValue(sortedBands[0]);
          }
        }
        setHerbieBandLoaded(true);
      })
      .catch((err) => {
        console.error("Error fetching Herbie tileset metadata:", err);
        setHerbieBandLoaded(true);
      });
  };

  // Fetch first band from Vermont resampled tileset
  const fetchVermontBand = () => {
    const tilesetId = "onwaterllc.hrrr_wind_resampled";
    const cacheBuster = `&_t=${Date.now()}&_r=${Math.random()}`;
    const url = `https://api.mapbox.com/v4/${tilesetId}.json?access_token=${MAPBOX_SECRET_TOKEN}${cacheBuster}`;

    setVermontBandLoaded(false);
    setVermontBandValue(null); // Clear old value immediately
    fetch(url, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch Vermont tileset metadata");
        return res.json();
      })
      .then((data) => {
        const rasterLayer = data.raster_layers?.[0];
        if (rasterLayer?.fields?.bands) {
          const bands: string[] = rasterLayer.fields.bands;
          const sortedBands = [...bands].sort(
            (a, b) => parseInt(a) - parseInt(b)
          );
          // Filter out bands less than 1 hour old to ensure tiles are processed
          const oneHourAgo = Date.now() - (60 * 60 * 1000);
          const validBands = sortedBands.filter((bandValue) => {
            const bandTimestamp = parseInt(bandValue) * 1000;
            return bandTimestamp < oneHourAgo;
          });
          if (validBands.length > 0) {
            setVermontBandValue(validBands[0]);
          } else if (sortedBands.length > 0) {
            // Fallback to oldest band if all are too recent
            setVermontBandValue(sortedBands[0]);
          }
        }
        setVermontBandLoaded(true);
      })
      .catch((err) => {
        console.error("Error fetching Vermont tileset metadata:", err);
        setVermontBandLoaded(true);
      });
  };

  // Fetch band from TBOFS ocean currents tileset
  const fetchTbofsBand = () => {
    const tilesetId = "onwaterllc.tbofs_currents";
    const cacheBuster = `&_t=${Date.now()}&_r=${Math.random()}`;
    const url = `https://api.mapbox.com/v4/${tilesetId}.json?access_token=${MAPBOX_SECRET_TOKEN}${cacheBuster}`;

    setTbofsCurrentBandLoaded(false);
    setTbofsCurrentBandValue(null); // Clear old value immediately
    fetch(url, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch TBOFS tileset metadata");
        return res.json();
      })
      .then((data) => {
        const rasterLayer = data.raster_layers?.[0];
        if (rasterLayer?.fields?.bands) {
          const bands: string[] = rasterLayer.fields.bands;
          const sortedBands = [...bands].sort(
            (a, b) => parseInt(a) - parseInt(b)
          );
          if (sortedBands.length > 0) {
            setTbofsCurrentBandValue(sortedBands[0]);
          }
        }
        setTbofsCurrentBandLoaded(true);
      })
      .catch((err) => {
        console.error("Error fetching TBOFS tileset metadata:", err);
        setTbofsCurrentBandLoaded(true);
      });
  };

  useEffect(() => {
    fetchBands();
    fetchHerbieBand();
    fetchVermontBand();
    fetchTbofsBand();
  }, [refreshKey]);

  const refreshBands = () => {
    // Clear all cached band values first
    setHerbieBandValue(null);
    setVermontBandValue(null);
    setTbofsCurrentBandValue(null);
    // Disable layers to prevent errors
    setHerbieWindEnabled(false);
    setVermontWindEnabled(false);
    setTbofsCurrentEnabled(false);
    // Trigger re-fetch
    setRefreshKey((prev) => prev + 1);
  };

  const selectedBand =
    selectedTimeSlice !== null ? timeBands[selectedTimeSlice] : null;

  // Track if preloaded layers have been initialized
  const weatherLayerInitializedRef = useRef(false);
  const oceanLayerInitializedRef = useRef(false);

  const handleMapLoad = () => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const handleError = (e: any) => {
      const errorMessage = e.error?.message || String(e.error || "");
      if (
        errorMessage.includes("Invalid band") ||
        errorMessage.includes("MRTError")
      ) {
        setTilesetError(
          "Tileset is still processing. Bands may not be available yet."
        );
        setRetryCount((currentCount) => {
          if (currentCount < 5) {
            setTimeout(() => {
              setRetryCount((prev) => prev + 1);
              setRefreshKey((prev) => prev + 1);
              setTilesetError(null);
            }, 30000);
          }
          return currentCount;
        });
      }
    };

    map.on("error", handleError);

    // Initialize preloaded weather layers if metadata is already available
    if (
      weatherLayerEnabled &&
      weatherMetadata &&
      selectedVariable?.latest_timestamp &&
      !weatherLayerInitializedRef.current
    ) {
      initializeWeatherLayers();
      weatherLayerInitializedRef.current = true;
    }

    // Initialize preloaded ocean layers if metadata is already available
    if (
      oceanLayerEnabled &&
      oceanMetadata &&
      selectedOceanVariable?.latest_timestamp &&
      !oceanLayerInitializedRef.current
    ) {
      initializeOceanLayers();
      oceanLayerInitializedRef.current = true;
    }
  };

  // Initialize weather layers when metadata becomes available after map load
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (
      map &&
      weatherLayerEnabled &&
      weatherMetadata &&
      selectedVariable?.latest_timestamp &&
      !weatherLayerInitializedRef.current
    ) {
      initializeWeatherLayers();
      weatherLayerInitializedRef.current = true;
    }
  }, [weatherMetadata, selectedVariable, weatherLayerEnabled, initializeWeatherLayers]);

  // Initialize ocean layers when metadata becomes available after map load
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (
      map &&
      oceanLayerEnabled &&
      oceanMetadata &&
      selectedOceanVariable?.latest_timestamp &&
      !oceanLayerInitializedRef.current
    ) {
      initializeOceanLayers();
      oceanLayerInitializedRef.current = true;
    }
  }, [oceanMetadata, selectedOceanVariable, oceanLayerEnabled, initializeOceanLayers]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <Map
        ref={mapRef}
        initialViewState={viewport}
        style={{ width: "100%", height: "100vh" }}
        mapStyle={mapStyle}
        mapboxAccessToken={MAPBOX_TOKEN}
        onLoad={handleMapLoad}
        onClick={(e) => {
          // Open wind forecast popup on map click
          setForecastPopup({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        }}
      >
        <NavigationControl position="top-right" />

        {/* S3 Weather Tiles Layer - Managed imperatively via usePreloadedRasterLayers hook */}
        {/* All forecast hours are pre-loaded as separate layers for instant transitions */}

        {/* Wind Particle Layers */}
        {selectedBand && (
          <Source {...particleSource}>
            <Layer {...windMagnitudeLayer} />
            <Layer {...createWindLayer(selectedBand.bandValue)} />
          </Source>
        )}

        {herbieWindEnabled && herbieBandValue && (
          <Source {...particleSourceTwo}>
            <Layer {...herbieWindMagnitudeLayer} />
            <Layer {...createHerbieWindLayer(herbieBandValue)} />
          </Source>
        )}

        {vermontWindEnabled && vermontBandValue && (
          <Source {...vermontWindSource}>
            <Layer {...vermontWindMagnitudeLayer} />
            <Layer {...createVermontWindLayer(vermontBandValue)} />
          </Source>
        )}

        {/* TBOFS Tampa Bay Ocean Currents */}
        {tbofsCurrentEnabled && tbofsCurrentBandValue && (
          <Source {...tbofsCurrentSource}>
            <Layer {...tbofsCurrentMagnitudeLayer} />
            <Layer {...createTbofsCurrentLayer(tbofsCurrentBandValue)} />
          </Source>
        )}
      </Map>

      {/* Left Panel - Controls */}
      <div className="control-panel">
        {/* Weather Variable Selector */}
        <div className="panel-section">
          <div className="section-header">
            <span className="section-title">Weather Layer</span>
            <button
              onClick={() => setWeatherLayerEnabled(!weatherLayerEnabled)}
              className={`toggle-btn ${weatherLayerEnabled ? 'active' : 'inactive'}`}
            >
              {weatherLayerEnabled ? "ON" : "OFF"}
            </button>
          </div>

          {weatherLoading && !weatherMetadata && (
            <div className="info-card">Loading weather data...</div>
          )}

          {weatherError && !weatherMetadata && (
            <div className="info-card" style={{ borderColor: 'rgba(244, 67, 54, 0.3)' }}>
              <span style={{ color: '#f44336' }}>Error loading weather data</span>
              <button onClick={refreshWeather} className="refresh-btn" style={{ marginLeft: '8px' }}>
                Retry
              </button>
            </div>
          )}

          {weatherMetadata && weatherLayerEnabled && (
            <>
              {/* Data Freshness */}
              <div className="info-card">
                <div className="info-label">Model Run</div>
                <div className="info-value">
                  HRRR {weatherMetadata.model_run?.cycle_formatted || "..."}
                  <span className={`status-badge ${weatherMetadata.data_freshness?.status === "fresh" ? 'fresh' : 'stale'}`}>
                    {weatherMetadata.data_freshness?.age_minutes < 60
                      ? `${weatherMetadata.data_freshness?.age_minutes}m ago`
                      : `${Math.floor(weatherMetadata.data_freshness?.age_minutes / 60)}h ago`}
                  </span>
                </div>
              </div>

              {/* Variable Buttons */}
              <div className="variable-grid">
                {weatherMetadata.variables.map((variable) => (
                  <button
                    key={variable.id}
                    onClick={() => setSelectedVariableId(variable.id)}
                    className={`variable-btn ${selectedVariableId === variable.id ? 'selected' : ''}`}
                    title={variable.description}
                  >
                    <span>{variable.name}</span>
                    {variable.units && <span className="units">({variable.units})</span>}
                  </button>
                ))}
              </div>

              {/* Forecast Animation Controller */}
              <ForecastAnimationController
                forecastHours={weatherMetadata.forecast_hours}
                selectedForecast={selectedForecast}
                onForecastChange={setSelectedForecast}
                modelRun={weatherMetadata.model_run}
                preloadProgress={preloadProgress}
              />

              {/* Opacity Slider */}
              <div className="opacity-section">
                <div className="opacity-header">
                  <span className="opacity-label">Layer Opacity</span>
                  <span className="opacity-value">{Math.round(weatherOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weatherOpacity * 100}
                  onChange={(e) => setWeatherOpacity(parseInt(e.target.value) / 100)}
                />
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="divider" />

        {/* Ocean Waves Section (GFS-Wave) */}
        <div className="panel-section">
          <div className="section-header">
            <span className="section-title">Ocean Waves</span>
            <button
              onClick={() => setOceanLayerEnabled(!oceanLayerEnabled)}
              className={`toggle-btn ${oceanLayerEnabled ? 'active' : 'inactive'}`}
            >
              {oceanLayerEnabled ? "ON" : "OFF"}
            </button>
          </div>

          {/* TBOFS Tampa Bay Currents - Particle Layer */}
          <button
            onClick={() => setTbofsCurrentEnabled(!tbofsCurrentEnabled)}
            disabled={!tbofsCurrentBandLoaded || !tbofsCurrentBandValue}
            className={`wind-btn ${tbofsCurrentEnabled ? 'active' : ''}`}
            style={{ marginBottom: '12px' }}
          >
            <span>🌊 Tampa Bay Currents</span>
            <span className={`wind-status ${tbofsCurrentEnabled ? 'on' : 'off'}`}>
              {tbofsCurrentEnabled ? "ON" : "OFF"}
            </span>
          </button>

          {oceanLoading && !oceanMetadata && (
            <div className="info-card">Loading ocean data...</div>
          )}

          {oceanError && !oceanMetadata && (
            <div className="info-card" style={{ borderColor: 'rgba(244, 67, 54, 0.3)' }}>
              <span style={{ color: '#f44336' }}>Error loading ocean data</span>
              <button onClick={refreshOcean} className="refresh-btn" style={{ marginLeft: '8px' }}>
                Retry
              </button>
            </div>
          )}

          {oceanMetadata && oceanLayerEnabled && (
            <>
              {/* Data Freshness */}
              <div className="info-card">
                <div className="info-label">Model Run</div>
                <div className="info-value">
                  GFS-Wave {oceanMetadata.model_run?.cycle_formatted || "..."}
                  <span className={`status-badge ${oceanMetadata.data_freshness?.status === "fresh" ? 'fresh' : 'stale'}`}>
                    {oceanMetadata.data_freshness?.age_minutes < 60
                      ? `${oceanMetadata.data_freshness?.age_minutes}m ago`
                      : `${Math.floor(oceanMetadata.data_freshness?.age_minutes / 60)}h ago`}
                  </span>
                </div>
              </div>

              {/* Variable Buttons */}
              <div className="variable-grid">
                {oceanMetadata.variables.map((variable) => (
                  <button
                    key={variable.id}
                    onClick={() => setSelectedOceanVariableId(variable.id)}
                    className={`variable-btn ${selectedOceanVariableId === variable.id ? 'selected' : ''}`}
                    title={variable.description}
                  >
                    <span>{variable.name}</span>
                    {variable.units && <span className="units">({variable.units})</span>}
                  </button>
                ))}
              </div>

              {/* Forecast Slider for Ocean */}
              {oceanMetadata.forecast_hours.length > 1 && (
                <div className="forecast-slider">
                  <div className="forecast-header">
                    <span className="forecast-label">Forecast Hour</span>
                    <span className="forecast-value">F{selectedOceanForecast}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={oceanMetadata.forecast_hours.length - 1}
                    value={oceanMetadata.forecast_hours.indexOf(selectedOceanForecast)}
                    onChange={(e) => setSelectedOceanForecast(oceanMetadata.forecast_hours[parseInt(e.target.value)])}
                  />
                </div>
              )}

              {/* Opacity Slider */}
              <div className="opacity-section">
                <div className="opacity-header">
                  <span className="opacity-label">Layer Opacity</span>
                  <span className="opacity-value">{Math.round(oceanOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={oceanOpacity * 100}
                  onChange={(e) => setOceanOpacity(parseInt(e.target.value) / 100)}
                />
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="divider" />

        {/* Wind Forecast Time Selector */}
        <div className="panel-section wind-section">
          <div className="section-header">
            <span className="section-title">Wind Particles</span>
            <button onClick={refreshBands} disabled={!bandsLoaded} className="refresh-btn">
              Refresh
            </button>
          </div>

          {/* Wind Toggle */}
          <button
            onClick={() => setHerbieWindEnabled(!herbieWindEnabled)}
            disabled={!herbieBandLoaded || !herbieBandValue}
            className={`wind-btn ${herbieWindEnabled ? 'active' : ''}`}
          >
            <span>Animated Wind</span>
            <span className={`wind-status ${herbieWindEnabled ? 'on' : 'off'}`}>
              {herbieWindEnabled ? "ON" : "OFF"}
            </span>
          </button>

          {/* Vermont Wind Resampled Toggle */}
          <button
            onClick={() => setVermontWindEnabled(!vermontWindEnabled)}
            disabled={!vermontBandLoaded || !vermontBandValue}
            className={`wind-btn ${vermontWindEnabled ? 'active' : ''}`}
            style={{ marginTop: '8px' }}
          >
            <span>🏔️ Vermont Wind (4x)</span>
            <span className={`wind-status ${vermontWindEnabled ? 'on' : 'off'}`}>
              {vermontWindEnabled ? "ON" : "OFF"}
            </span>
          </button>

          <div className="time-grid">
            {timeBands.map((band) => (
              <button
                key={band.index}
                onClick={() => setSelectedTimeSlice(band.index)}
                className={`time-btn ${selectedTimeSlice === band.index ? 'selected' : ''}`}
              >
                {band.label.split(' ')[1]}
              </button>
            ))}
          </div>

          {selectedBand && (
            <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
              Selected: {selectedBand.label}
            </div>
          )}

          {tilesetError && (
            <div style={{
              marginTop: '12px',
              padding: '10px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#f59e0b'
            }}>
              {tilesetError}
              {retryCount > 0 && <span> (Retry {retryCount}/5)</span>}
            </div>
          )}
        </div>
      </div>

      {/* Weather Legend */}
      {weatherLayerEnabled && selectedVariable && (
        <WeatherLegend
          variable={selectedVariable}
          modelRun={weatherMetadata?.model_run?.cycle_formatted || null}
          ageMinutes={weatherMetadata?.data_freshness?.age_minutes || -1}
          modelName="HRRR"
        />
      )}

      {/* Ocean Legend */}
      {oceanLayerEnabled && selectedOceanVariable && (
        <div className="ocean-legend">
          <WeatherLegend
            variable={selectedOceanVariable}
            modelRun={oceanMetadata?.model_run?.cycle_formatted || null}
            ageMinutes={oceanMetadata?.data_freshness?.age_minutes || -1}
            modelName="GFS-Wave"
          />
        </div>
      )}

      {/* Weather preloading indicator */}
      {weatherLayerEnabled && !weatherLayersReady && weatherTotalCount > 0 && (
        <div className="loading-bar">
          <div className="loading-text">
            Loading weather forecasts: {weatherLoadedCount}/{weatherTotalCount}
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${weatherLoadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Ocean preloading indicator */}
      {oceanLayerEnabled && !oceanLayersReady && oceanTotalCount > 0 && (
        <div className="loading-bar" style={{ bottom: weatherLayerEnabled && !weatherLayersReady ? '60px' : '20px' }}>
          <div className="loading-text">
            Loading ocean forecasts: {oceanLoadedCount}/{oceanTotalCount}
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${oceanLoadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Wind Forecast Popup - Click anywhere on map */}
      {forecastPopup && (
        <WindForecastPopup
          latitude={forecastPopup.lat}
          longitude={forecastPopup.lng}
          onClose={() => setForecastPopup(null)}
        />
      )}
    </div>
  );
};

export default ParticleApp;
