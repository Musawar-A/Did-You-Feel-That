import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
} from "react-leaflet";

// Set up the normal Leaflet marker images.
// This makes sure the marker appears correctly when using Vite.
const userIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function LocationUpdater({ userLocation }) {
  const map = useMap();

  useEffect(() => {
    // Move the map to the user's location when we have it.
    if (userLocation) {
      map.setView([userLocation.latitude, userLocation.longitude], 13);
    }
  }, [userLocation, map]);

  return null;
}

function MapView({ userLocation, feltReports = [], nearbyReports = [] }) {
  // Auckland is shown until the user's location is available.
  const defaultPosition = [-36.8485, 174.7633];

  return (
    <div className="h-full w-full">
      <MapContainer
        center={defaultPosition}
        zoom={10}
        className="h-full w-full"
      >
        {/* Display the OpenStreetMap map. */}
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Move the map when the user's location becomes available. */}
        <LocationUpdater userLocation={userLocation} />

        {/* Show a marker for the current user's location. */}
        {userLocation && (
          <Marker
            position={[userLocation.latitude, userLocation.longitude]}
            icon={userIcon}
          >
            <Popup>You are here</Popup>
          </Marker>
        )}

        {/* Show red circles where people reported feeling an earthquake. */}
        {feltReports.map((report, index) => (
          <CircleMarker
            key={index}
            center={[report.latitude, report.longitude]}
            radius={8}
            pathOptions={{
              color: "red",
              fillColor: "red",
              fillOpacity: 0.8,
            }}
          >
            <Popup>Someone reported feeling an earthquake here.</Popup>
          </CircleMarker>
        ))}
        {/* Show reports returned by the Lambda on the map. */}
        {nearbyReports.map((report) => (
          <CircleMarker
            key={report.reportID}
            center={[report.latitude, report.longitude]}
            radius={8}
            pathOptions={{
              color: "red",
              fillColor: "red",
              fillOpacity: 0.8,
            }}
          >
            <Popup>
              Someone reported feeling an earthquake here.
              <br />
              Distance: {report.distanceKm} km
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export default MapView;
