import React, { useState, useEffect } from 'react';

interface WindForecastPopupProps {
  latitude: number;
  longitude: number;
  onClose: () => void;
}

interface CurrentWeather {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number;
  time: string;
}

interface HourlyData {
  time: string[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  wind_gusts_10m: number[];
  temperature_2m: number[];
}

interface OpenMeteoResponse {
  current_weather: CurrentWeather;
  hourly: HourlyData;
  elevation: number;
}

// Wind direction to cardinal
const getWindDirection = (degrees: number): string => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
};

// Beaufort scale
const getBeaufortScale = (speedKmh: number): { scale: number; description: string; color: string } => {
  if (speedKmh < 1) return { scale: 0, description: 'Calm', color: '#a8d5e5' };
  if (speedKmh < 6) return { scale: 1, description: 'Light air', color: '#a8d5e5' };
  if (speedKmh < 12) return { scale: 2, description: 'Light breeze', color: '#7ec8e3' };
  if (speedKmh < 20) return { scale: 3, description: 'Gentle breeze', color: '#5bb5d5' };
  if (speedKmh < 29) return { scale: 4, description: 'Moderate breeze', color: '#4CAF50' };
  if (speedKmh < 39) return { scale: 5, description: 'Fresh breeze', color: '#8BC34A' };
  if (speedKmh < 50) return { scale: 6, description: 'Strong breeze', color: '#CDDC39' };
  if (speedKmh < 62) return { scale: 7, description: 'High wind', color: '#FFEB3B' };
  if (speedKmh < 75) return { scale: 8, description: 'Gale', color: '#FFC107' };
  if (speedKmh < 89) return { scale: 9, description: 'Strong gale', color: '#FF9800' };
  if (speedKmh < 103) return { scale: 10, description: 'Storm', color: '#FF5722' };
  if (speedKmh < 118) return { scale: 11, description: 'Violent storm', color: '#f44336' };
  return { scale: 12, description: 'Hurricane', color: '#9C27B0' };
};

// Convert km/h to mph
const kmhToMph = (kmh: number): number => kmh * 0.621371;

// Format time for display
const formatHour = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
};

const WindForecastPopup: React.FC<WindForecastPopupProps> = ({ latitude, longitude, onClose }) => {
  const [data, setData] = useState<OpenMeteoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m&timezone=auto&forecast_days=2`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch weather data');
        
        const result: OpenMeteoResponse = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [latitude, longitude]);

  const currentBeaufort = data ? getBeaufortScale(data.current_weather.windspeed) : null;

  // Get next 24 hours of data
  const next24Hours = data?.hourly ? (() => {
    const now = new Date();
    const startIndex = data.hourly.time.findIndex(t => new Date(t) >= now);
    return {
      time: data.hourly.time.slice(startIndex, startIndex + 24),
      wind_speed_10m: data.hourly.wind_speed_10m.slice(startIndex, startIndex + 24),
      wind_direction_10m: data.hourly.wind_direction_10m.slice(startIndex, startIndex + 24),
      wind_gusts_10m: data.hourly.wind_gusts_10m.slice(startIndex, startIndex + 24),
      temperature_2m: data.hourly.temperature_2m.slice(startIndex, startIndex + 24),
    };
  })() : null;

  // Calculate max gust in next 24h
  const maxGust = next24Hours ? Math.max(...next24Hours.wind_gusts_10m) : 0;
  const avgWind = next24Hours ? next24Hours.wind_speed_10m.reduce((a, b) => a + b, 0) / next24Hours.wind_speed_10m.length : 0;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.coords}>
              {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
            </div>
            {data && (
              <div style={styles.elevation}>
                Elevation: {Math.round(data.elevation)}m
              </div>
            )}
          </div>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {loading && (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <span>Loading forecast...</span>
          </div>
        )}

        {error && (
          <div style={styles.errorContainer}>
            <span>⚠️ {error}</span>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Current Conditions */}
            <div style={styles.currentSection}>
              <div style={styles.windMain}>
                <div style={styles.windSpeedContainer}>
                  <div style={styles.windSpeedValue}>
                    {Math.round(kmhToMph(data.current_weather.windspeed))}
                  </div>
                  <div style={styles.windSpeedUnit}>mph</div>
                </div>
                
                <div style={styles.windCompass}>
                  <div 
                    style={{
                      ...styles.compassArrow,
                      transform: `rotate(${data.current_weather.winddirection}deg)`
                    }}
                  >
                    ↑
                  </div>
                  <div style={styles.compassDirection}>
                    {getWindDirection(data.current_weather.winddirection)}
                  </div>
                  <div style={styles.compassDegrees}>
                    {Math.round(data.current_weather.winddirection)}°
                  </div>
                </div>
              </div>

              {/* Beaufort Scale */}
              {currentBeaufort && (
                <div style={{...styles.beaufortBadge, backgroundColor: currentBeaufort.color}}>
                  <span style={styles.beaufortScale}>Force {currentBeaufort.scale}</span>
                  <span style={styles.beaufortDesc}>{currentBeaufort.description}</span>
                </div>
              )}
            </div>

            {/* Stats Row */}
            <div style={styles.statsRow}>
              <div style={styles.statCard}>
                <div style={styles.statIcon}>💨</div>
                <div style={styles.statValue}>{Math.round(kmhToMph(maxGust))}</div>
                <div style={styles.statLabel}>Max Gust (mph)</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statIcon}>📊</div>
                <div style={styles.statValue}>{Math.round(kmhToMph(avgWind))}</div>
                <div style={styles.statLabel}>Avg Wind (mph)</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statIcon}>🌡️</div>
                <div style={styles.statValue}>{Math.round(data.current_weather.temperature * 9/5 + 32)}°</div>
                <div style={styles.statLabel}>Temperature</div>
              </div>
            </div>

            {/* Hourly Forecast */}
            <div style={styles.forecastSection}>
              <div style={styles.forecastTitle}>24-Hour Wind Forecast</div>
              <div style={styles.forecastScroll}>
                {next24Hours?.time.slice(0, 24).map((time, i) => {
                  const speed = next24Hours.wind_speed_10m[i];
                  const direction = next24Hours.wind_direction_10m[i];
                  const gust = next24Hours.wind_gusts_10m[i];
                  const beaufort = getBeaufortScale(speed);
                  
                  return (
                    <div key={time} style={styles.forecastItem}>
                      <div style={styles.forecastTime}>{formatHour(time)}</div>
                      <div 
                        style={{
                          ...styles.forecastArrow,
                          transform: `rotate(${direction}deg)`,
                          color: beaufort.color
                        }}
                      >
                        ↑
                      </div>
                      <div style={styles.forecastSpeed}>
                        {Math.round(kmhToMph(speed))}
                      </div>
                      <div style={styles.forecastGust}>
                        G{Math.round(kmhToMph(gust))}
                      </div>
                      <div 
                        style={{
                          ...styles.forecastBar,
                          height: `${Math.min(speed / 50 * 40, 40)}px`,
                          backgroundColor: beaufort.color
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={styles.footer}>
              <span>Data: Open-Meteo API</span>
              <span>Updated: {new Date(data.current_weather.time).toLocaleTimeString()}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  popup: {
    backgroundColor: '#1a1a2e',
    borderRadius: '20px',
    width: '380px',
    maxWidth: '95vw',
    maxHeight: '85vh',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 20px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  coords: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
  },
  elevation: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  closeButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '16px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorContainer: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#ef4444',
  },
  currentSection: {
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  windMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '32px',
  },
  windSpeedContainer: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
  },
  windSpeedValue: {
    fontSize: '64px',
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1,
  },
  windSpeedUnit: {
    fontSize: '20px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: 500,
  },
  windCompass: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  compassArrow: {
    fontSize: '36px',
    color: '#3b82f6',
    transition: 'transform 0.3s ease',
  },
  compassDirection: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#fff',
  },
  compassDegrees: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  beaufortBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '20px',
    color: '#000',
    fontWeight: 600,
  },
  beaufortScale: {
    fontSize: '13px',
  },
  beaufortDesc: {
    fontSize: '13px',
    opacity: 0.8,
  },
  statsRow: {
    display: 'flex',
    gap: '12px',
    padding: '0 20px 20px',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  statIcon: {
    fontSize: '20px',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
  },
  statLabel: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  forecastSection: {
    padding: '0 20px 20px',
  },
  forecastTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '12px',
  },
  forecastScroll: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '8px',
  },
  forecastItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    minWidth: '44px',
    padding: '8px 4px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
  },
  forecastTime: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  forecastArrow: {
    fontSize: '18px',
    transition: 'transform 0.3s',
  },
  forecastSpeed: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
  },
  forecastGust: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  forecastBar: {
    width: '20px',
    borderRadius: '4px',
    marginTop: '4px',
    transition: 'height 0.3s',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 20px',
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.3)',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  },
};

// Add keyframes for spinner animation
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default WindForecastPopup;
