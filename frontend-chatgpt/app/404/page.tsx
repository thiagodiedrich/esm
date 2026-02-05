import ErrorTemplate from "@/src/templates/ErrorTemplate";
import NotFoundPage from "@/src/domains/errors/NotFoundPage";

export default function NotFoundRoute() {
  return (
    <ErrorTemplate>
      <NotFoundPage />
    </ErrorTemplate>
  );
}
