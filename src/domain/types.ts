export type SiteConfig = {
  title?: string;
  subtitle?: string;
  timezone?: string; // IANA, e.g. "UTC"
  show_timezone_toggle?: boolean;
  footer?: {
    left?: string;
    right?: string;
  };
};

export type DeadlineItem = {
  id?: string;
  title: string;
  acronym?: string;
  year?: number;
  venue?: string;
  tags?: string[];
  url?: string;
  location?: string;
  deadline: string; // "YYYY-MM-DD HH:mm"
  timezone?: string; // IANA or AoE
  start?: string; // "YYYY-MM-DD"
  end?: string; // "YYYY-MM-DD"
  note?: string;
};

export type DeadlinesYaml = {
  site?: SiteConfig;
  items?: DeadlineItem[];
};

export type NormalizedItem = DeadlineItem & {
  id: string;
  venue: string;
  tags: string[];
  timezone: string;
  deadlineIsoUtc: string; // ISO string in UTC
};

