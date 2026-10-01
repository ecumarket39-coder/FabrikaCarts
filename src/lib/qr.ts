import { renderSVG } from "uqr";

export function qrSvg(payload: string): string {
  return renderSVG(payload, {
    pixelSize: 8,
    whiteColor: "#F7F1E8",
    blackColor: "#1A1714",
    ecc: "M",
    border: 2,
  });
}
