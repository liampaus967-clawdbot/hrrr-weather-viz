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
  s3BandLayer,
} from "@/layers/layer";
import { createWindLayer } from "@/layers/layer-with-time-control";
import {
  particleSource,
  particleSourceTwo,
} from "@/layers/source";
import { useWeatherMetadata } from "@/hooks/useWeatherMetadata";
import type { WeatherVariable, ColorStop } from "@/hooks/useWeatherMetadata";
import ForecastAnimationController from "@/components/ForecastAnimationController";
import { useTilePreloader } from "@/hooks/useTilePreloader";
import { usePreloadedRasterLayers } from "@/hooks/usePreloadedRasterLayers";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const MAPBOX_SECRET_TOKEN = process.env.MAPBOX_SECRET_TOKEN || "";

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
  variable: WeatherVariable | null;
  modelRun: string | null;
  ageMinutes: number;
}

const WeatherLegend: React.FC<WeatherLegendProps> = ({
  variable,
  modelRun,
  ageMinutes,
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
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        right: "20px",
        background: "rgba(0, 0, 0, 0.85)",
        padding: "12px 15px",
        borderRadius: "8px",
        color: "white",
        fontSize: "12px",
        zIndex: 1,
        minWidth: "180px",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "6px" }}>
        {variable.name}
      </div>

      {/* Color bar */}
      {colorStops.length >= 2 && (
        <>
          <div
            style={{
              height: "10px",
              borderRadius: "3px",
              background: gradient,
              marginBottom: "4px",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "10px",
              opacity: 0.8,
            }}
          >
            <span>
              {minValue}
              {variable.units}
            </span>
            <span>
              {maxValue}
              {variable.units}
            </span>
          </div>
        </>
      )}

      <div
        style={{
          marginTop: "8px",
          fontSize: "10px",
          opacity: 0.6,
          borderTop: "1px solid rgba(255,255,255,0.2)",
          paddingTop: "6px",
        }}
      >
        {modelRun && <div>HRRR {modelRun}</div>}
        {ageText && <div style={{ color: "#4CAF50" }}>{ageText}</div>}
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

  // Weather metadata from S3
  const {
    metadata: weatherMetadata,
    loading: weatherLoading,
    error: weatherError,
    refresh: refreshWeather,
  } = useWeatherMetadata();

  // State for S3 weather layer
  const [weatherLayerEnabled, setWeatherLayerEnabled] = useState(true);
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

  // Get selected variable details (must be defined before buildTileUrlForHook)
  const selectedVariable = useMemo(() => {
    if (!weatherMetadata || !selectedVariableId) return null;
    return (
      weatherMetadata.variables.find((v) => v.id === selectedVariableId) || null
    );
  }, [weatherMetadata, selectedVariableId]);

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

  // Tile preloader configuration
  const preloadConfig = useMemo(() => {
    if (!weatherMetadata || !selectedVariable?.latest_timestamp) return null;
    return {
      urlTemplate: weatherMetadata.tiles.url_template,
      variable: selectedVariable.id,
      timestamp: selectedVariable.latest_timestamp,
      forecastHours: weatherMetadata.forecast_hours,
      zoomLevel: 5,
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
          const mappedBands: TimeBand[] = sortedBands
            .map((bandValue, index) => ({
              index,
              label: formatUnixToUTC(bandValue),
              bandValue,
            }))
            .filter((band) => !band.label.includes("00:00 UTC"))
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
    const cacheBuster = `&_t=${Date.now()}`;
    const url = `https://api.mapbox.com/v4/${tilesetId}.json?access_token=${MAPBOX_SECRET_TOKEN}${cacheBuster}`;

    setHerbieBandLoaded(false);
    fetch(url, {
      cache: "no-cache",
      headers: {
        "Cache-Control": "no-cache",
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
          if (sortedBands.length > 0) {
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

  useEffect(() => {
    fetchBands();
    fetchHerbieBand();
  }, [refreshKey]);

  const refreshBands = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const selectedBand =
    selectedTimeSlice !== null ? timeBands[selectedTimeSlice] : null;

  // Track if preloaded layers have been initialized
  const weatherLayerInitializedRef = useRef(false);

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

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <Map
        ref={mapRef}
        initialViewState={viewport}
        style={{ width: "100%", height: "100vh" }}
        mapStyle={mapStyle}
        mapboxAccessToken={MAPBOX_TOKEN}
        onLoad={handleMapLoad}
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
      </Map>

      {/* Top Right Controls */}
      <div
        style={{
          position: "absolute",
          top: "60px",
          right: "20px",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <button
          onClick={() => setHerbieWindEnabled(!herbieWindEnabled)}
          disabled={!herbieBandLoaded || !herbieBandValue}
          style={{
            padding: "10px 16px",
            background: herbieWindEnabled ? "#4CAF50" : "#333",
            border: "none",
            borderRadius: "8px",
            color: "white",
            cursor:
              herbieBandLoaded && herbieBandValue ? "pointer" : "not-allowed",
            fontSize: "14px",
            fontWeight: "500",
            transition: "background 0.3s",
            opacity: herbieBandLoaded && herbieBandValue ? 1 : 0.5,
          }}
        >
          {herbieWindEnabled ? "Wind Particles ON" : "Wind Particles OFF"}
        </button>
      </div>

      {/* Left Panel - Controls */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          background: "rgba(0, 0, 0, 0.85)",
          padding: "15px",
          borderRadius: "10px",
          color: "white",
          zIndex: 1,
          minWidth: "220px",
          maxHeight: "calc(100vh - 60px)",
          overflowY: "auto",
        }}
      >
        {/* Weather Variable Selector */}
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px" }}>Weather Layer</h3>
            <button
              onClick={() => setWeatherLayerEnabled(!weatherLayerEnabled)}
              style={{
                padding: "4px 8px",
                background: weatherLayerEnabled ? "#4CAF50" : "#666",
                border: "none",
                borderRadius: "4px",
                color: "white",
                cursor: "pointer",
                fontSize: "10px",
              }}
            >
              {weatherLayerEnabled ? "ON" : "OFF"}
            </button>
          </div>

          {weatherLoading && !weatherMetadata && (
            <div style={{ fontSize: "12px", opacity: 0.7 }}>
              Loading weather data...
            </div>
          )}

          {weatherError && !weatherMetadata && (
            <div style={{ fontSize: "12px", color: "#f44336" }}>
              Error loading weather data
              <button
                onClick={refreshWeather}
                style={{
                  marginLeft: "8px",
                  padding: "2px 6px",
                  background: "#333",
                  border: "none",
                  borderRadius: "3px",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "10px",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {weatherMetadata && weatherLayerEnabled && (
            <>
              {/* Data Freshness */}
              <div
                style={{
                  padding: "6px 8px",
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "4px",
                  marginBottom: "10px",
                  fontSize: "11px",
                }}
              >
                <div style={{ opacity: 0.7 }}>Model Run</div>
                <div style={{ fontWeight: 500 }}>
                  HRRR {weatherMetadata.model_run?.cycle_formatted || "..."}
                  <span
                    style={{
                      marginLeft: "8px",
                      color:
                        weatherMetadata.data_freshness?.status === "fresh"
                          ? "#4CAF50"
                          : "#FF9800",
                    }}
                  >
                    {weatherMetadata.data_freshness?.age_minutes < 60
                      ? `${weatherMetadata.data_freshness?.age_minutes}m ago`
                      : `${Math.floor(
                          weatherMetadata.data_freshness?.age_minutes / 60
                        )}h ago`}
                  </span>
                </div>
              </div>

              {/* Variable Buttons */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {weatherMetadata.variables.map((variable) => (
                  <button
                    key={variable.id}
                    onClick={() => setSelectedVariableId(variable.id)}
                    style={{
                      padding: "8px 10px",
                      background:
                        selectedVariableId === variable.id ? "#2196F3" : "#333",
                      border: "none",
                      borderRadius: "4px",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "12px",
                      textAlign: "left",
                      transition: "background 0.2s",
                    }}
                    title={variable.description}
                  >
                    {variable.name}
                    {variable.units && (
                      <span style={{ opacity: 0.6, marginLeft: "4px" }}>
                        ({variable.units})
                      </span>
                    )}
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
              <div style={{ marginTop: "12px" }}>
                <div
                  style={{
                    fontSize: "12px",
                    opacity: 0.8,
                    marginBottom: "4px",
                  }}
                >
                  Opacity: {Math.round(weatherOpacity * 100)}%
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weatherOpacity * 100}
                  onChange={(e) =>
                    setWeatherOpacity(parseInt(e.target.value) / 100)
                  }
                  style={{ width: "100%" }}
                />
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.2)",
            margin: "15px 0",
          }}
        />

        {/* Wind Forecast Time Selector */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px" }}>Wind Forecast Time</h3>
            <button
              onClick={refreshBands}
              disabled={!bandsLoaded}
              style={{
                padding: "4px 8px",
                background: bandsLoaded ? "#555" : "#333",
                border: "none",
                borderRadius: "4px",
                color: "white",
                cursor: bandsLoaded ? "pointer" : "not-allowed",
                fontSize: "10px",
                opacity: bandsLoaded ? 1 : 0.5,
              }}
              title="Refresh tileset metadata"
            >
              Refresh
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {timeBands.map((band) => (
              <button
                key={band.index}
                onClick={() => setSelectedTimeSlice(band.index)}
                style={{
                  padding: "6px 10px",
                  background:
                    selectedTimeSlice === band.index ? "#4CAF50" : "#333",
                  border: "none",
                  borderRadius: "4px",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "12px",
                  transition: "background 0.2s",
                }}
              >
                {band.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: "8px", fontSize: "11px", opacity: 0.7 }}>
            {bandsLoaded ? (
              selectedBand ? (
                <>Wind: {selectedBand.label}</>
              ) : (
                <>Select a time for wind particles</>
              )
            ) : (
              <>Loading wind bands...</>
            )}
          </div>

          {tilesetError && (
            <div
              style={{
                marginTop: "8px",
                padding: "6px",
                background: "rgba(255, 152, 0, 0.2)",
                border: "1px solid rgba(255, 152, 0, 0.5)",
                borderRadius: "4px",
                fontSize: "10px",
                color: "#ff9800",
              }}
            >
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
        />
      )}

      {/* Loading indicator for weather refresh */}
      {weatherLoading && weatherMetadata && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "200px",
            background: "rgba(33, 150, 243, 0.9)",
            padding: "6px 10px",
            borderRadius: "4px",
            color: "white",
            fontSize: "11px",
            zIndex: 1,
          }}
        >
          Refreshing...
        </div>
      )}

      {/* Preloading indicator - shows progress while all forecast layers load */}
      {weatherLayerEnabled && !weatherLayersReady && weatherTotalCount > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0, 0, 0, 0.85)",
            padding: "10px 16px",
            borderRadius: "6px",
            color: "white",
            fontSize: "12px",
            zIndex: 1,
            textAlign: "center",
          }}
        >
          <div style={{ marginBottom: "6px" }}>
            Loading forecast layers: {weatherLoadedCount}/{weatherTotalCount}
          </div>
          <div
            style={{
              width: "150px",
              height: "4px",
              background: "rgba(255,255,255,0.2)",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${weatherLoadProgress}%`,
                height: "100%",
                background: "#4CAF50",
                transition: "width 0.2s",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticleApp;
