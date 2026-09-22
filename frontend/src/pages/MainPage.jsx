import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import MapView from "../components/MapView";

// Sends the user's earthquake report to the API Gateway.
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

  // Return whatever the backend sends back.
  return response.json();
}

function MainPage() {
  // Stores the user's current browser location.
  const [userLocation, setUserLocation] = useState(null);

  // Used to give the button a pressed appearance.
  const [isPressed, setIsPressed] = useState(false);

  // Stores the user's own report so it can be shown on the map.
  const [feltReports, setFeltReports] = useState([]);

  // Stores nearby reports returned by the Lambda function.
  const [nearbyReports, setNearbyReports] = useState([]);

  // Stores the number of reports returned by the Lambda function.
  const [nearbyReportCount, setNearbyReportCount] = useState(0);

  // Keeps track of whether a report has already been submitted.
  const [reportSubmitted, setReportSubmitted] = useState(false);

  // Used to stop another click while the first report is still being processed.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Controls the message shown when the user tries to report again too soon.
  const [showAlreadyReported, setShowAlreadyReported] = useState(false);

  useEffect(() => {
    // Ask the browser for permission to use the user's location.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        // Save the location so it can be displayed on the map.
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
    // If the first request is still being processed, don't send another one.
    if (isSubmitting) {
      setShowAlreadyReported(true);

      setTimeout(() => {
        setShowAlreadyReported(false);
      }, 3000);

      return;
    }

    // Prevent the same user from submitting another report
    // during the 10-minute waiting period.
    if (reportSubmitted) {
      setShowAlreadyReported(true);

      setTimeout(() => {
        setShowAlreadyReported(false);
      }, 3000);

      return;
    }

    // The user needs to have a location before submitting a report.
    if (!userLocation) {
      console.log("User location is not available yet.");
      return;
    }

    try {
      // Lock the submission while the request is being processed.
      setIsSubmitting(true);

      // Add a small random offset so the user's exact location
      // is not sent to the backend.
      const latitudeOffset = (Math.random() - 0.5) * 0.05;
      const longitudeOffset = (Math.random() - 0.5) * 0.05;

      const reportLocation = {
        latitude: userLocation.latitude + latitudeOffset,
        longitude: userLocation.longitude + longitudeOffset,
      };

      // Show the user's report on the map immediately.
      setFeltReports((reports) => [...reports, reportLocation]);

      // Send the offset location to API Gateway.
      const result = await submitReport(
        reportLocation.latitude,
        reportLocation.longitude,
      );

      // Show the complete response returned by the Lambda.
      console.log("========== LAMBDA RESPONSE ==========");
      console.log("Full response:", result);
      console.log("Response body:", result?.body);
      console.log("Response body type:", typeof result?.body);

      // The API may return the data directly or inside result.body.
      const rawData = result?.body ?? result;

      // If the response is a string, convert it into a JavaScript object.
      // If it is already an object, use it directly.
      const data = typeof rawData === "string" ? JSON.parse(rawData) : rawData;

      // Display the values returned by the Lambda in the browser console.
      console.log("========== PARSED LAMBDA DATA ==========");
      console.log("Message:", data?.message);
      console.log("Report ID:", data?.reportID);
      console.log("Timestamp:", data?.timestamp);
      console.log("Nearby report count:", data?.nearbyReportCount);
      console.log("Nearby reports:", data?.nearbyReports);

      // Store the nearby reports so they can be displayed on the map.
      setNearbyReports(data?.nearbyReports || []);

      // Store the number of reports returned by the Lambda.
      setNearbyReportCount(data?.nearbyReportCount || 0);

      // The report was successfully registered.
      setReportSubmitted(true);

      // Allow the user to submit another report after 10 minutes.
      setTimeout(
        () => {
          setReportSubmitted(false);
        },
        10 * 60 * 1000,
      );
    } catch (error) {
      // If something goes wrong, allow the user to try again.
      console.error("Could not submit earthquake report:", error);
    } finally {
      // The first request has finished, so another click can be processed.
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Page title and earthquake reporting button. */}
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

      {/* Map and floating messages. */}
      <div className="h-[600px] w-full relative">
        <MapView
          userLocation={userLocation}
          feltReports={feltReports}
          nearbyReports={nearbyReports}
        />

        {/* Message shown when the user tries to submit another report too soon. */}
        {showAlreadyReported && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[1000] min-w-[320px] rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md shadow-2xl px-6 py-5">
            <p className="text-center text-gray-900 font-bold text-lg">
              Your report has already been registered.
            </p>

            <p className="text-sm text-gray-700 text-center mt-2 font-medium">
              You can report again after 10 minutes.
            </p>
          </div>
        )}

        {/* Shows how many people reported feeling the earthquake. */}
        {!showAlreadyReported && nearbyReportCount > 0 && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[1000] min-w-[320px] rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md shadow-2xl px-6 py-5">
            <p className="text-center text-gray-900 font-bold text-lg">
              {nearbyReportCount === 1 ? (
                <span className="font-semibold text-lg">
                  You are the first person to feel this earthquake.
                </span>
              ) : (
                <>
                  <span className="text-4xl font-extrabold text-red-600 mr-2">
                    {nearbyReportCount + 1}
                  </span>

                  <span className="text-xl font-bold">
                    people felt this earthquake
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
    </main>
  );
}

export default MainPage;
