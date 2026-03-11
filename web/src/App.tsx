import LoginPage from "./pages/LoginPage";
import GitHubCallbackPage from "./pages/GitHubCallbackPage";
import ReposPage from "./pages/ReposPage";
import ErrorPage from "./pages/ErrorPage";

export default function App() {
  const path = window.location.pathname;

  if (path === "/auth/github/callback") return <GitHubCallbackPage />;
  if (path === "/auth/error") return <ErrorPage />;
  if (path === "/repos") return <ReposPage />;
  return <LoginPage />;
}

