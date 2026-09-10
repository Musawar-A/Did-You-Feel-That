import { useState } from "react";

function LoginPage({ onLogin }) {
  // Keeps track of whether we are showing Login or Register.
  const [isRegistering, setIsRegistering] = useState(false);

  // Switches between Login and Register.
  const switchForm = () => {
    setIsRegistering(!isRegistering);
  };

  return (
    // flex = uses a flexible layout.
    // items-center = centres the card vertically.
    // justify-center = centres the card horizontally.
    // px-4 = adds space on the left and right.
    // py-12 = adds space above and below.
    <main className="flex items-center justify-center px-4 py-12">
      {/* Login/Register card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
          Did You Feel That?
        </h1>

        <h2 className="text-xl font-semibold text-center text-gray-700 mb-6">
          {isRegistering
            ? "Create an Account"
            : "Check earthquakes and report if you felt one by logging in"}
        </h2>

        <form
          onSubmit={(event) => {
            // Stops the browser from refreshing the page.
            event.preventDefault();

            // For now, Login and Register both go to the main page.
            onLogin();
          }}
          className="space-y-4"
        >
          {/* Email input */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Password input */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Login/Register button */}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg
                       font-semibold hover:bg-blue-700 transition cursor-pointer"
          >
            {isRegistering ? "Create Account" : "Login"}
          </button>
        </form>

        {/* Switch between Login and Register */}
        <div className="text-center mt-6 text-sm text-gray-600">
          {isRegistering
            ? "Already have an account?"
            : "Don't have an account?"}

          <button
            type="button"
            onClick={switchForm}
            className="ml-2 text-blue-600 font-semibold hover:underline cursor-pointer"
          >
            {isRegistering ? "Login" : "Register"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;
