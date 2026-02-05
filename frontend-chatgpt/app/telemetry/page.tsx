import TelemetryTemplate from "@/src/templates/TelemetryTemplate";
import TelemetryHomePage from "@/src/domains/telemetry/TelemetryHomePage";

export default function TelemetryPage() {
  return (
    <TelemetryTemplate>
      <TelemetryHomePage />
    </TelemetryTemplate>
  );
}
