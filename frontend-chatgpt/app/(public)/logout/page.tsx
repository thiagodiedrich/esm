import AuthTemplate from "@/src/templates/AuthTemplate";
import LogoutPage from "@/src/domains/auth/LogoutPage";

export default function LogoutRoute() {
  return (
    <AuthTemplate>
      <LogoutPage />
    </AuthTemplate>
  );
}
