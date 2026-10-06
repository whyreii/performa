// Central icon module — the ONLY place an icon library is imported.
//
// Icons are Phosphor (MIT, SF-Symbols-inspired: weights + fill variants). They
// are re-exported under the existing Lucide-style names so call sites did not
// change; to swap the library, change this file, not the 55 usages.
// Guarded by frontend/eslint.config.js (no direct icon-library imports elsewhere).
//
// Weight: Phosphor defaults to `regular`. For a filled active state pass
// `weight="fill"` (e.g. the active nav item) — see docs/SLOP_AUDIT.md.
import { createElement as h } from 'react';

export {
  ArrowsDownUp as ArrowUpDown,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  BookOpen,
  Building,
  Buildings as Building2,
  Calendar,
  CaretDown as ChevronDown,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  CaretUp as ChevronUp,
  ChartBar as BarChart3,
  Check,
  CheckCircle as CheckCircle2,
  Checks as CheckCheck,
  CircleNotch as Loader2,
  Clock,
  ClockCounterClockwise as History,
  Desktop as Monitor,
  DownloadSimple as Download,
  Eye,
  EyeSlash as EyeOff,
  FileText,
  Fire as Flame,
  Funnel as Filter,
  Gear as Settings,
  Info,
  Key as KeyRound,
  Lock,
  MagnifyingGlass as Search,
  Medal as Award,
  Moon,
  NavigationArrow as Navigation,
  Palette,
  Plus,
  Printer,
  Pulse as Activity,
  SealCheck as FileCheck2,
  ShieldCheck,
  ShieldWarning as ShieldAlert,
  SignOut as LogOut,
  Sliders,
  Sparkle as Sparkles,
  SquaresFour as LayoutDashboard,
  Sun,
  Target,
  TrendUp as TrendingUp,
  User,
  UserCheck,
  UserGear as UserCog,
  UserMinus as UserX,
  UserPlus,
  Users,
  Warning as AlertTriangle,
  WarningCircle as AlertCircle,
  X,
  XCircle,
} from '@phosphor-icons/react';

// Performa brand mark — an L-bracket measured span closing on a milestone dot.
// A custom SVG kept here so icons.js stays the single source for iconography
// (the eslint guardrail points every icon import at this file). Built with
// createElement because this module is a .js file (no JSX transform).
export function PerformaMark({ className = '', ...props }) {
  return h(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2.2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
      className,
      ...props,
    },
    h('path', { d: 'M4 6h16' }),
    h('path', { d: 'M4 6v14' }),
    h('path', { d: 'M9 20v-6h11v6' }),
    h('circle', { cx: 20, cy: 10, r: 1.7, fill: 'currentColor', stroke: 'none' })
  );
}
