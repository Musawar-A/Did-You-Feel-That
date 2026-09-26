import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import MapView from "../components/MapView";

// Sends the earthquake report to the backend.
async function submitReport(latitude, longitude) {
  // Get the user's current Cognito login session.
  const { tokens } = await fetchAuthSession();

  const idToken = tokens?.idToken?.toString();

  // A report cannot be submitted unless the user is logged in.
  if (!idToken) {
    throw new Error("User is not authenticated");
  }

  // Send the report to our backend through API Gateway.
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

  // Read the response even when the backend returns an error.
  // This lets us handle responses such as HTTP 429 properly.
  const responseText = await response.text();

  let responseData;

  // The backend normally sends JSON, so convert the response
  // into a JavaScript object when possible.
  try {
    responseData = JSON.parse(responseText);
  } catch {
    // If the response is plain text instead, keep it as text.
    responseData = responseText;
  }

  // Return both the status code and the backend's response.
  return {
    statusCode: response.status,
    body: responseData,
  };
}

function MainPage() {
  // Stores the user's current browser location.
  const [userLocation, setUserLocation] = useState(null);

  // Makes the "I FELT THAT" button look pressed while clicking it.
  const [isPressed, setIsPressed] = useState(false);

  // Stores reports successfully submitted by this user.
  const [feltReports, setFeltReports] = useState([]);

  // Stores nearby reports returned by the backend.
  const [nearbyReports, setNearbyReports] = useState([]);

  // Stores how many nearby reports the backend found.
  const [nearbyReportCount, setNearbyReportCount] = useState(0);

  // Prevents another request while the current request is still running.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Controls the message shown when the backend says
  // the user has already reported within the last 15 minutes.
  const [showAlreadyReported, setShowAlreadyReported] = useState(false);

  // Remembers that the user has successfully submitted a report.
  // This allows the previous report-count message to appear again
  // after the temporary warning disappears.
  const [hasReported, setHasReported] = useState(false);

  useEffect(() => {
    // Ask the browser for permission to use the user's location.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        // Save the current location so it can be shown on the map.
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
    // We need the user's location before creating a report.
    if (!userLocation) {
      console.log("User location is not available yet.");
      return;
    }

    // Do not send another request while the current one is still processing.
    if (isSubmitting) {
      return;
    }

    try {
      // Lock the submission while the backend is processing it.
      setIsSubmitting(true);

      // Remove any previous "already reported" warning
      // before processing this new click.
      setShowAlreadyReported(false);

      // Add a small random offset to protect the user's exact location.
      // The actual location is never sent directly to the backend.
      const latitudeOffset = (Math.random() - 0.5) * 0.05;
      const longitudeOffset = (Math.random() - 0.5) * 0.05;

      const reportLocation = {
        latitude: userLocation.latitude + latitudeOffset,
        longitude: userLocation.longitude + longitudeOffset,
      };

      // Send the privacy-adjusted location to the backend.
      const result = await submitReport(
        reportLocation.latitude,
        reportLocation.longitude,
      );

      // These logs make it easy to see exactly what the backend returned
      // while testing the application.
      console.log("========== REPORT RESPONSE ==========");
      console.log("Status code:", result?.statusCode);
      console.log("Response body:", result?.body);

      const data = result?.body;

      // 15-MINUTE RESTRICTION
      // The backend is responsible for checking whether this user
      // has already submitted a report within the last 15 minutes.
      //
      // If the backend returns 429, the report was not accepted.
      if (result?.statusCode === 429) {
        console.log(
          "Report rejected: user already reported within the last 15 minutes.",
        );

        // Show the temporary warning message.
        setShowAlreadyReported(true);

        // Hide the warning after 2.5 seconds.
        // We are NOT calculating the 15-minute restriction here.
        // The backend is responsible for that.
        setTimeout(() => {
          setShowAlreadyReported(false);
        }, 2500);

        // Stop here because this report was not accepted.
        return;
      }

      // OTHER BACKEND ERRORS
      // If the response is not a successful 2xx response,
      // something else went wrong with the request.
      if (result?.statusCode < 200 || result?.statusCode >= 300) {
        console.error("Report submission failed:", result?.statusCode, data);

        return;
      }

      // SUCCESSFUL REPORT
      // Only show the new report marker after the backend
      // confirms that the report was successfully registered.
      setFeltReports((reports) => [...reports, reportLocation]);

      // Save the nearby reports returned by the backend.
      setNearbyReports(data?.nearbyReports || []);

      // Save the number of nearby reports returned by the backend.
      setNearbyReportCount(data?.nearbyReportCount || 0);

      // Remember that this user has successfully reported.
      // This is also used to bring the report-count message back
      // after the temporary 429 warning disappears.
      setHasReported(true);

      console.log("Report successfully registered.");
    } catch (error) {
      // Handle unexpected problems such as network errors
      // or authentication problems.
      console.error("Could not submit earthquake report:", error);
    } finally {
      // The request has finished, so another click can be processed.
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Page heading and earthquake report button. */}
      <div className="px-6 py-5">
        <h2 className="text-2xl font-semibold text-gray-900">
          Earthquakes Near You
        </h2>

        <p className="text-gray-600 mt-1">
          Click the button if you felt an earthquake.
        </p>

        {/* Main button used to submit an earthquake report. */}
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

      {/* Map and temporary information messages. */}
      <div className="h-[600px] w-full relative">
        <MapView
          userLocation={userLocation}
          feltReports={feltReports}
          nearbyReports={nearbyReports}
        />

        {/* Show this message when the backend returns HTTP 429.
            The message automatically disappears after 2.5 seconds. */}
        {showAlreadyReported && (
          <div className="auto-hide-message absolute top-5 left-1/2 -translate-x-1/2 z-[1000] min-w-[320px] rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md shadow-2xl px-6 py-5">
            <p className="text-center text-gray-900 font-bold text-lg">
              Your report has already been registered.
            </p>

            <p className="text-sm text-gray-700 text-center mt-2 font-medium">
              You can report again after 15 minutes.
            </p>
          </div>
        )}

        {/* Show the successful report result.
            Because hasReported stays true, this message can appear
            again after the temporary 429 warning disappears. */}
        {hasReported && !showAlreadyReported && (
          <div className="auto-hide-message absolute top-5 left-1/2 -translate-x-1/2 z-[1000] min-w-[320px] rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md shadow-2xl px-6 py-5">
            <p className="text-center text-gray-900 font-bold text-lg">
              {nearbyReportCount === 0 ? (
                <span className="text-xl font-bold">
                  You are the first person to feel this Shake within 10 km.
                </span>
              ) : (
                <>
                  <span className="text-4xl font-extrabold text-red-600 mr-2">
                    {nearbyReportCount + 1}
                  </span>

                  <span className="text-xl font-bold">
                    people within 10 km felt this Shake
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

      {/* Explain why report markers are not exact user locations. */}
      <p className="text-sm text-gray-500 text-center px-6 py-3">
        Locations are shown with an offset and will not represent the actual
        location of other users&apos; reports.
      </p>
    </main>
  );
}

export default MainPage;
