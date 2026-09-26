"use client";

import { useState } from "react";
import { MonthGrid, type DayState } from "@/components/calendar/month-grid";
import { buttonClasses } from "@/components/ui/button";
import { IconChat } from "@/components/ui/icons";
import { addDays, daysInMonth, monthStart } from "@/lib/availability/dates";
import { lastCheckout, nightStatus, quoteStay, requiredMinimumStay, type QuoteInput } from "@/lib/availability/quote";
import { formatRupees } from "@/lib/properties/basics";
import type { PublicAvailability } from "@/lib/public/catalogue";

const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const nights = (n: number) => `${n} ${n === 1 ? "night" : "nights"}`;
const shiftMonth = (month: string, by: number) => (by > 0 ? addDays(month, daysInMonth(month)) : monthStart(addDays(month, -1)));

type Props = { baseRateCents: number; availability: PublicAvailability; today: string; whatsappHref: string | null; propertyName: string };

export function StayPicker({ baseRateCents, availability, today, whatsappHref, propertyName }: Props) {
  const [month, setMonth] = useState(monthStart(today));
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);

  const input: QuoteInput = { baseRateCents, today, ...availability };
  // Only the next 12 months of availability are sent, so nothing past them is offered.
  const horizon = addDays(today, 366);
  const firstMonth = monthStart(today);
  const lastMonth = monthStart(addDays(today, 365));
  const limit = checkIn && !checkOut ? lastCheckout(checkIn, input, horizon) : null;

  function stateFor(date: string): DayState {
    if (date === checkIn || date === checkOut) return "selected";
    if (checkIn && checkOut && date > checkIn && date < checkOut) return "in-range";
    if (limit && checkIn && date > checkIn) return date <= limit ? "available" : "past";
    if (date >= horizon) return "past";
    return nightStatus(date, input);
  }

  function labelFor(date: string, state: DayState) {
    const status = date === checkIn ? "check-in" : date === checkOut ? "checkout" : state === "available" || state === "in-range" ? "available" : "unavailable";
    return `${WEEKDAY.format(utc(date))} ${LONG.format(utc(date))}, ${status}`;
  }

  function select(date: string) {
    if (!checkIn || checkOut || date <= checkIn) {
      setCheckIn(date);
      setCheckOut(null);
    } else {
      setCheckOut(date);
    }
  }

  const clear = () => {
    setCheckIn(null);
    setCheckOut(null);
  };

  return (
    <div className="stay-picker">
      <div className="stay-picker-nav">
        <button type="button" className="stay-picker-arrow" aria-label="Previous month" disabled={month <= firstMonth} onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <button type="button" className="stay-picker-arrow" aria-label="Next month" disabled={month >= lastMonth} onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>
      <div className="stay-picker-months">
        {[month, shiftMonth(month, 1)].map((m) => (
          <MonthGrid key={m} month={m} stateFor={stateFor} labelFor={labelFor} onSelect={select} />
        ))}
      </div>
      <ul className="stay-legend" aria-label="Legend">
        <li><span className="stay-swatch" data-kind="available" aria-hidden="true" />Available</li>
        <li><span className="stay-swatch" data-kind="unavailable" aria-hidden="true" />Unavailable</li>
        <li><span className="stay-swatch" data-kind="selected" aria-hidden="true" />Your stay</li>
      </ul>
      <div className="stay-quote" aria-live="polite">
        <Quote checkIn={checkIn} checkOut={checkOut} input={input} whatsappHref={whatsappHref} propertyName={propertyName} />
        {checkIn && <button type="button" className={buttonClasses("ghost", "stay-quote-clear")} onClick={clear}>Clear dates</button>}
      </div>
    </div>
  );
}

function Quote({ checkIn, checkOut, input, whatsappHref, propertyName }: { checkIn: string | null; checkOut: string | null; input: QuoteInput; whatsappHref: string | null; propertyName: string }) {
  if (!checkIn) {
    return (
      <div className="stay-quote-body">
        <p className="stay-quote-lead">Select your check-in date.</p>
        {input.minimumStay > 1 && <p className="stay-quote-meta">Minimum stay: {nights(input.minimumStay)}</p>}
      </div>
    );
  }
  if (!checkOut) {
    const minimum = requiredMinimumStay(checkIn, input);
    return (
      <div className="stay-quote-body">
        <p className="stay-quote-lead">Select your checkout date.</p>
        <p className="stay-quote-meta">Check-in {SHORT.format(utc(checkIn))}{minimum > 1 ? ` · at least ${nights(minimum)}` : ""}</p>
      </div>
    );
  }
  const quote = quoteStay(checkIn, checkOut, input);
  if (!quote.ok) {
    const message = quote.reason === "minimum_stay" ? `This stay needs at least ${nights(quote.minimumStay)}.` : "Those dates aren't available. Try others.";
    return <div className="stay-quote-body"><p className="stay-quote-lead">{message}</p></div>;
  }
  const counts = new Map<number, number>();
  for (const n of quote.breakdown) counts.set(n.rateCents, (counts.get(n.rateCents) ?? 0) + 1);
  const breakdown = [...counts].map(([rate, count]) => `${count} × ${formatRupees(rate)}`).join(" · ");
  const [from, to] = [SHORT.format(utc(checkIn)), SHORT.format(utc(checkOut))];
  const message = `Hi, I'd like to book ${propertyName} from ${from} to ${to} (${nights(quote.nights)}).`;
  return (
    <div className="stay-quote-body">
      <p className="stay-quote-meta">{from} → {to}</p>
      <p className="stay-quote-total"><span>{nights(quote.nights)}</span> · <strong>{formatRupees(quote.totalCents)}</strong></p>
      {counts.size > 1 && <p className="stay-quote-meta">{breakdown}</p>}
      {whatsappHref && (
        <a href={`${whatsappHref}?text=${encodeURIComponent(message)}`} className={buttonClasses("primary", "w-full")} rel="noopener">
          <IconChat className="size-4" /> Ask to book on WhatsApp
        </a>
      )}
    </div>
  );
}
