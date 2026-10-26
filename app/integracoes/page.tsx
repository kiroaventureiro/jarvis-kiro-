import inventory from "../../config/kiro-ecosystem-inventory.json";
import InternalPage from "../components/InternalPage";
import IntegrationCenter from "../components/IntegrationCenter";
export default function IntegrationsPage() {
  return (
    <InternalPage title="Central de conexões" eyebrow="Ecossistema Kiro">
      <IntegrationCenter services={inventory.services} />
    </InternalPage>
  );
}
