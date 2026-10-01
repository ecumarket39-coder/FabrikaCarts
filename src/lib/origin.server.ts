import { getRequest } from "@tanstack/react-start/server";

export function publicOrigin(): string {
  const req = getRequest();
  const url = new URL(req.url);
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host") ||
    url.host;
  return `${proto}://${host}`;
}
