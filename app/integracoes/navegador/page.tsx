import InternalPage from "../../components/InternalPage";
import PrivateArea from "../../components/PrivateArea";
import BrowserConnection from "../../components/BrowserConnection";
import { authorized } from "../../../lib/auth";
export const dynamic = "force-dynamic";
export default async function BrowserPage() {
  return <InternalPage title="Navegador" eyebrow="Integração local supervisionada">{await authorized() ? <BrowserConnection /> : <PrivateArea><></></PrivateArea>}</InternalPage>;
}
