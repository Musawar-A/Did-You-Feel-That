import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import MapView from "../components/MapView";

// Sends the user's earthquake report to API Gateway.
async function submitReport(latitude, longitude) {
  // Get the login token from the current Cognito session.
  const { tokens } = await fetchAuthSession();

  const idToken = tokens?.idToken?.toString();

  // The report cannot be submitted if the user is not logged in.
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

// Calculates the approximate distance between two latitude/longitude points.
// This is used to check whether the user is still in roughly the same location.
function getDistanceInMetres(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000;

  const latDifference = ((lat2 - lat1) * Math.PI) / 180;
  const lonDifference = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(latDifference / 2) * Math.sin(latDifference / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(lonDifference / 2) *
      Math.sin(lonDifference / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

function MainPage() {
  // Stores the user's current browser location.
  const [userLocation, setUserLocation] = useState(null);

  // Gives the "I FELT THAT" button a pressed appearance.
  const [isPressed, setIsPressed] = useState(false);

  // Stores the user's own reports displayed on the map.
  const [feltReports, setFeltReports] = useState([]);

  // Stores nearby reports returned by Lambda.
  const [nearbyReports, setNearbyReports] = useState([]);

  // Stores the number of nearby reports returned by Lambda.
  const [nearbyReportCount, setNearbyReportCount] = useState(0);

  // Prevents another request while the first request is still processing.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Controls the "already registered" message.
  const [showAlreadyReported, setShowAlreadyReported] = useState(false);

  // Stores the location and time of the user's last successful report.
  const [lastReport, setLastReport] = useState(null);

  useEffect(() => {
    // Ask the browser for permission to access the user's location.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        // Save the actual browser location.
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
    // Make sure the user's location is available first.
    if (!userLocation) {
      console.log("User location is not available yet.");
      return;
    }

    // Stop a second click while the first report is still being submitted.
    if (isSubmitting) {
      setShowAlreadyReported(true);

      setTimeout(() => {
        setShowAlreadyReported(false);
      }, 3000);

      return;
    }

    // If the user has submitted a report before, check whether
    // they are still within the 10-minute restriction.
    if (lastReport) {
      const tenMinutes = 10 * 60 * 1000;

      const timePassed = Date.now() - lastReport.time;

      // Calculate how far the user has moved since their previous report.
      const distanceFromLastReport = getDistanceInMetres(
        lastReport.latitude,
        lastReport.longitude,
        userLocation.latitude,
        userLocation.longitude,
      );

      // Treat the user as being in the same location if they are
      // within 100 metres of their previous reporting location.
      const sameLocation = distanceFromLastReport <= 100;

      // Block another report when the user is in the same area
      // and the previous report was less than 10 minutes ago.
      if (sameLocation && timePassed < tenMinutes) {
        setShowAlreadyReported(true);

        setTimeout(() => {
          setShowAlreadyReported(false);
        }, 3000);

        return;
      }
    }

    try {
      // Lock the button while the report is being processed.
      setIsSubmitting(true);

      // Add a random offset to protect the user's exact location.
      // The actual browser location is used only for the 10-minute
      // same-location check above.
      const latitudeOffset = (Math.random() - 0.5) * 0.05;
      const longitudeOffset = (Math.random() - 0.5) * 0.05;

      const reportLocation = {
        latitude: userLocation.latitude + latitudeOffset,
        longitude: userLocation.longitude + longitudeOffset,
      };

      // Show the offset report location on the map.
      setFeltReports((reports) => [...reports, reportLocation]);

      // Send the offset coordinates to the backend.
      const result = await submitReport(
        reportLocation.latitude,
        reportLocation.longitude,
      );

      // Display the complete response from Lambda while testing.
      console.log("========== LAMBDA RESPONSE ==========");
      console.log("Full response:", result);
      console.log("Response body:", result?.body);
      console.log("Response body type:", typeof result?.body);

      // The API may return the data directly or inside result.body.
      const rawData = result?.body ?? result;

      // Convert the response into a JavaScript object if necessary.
      const data = typeof rawData === "string" ? JSON.parse(rawData) : rawData;

      // Display the returned Lambda values in the browser console.
      console.log("========== PARSED LAMBDA DATA ==========");
      console.log("Message:", data?.message);
      console.log("Report ID:", data?.reportID);
      console.log("Timestamp:", data?.timestamp);
      console.log("Nearby report count:", data?.nearbyReportCount);
      console.log("Nearby reports:", data?.nearbyReports);

      // Store the nearby reports so they can be displayed on the map.
      setNearbyReports(data?.nearbyReports || []);

      // Store the number returned by Lambda.
      setNearbyReportCount(data?.nearbyReportCount || 0);

      // Save the ACTUAL browser location and submission time.
      // The offset location sent to the backend is not used here.
      setLastReport({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        time: Date.now(),
      });

      console.log("Report successfully registered.");
    } catch (error) {
      // If something fails, allow the user to try again.
      console.error("Could not submit earthquake report:", error);
    } finally {
      // The request has finished, so another request can be attempted.
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Page heading and report button. */}
      <div className="px-6 py-5">
        <h2 className="text-2xl font-semibold text-gray-900">
          Earthquakes Near You
        </h2>

        <p className="text-gray-600 mt-1">
          Click the button if you felt an earthquake.
        </p>

        {/* Lets the user submit an earthquake report. */}
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

      {/* Map and floating information messages. */}
      <div className="h-[600px] w-full relative">
        <MapView
          userLocation={userLocation}
          feltReports={feltReports}
          nearbyReports={nearbyReports}
        />

        {/* Tell the user when another report cannot be submitted yet. */}
        {showAlreadyReported && (
          <div className="auto-hide-message absolute top-5 left-1/2 -translate-x-1/2 z-[1000] min-w-[320px] rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md shadow-2xl px-6 py-5">
            <p className="text-center text-gray-900 font-bold text-lg">
              Your report has already been registered.
            </p>

            <p className="text-sm text-gray-700 text-center mt-2 font-medium">
              You can report again after 10 minutes.
            </p>
          </div>
        )}

        {/* Show the number of people who felt the earthquake. */}
        {!showAlreadyReported && nearbyReportCount > 0 && (
          <div className="auto-hide-message absolute top-5 left-1/2 -translate-x-1/2 z-[1000] min-w-[320px] rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md shadow-2xl px-6 py-5">
            <p className="text-center text-gray-900 font-bold text-lg">
              {nearbyReportCount === 1 ? (
                <span className="font-semibold text-lg">
                  You are the first person to feel this Shake.
                </span>
              ) : (
                <>
                  <span className="text-4xl font-extrabold text-red-600 mr-2">
                    {nearbyReportCount + 1}
                  </span>

                  <span className="text-xl font-bold">
                    people felt this Shake
                  </span>
                </>
              )}
            </p>

            <p className="text-sm text-gray-700 text-center mt-2 font-medium">
              Reports from the last 30 minutes
            </p>
          </div>
        )}
      </div>

      {/* Privacy note explaining why report markers are not exact locations. */}
      <p className="text-sm text-gray-500 text-center px-6 py-3">
        Locations are shown with an offset and will not represent the actual
        location of other users' reports.
      </p>
    </main>
  );
}

export default MainPage;
