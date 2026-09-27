import { useEffect, useRef, useState } from "react";
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

  // Read the response so we can handle both successful
  // responses and backend errors such as HTTP 429.
  const responseText = await response.text();

  let responseData;

  // The backend normally returns JSON, so convert the response
  // into a JavaScript object when possible.
  try {
    responseData = JSON.parse(responseText);
  } catch {
    // If the backend returns plain text instead, keep it as text.
    responseData = responseText;
  }

  // Return the status code and response body so the page
  // can decide how to handle the result.
  return {
    statusCode: response.status,
    body: responseData,
  };
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

  // Tracks whether the user has submitted a report during this page session.
  const [hasReported, setHasReported] = useState(false);

  const [isReportAccepted, setIsReportAccepted] = useState(false);

  // Keeps the warning timer so it can be cancelled before
  // another timer is started.
  const hideWarningTimeoutRef = useRef(null);

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
      (error) => {},
    );
  }, []);

  useEffect(() => {
    // Clear the warning timer if the page is closed or
    // the component is removed before the timer finishes.
    return () => {
      if (hideWarningTimeoutRef.current) {
        clearTimeout(hideWarningTimeoutRef.current);
      }
    };
  }, []);

  // Shows the temporary warning and makes sure an older
  // warning timer cannot interfere with the new one.
  const showAlreadyReportedWarning = () => {
    if (hideWarningTimeoutRef.current) {
      clearTimeout(hideWarningTimeoutRef.current);
    }

    setShowAlreadyReported(true);

    // The backend controls the 15-minute restriction.
    // This timer only controls how long the message is visible.
    hideWarningTimeoutRef.current = setTimeout(() => {
      setShowAlreadyReported(false);
      hideWarningTimeoutRef.current = null;
    }, 2000);
  };

  const handleFeltThat = async () => {
    // Make sure the user's location is available first.
    if (!userLocation) {
      return;
    }

    // Stop a second click while the first report is still being submitted.
    if (isSubmitting) {
      return;
    }

    try {
      // Lock the button while the report is being processed.
      setIsSubmitting(true);

      // Hide an old warning before processing the new click.
      setShowAlreadyReported(false);

      // Add a random offset to protect the user's exact location.
      const latitudeOffset = (Math.random() - 0.5) * 0.05;
      const longitudeOffset = (Math.random() - 0.5) * 0.05;

      const reportLocation = {
        latitude: userLocation.latitude + latitudeOffset,
        longitude: userLocation.longitude + longitudeOffset,
      };

      // Send the offset coordinates to the backend.
      const result = await submitReport(
        reportLocation.latitude,
        reportLocation.longitude,
      );

      // Display the complete response from Lambda while testing.

      const data = result?.body;

      // The backend returns 429 when the user has already
      // submitted a report within the last 15 minutes.
      if (result?.statusCode === 429) {
        // Store the nearby reports returned by the backend.
        // This allows the map to show the reports even though
        // this new report was rejected.
        setNearbyReports(data?.nearbyReports || []);

        // Store the nearby report count returned by the backend.
        // This keeps the information from the previous report available.
        setNearbyReportCount(data?.nearbyReportCount || 0);

        // The previous report is already included in the backend count.
        setIsReportAccepted(false);

        //we have report information to display.
        setHasReported(true);

        // Show the warning for two seconds.
        // The report result underneath stays available.
        showAlreadyReportedWarning();

        // Do not add another red dot because this report
        // was rejected by the backend.
        return;
      }

      // Handle other errors returned by the backend.
      if (result?.statusCode < 200 || result?.statusCode >= 300) {
        return;
      }

      // Show the offset report location on the map.
      setFeltReports((reports) => [...reports, reportLocation]);

      // Store the nearby reports so they can be displayed on the map.
      setNearbyReports(data?.nearbyReports || []);

      // Store the number returned by Lambda.
      setNearbyReportCount(data?.nearbyReportCount || 0);

      // The new report is not included in the nearby count,
      // so it needs to be included in the displayed total.
      setIsReportAccepted(true);

      // The user has successfully submitted a report.
      setHasReported(true);
    } catch (error) {
      // If something fails, allow the user to try again.
    } finally {
      // The request has finished, so another request can be attempted.
      setIsSubmitting(false);
    }
  };
  const totalNearbyCount = nearbyReportCount + (isReportAccepted ? 1 : 0);
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

        {/* Tell the user when another report cannot be submitted yet.
    This warning appears temporarily when Lambda returns 429. */}
        {showAlreadyReported && (
          <div className="auto-hide-message absolute top-5 left-1/2 -translate-x-1/2 z-[1000] w-[420px] min-h-[120px] rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md shadow-2xl px-6 py-5">
            <p className="text-center text-gray-900 font-bold text-lg">
              Your report has already been registered.
            </p>

            <p className="text-sm text-gray-700 text-center mt-2 font-medium">
              You can report again after 15 minutes.
            </p>
          </div>
        )}

        {/* Show the number of people who felt the earthquake.
    This stays in the same position as the warning above,
    so the warning temporarily covers it and then disappears. */}
        {hasReported && (
          <div className="auto-hide-message absolute top-5 left-1/2 -translate-x-1/2 z-[999] w-[420px] min-h-[120px] rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md shadow-2xl px-6 py-5">
            <p className="text-center text-gray-900 font-bold text-lg">
              {totalNearbyCount === 1 ? (
                <span className="text-xl font-bold">
                  You are the first person to feel this Shake within 10 km.
                </span>
              ) : (
                <>
                  <span className="text-4xl font-extrabold text-red-600 mr-2">
                    {totalNearbyCount}
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

      {/* Privacy note explaining why report markers are not exact locations. */}
      <p className="text-sm text-gray-500 text-center px-6 py-3">
        Locations are shown with an offset and will not represent the actual
        location of other users&apos; reports.
      </p>
    </main>
  );
}

export default MainPage;
