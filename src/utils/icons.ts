/**
 * MyFinance - Lucide Icon Helper
 * Provides crisp SVG icons for vanilla HTML rendering
 */

import {
  Wallet,
  Landmark,
  CreditCard,
  Smartphone,
  PiggyBank,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Plus,
  PieChart,
  Calendar,
  Target,
  Scale,
  Settings,
  Bell,
  Eye,
  EyeOff,
  Download,
  Upload,
  Lock,
  Trash2,
  Edit,
  Check,
  AlertTriangle,
  ShieldCheck,
  Search,
  Filter,
  X,
  Sun,
  Moon,
  RefreshCw,
  Printer,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  FileText,
  DollarSign,
  Briefcase,
  Laptop,
  Store,
  ShoppingCart,
  Home,
  Car,
  GraduationCap,
  HeartPulse,
  Wifi,
  Coffee,
  Users,
  Tag,
  Menu,
  type IconNode,
} from 'lucide';

// Map of available icons
const iconsMap: Record<string, IconNode> = {
  wallet: Wallet,
  landmark: Landmark,
  'credit-card': CreditCard,
  smartphone: Smartphone,
  'piggy-bank': PiggyBank,
  'arrow-down-left': ArrowDownLeft,
  'arrow-up-right': ArrowUpRight,
  'arrow-left-right': ArrowLeftRight,
  plus: Plus,
  'pie-chart': PieChart,
  calendar: Calendar,
  target: Target,
  scale: Scale,
  settings: Settings,
  bell: Bell,
  eye: Eye,
  'eye-off': EyeOff,
  download: Download,
  upload: Upload,
  lock: Lock,
  'trash-2': Trash2,
  trash: Trash2,
  edit: Edit,
  check: Check,
  'alert-triangle': AlertTriangle,
  'shield-check': ShieldCheck,
  search: Search,
  filter: Filter,
  x: X,
  sun: Sun,
  moon: Moon,
  'refresh-cw': RefreshCw,
  printer: Printer,
  'chevron-right': ChevronRight,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'file-text': FileText,
  'dollar-sign': DollarSign,
  briefcase: Briefcase,
  laptop: Laptop,
  store: Store,
  'shopping-cart': ShoppingCart,
  home: Home,
  car: Car,
  'graduation-cap': GraduationCap,
  'heart-pulse': HeartPulse,
  wifi: Wifi,
  coffee: Coffee,
  users: Users,
  tag: Tag,
  menu: Menu,
};

/**
 * Generates an inline SVG string for the requested Lucide icon
 */
export function getIcon(name: string, className: string = 'w-5 h-5'): string {
  const iconNodes = (iconsMap[name] || iconsMap['tag']) as [string, Record<string, any>][];
  if (!iconNodes || !Array.isArray(iconNodes)) return '';

  const childElements = iconNodes
    .map(([childTag, childAttrs]) => {
      const attrStr = Object.entries(childAttrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `<${childTag} ${attrStr}></${childTag}>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}">
    ${childElements}
  </svg>`;
}
