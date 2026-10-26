import Link from "next/link";
import { authorized } from "../../lib/auth";
export default async function PrivateArea({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await authorized()))
    return (
      <section className="glass notice">
        <h2>Acesso do proprietário</h2>
        <p>Autentique seu dispositivo para consultar os dados desta área.</p>
        <Link className="text-link" href="/configuracoes">
          Abrir acesso e configurações →
        </Link>
      </section>
    );
  return <>{children}</>;
}
