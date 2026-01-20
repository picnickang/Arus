import { ReferenceArea } from "recharts";

export interface ContextBand {
  start: number;
  end: number;
  type: "sea_state" | "operational_mode" | "maintenance" | "other";
  label: string;
  severity?: number;
}

interface ContextBandsProps {
  bands: ContextBand[];
  xKey?: string;
}

/**
 * Reusable context band overlay component for charts
 * Renders shaded regions for sea state, operational mode, etc.
 */
export function ContextBands({ bands, xKey: _xKey = "x" }: ContextBandsProps) {
  if (!bands || bands.length === 0) {return null;}

  const getBandColor = (type: string, severity?: number) => {
    switch (type) {
      case "sea_state":
        // Color by severity (Douglas scale 0-7)
        if (severity !== undefined) {
          if (severity <= 2) {return "#dbeafe";} // blue-100 - calm
          if (severity <= 4) {return "#fef3c7";} // yellow-100 - moderate
          if (severity <= 6) {return "#fed7aa";} // orange-100 - rough
          return "#fecaca"; // red-100 - very rough
        }
        return "#e0e7ff"; // indigo-100
      case "operational_mode":
        return "#dcfce7"; // green-100
      case "maintenance":
        return "#fef9c3"; // yellow-100
      default:
        return "#f3f4f6"; // gray-100
    }
  };

  return (
    <>
      {bands.map((band, index) => (
        <ReferenceArea
          key={`context-band-${index}`}
          x1={band.start}
          x2={band.end}
          fill={getBandColor(band.type, band.severity)}
          fillOpacity={0.3}
          label={{
            value: band.label,
            position: "insideTop",
            fontSize: 10,
            fill: "#6b7280",
          }}
        />
      ))}
    </>
  );
}
