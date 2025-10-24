export type ParsedReply = {
  status: "confirmed" | "maybe" | "declined" | "no_reply";
  shiftPreference?: string;
};

export function parseReply(message: string): ParsedReply {
  const normalized = message.trim().toLowerCase();

  if (normalized === "y" || normalized === "yes" || normalized === "👍") {
    return { status: "confirmed" };
  }

  if (normalized === "n" || normalized === "no" || normalized === "👎") {
    return { status: "declined" };
  }

  if (normalized === "1") {
    return { status: "confirmed", shiftPreference: "AM Shift" };
  }

  if (normalized === "2") {
    return { status: "confirmed", shiftPreference: "PM Shift" };
  }

  if (normalized === "3") {
    return { status: "confirmed", shiftPreference: "Full Day" };
  }

  if (normalized === "maybe" || normalized === "m") {
    return { status: "maybe" };
  }

  return { status: "no_reply" };
}
