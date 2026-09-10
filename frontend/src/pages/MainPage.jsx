import MapView from "../components/MapView";

function MainPage() {
  return (
    // min-h-screen = makes the page at least as tall as the browser screen.
    // bg-gray-100 = gives the area around the map a light grey background.
    <main className="min-h-screen bg-gray-100">
      {/* 
        This heading gives the user a simple introduction
        before they interact with the map.
      */}
      <div className="px-6 py-5">
        {/* text-2xl = larger text.
            font-semibold = makes the heading slightly bold. */}
        <h2 className="text-2xl font-semibold text-gray-900">
          Earthquakes Near You
        </h2>

        {/* text-gray-600 = softer grey for supporting text. */}
        <p className="text-gray-600 mt-1">
          Click an earthquake to see more information.
        </p>
      </div>

      {/* 
        h-[600px] = gives the map a fixed height for now.
        Later we can make this responsive for different screens.
      */}
      <div className="h-[600px] w-full">
        <MapView />
      </div>
    </main>
  );
}

export default MainPage;
