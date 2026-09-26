import { useEffect, useRef, useState } from "react";
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

  // Read the response even when the backend returns an error.
  // This lets us handle responses such as HTTP 429 properly.
  const responseText = await response.text();

  let responseData;

  // The backend normally returns JSON, so convert it into
  // a JavaScript object when possible.
  try {
    responseData = JSON.parse(responseText);
  } catch {
    // If the backend returns plain text instead, keep it as text.
    responseData = responseText;
  }

  // Return both the status code and the backend response.
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

  // Stores reports that were successfully submitted by this user.
  const [feltReports, setFeltReports] = useState([]);

  // Stores nearby reports returned by the backend.
  const [nearbyReports, setNearbyReports] = useState([]);

  // Stores the number of nearby reports returned by the backend.
  const [nearbyReportCount, setNearbyReportCount] = useState(0);

  // Prevents another request while the current request is still processing.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Controls the temporary warning shown when the backend
  // says the user has already reported within 15 minutes.
  const [showAlreadyReported, setShowAlreadyReported] = useState(false);

  // Remembers that the user has successfully submitted a report.
  // This stays true even when a later click is rejected with 429.
  const [hasReported, setHasReported] = useState(false);

  // Keeps track of the warning timer so we can cancel an old timer
  // before starting a new one.
  const hideWarningTimeoutRef = useRef(null);

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

  useEffect(() => {
    // Clear the warning timer if the page is closed
    // or this component is removed.
    return () => {
      if (hideWarningTimeoutRef.current) {
        clearTimeout(hideWarningTimeoutRef.current);
      }
    };
  }, []);

  // Shows the "already reported" warning and hides it again
  // after two seconds.
  const showAlreadyReportedWarning = () => {
    // Cancel any existing timer first.
    // This prevents multiple timers from fighting over the same state.
    if (hideWarningTimeoutRef.current) {
      clearTimeout(hideWarningTimeoutRef.current);
    }

    // Show the warning message.
    setShowAlreadyReported(true);

    // Hide the warning after two seconds.
    hideWarningTimeoutRef.current = setTimeout(() => {
      setShowAlreadyReported(false);
      hideWarningTimeoutRef.current = null;
    }, 2000);
  };

  const handleFeltThat = async () => {
    // We need the user's location before creating a report.
    if (!userLocation) {
      console.log("User location is not available yet.");
      return;
    }

    // Do not send another request while the current request
    // is still being processed.
    if (isSubmitting) {
      return;
    }

    try {
      // Lock the submission while the backend processes it.
      setIsSubmitting(true);

      // Hide an old warning before processing this click.
      setShowAlreadyReported(false);

      // Add a small random offset to protect the user's exact location.
      // The actual browser location is not sent directly to the backend.
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

      // These logs make it easier to see what the backend returned
      // while testing the application.
      console.log("========== REPORT RESPONSE ==========");
      console.log("Status code:", result?.statusCode);
      console.log("Response body:", result?.body);

      const data = result?.body;

      // HTTP 429 means the backend has rejected this report
      // because the user already reported within the last 15 minutes.
      if (result?.statusCode === 429) {
        console.log(
          "Report rejected: user already reported within the last 15 minutes.",
        );

        // Show the temporary warning.
        // The previous report result remains underneath it.
        showAlreadyReportedWarning();

        // Do not add another red dot because this report
        // was rejected by the backend.
        return;
      }

      // Handle other errors returned by the backend.
      if (result?.statusCode < 200 || result?.statusCode >= 300) {
        console.error("Report submission failed:", result?.statusCode, data);

        return;
      }

      // Only add the new report marker after the backend
      // confirms that the report was successfully registered.
      setFeltReports((reports) => [...reports, reportLocation]);

      // Store the nearby reports returned by the backend.
      setNearbyReports(data?.nearbyReports || []);

      // Store the number of nearby reports returned by the backend.
      setNearbyReportCount(data?.nearbyReportCount || 0);

      // Remember that the user has successfully submitted a report.
      // This allows the report result to remain visible after
      // the temporary 429 warning disappears.
      setHasReported(true);

      console.log("Report successfully registered.");
    } catch (error) {
      // Handle unexpected problems such as network
      // or authentication errors.
      console.error("Could not submit earthquake report:", error);
    } finally {
      // The request has finished, so another request can be attempted.
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

        {/* Show the 429 warning in the same position and size
            as the report-count message. It sits on top while visible. */}
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

        {/* Keep the successful report result in the same position
            and same size as the warning above.
            The warning has a higher z-index, so it temporarily covers
            this message. When the warning disappears, this message
            becomes visible again automatically. */}
        {hasReported && (
          <div className="auto-hide-message absolute top-5 left-1/2 -translate-x-1/2 z-[999] min-w-[320px] rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md shadow-2xl px-6 py-5">
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

      {/* Explain why report markers do not show exact user locations. */}
      <p className="text-sm text-gray-500 text-center px-6 py-3">
        Locations are shown with an offset and will not represent the actual
        location of other users&apos; reports.
      </p>
    </main>
  );
}

export default MainPage;
