import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Text } from "react-native";
import { C } from "@/src/theme";

// Loads Leaflet from a CDN once, since it's a plain JS/CSS library with no
// npm package needed for this simple use case — keeps the app bundle small.
let leafletLoading: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => resolve((window as any).L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return leafletLoading;
}

type Point = { id: string; lat: number; lng: number; self?: boolean; user?: any };

export default function WorldMap({ points }: { points: Point[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([20, 0], 2);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      mapRef.current = map;
      renderMarkers(L);
    });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ((window as any).L && mapRef.current) renderMarkers((window as any).L);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  function renderMarkers(L: any) {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    if (points.length === 0) return;

    points.forEach((p) => {
      const name = p.self ? "You" : p.user?.display_name || "Friend";
      const avatarUrl = p.user?.avatar;
      const ringColor = p.self ? "#3B82F6" : "#8B5CF6";
      const html = `
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div style="width:44px;height:44px;border-radius:50%;border:3px solid ${ringColor};overflow:hidden;background:#1F2937;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
            ${
              avatarUrl
                ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;">${name[0]?.toUpperCase() || "?"}</div>`
            }
          </div>
          <div style="margin-top:4px;background:rgba(0,0,0,0.7);color:#fff;font-size:11px;font-weight:600;padding:2px 6px;border-radius:6px;white-space:nowrap;">${name}</div>
        </div>`;
      const icon = L.divIcon({ html, className: "", iconSize: [60, 60], iconAnchor: [30, 30] });
      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
      markersRef.current.push(marker);
    });

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13);
    } else {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }

  return (
    <View style={styles.wrap}>
      {/* @ts-ignore — plain DOM element, valid under react-native-web */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {points.length === 0 && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyOverlayText}>No one to show yet</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.surface },
  emptyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyOverlayText: { color: "#fff", fontSize: 14 },
});
