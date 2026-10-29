import AbacusStatus from "../components/AbacusStatus";
import inventory from "../../config/kiro-ecosystem-inventory.json";
import InternalPage from "../components/InternalPage";
import IntegrationCenter from "../components/IntegrationCenter";
export default function IntegrationsPage() {
  return (
    <InternalPage title="Central de conexões" eyebrow="Ecossistema Kiro">
      <AbacusStatus />
      <IntegrationCenter services={inventory.services} />
    </InternalPage>
  );
}
