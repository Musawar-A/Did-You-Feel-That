import { useEffect, useState } from "react";
import {
  confirmSignUp,
  getCurrentUser,
  signIn,
  signUp,
  fetchAuthSession,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
} from "aws-amplify/auth";

/**
 * regsiters the user to DYNAMODB
 */
async function registerUser() {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens.idToken.toString();

    const response = await fetch(
      `${import.meta.env.VITE_API_GATEWAY_URL_USERS}/users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: idToken,
        },
      },
    );

    const data = await response.json();
    console.log("User Registration results", data);
  } catch (error) {
    console.error("Error fetching auth session:", error);
  }
}

function LoginPage({ onLogin }) {
  // Keeps track of whether we are showing Login or Register.
  const [isRegistering, setIsRegistering] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false); //controls if cogito is asking for email confirmation
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  //user input
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetCode, setResetCode] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then(() => {
        registerUser();
        onLogin();
      })
      .catch(() => {
        // No existing Cognito session; keep showing the login form.
      });
  }, [onLogin]);

  const resetToLogin = () => {
    setIsRegistering(false);
    setIsConfirming(false);
    setIsResettingPassword(false);
    setError("");
    setMessage("");
  };

  // Switches between Login and Register.
  const switchForm = () => {
    setIsRegistering(!isRegistering);
    setIsConfirming(false);
    setIsResettingPassword(false);
    setError("");
    setMessage("");
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email to reset password.");
      return;
    }
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      await resetPassword({ username: email });
      setIsResettingPassword(true);
      setMessage("Check your email for the reset code.");
    } catch (resetError) {
      setError(resetError.message || "Failed to initiate password reset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      if (isResettingPassword) {
        await confirmResetPassword({
          username: email,
          confirmationCode: resetCode,
          newPassword,
        });
        setIsResettingPassword(false);
        setMessage("Your password has been reset. You can now log in.");
      } else if (isConfirming) {
        await confirmSignUp({ username, confirmationCode });
        setIsConfirming(false);
        setIsRegistering(false);
        setMessage("Your account is confirmed. You can now log in.");
      } else if (isRegistering) {
        const result = await signUp({
          username,
          password,
          options: { userAttributes: { email } },
        });

        if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
          setIsConfirming(true);
          setMessage("Check your email for the confirmation code.");
        }
      } else {
        const result = await signIn({ username: email, password });
        if (result.isSignedIn) {
          registerUser();
          onLogin();
        } else {
          setError("Additional step required: " + result.nextStep.signInStep);
        }
      }
    } catch (authError) {
      //started registering but never confirmed -> put pack to the confirmation step and resend the code
      if (authError.name === "UserNotConfirmedException") {
        try {
          await resendSignUpCode({ username: email });
          setUsername(email);
          setIsConfirming(true);
          setMessage(
            "Your account isn't confirmed yet. We've sent a new code to your email.",
          );
        } catch (resendError) {
          setError(resendError.message || "Couldn't resend confirmation code.");
        }
      } else if (authError.name === "LimitExceededException") {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setError(authError.message || "Authentication failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const heading = isResettingPassword
    ? "Reset Your Password"
    : isConfirming
      ? "Confirm Your Account"
      : isRegistering
        ? "Create an Account"
        : "Check earthquakes and report if you felt one by logging in";

  const buttonLabel = isSubmitting
    ? "Please wait..."
    : isResettingPassword
      ? "Set New Password"
      : isConfirming
        ? "Confirm Account"
        : isRegistering
          ? "Create Account"
          : "Login";

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
          {heading}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email input */}
          {!isConfirming && !isResettingPassword && (
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          {/* username register only */}
          {!isConfirming && !isResettingPassword && isRegistering && (
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Choose a username"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          {/* Password input logging in and register only.  no reset */}
          {!isConfirming && !isResettingPassword && (
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          {isConfirming && (
            <div>
              <label
                htmlFor="confirmationCode"
                className="block text-sm font-medium text-gray-700 mb-1">
                Confirmation code
              </label>
              <input
                id="confirmationCode"
                type="text"
                value={confirmationCode}
                onChange={(event) => setConfirmationCode(event.target.value)}
                placeholder="Enter the code from your email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          {/* Password reset: code + new password */}
          {isResettingPassword && (
            <>
              <div>
                <label
                  htmlFor="resetCode"
                  className="block text-sm font-medium text-gray-700 mb-1">
                  Reset code
                </label>
                <input
                  id="resetCode"
                  type="text"
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value)}
                  placeholder="Enter the code from your email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 mb-1">
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter a new password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </>
          )}

          {/* Forgot password link - only on the plain login screen */}
          {!isConfirming && !isResettingPassword && !isRegistering && (
            <div className="text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isSubmitting}
                className="text-sm text-blue-600 hover:underline cursor-pointer">
                Forgot password?
              </button>
            </div>
          )}

          {/* Login/Register button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg
                       font-semibold hover:bg-blue-700 transition cursor-pointer
                       disabled:opacity-50 disabled:cursor-not-allowed">
            {buttonLabel}
          </button>
        </form>

        {/* Switch between Login and Register */}
        {message && (
          <p className="mt-4 text-center text-sm text-green-700">{message}</p>
        )}
        {error && (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        )}

        {/* Cancel out of confirmation or password reset back to plain login */}
        {(isConfirming || isResettingPassword) && (
          <div className="text-center mt-6 text-sm text-gray-600">
            <button
              type="button"
              onClick={resetToLogin}
              className="text-blue-600 font-semibold hover:underline cursor-pointer">
              Cancel and go back to login
            </button>
          </div>
        )}

        {!isConfirming && !isResettingPassword && (
          <div className="text-center mt-6 text-sm text-gray-600">
            {isRegistering
              ? "Already have an account?"
              : "Don't have an account?"}

            <button
              type="button"
              onClick={switchForm}
              className="ml-2 text-blue-600 font-semibold hover:underline cursor-pointer">
              {isRegistering ? "Login" : "Register"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default LoginPage;
