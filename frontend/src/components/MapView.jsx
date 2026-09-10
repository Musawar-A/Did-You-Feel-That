import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function MapView() {
  // These are temporary coordinates for Hamilton.
  // Later, the map will automatically use the user's location.
  const hamiltonPosition = [-37.787, 175.279];

  return (
    // h-full = use all available height.
    // w-full = use all available width.
    <div className="h-full w-full">
      <MapContainer
        center={hamiltonPosition}
        zoom={10}
        className="h-full w-full"
      >
        {/* 
          TileLayer provides the actual map background.
          Leaflet controls the map, while these tiles give us
          the roads, land and other map details.
        */}
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 
          This is a temporary earthquake marker.
          Later, these coordinates will come from GeoNet.
        */}
        <Marker position={hamiltonPosition}>
          {/* 
            Popup appears when the user clicks the earthquake marker.
          */}
          <Popup>
            {/* Basic information about this earthquake. */}
            <strong>M4.8 Earthquake</strong>
            <br />
            Near Hamilton
            <br />
            12 people felt it
            <br />
            <br />
            {/* 
            This button lets the user report that they felt this earthquake.
            For now it only displays the button.
            Later, clicking it will send the report to our backend.
        */}
            <button
              type="button"
              className="bg-stone-800 text-white px-4 py-2 rounded-lg
                    font-semibold hover:bg-stone-500 cursor-pointer"
            >
              I FELT IT
            </button>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

export default MapView;
