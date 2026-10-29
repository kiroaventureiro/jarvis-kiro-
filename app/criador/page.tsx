import InternalPage from "../components/InternalPage";
import PrivateArea from "../components/PrivateArea";
import DesignStudio from "../components/DesignStudio";
export const dynamic = "force-dynamic";
export default function CreatorPage() {
  return (
    <InternalPage title="Criador de interfaces" eyebrow="CRIAÇÃO / JK">
      <PrivateArea>
        <DesignStudio />
      </PrivateArea>
    </InternalPage>
  );
}
