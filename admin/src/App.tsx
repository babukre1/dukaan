import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import "./App.css";
import "./live.css";
import {
  api,
  type ApiOwner,
  type ApiPlan,
  type ApiShop,
  type ApiSubscription,
  type ApiSubscriptionEvent,
} from "./api";

type Page =
  | "dashboard"
  | "shops"
  | "subscriptions"
  | "owners"
  | "reports"
  | "settings";
type IconName =
  | "dashboard"
  | "store"
  | "calendar"
  | "users"
  | "chart"
  | "settings"
  | "bell"
  | "search"
  | "plus"
  | "trend"
  | "clock"
  | "money"
  | "check"
  | "more"
  | "back"
  | "shield"
  | "box"
  | "cart"
  | "refresh"
  | "logout"
  | "close";

const paths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  store: (
    <>
      <path d="M3 9h18l-2-5H5L3 9Z" />
      <path d="M5 9v11h14V9M9 20v-6h6v6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20V7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88L4.2 6.56l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.35.6.7 1.1.9.32.1.66.14 1 .1h.1v4h-.09a1.7 1.7 0 0 0-1.51.6 1.7 1.7 0 0 0-.6.4Z" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  money: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M17 14h.01" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </>
  ),
  back: <path d="m15 18-6-6 6-6" />,
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  box: (
    <>
      <path d="m21 8-9 5-9-5 9-5 9 5Z" />
      <path d="m3 8 9 5v9M21 8l-9 5" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M3 4h2l2.5 11h11l2-7H6" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7h-5V2" />
      <path d="M20 7a9 9 0 1 0 1 8" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
const shops = [
  {
    id: "#S-0168",
    name: "Sajib Grocery",
    phone: "+880 1712 345678",
    account: "Active",
    subscription: "Active",
    info: "Until 24 Dec 2026",
  },
  {
    id: "#S-0167",
    name: "Rotna Begum Store",
    phone: "+880 1716 998877",
    account: "Active",
    subscription: "Trial",
    info: "5 days left",
  },
  {
    id: "#S-0166",
    name: "Monir Hossain Mart",
    phone: "+880 1710 556677",
    account: "Suspended",
    subscription: "Expired",
    info: "Expired 10 Jan 2026",
  },
  {
    id: "#S-0165",
    name: "Sumon Prodhan",
    phone: "+880 1713 667788",
    account: "Active",
    subscription: "Active",
    info: "Until 18 Nov 2026",
  },
  {
    id: "#S-0164",
    name: "Jahanara Ferdous",
    phone: "+880 1719 445566",
    account: "Read-only",
    subscription: "Active",
    info: "Until 24 Dec 2026",
  },
];
const owners = [
  ["Karim Ali", "+880 1711 223344", "3", "Active"],
  ["Rotna Begum", "+880 1716 998877", "1", "Active"],
  ["Monir Hossain", "+880 1710 556677", "2", "Suspended"],
  ["Sumon Prodhan", "+880 1713 667788", "1", "Active"],
  ["Jahanara Ferdous", "+880 1719 445566", "1", "Read-only"],
];
const currency = (value: number) => `৳ ${value.toLocaleString()}`;
const tone = (value: string) =>
  value === "Active"
    ? "green"
    : value === "Trial"
      ? "yellow"
      : value === "Read-only"
        ? "gray"
        : "red";

function Brand() {
  return (
    <div className="brand">
      <span>
        <Icon name="store" size={20} />
      </span>
      <div>
        <strong>DukaanFlow</strong>
        <small>Admin Portal</small>
      </div>
    </div>
  );
}
function Badge({
  children,
  color = "gray",
}: {
  children: ReactNode;
  color?: string;
}) {
  return <span className={`badge ${color}`}>{children}</span>;
}
function Button({
  children,
  kind = "primary",
  onClick,
}: {
  children: ReactNode;
  kind?: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={`button ${kind}`} onClick={onClick}>
      {children}
    </button>
  );
}
function Sidebar({
  page,
  setPage,
  adminName,
  onLogout,
  loggingOut,
}: {
  page: Page;
  setPage: (page: Page) => void;
  adminName: string;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const nav: [Page, IconName, string][] = [
    ["dashboard", "dashboard", "Dashboard"],
    ["shops", "store", "Shops"],
    ["subscriptions", "calendar", "Subscriptions"],
    ["owners", "users", "Owners"],
    ["reports", "chart", "Reports"],
    ["settings", "settings", "Settings"],
  ];
  return (
    <aside className="sidebar">
      <Brand />
      <nav>
        {nav.map(([id, icon, label]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => setPage(id)}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-user">
        <div className="avatar">{adminName.charAt(0).toUpperCase()}</div>
        <div className="sidebar-user-copy">
          <strong>{adminName}</strong>
          <small>Super administrator</small>
        </div>
        <button
          type="button"
          className="sidebar-logout"
          onClick={onLogout}
          disabled={loggingOut}
          aria-label="Log out"
          title="Log out"
        >
          <Icon name="logout" />
        </button>
      </div>
    </aside>
  );
}
function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="top-actions">
        <button className="icon-button">
          <Icon name="bell" />
          <i />
        </button>
        <div className="user-chip">
          <div className="avatar">A</div>
          <span>Admin</span>
          <b>⌄</b>
        </div>
      </div>
    </header>
  );
}
function Metric({
  icon,
  label,
  value,
  warning = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <article className="metric">
      <span className={warning ? "warning" : ""}>
        <Icon name={icon} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function RevenueChart() {
  const values = [26, 35, 44, 51, 61, 48, 42, 62, 58, 72, 88, 70, 91, 87, 100];
  return (
    <div className="chart-wrap">
      <div className="axis">
        <span>৳30K</span>
        <span>৳20K</span>
        <span>৳10K</span>
        <span>৳0</span>
      </div>
      <div className="chart-area">
        <div className="bars">
          {values.map((v, i) => (
            <i key={i} style={{ height: `${v}%` }} title={currency(v * 300)} />
          ))}
        </div>
        <div className="dates">
          <span>23 Dec</span>
          <span>1 Jan</span>
          <span>10 Jan</span>
          <span>21 Jan</span>
        </div>
      </div>
    </div>
  );
}
function Activity({
  icon,
  title,
  time,
  danger = false,
}: {
  icon: IconName;
  title: string;
  time: string;
  danger?: boolean;
}) {
  return (
    <div className="activity-row">
      <span className={danger ? "danger" : ""}>
        <Icon name={icon} />
      </span>
      <strong>{title}</strong>
      <small>{time}</small>
    </div>
  );
}
function Progress({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  return (
    <div className="progress-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <progress max={total} value={value} />
    </div>
  );
}

function Dashboard() {
  return (
    <>
      <Header title="Dashboard" subtitle="Platform overview and key metrics" />
      <div className="page">
        <div className="page-actions">
          <Button kind="secondary">
            <Icon name="calendar" /> Last 30 days⌄
          </Button>
        </div>
        <section className="metrics">
          <Metric icon="store" label="Total shops" value="432" />
          <Metric icon="shield" label="Active subscriptions" value="318" />
          <Metric icon="users" label="Trial shops" value="42" />
          <Metric icon="clock" label="Expiring soon" value="18" warning />
          <Metric
            icon="money"
            label="Revenue this month"
            value={currency(248760)}
          />
        </section>
        <div className="dashboard-grid">
          <Panel
            title="Revenue trend"
            subtitle="Daily subscription revenue"
            action={<Badge color="green">● Revenue</Badge>}
          >
            <RevenueChart />
          </Panel>
          <Panel
            title="Recent activity"
            subtitle="Latest platform events"
            action={<button className="link-button">View all →</button>}
          >
            <Activity
              icon="refresh"
              title="Subscription renewed · Sajib Grocery"
              time="2 min ago"
            />
            <Activity
              icon="plus"
              title="New shop registered · Monir Store"
              time="12 min ago"
            />
            <Activity
              icon="clock"
              title="Shop suspended · Rahim Traders"
              time="28 min ago"
              danger
            />
            <Activity
              icon="calendar"
              title="Trial started · New Era Mart"
              time="44 min ago"
            />
          </Panel>
        </div>
        <div className="dashboard-grid lower">
          <Panel
            title="Subscription health"
            subtitle="Current account distribution"
          >
            <Progress label="Active" value={318} total={432} />
            <Progress label="Trial" value={42} total={432} />
            <Progress label="Expiring" value={18} total={432} />
            <Progress label="Inactive" value={54} total={432} />
          </Panel>
          <Panel title="Quick actions" subtitle="Common admin tasks">
            <div className="quick-actions">
              <button>
                <Icon name="plus" />
                <span>Add a shop</span>
              </button>
              <button>
                <Icon name="refresh" />
                <span>Renew subscription</span>
              </button>
              <button>
                <Icon name="chart" />
                <span>Open reports</span>
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <section className="table-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      <footer>
        <span>Showing 1–5 of 432</span>
        <div>
          <button>‹</button>
          <button className="current">1</button>
          <button>2</button>
          <button>3</button>
          <span>…</span>
          <button>87</button>
          <button>›</button>
        </div>
      </footer>
    </section>
  );
}
function Shops() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<(typeof shops)[number] | null>(null);
  const [renew, setRenew] = useState(false);
  const rows = useMemo(
    () =>
      shops.filter((s) =>
        `${s.name} ${s.phone}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );
  if (selected)
    return (
      <ShopDetail
        shop={selected}
        back={() => setSelected(null)}
        renew={() => setRenew(true)}
        modal={renew ? <RenewModal close={() => setRenew(false)} /> : null}
      />
    );
  return (
    <>
      <Header title="Shops" subtitle="All shops on DukaanFlow (432)" />
      <div className="page">
        <div className="filters">
          <label className="search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by shop name or phone..."
            />
          </label>
          <Button kind="secondary">Account: All⌄</Button>
          <Button kind="secondary">Subscription: All⌄</Button>
          <Button>
            <Icon name="plus" /> Add shop
          </Button>
        </div>
        <Table
          headers={[
            "#",
            "Shop name",
            "Owner phone",
            "Account status",
            "Subscription",
            "Subscription info",
            "Actions",
          ]}
        >
          {rows.map((shop) => (
            <tr key={shop.id}>
              <td>{shop.id}</td>
              <td>
                <strong>{shop.name}</strong>
              </td>
              <td>{shop.phone}</td>
              <td>
                <Badge color={tone(shop.account)}>{shop.account}</Badge>
              </td>
              <td>
                <Badge color={tone(shop.subscription)}>
                  {shop.subscription}
                </Badge>
              </td>
              <td>{shop.info}</td>
              <td>
                <button
                  className="icon-button"
                  onClick={() => setSelected(shop)}
                >
                  <Icon name="more" />
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}
function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function ShopDetail({
  shop,
  back,
  renew,
  modal,
}: {
  shop: (typeof shops)[number];
  back: () => void;
  renew: () => void;
  modal: ReactNode;
}) {
  return (
    <>
      <Header
        title="Shop details"
        subtitle="Review account and subscription information"
      />
      <div className="page">
        <button className="back" onClick={back}>
          <Icon name="back" /> Back to shops
        </button>
        <div className="shop-heading">
          <div className="shop-avatar">SG</div>
          <div>
            <h2>{shop.name}</h2>
            <p>Shop ID: {shop.id}</p>
          </div>
          <Button kind="secondary">Actions⌄</Button>
        </div>
        <div className="tabs">
          <button className="active">Overview</button>
          <button>Subscription</button>
          <button>Renewal history</button>
          <button>Activity log</button>
        </div>
        <div className="details-grid">
          <Panel title="Shop information">
            <Info label="Owner phone" value={shop.phone} />
            <Info label="Shop name" value={shop.name} />
            <Info label="Registered on" value="18 Jan 2024, 09:10 AM" />
          </Panel>
          <Panel
            title="Subscription information"
            action={
              <Button kind="text" onClick={renew}>
                Renew
              </Button>
            }
          >
            <Info
              label="Subscription status"
              value={<Badge color="green">Active</Badge>}
            />
            <Info label="Plan" value="Yearly" />
            <Info label="Status details" value="Active until 24 Dec 2026" />
            <Info label="Next renewal" value="24 Dec 2026 (338 days left)" />
          </Panel>
          <Panel
            title="Account status"
            action={<Badge color="green">Active</Badge>}
          >
            <p className="body-copy">Shop can log in and use all features.</p>
            <Button kind="danger">Suspend account</Button>
          </Panel>
          <Panel title="Key shop metrics">
            <div className="small-metrics">
              <Metric icon="cart" label="Total sales" value={currency(42660)} />
              <Metric icon="chart" label="Invoices" value="328" />
              <Metric icon="box" label="Products" value="7 items" />
              <Metric icon="users" label="Customers" value="64" />
            </div>
          </Panel>
        </div>
      </div>
      {modal}
    </>
  );
}

function RenewModal({ close }: { close: () => void }) {
  return (
    <div className="modal-layer">
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2>Manual renewal / extension</h2>
            <p>Renew Sajib Grocery's subscription.</p>
          </div>
          <button className="icon-button" onClick={close}>
            <Icon name="close" />
          </button>
        </div>
        <div className="renew-shop">
          <div className="shop-avatar small">SG</div>
          <strong>Sajib Grocery</strong>
          <Badge color="green">Active</Badge>
        </div>
        <label className="radio">
          <input type="radio" defaultChecked />
          <span>
            <strong>Renew subscription</strong>
            <small>Add a new period from the current end date.</small>
          </span>
        </label>
        <label className="radio">
          <input type="radio" />
          <span>
            <strong>Extend subscription</strong>
            <small>Add extra time to the current subscription.</small>
          </span>
        </label>
        <label className="field">
          Plan <em>*</em>
          <select defaultValue="Yearly">
            <option>Yearly — ৳20,000 / year</option>
            <option>Monthly — ৳2,000 / month</option>
          </select>
        </label>
        <label className="field">
          New valid until
          <input defaultValue="24 Dec 2027" />
        </label>
        <label className="field">
          Note <span>(optional)</span>
          <textarea defaultValue="Manual renewal by admin." />
        </label>
        <div className="modal-actions">
          <Button kind="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={close}>Confirm renewal</Button>
        </div>
      </div>
    </div>
  );
}

const plans = [
  ["Weekly Trial", "7 days", "Free"],
  ["Monthly Trial", "30 days", "Free"],
  ["Monthly", "1 month", "৳ 2,000 / month"],
  ["Yearly", "1 year", "৳ 20,000 / year"],
];
function Subscriptions() {
  return (
    <>
      <Header
        title="Subscription plans"
        subtitle="Manage subscription plans for all shops"
      />
      <div className="page">
        <div className="page-actions">
          <Button>
            <Icon name="plus" /> New plan
          </Button>
        </div>
        <div className="plan-grid">
          {plans.map((p, i) => (
            <article className={`plan ${i === 3 ? "featured" : ""}`} key={p[0]}>
              {i === 3 && <Badge color="green">Popular</Badge>}
              <Icon name="calendar" size={24} />
              <h2>{p[0]}</h2>
              <p>
                {i < 2
                  ? "Try all features before subscribing."
                  : "For growing, active shops."}
              </p>
              <strong>{p[2]}</strong>
              <small>{p[1]}</small>
              <ul>
                <li>
                  <Icon name="check" />
                  Full feature access
                </li>
                <li>
                  <Icon name="check" />
                  No hidden fees
                </li>
                <li>
                  <Icon name="check" />
                  One shop account
                </li>
                <li>
                  <Icon name="check" />
                  Email support
                </li>
              </ul>
              <Button kind="secondary">Edit plan</Button>
            </article>
          ))}
        </div>
        <Panel
          title="Plan changes are tracked"
          subtitle="Pricing and duration updates apply to new renewals. Active subscriptions keep their existing terms."
        >
          <div />
        </Panel>
      </div>
    </>
  );
}
function Owners() {
  return (
    <>
      <Header title="Owners" subtitle="Manage shop owners' accounts (432)" />
      <div className="page">
        <div className="filters">
          <label className="search">
            <Icon name="search" />
            <input placeholder="Search by owner name or phone..." />
          </label>
          <Button kind="secondary">Status: All⌄</Button>
          <Button>
            <Icon name="plus" /> Add owner
          </Button>
        </div>
        <Table
          headers={[
            "Owner name",
            "Phone number",
            "Shops",
            "Account status",
            "Actions",
          ]}
        >
          {owners.map((owner) => (
            <tr key={owner[1]}>
              <td>
                <strong>{owner[0]}</strong>
              </td>
              <td>{owner[1]}</td>
              <td>{owner[2]}</td>
              <td>
                <Badge color={tone(owner[3])}>{owner[3]}</Badge>
              </td>
              <td>
                <button className="icon-button">
                  <Icon name="more" />
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}
function Reports() {
  return (
    <>
      <Header
        title="Reports"
        subtitle="Platform performance and subscription insights"
      />
      <div className="page">
        <section className="metrics four">
          <Metric
            icon="money"
            label="Monthly revenue"
            value={currency(248760)}
          />
          <Metric icon="trend" label="Growth" value="+12.4%" />
          <Metric icon="store" label="New shops" value="38" />
          <Metric icon="refresh" label="Renewal rate" value="84.6%" />
        </section>
        <div className="dashboard-grid">
          <Panel title="Revenue overview" subtitle="Last 30 days">
            <RevenueChart />
          </Panel>
          <Panel title="Plan distribution" subtitle="Across active shops">
            <div className="distribution">
              <div className="donut">
                <span>
                  318<small>active</small>
                </span>
              </div>
              <div>
                <p>
                  <i className="one" />
                  Yearly <strong>48%</strong>
                </p>
                <p>
                  <i className="two" />
                  Monthly <strong>38%</strong>
                </p>
                <p>
                  <i className="three" />
                  Trial <strong>14%</strong>
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
function Settings() {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <Header
        title="Settings"
        subtitle="Manage your admin account and platform preferences"
      />
      <div className="page">
        <div className="tabs">
          <button className="active">Admin profile</button>
          <button>Platform settings</button>
          <button>Subscription settings</button>
        </div>
        <section className="profile-panel">
          <div className="profile-picture">
            <div className="avatar large">A</div>
            <button className="link-button">Change photo</button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSaved(true);
            }}
          >
            <h2>Admin profile</h2>
            <p>Update your admin account information.</p>
            <label className="field">
              Name <em>*</em>
              <input defaultValue="Admin" />
            </label>
            <label className="field">
              Phone number <em>*</em>
              <input defaultValue="+880 1712 345678" />
            </label>
            <label className="field">
              Email
              <input type="email" defaultValue="admin@dukaanflow.com" />
            </label>
            <label className="field">
              Password
              <div className="password">
                <input type="password" defaultValue="123456789" />
                <Button kind="secondary">Change password</Button>
              </div>
            </label>
            <div className="form-actions">
              <Button kind="secondary">Discard</Button>
              <button className="button">
                {saved ? (
                  <>
                    <Icon name="check" /> Saved
                  </>
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

void Dashboard;
void Shops;
void Subscriptions;
void Owners;
void LiveShops;
function Loading({ message = "Loading data..." }: { message?: string }) {
  return <div className="state-card">{message}</div>;
}
function ErrorState({ message }: { message: string }) {
  return <div className="state-card error">{message}</div>;
}

function Login({
  onLogin,
}: {
  onLogin: (name: string, mustChangePassword: boolean) => void;
}) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await api.login(phone, password);
      if (session.user.platformRole !== "ADMIN")
        throw new Error("This portal is only for platform administrators.");
      onLogin(session.user.fullName, session.user.mustChangePassword);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <Brand />
        <div>
          <h1>Admin login</h1>
          <p>Manage shops and subscriptions securely.</p>
        </div>
        {error && <div className="form-error">{error}</div>}
        <label className="field">
          Phone number
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+252 61 0000000"
            autoComplete="username"
            required
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button className="button login-button" disabled={busy}>
          {busy ? "Signing in..." : "Log in"}
        </button>
      </form>
    </div>
  );
}

function AdminPassword({ done }: { done: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.changePassword(current, next);
      done();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Password change failed",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <Brand />
        <div>
          <h1>Change temporary password</h1>
          <p>Create a private password before using the admin portal.</p>
        </div>
        {error && <div className="form-error">{error}</div>}
        <label className="field">
          Temporary password
          <input
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            required
          />
        </label>
        <label className="field">
          New password
          <input
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            minLength={8}
            required
          />
        </label>
        <button className="button login-button" disabled={busy}>
          {busy ? "Saving..." : "Change password"}
        </button>
      </form>
    </div>
  );
}

function LiveDashboard() {
  const [data, setData] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .dashboard()
      .then(setData)
      .catch((reason) => setError(reason.message));
  }, []);
  return (
    <>
      <Header title="Dashboard" subtitle="Live platform overview" />
      <div className="page">
        {error ? (
          <ErrorState message={error} />
        ) : !data ? (
          <Loading />
        ) : (
          <section className="metrics">
            <Metric
              icon="store"
              label="Total shops"
              value={String(data.totalShops ?? 0)}
            />
            <Metric
              icon="shield"
              label="Active subscriptions"
              value={String(data.activeSubscriptions ?? 0)}
            />
            <Metric
              icon="users"
              label="Trial shops"
              value={String(data.trialShops ?? 0)}
            />
            <Metric
              icon="clock"
              label="Expiring in 30 days"
              value={String(data.expiringSoon ?? 0)}
              warning
            />
            <Metric
              icon="store"
              label="Suspended shops"
              value={String(data.suspendedShops ?? 0)}
            />
          </section>
        )}
        <Panel
          title="Foundation ready"
          subtitle="Revenue is intentionally omitted until real subscription payments are recorded."
        >
          <p className="body-copy">
            Shop, owner, authentication, and subscription metrics are loaded
            directly from the API.
          </p>
        </Panel>
      </div>
    </>
  );
}

function AddShopModal({
  close,
  saved,
}: {
  close: () => void;
  saved: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api.createShop(values);
      saved();
      close();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not create shop",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-layer">
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <h2>Add shop</h2>
            <p>Create the shop and its owner in one transaction.</p>
          </div>
          <button type="button" className="icon-button" onClick={close}>
            <Icon name="close" />
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <label className="field">
          Shop name
          <input name="name" required />
        </label>
        <label className="field">
          Shop phone
          <input name="phoneNumber" placeholder="+252..." required />
        </label>
        <label className="field">
          Currency code
          <input
            name="currencyCode"
            defaultValue="USD"
            maxLength={3}
            required
          />
        </label>
        <label className="field">
          Owner full name
          <input name="ownerFullName" required />
        </label>
        <label className="field">
          Owner phone
          <input name="ownerPhoneNumber" placeholder="+252..." required />
        </label>
        <label className="field">
          Temporary password
          <input
            name="temporaryPassword"
            type="password"
            minLength={8}
            required
          />
        </label>
        <div className="modal-actions">
          <Button kind="secondary" onClick={close}>
            Cancel
          </Button>
          <button className="button" disabled={busy}>
            {busy ? "Creating..." : "Create shop"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LiveShops() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ApiShop[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<ApiShop | null>(null);
  const reload = useCallback(() => {
    setLoading(true);
    api
      .shops(query)
      .then((result) => {
        setRows(result.items);
        setError("");
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(reload, 250);
    return () => clearTimeout(timer);
  }, [reload]);
  async function changeStatus(shop: ApiShop) {
    try {
      await api.setShopStatus(
        shop.id,
        shop.accountStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
      );
      setSelected(null);
      reload();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Status update failed",
      );
    }
  }
  if (selected)
    return (
      <>
        <Header
          title="Shop details"
          subtitle="Live account and subscription information"
        />
        <div className="page">
          <button className="back" onClick={() => setSelected(null)}>
            <Icon name="back" /> Back to shops
          </button>
          <div className="shop-heading">
            <div className="shop-avatar">
              {selected.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2>{selected.name}</h2>
              <p>{selected.phoneNumber}</p>
            </div>
            <Button
              kind={selected.accountStatus === "ACTIVE" ? "danger" : "primary"}
              onClick={() => changeStatus(selected)}
            >
              {selected.accountStatus === "ACTIVE" ? "Suspend" : "Reactivate"}
            </Button>
          </div>
          <div className="details-grid">
            <Panel title="Shop information">
              <Info label="Owner" value={selected.ownerName} />
              <Info label="Owner phone" value={selected.ownerPhoneNumber} />
              <Info
                label="Account status"
                value={
                  <Badge
                    color={tone(
                      selected.accountStatus[0] +
                        selected.accountStatus.slice(1).toLowerCase(),
                    )}
                  >
                    {selected.accountStatus}
                  </Badge>
                }
              />
            </Panel>
            <Panel title="Subscription">
              <Info
                label="Status"
                value={selected.subscriptionStatus ?? "Not assigned"}
              />
              <Info label="Plan" value={selected.planName ?? "—"} />
              <Info
                label="Expires"
                value={
                  selected.expiresAt
                    ? new Date(selected.expiresAt).toLocaleDateString()
                    : "—"
                }
              />
            </Panel>
          </div>
        </div>
      </>
    );
  return (
    <>
      <Header title="Shops" subtitle="Real shop accounts from DukaanFlow" />
      <div className="page">
        <div className="filters">
          <label className="search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by shop name or phone..."
            />
          </label>
          <Button onClick={() => setAdding(true)}>
            <Icon name="plus" /> Add shop
          </Button>
        </div>
        {error && <ErrorState message={error} />}{" "}
        {loading ? (
          <Loading />
        ) : (
          <section className="table-card">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Owner</th>
                    <th>Phone</th>
                    <th>Account</th>
                    <th>Subscription</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((shop) => (
                    <tr key={shop.id}>
                      <td>
                        <strong>{shop.name}</strong>
                      </td>
                      <td>{shop.ownerName}</td>
                      <td>{shop.phoneNumber}</td>
                      <td>
                        <Badge
                          color={
                            shop.accountStatus === "ACTIVE" ? "green" : "red"
                          }
                        >
                          {shop.accountStatus}
                        </Badge>
                      </td>
                      <td>
                        <Badge
                          color={
                            shop.subscriptionStatus === "ACTIVE"
                              ? "green"
                              : shop.subscriptionStatus === "TRIAL"
                                ? "yellow"
                                : shop.subscriptionStatus
                                  ? "red"
                                  : "gray"
                          }
                        >
                          {shop.subscriptionStatus ?? "NONE"}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="link-button"
                          onClick={() => setSelected(shop)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer>
              <span>{rows.length} shops shown</span>
            </footer>
          </section>
        )}
      </div>
      {adding && <AddShopModal close={() => setAdding(false)} saved={reload} />}
    </>
  );
}

function SubscriptionDialog({
  shop,
  subscription,
  close,
  saved,
}: {
  shop: ApiShop;
  subscription: ApiSubscription | null;
  close: () => void;
  saved: () => void;
}) {
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const renewal =
    !!subscription &&
    !["EXPIRED", "CANCELLED"].includes(subscription.effectiveStatus);
  useEffect(() => {
    api
      .plans()
      .then((items) => {
        const available = items.filter(
          (plan) => plan.isActive && (renewal ? plan.type === "PAID" : true),
        );
        setPlans(available);
        setPlanId(available[0]?.id ?? "");
      })
      .catch((reason) => setError(reason.message));
  }, [renewal]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (renewal) await api.renew(shop.id, planId, note);
      else await api.activate(shop.id, planId, note);
      saved();
      close();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Subscription update failed",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-layer">
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <h2>{renewal ? "Renew subscription" : "Activate subscription"}</h2>
            <p>{shop.name}</p>
          </div>
          <button type="button" className="icon-button" onClick={close}>
            <Icon name="close" />
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <label className="field">
          Plan
          <select
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            required
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {plan.durationCount}{" "}
                {plan.durationUnit.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        {subscription && (
          <div className="renew-shop">
            <div>
              <strong>Current expiration</strong>
              <small>
                {new Date(subscription.expiresAt).toLocaleDateString()} ·{" "}
                {subscription.daysRemaining} days left
              </small>
            </div>
          </div>
        )}
        <label className="field">
          Note <span>(optional)</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <div className="modal-actions">
          <Button kind="secondary" onClick={close}>
            Cancel
          </Button>
          <button className="button" disabled={busy || !planId}>
            {busy
              ? "Saving..."
              : renewal
                ? "Confirm renewal"
                : "Confirm activation"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CompleteShops() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ApiShop[]>([]);
  const [selected, setSelected] = useState<ApiShop | null>(null);
  const [subscription, setSubscription] = useState<ApiSubscription | null>(
    null,
  );
  const [history, setHistory] = useState<ApiSubscriptionEvent[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadList = useCallback(() => {
    setLoading(true);
    api
      .shops(query)
      .then((result) => {
        setItems(result.items);
        setError("");
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [query]);
  const loadDetail = useCallback(async (id: string) => {
    const [shop, current, events] = await Promise.all([
      api.shop(id),
      api.subscription(id),
      api.subscriptionHistory(id),
    ]);
    setSelected(shop);
    setSubscription(current);
    setHistory(events.items);
  }, []);
  useEffect(() => {
    const timer = setTimeout(loadList, 250);
    return () => clearTimeout(timer);
  }, [loadList]);
  async function updateStatus() {
    if (!selected) return;
    try {
      await api.setShopStatus(
        selected.id,
        selected.accountStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
      );
      await loadDetail(selected.id);
      loadList();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Status update failed",
      );
    }
  }
  if (selected)
    return (
      <>
        <Header
          title="Shop details"
          subtitle="Account, owner, and subscription history"
        />
        <div className="page">
          <button
            className="back"
            onClick={() => {
              setSelected(null);
              setSubscription(null);
            }}
          >
            <Icon name="back" /> Back to shops
          </button>
          <div className="shop-heading">
            <div className="shop-avatar">
              {selected.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2>{selected.name}</h2>
              <p>{selected.phoneNumber}</p>
            </div>
            <Button
              kind="secondary"
              onClick={() => setEditingSubscription(true)}
            >
              {subscription ? "Renew subscription" : "Assign subscription"}
            </Button>
            <Button
              kind={selected.accountStatus === "ACTIVE" ? "danger" : "primary"}
              onClick={updateStatus}
            >
              {selected.accountStatus === "ACTIVE" ? "Suspend" : "Reactivate"}
            </Button>
          </div>
          {error && <ErrorState message={error} />}
          <div className="details-grid">
            <Panel title="Shop information">
              <Info label="Owner" value={selected.ownerName} />
              <Info label="Owner phone" value={selected.ownerPhoneNumber} />
              <Info
                label="Account status"
                value={
                  <Badge
                    color={
                      selected.accountStatus === "ACTIVE" ? "green" : "red"
                    }
                  >
                    {selected.accountStatus}
                  </Badge>
                }
              />
              <Info
                label="Registered"
                value={new Date(selected.createdAt).toLocaleDateString()}
              />
            </Panel>
            <Panel title="Subscription">
              <Info
                label="Status"
                value={subscription?.effectiveStatus ?? "Not assigned"}
              />
              <Info label="Plan" value={subscription?.planName ?? "—"} />
              <Info
                label="Expiration"
                value={
                  subscription
                    ? new Date(subscription.expiresAt).toLocaleDateString()
                    : "—"
                }
              />
              <Info
                label="Access"
                value={subscription?.access ?? "RESTRICTED"}
              />
            </Panel>
          </div>
          <Panel
            title="Subscription history"
            subtitle="Audited administrator actions"
            className="history-panel"
          >
            {history.length ? (
              history.map((item) => (
                <div className="activity-row" key={item.id}>
                  <span>
                    <Icon name="calendar" />
                  </span>
                  <strong>{item.eventType.replaceAll("_", " ")}</strong>
                  <small>
                    {new Date(item.createdAt).toLocaleString()} ·{" "}
                    {item.performedByName}
                  </small>
                </div>
              ))
            ) : (
              <p className="body-copy">No subscription actions yet.</p>
            )}
          </Panel>
        </div>
        {editingSubscription && (
          <SubscriptionDialog
            shop={selected}
            subscription={subscription}
            close={() => setEditingSubscription(false)}
            saved={() => loadDetail(selected.id)}
          />
        )}
      </>
    );
  return (
    <>
      <Header title="Shops" subtitle="Real shop accounts from DukaanFlow" />
      <div className="page">
        <div className="filters">
          <label className="search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by shop name or phone..."
            />
          </label>
          <Button onClick={() => setAdding(true)}>
            <Icon name="plus" /> Add shop
          </Button>
        </div>
        {error && <ErrorState message={error} />}{" "}
        {loading ? (
          <Loading />
        ) : (
          <section className="table-card">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Owner</th>
                    <th>Phone</th>
                    <th>Account</th>
                    <th>Subscription</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((shop) => (
                    <tr key={shop.id}>
                      <td>
                        <strong>{shop.name}</strong>
                      </td>
                      <td>{shop.ownerName}</td>
                      <td>{shop.phoneNumber}</td>
                      <td>
                        <Badge
                          color={
                            shop.accountStatus === "ACTIVE" ? "green" : "red"
                          }
                        >
                          {shop.accountStatus}
                        </Badge>
                      </td>
                      <td>
                        <Badge
                          color={
                            shop.subscriptionStatus === "ACTIVE"
                              ? "green"
                              : shop.subscriptionStatus === "TRIAL"
                                ? "yellow"
                                : shop.subscriptionStatus
                                  ? "red"
                                  : "gray"
                          }
                        >
                          {shop.subscriptionStatus ?? "NONE"}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="link-button"
                          onClick={() =>
                            loadDetail(shop.id).catch((reason) =>
                              setError(reason.message),
                            )
                          }
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer>
              <span>{items.length} shops shown</span>
            </footer>
          </section>
        )}
      </div>
      {adding && (
        <AddShopModal close={() => setAdding(false)} saved={loadList} />
      )}
    </>
  );
}

function LiveSubscriptions() {
  const [items, setItems] = useState<ApiPlan[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .plans()
      .then(setItems)
      .catch((reason) => setError(reason.message));
  }, []);
  return (
    <>
      <Header
        title="Subscription plans"
        subtitle="Plans configured in the database"
      />
      <div className="page">
        {error ? (
          <ErrorState message={error} />
        ) : !items.length ? (
          <Loading />
        ) : (
          <div className="plan-grid">
            {items.map((plan) => (
              <article className="plan" key={plan.id}>
                <Icon name="calendar" size={24} />
                <h2>{plan.name}</h2>
                <p>
                  {plan.type === "TRIAL"
                    ? "Introductory access"
                    : "Manually managed paid subscription"}
                </p>
                <strong>
                  {Number(plan.price) === 0
                    ? "Price not configured"
                    : `${plan.currencyCode} ${plan.price}`}
                </strong>
                <small>
                  {plan.durationCount} {plan.durationUnit.toLowerCase()}
                  {plan.durationCount === 1 ? "" : "s"}
                </small>
                <ul>
                  <li>
                    <Icon name="check" />
                    Real database plan
                  </li>
                  <li>
                    <Icon name="check" />
                    {plan.isActive ? "Available" : "Disabled"}
                  </li>
                </ul>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function LiveOwners() {
  const [items, setItems] = useState<ApiOwner[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .owners()
      .then((result) => setItems(result.items))
      .catch((reason) => setError(reason.message));
  }, []);
  return (
    <>
      <Header title="Owners" subtitle="Shop owner accounts" />
      <div className="page">
        {error ? (
          <ErrorState message={error} />
        ) : (
          <section className="table-card">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Owner</th>
                    <th>Phone</th>
                    <th>Shops</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((owner) => (
                    <tr key={owner.id}>
                      <td>
                        <strong>{owner.fullName}</strong>
                      </td>
                      <td>{owner.phoneNumber}</td>
                      <td>{owner.shopCount}</td>
                      <td>
                        <Badge color={owner.isActive ? "green" : "red"}>
                          {owner.isActive ? "ACTIVE" : "INACTIVE"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer>
              <span>{items.length} owners shown</span>
            </footer>
          </section>
        )}
      </div>
    </>
  );
}

function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [adminName, setAdminName] = useState("");
  const [mustChange, setMustChange] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    api
      .refresh()
      .then((session) => {
        if (session.user.platformRole === "ADMIN") {
          setAdminName(session.user.fullName);
          setMustChange(session.user.mustChangePassword);
        }
      })
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, []);
  async function logout() {
    setLoggingOut(true);
    try {
      await api.logout();
    } catch {
      // Local session cleanup still signs the administrator out if the request fails.
    } finally {
      setAdminName("");
      setMustChange(false);
      setPage("dashboard");
      setLoggingOut(false);
    }
  }
  if (checking) return <Loading message="Restoring secure session..." />;
  if (!adminName)
    return (
      <Login
        onLogin={(name, required) => {
          setAdminName(name);
          setMustChange(required);
        }}
      />
    );
  if (mustChange)
    return (
      <AdminPassword
        done={() => {
          setAdminName("");
          setMustChange(false);
        }}
      />
    );
  const screens: Record<Page, ReactNode> = {
    dashboard: <LiveDashboard />,
    shops: <CompleteShops />,
    subscriptions: <LiveSubscriptions />,
    owners: <LiveOwners />,
    reports: <Reports />,
    settings: <Settings />,
  };
  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        setPage={setPage}
        adminName={adminName}
        onLogout={logout}
        loggingOut={loggingOut}
      />
      <main>{screens[page]}</main>
    </div>
  );
}
export default App;
