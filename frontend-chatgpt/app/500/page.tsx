import ErrorTemplate from "@/src/templates/ErrorTemplate";
import ErrorPage from "@/src/domains/errors/ErrorPage";

export default function ErrorRoute() {
  return (
    <ErrorTemplate>
      <ErrorPage />
    </ErrorTemplate>
  );
}
