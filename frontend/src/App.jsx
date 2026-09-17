import { useState } from "react";
import { signOut } from "aws-amplify/auth";
import Header from "./components/Header";
import LoginPage from "./pages/LoginPage";
import MainPage from "./pages/MainPage";

function App() {
  // Keeps track of whether the user has entered the main page.
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setIsLoggedIn(false);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Shared header */}
      <Header isLoggedIn={isLoggedIn} onSignOut={handleSignOut} />

      {isLoggedIn ? (
        // Show the earthquake map after Login/Register.
        <MainPage />
      ) : (
        // Show Login/Register first.//checking user clicked loged in or register yes set it to true
        <LoginPage onLogin={() => setIsLoggedIn(true)} />
      )}
    </div>
  );
}

export default App;
