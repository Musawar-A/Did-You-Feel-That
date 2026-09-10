function Header() {
  return (
    // I'm giving the header a dark earthy colour because it fits the earthquake theme.
    <header className="w-full bg-stone-800 text-white shadow-md">
      {/* This keeps the title lined up nicely instead of sitting right against the edge. */}
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* This is the main title of our website. */}
        <h1 className="text-2xl font-bold tracking-wide">Earthquake Checker</h1>
      </div>
    </header>
  );
}

export default Header;
