import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

function LocationUpdater({ userLocation }) {
  const map = useMap();

  useEffect(() => {
    // Move the map to the user's location.
    if (userLocation) {
      map.setView([userLocation.latitude, userLocation.longitude], 13);
    }
  }, [userLocation, map]);

  return null;
}

function MapView({ userLocation, feltReports = [] }) {
  // Show Auckland first if the user's location is not ready yet.
  const defaultPosition = [-36.8485, 174.7633];

  return (
    // Make the map fill the whole area.
    <div className="h-full w-full">
      <MapContainer
        center={defaultPosition}
        zoom={10}
        className="h-full w-full"
      >
        {/* Loads the map tiles. */}
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Move the map when the user's location is found. */}
        <LocationUpdater userLocation={userLocation} />

        {/* Show where the current user is. */}
        {userLocation && (
          <Marker position={[userLocation.latitude, userLocation.longitude]}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {/* Show red circles for people who reported feeling an earthquake. */}
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
      </MapContainer>
    </div>
  );
}

export default MapView;
