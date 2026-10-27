export type ConnectorResultLink = {
  kind: "connector_plan";
  id: string;
  title: string;
  href: string;
};
export function connectorResultLink(
  value: unknown,
): ConnectorResultLink | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    v.kind !== "connector_plan" ||
    typeof v.id !== "string" ||
    !/^[a-f0-9-]{36}$/.test(v.id) ||
    typeof v.title !== "string" ||
    v.title.length > 180 ||
    v.href !== "/conexoes#plan-" + v.id
  )
    return null;
  return {
    kind: "connector_plan",
    id: v.id,
    title: v.title,
    href: v.href as string,
  };
}
