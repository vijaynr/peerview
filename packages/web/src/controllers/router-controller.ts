import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { DashboardSection } from "../types.js";

const ROUTE_MAP: Record<string, DashboardSection> = {
  overview: "overview",
  gitlab: "gitlab",
  github: "github",
  reviewboard: "reviewboard",
  settings: "settings",
};

const DEFAULT_SECTION: DashboardSection = "overview";

function parseHash(): DashboardSection {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return ROUTE_MAP[hash] ?? DEFAULT_SECTION;
}

export class RouterController implements ReactiveController {
  private host: ReactiveControllerHost;
  private onChange?: (section: DashboardSection) => void;
  section: DashboardSection = DEFAULT_SECTION;

  constructor(
    host: ReactiveControllerHost,
    onChange?: (section: DashboardSection) => void
  ) {
    this.host = host;
    this.onChange = onChange;
    host.addController(this);
    this.section = parseHash();
  }

  hostConnected() {
    window.addEventListener("hashchange", this.handleHashChange);
    this.section = parseHash();
  }

  hostDisconnected() {
    window.removeEventListener("hashchange", this.handleHashChange);
  }

  navigate(section: DashboardSection) {
    this.section = section;
    this.host.requestUpdate();
    window.location.hash = `#/${section}`;
  }

  private handleHashChange = () => {
    const next = parseHash();
    if (next !== this.section) {
      this.section = next;
      this.host.requestUpdate();
      this.onChange?.(next);
    }
  };
}
