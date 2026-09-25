import type { SVGProps } from "react";

// One small, consistent line-icon set (24px grid, 1.75 stroke). Icons are
// decorative: every one sits beside a visible label, so they are hidden
// from assistive tech. Directional icons carry `rtl:-scale-x-100`.
type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, className = "size-5", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z" />
  </Svg>
);

export const IconInbox = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 13.5 6.2 6.2A1.7 1.7 0 0 1 7.8 5h8.4a1.7 1.7 0 0 1 1.6 1.2L20 13.5" />
    <path d="M4 13.5V18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4.5h-4.5a3.5 3.5 0 0 1-7 0H4Z" />
  </Svg>
);

export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </Svg>
);

export const IconBuilding = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 20h17M6 20V9l6-4.5L18 9v11" />
    <path d="M10 20v-4.5h4V20M9.5 11.5h.01M14.5 11.5h.01" />
  </Svg>
);

export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);

export const IconMore = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Svg>
);

export const IconArrowRight = ({ className = "size-4", ...p }: IconProps) => (
  <Svg className={`${className} rtl:-scale-x-100`} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const IconArrowLeft = ({ className = "size-4", ...p }: IconProps) => (
  <Svg className={`${className} rtl:-scale-x-100`} {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const IconArrowUpRight = ({ className = "size-4", ...p }: IconProps) => (
  <Svg className={`${className} rtl:-scale-x-100`} {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5M12 16h.01" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconPhoto = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4 17 4.8-4.3a1.2 1.2 0 0 1 1.6 0L14 16l2.2-2a1.2 1.2 0 0 1 1.6 0L20.5 16.5" />
  </Svg>
);

export const IconBook = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2V4.5Z" />
    <path d="M5 18a2 2 0 0 1 2-2h11M9 8.5h5" />
  </Svg>
);

export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5.5h14a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-7.5L7 20.5V17H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />
  </Svg>
);

export const IconLogout = ({ className = "size-4", ...p }: IconProps) => (
  <Svg className={`${className} rtl:-scale-x-100`} {...p}>
    <path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H4" />
  </Svg>
);

export const IconMail = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </Svg>
);

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6l-7-2.5Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Svg>
);

export const IconSparkle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v4M12 16v4M4 12h4M16 12h4M7 7l1.8 1.8M15.2 15.2 17 17M17 7l-1.8 1.8M8.8 15.2 7 17" />
  </Svg>
);

export const IconStar = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 4 2.3 4.9 5.2.6-3.9 3.6 1.1 5.2L12 15.7l-4.7 2.6 1.1-5.2-3.9-3.6 5.2-.6L12 4Z" />
  </Svg>
);

export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" />
    <path d="M4.5 14.5V18a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3.5" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l.8 12a1 1 0 0 0 1 1h7.4a1 1 0 0 0 1-1l.8-12" />
  </Svg>
);

export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);

export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </Svg>
);
