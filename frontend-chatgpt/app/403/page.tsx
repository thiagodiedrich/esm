import ErrorTemplate from "@/src/templates/ErrorTemplate";
import ForbiddenPage from "@/src/domains/errors/ForbiddenPage";

export default function ForbiddenRoute() {
  return (
    <ErrorTemplate>
      <ForbiddenPage />
    </ErrorTemplate>
  );
}
