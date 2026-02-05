import AuthTemplate from "@/src/templates/AuthTemplate";
import LoginPage from "@/src/domains/auth/LoginPage";

export default function LoginRoute() {
  return (
    <AuthTemplate>
      <LoginPage />
    </AuthTemplate>
  );
}
