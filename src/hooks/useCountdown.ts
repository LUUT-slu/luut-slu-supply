import { useState, useEffect } from "react";

interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  formatted: string; // e.g. "5D 03H 12M"
}

export function useCountdown(endDate: string | null | undefined): CountdownResult {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!endDate) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  if (!endDate) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, formatted: "" };
  }

  const end = new Date(endDate).getTime();
  const diff = end - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, formatted: "" };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}D`);
  parts.push(`${String(hours).padStart(2, "0")}H`);
  parts.push(`${String(minutes).padStart(2, "0")}M`);

  return { days, hours, minutes, seconds, isExpired: false, formatted: parts.join(" ") };
}
