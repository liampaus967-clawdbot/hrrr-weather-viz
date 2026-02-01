import { useState, useEffect } from "react";

interface WindBand {
  name: string;
  displayName: string;
  timestamp?: number;
}

/**
 * Hook to fetch available wind bands from the Mapbox tileset
 * This eliminates the need to hardcode GRIB_VALID_TIME values!
 */
export const useWindBands = (
  tilesetId: string = "onwaterllc.wind-hrrr-daily",
  accessToken: string
) => {
  const [bands, setBands] = useState<WindBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBands = async () => {
      try {
        // Fetch tileset metadata
        const response = await fetch(
          `https://api.mapbox.com/v4/${tilesetId}.json?access_token=${accessToken}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch tileset metadata: ${response.statusText}`);
        }

        const data = await response.json();

        // Extract bands from rasterarray metadata
        if (data.rasterarray?.bands) {
          const fetchedBands = data.rasterarray.bands.map((band: any, index: number) => {
            // Parse band name (could be GRIB_VALID_TIME or Band_X)
            const bandName = band.name || band;
            const timestamp = parseInt(bandName);

            return {
              name: bandName,
              displayName: isNaN(timestamp)
                ? bandName
                : formatTimestamp(timestamp, index),
              timestamp: isNaN(timestamp) ? undefined : timestamp,
            };
          });

          setBands(fetchedBands);
        } else {
          // Fallback: create default bands
          setBands([
            { name: "Band_1", displayName: "Hour 03 UTC" },
            { name: "Band_2", displayName: "Hour 07 UTC" },
            { name: "Band_3", displayName: "Hour 12 UTC" },
            { name: "Band_4", displayName: "Hour 16 UTC" },
          ]);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching wind bands:", err);
        setError(err instanceof Error ? err.message : "Unknown error");

        // Fallback to default bands
        setBands([
          { name: "Band_1", displayName: "Hour 03 UTC" },
          { name: "Band_2", displayName: "Hour 07 UTC" },
          { name: "Band_3", displayName: "Hour 12 UTC" },
          { name: "Band_4", displayName: "Hour 16 UTC" },
        ]);

        setLoading(false);
      }
    };

    if (accessToken) {
      fetchBands();
    }
  }, [tilesetId, accessToken]);

  return { bands, loading, error };
};

/**
 * Format Unix timestamp to human-readable time
 */
function formatTimestamp(timestamp: number, index: number): string {
  const date = new Date(timestamp * 1000);
  const hours = date.getUTCHours().toString().padStart(2, "0");

  // Fallback to index-based naming if date is invalid
  if (isNaN(date.getTime())) {
    const hourMap = ["03:00", "07:00", "12:00", "16:00"];
    return `${hourMap[index] || `Hour ${index + 1}`} UTC`;
  }

  return `${hours}:00 UTC`;
}

/**
 * Alternative: Simplified hook that just provides band indices
 */
export const useWindBandIndices = (count: number = 4) => {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    name: `Band_${i + 1}`,
    displayName: ["03:00 UTC", "07:00 UTC", "12:00 UTC", "16:00 UTC"][i] || `Hour ${i + 1}`,
  }));
};
