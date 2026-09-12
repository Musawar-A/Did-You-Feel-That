import { useEffect, useState } from "react";
import MapView from "../components/MapView";

function MainPage() {
  // Stores the user's current location.
  const [userLocation, setUserLocation] = useState(null);

  // Stores the locations of people who clicked "I FELT THAT".
  const [feltReports, setFeltReports] = useState([]);

  useEffect(() => {
    // Ask the browser for the user's location.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setUserLocation({
          latitude,
          longitude,
        });
      },
      (error) => {
        console.log("Could not get location:", error);
      },
    );
  }, []);

  // Creates a slightly different location for the report
  // so the user's exact location is not shown.
  const handleFeltThat = () => {
    if (!userLocation) {
      console.log("User location is not available yet.");
      return;
    }

    // Small random offset from the real location.
    const latitudeOffset = (Math.random() - 0.5) * 0.05;
    const longitudeOffset = (Math.random() - 0.5) * 0.05;

    const reportLocation = {
      latitude: userLocation.latitude + latitudeOffset,
      longitude: userLocation.longitude + longitudeOffset,
    };

    // Add the new report to the map.
    setFeltReports((reports) => [...reports, reportLocation]);

    // Later this will send the report to the backend.
    // The backend will save the user ID, location and time.
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Page title and report button */}
      <div className="px-6 py-5">
        <h2 className="text-2xl font-semibold text-gray-900">
          Earthquakes Near You
        </h2>

        <p className="text-gray-600 mt-1">
          Click the button if you felt an earthquake.
        </p>

        {/* Lets the user report that they felt an earthquake */}
        <button
          onClick={handleFeltThat}
          className="
            mt-4
            bg-red-600
            hover:bg-red-700
            text-white
            font-semibold
            px-10
            py-4
            rounded-md
            text-lg
            cursor-pointer
          "
        >
          I FELT THAT
        </button>
      </div>

      {/* Pass the user location and reports to the map */}
      <div className="h-[600px] w-full">
        <MapView userLocation={userLocation} feltReports={feltReports} />
      </div>
    </main>
  );
}

export default MainPage;
