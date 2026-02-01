/**
 * Forecast Animation Controller
 *
 * Provides play/pause animation controls for cycling through forecast hours.
 * Includes timeline slider, speed control, and loop toggle.
 *
 * Part of TICKET-014: Implement Forecast Hour Animation
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { ModelRun } from "../hooks/useWeatherMetadata";

interface ForecastAnimationControllerProps {
  forecastHours: string[];
  selectedForecast: string;
  onForecastChange: (forecast: string) => void;
  modelRun: ModelRun | null;
  preloadProgress?: number;
}

type AnimationSpeed = 1 | 2 | 4;

const ForecastAnimationController: React.FC<ForecastAnimationControllerProps> = ({
  forecastHours,
  selectedForecast,
  onForecastChange,
  modelRun,
  preloadProgress = 100,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState<AnimationSpeed>(1);
  const [loopAnimation, setLoopAnimation] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get current index in forecast hours array
  const currentIndex = useMemo(() => {
    const idx = forecastHours.indexOf(selectedForecast);
    return idx >= 0 ? idx : 0;
  }, [forecastHours, selectedForecast]);

  // Calculate interval based on speed
  const getIntervalMs = useCallback((speed: AnimationSpeed): number => {
    const baseInterval = 1500; // 1.5 seconds per frame
    return baseInterval / speed;
  }, []);

  // Animation effect
  useEffect(() => {
    if (isAnimating && forecastHours.length > 1) {
      intervalRef.current = setInterval(() => {
        const currentIdx = forecastHours.indexOf(selectedForecast);
        const nextIdx = currentIdx + 1;

        if (nextIdx >= forecastHours.length) {
          if (loopAnimation) {
            onForecastChange(forecastHours[0]);
          } else {
            setIsAnimating(false);
          }
        } else {
          onForecastChange(forecastHours[nextIdx]);
        }
      }, getIntervalMs(animationSpeed));
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAnimating, animationSpeed, loopAnimation, forecastHours, selectedForecast, onForecastChange, getIntervalMs]);

  // Calculate validity time from model run
  const validityTime = useMemo(() => {
    if (!modelRun?.unix_timestamp) return null;

    const forecastHourNum = parseInt(selectedForecast, 10) || 0;
    const runDate = new Date(modelRun.unix_timestamp * 1000);
    const validDate = new Date(runDate.getTime() + forecastHourNum * 60 * 60 * 1000);

    return validDate.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });
  }, [modelRun, selectedForecast]);

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    setIsAnimating(false); // Pause when manually changing
    onForecastChange(forecastHours[index]);
  };

  // Handle previous/next buttons
  const handlePrevious = () => {
    setIsAnimating(false);
    const newIndex = Math.max(0, currentIndex - 1);
    onForecastChange(forecastHours[newIndex]);
  };

  const handleNext = () => {
    setIsAnimating(false);
    const newIndex = Math.min(forecastHours.length - 1, currentIndex + 1);
    onForecastChange(forecastHours[newIndex]);
  };

  // Toggle play/pause
  const togglePlayPause = () => {
    setIsAnimating(!isAnimating);
  };

  // Cycle through speed options
  const cycleSpeed = () => {
    const speeds: AnimationSpeed[] = [1, 2, 4];
    const currentIdx = speeds.indexOf(animationSpeed);
    const nextIdx = (currentIdx + 1) % speeds.length;
    setAnimationSpeed(speeds[nextIdx]);
  };

  if (forecastHours.length <= 1) {
    return null;
  }

  const isAtStart = currentIndex === 0;
  const isAtEnd = currentIndex === forecastHours.length - 1;

  return (
    <div style={{ marginTop: "12px" }}>
      {/* Validity Time Display */}
      {validityTime && (
        <div
          style={{
            padding: "8px 10px",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "4px",
            marginBottom: "10px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "10px", opacity: 0.7, marginBottom: "2px" }}>
            Forecast Valid Time
          </div>
          <div style={{ fontSize: "13px", fontWeight: 500 }}>
            {validityTime}
            <span style={{ opacity: 0.6, marginLeft: "6px" }}>
              (+{selectedForecast.padStart(2, "0")}h)
            </span>
          </div>
        </div>
      )}

      {/* Timeline Slider */}
      <div style={{ marginBottom: "10px" }}>
        <input
          type="range"
          min="0"
          max={forecastHours.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          style={{
            width: "100%",
            height: "6px",
            borderRadius: "3px",
            background: `linear-gradient(to right, #4CAF50 0%, #4CAF50 ${(currentIndex / (forecastHours.length - 1)) * 100}%, rgba(255,255,255,0.2) ${(currentIndex / (forecastHours.length - 1)) * 100}%, rgba(255,255,255,0.2) 100%)`,
            outline: "none",
            cursor: "pointer",
            WebkitAppearance: "none",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "4px",
            fontSize: "10px",
            opacity: 0.6,
          }}
        >
          <span>F{forecastHours[0].padStart(2, "0")}</span>
          <span>F{forecastHours[forecastHours.length - 1].padStart(2, "0")}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          disabled={isAtStart}
          style={{
            padding: "6px 10px",
            background: isAtStart ? "rgba(255,255,255,0.05)" : "#333",
            border: "none",
            borderRadius: "4px",
            color: isAtStart ? "rgba(255,255,255,0.3)" : "white",
            cursor: isAtStart ? "not-allowed" : "pointer",
            fontSize: "14px",
          }}
          title="Previous Hour"
        >
          ◀
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={togglePlayPause}
          style={{
            flex: 1,
            padding: "6px 10px",
            background: isAnimating ? "#f44336" : "#4CAF50",
            border: "none",
            borderRadius: "4px",
            color: "white",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 500,
            transition: "background 0.2s",
          }}
        >
          {isAnimating ? "⏸ Pause" : "▶ Play"}
        </button>

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={isAtEnd}
          style={{
            padding: "6px 10px",
            background: isAtEnd ? "rgba(255,255,255,0.05)" : "#333",
            border: "none",
            borderRadius: "4px",
            color: isAtEnd ? "rgba(255,255,255,0.3)" : "white",
            cursor: isAtEnd ? "not-allowed" : "pointer",
            fontSize: "14px",
          }}
          title="Next Hour"
        >
          ▶
        </button>

        {/* Speed Button */}
        <button
          onClick={cycleSpeed}
          style={{
            padding: "6px 8px",
            background: "#333",
            border: "none",
            borderRadius: "4px",
            color: "white",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 500,
            minWidth: "38px",
          }}
          title="Animation Speed"
        >
          {animationSpeed}x
        </button>
      </div>

      {/* Loop Toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "8px",
          fontSize: "11px",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            opacity: 0.8,
          }}
        >
          <input
            type="checkbox"
            checked={loopAnimation}
            onChange={(e) => setLoopAnimation(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          Loop
        </label>

        {preloadProgress < 100 && (
          <span style={{ opacity: 0.6 }}>
            Loading... {preloadProgress}%
          </span>
        )}
      </div>
    </div>
  );
};

export default ForecastAnimationController;
