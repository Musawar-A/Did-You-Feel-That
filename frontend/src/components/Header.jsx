function Header({ isLoggedIn, onSignOut }) {
  return (
    // I'm giving the header a dark earthy colour because it fits the earthquake theme.
    <header className="w-full bg-stone-800 text-white shadow-md">
      {/* This keeps the title lined up nicely instead of sitting right against the edge. */}
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        {/* This is the main title of our website. */}
        <h1 className="text-2xl font-bold tracking-wide">Earthquake Checker</h1>
        {isLoggedIn && (
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-md bg-stone-600 px-4 py-2 text-sm font-semibold hover:bg-stone-500">
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
