import { useEffect, useState } from "react";
import * as QRCode from "qrcode";
import {
  Campfire,
  CheckCircle,
  Church,
  IdentificationBadge,
  MapPin,
  Printer,
  SunHorizon,
  User,
} from "@phosphor-icons/react";
import {
  AGE_GROUP_LABELS,
  GENDER_LABELS,
  MINISTRY_ROLE_LABELS,
  formatFullName,
  isCheckedInForDay,
  type EventRow,
  type Guest,
} from "@/lib/types";

export function QrBadgePass({
  guest,
  event,
  compact = false,
}: {
  guest: Guest;
  event: EventRow | null;
  compact?: boolean;
}) {
  const [svgMarkup, setSvgMarkup] = useState<string>("");

  useEffect(() => {
    let active = true;
    const payload = JSON.stringify({
      v: 3,
      code: guest.reg_code,
      uuid: guest.id,
      event: event?.code || guest.event_id,
      name: formatFullName(guest),
    });

    QRCode.toString(payload, {
      type: "svg",
      margin: 1,
      width: compact ? 96 : 124,
      errorCorrectionLevel: "M",
      color: {
        dark: "#142822",
        light: "#00000000",
      },
    })
      .then((svg) => {
        if (active) setSvgMarkup(svg);
      })
      .catch(() => {
        if (active) setSvgMarkup("");
      });

    return () => {
      active = false;
    };
  }, [guest, event?.code, compact]);

  const totalDays = event?.total_days || 3;
  const daysArray = Array.from({ length: totalDays }, (_, idx) => idx + 1);
  const fullName = formatFullName(guest);

  return (
    <div className="bezel-shell print:border-black print:bg-white">
      <div className="bezel-core relative overflow-hidden p-5 sm:p-6 print:shadow-none">
        {/* Top punch-hole slot visual for physical lanyard aesthetic */}
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border/80 print:border print:border-neutral-400" aria-hidden="true" />

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 font-mono-code text-xs font-semibold text-primary-foreground">
                <IdentificationBadge size={14} weight="bold" aria-hidden="true" />
                {guest.reg_code}
              </span>
              <span className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {MINISTRY_ROLE_LABELS[guest.ministry_role] || "Attendee"}
              </span>
              {guest.gender !== "unspecified" && (
                <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                  {GENDER_LABELS[guest.gender]} · {AGE_GROUP_LABELS[guest.age_group] || guest.age_group}
                </span>
              )}
            </div>

            <div>
              {event?.organizer && (
                <p className="text-[11px] font-semibold text-accent">
                  {event.organizer}
                </p>
              )}
              <p className="text-xs font-medium text-muted-foreground">
                {event?.name || "Church Gathering"} {event?.year ? `(${event.year})` : ""}
              </p>
              <h3 className="mt-0.5 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {fullName}
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div className="flex items-center gap-1.5">
                <Church size={14} className="shrink-0 text-accent" aria-hidden="true" />
                <span className="truncate">{guest.church_name || "Local fellowship"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="shrink-0 text-accent" aria-hidden="true" />
                <span className="truncate">{guest.origin || "Origin not set"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {guest.status === "camping" ? (
                  <Campfire size={14} className="shrink-0 text-warm" aria-hidden="true" />
                ) : (
                  <SunHorizon size={14} className="shrink-0 text-accent" aria-hidden="true" />
                )}
                <span className="truncate font-medium text-foreground">
                  {guest.status === "camping"
                    ? guest.accommodation_zone || "Campgrounds"
                    : "Day attendee"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono-code">
                <User size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate" title={guest.id}>
                  UUID {guest.id.slice(0, 8)}
                </span>
              </div>
            </div>
          </div>

          {/* QR Verification Block */}
          <div className="flex shrink-0 flex-row items-center justify-between gap-4 border-t border-border pt-4 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
            <div
              className="flex h-28 w-28 items-center justify-center rounded-xl border border-border bg-white p-2"
              aria-label={`QR verification code for ${guest.reg_code}`}
            >
              {svgMarkup ? (
                <div
                  className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: svgMarkup }}
                />
              ) : (
                <span className="font-mono-code text-[11px] text-neutral-500">{guest.reg_code}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-muted"
            >
              <Printer size={14} aria-hidden="true" />
              Print pass
            </button>
          </div>
        </div>

        {/* Multi-day Attendance & Gate Check-in Strip */}
        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">Registered days & gate verification</span>
            <span className="font-mono-code text-muted-foreground">
              {Object.keys(guest.check_ins ?? {}).length}/{guest.days_registered?.length || 1} checked in
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {daysArray.map((d) => {
              const registered = guest.days_registered?.includes(d) || guest.day === d;
              const checkedIn = isCheckedInForDay(guest, d);
              return (
                <div
                  key={d}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    checkedIn
                      ? "border-success/30 bg-success/10 text-success"
                      : registered
                        ? "border-accent/30 bg-accent/8 text-foreground"
                        : "border-border bg-muted/40 text-muted-foreground opacity-55"
                  }`}
                >
                  {checkedIn && <CheckCircle size={13} weight="fill" aria-hidden="true" />}
                  <span>Day {d}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
