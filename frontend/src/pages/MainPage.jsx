import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import MapView from "../components/MapView";

// Sends the user's earthquake report to the API Gateway.
async function submitReport(latitude, longitude) {
  // Get the login tokens from the current Cognito session.
  const { tokens } = await fetchAuthSession();

  const idToken = tokens?.idToken?.toString();

  // Stop here if the user is not logged in.
  if (!idToken) {
    throw new Error("User is not authenticated");
  }

  // Send the report to the backend through API Gateway.
  const response = await fetch(
    `${import.meta.env.VITE_API_GATEWAY_URL_REPORTS}/reports`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: idToken,
      },
      body: JSON.stringify({
        latitude,
        longitude,
      }),
    },
  );

  // Show the backend error if the request was not successful.
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Report submission failed: ${error}`);
  }

  // Return the response from the backend.
  return response.json();
}

function MainPage() {
  // Keeps track of the user's current location.
  const [userLocation, setUserLocation] = useState(null);

  const [isPressed, setIsPressed] = useState(false); //someone clicked the i felt that button or not

  // Keeps the reports that are currently displayed on the map.
  const [feltReports, setFeltReports] = useState([]);
  //to collect the returned json
  const [nearbyReports, setNearbyReports] = useState([]);
  const [nearbyReportCount, setNearbyReportCount] = useState(0);

  useEffect(() => {
    // Ask the browser for permission to access the user's location.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        // Save the user's location so the map can show it.
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

  const handleFeltThat = async () => {
    // The user cannot submit a report until their location is available.
    if (!userLocation) {
      console.log("User location is not available yet.");
      return;
    }

    try {
      // Add a small random offset so the user's exact location
      // is not sent to the backend or shown as the report location.
      const latitudeOffset = (Math.random() - 0.5) * 0.05;
      const longitudeOffset = (Math.random() - 0.5) * 0.05;

      const reportLocation = {
        latitude: userLocation.latitude + latitudeOffset,
        longitude: userLocation.longitude + longitudeOffset,
      };

      // Show the report immediately on the map using the
      // same offset location that will be sent to the backend.
      setFeltReports((reports) => [...reports, reportLocation]);

      // Send the already-offset coordinates to API Gateway.
      // The backend should therefore never receive the exact
      // browser location.
      const result = await submitReport(
        reportLocation.latitude,
        reportLocation.longitude,
      );

      // Show the complete response returned by Lambda.
      console.log("========== LAMBDA RESPONSE ==========");
      console.log("Full response:", result);
      console.log("Response body:", result.body);

      // Convert the Lambda body from JSON string to JavaScript object.
      const data = JSON.parse(result.body);

      // Show the individual returned values in the console.
      console.log("========== PARSED LAMBDA DATA ==========");
      console.log("Message:", data.message);
      console.log("Report ID:", data.reportID);
      console.log("Timestamp:", data.timestamp);
      console.log("Nearby report count:", data.nearbyReportCount);
      console.log("Nearby reports:", data.nearbyReports);

      // Store the returned values for the frontend.
      setNearbyReports(data.nearbyReports || []);
      setNearbyReportCount(data.nearbyReportCount || 0);
    } catch (error) {
      // Keep the error visible in the browser console while testing.
      console.error("Could not submit earthquake report:", error);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Shows the page title and lets the user report an earthquake. */}
      <div className="px-6 py-5">
        <h2 className="text-2xl font-semibold text-gray-900">
          Earthquakes Near You
        </h2>

        <p className="text-gray-600 mt-1">
          Click the button if you felt an earthquake.
        </p>

        {/* Sends the earthquake report when the user clicks the button. */}
        <button
          onClick={handleFeltThat}
          onPointerDown={() => setIsPressed(true)}
          onPointerUp={() => setIsPressed(false)}
          onPointerCancel={() => setIsPressed(false)}
          onPointerLeave={() => setIsPressed(false)}
          className={`
            mt-4
            ${isPressed ? "bg-red-900" : "bg-red-600"}
            hover:bg-red-700
            text-white
            font-semibold
            px-10
            py-4
            rounded-md
            text-lg
            cursor-pointer
            transition-colors
          `}
        >
          I FELT THAT
        </button>
      </div>

      {/* Gives the map both the user's location and submitted reports. */}
      <div className="h-[600px] w-full">
        <MapView
          userLocation={userLocation}
          feltReports={feltReports}
          nearbyReports={nearbyReports}
        />
        {nearbyReports.length > 0 && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-xl shadow-lg px-5 py-4 min-w-[280px]">
            <p className="font-semibold text-gray-900 text-center">
              {nearbyReportCount === 1
                ? "You are the first person to feel this earthquake."
                : `${nearbyReportCount - 1} other ${
                    nearbyReportCount - 1 === 1 ? "person" : "people"
                  } also felt this earthquake.`}
            </p>

            <p className="text-sm text-gray-600 text-center mt-1">
              Reports from the last 30 minutes.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default MainPage;
