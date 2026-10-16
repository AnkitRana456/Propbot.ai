import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Users,
  Search,
  ShieldCheck,
  Calendar,
  Check,
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Card } from '../components/ui/Card.js';
import { StatTile } from '../components/ui/StatTile.js';
import { Gauge } from '../components/ui/Gauge.js';
import { CommandPalette } from '../components/ui/CommandPalette.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Skeleton } from '../components/common/Skeleton.js';
import { useTheme } from '../contexts/ThemeContext.js';

export const DesignSystemPage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(text);
    setTimeout(() => setCopiedToken(null), 1500);
  };

  const colorSwatches = [
    { name: 'Midnight Navy', hex: '#0B1B3A', role: 'Brand Core / Dark Card / Text' },
    { name: 'Deep Midnight', hex: '#060E1F', role: 'App Canvas Dark Mode' },
    { name: 'Electric Blue', hex: '#2563EB', role: 'Primary CTA / Active State' },
    { name: 'Mint Emerald', hex: '#14B8A6', role: 'Success / RERA Verified' },
    { name: 'Warm Sand', hex: '#F6F1E7', role: 'Warm Background / Container' },
    { name: 'Imperial Gold', hex: '#F5B942', role: 'Hot Lead (Score >= 70) / VIP' },
    { name: 'Crimson Rose', hex: '#E11D48', role: 'Alerts / SLA Timer Warning' },
  ];

  return (
    <div className="space-y-12 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-8 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-950 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-blue-200">
              Design System Showcase
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold font-display">
            Aurora Estate Design System
          </h1>
          <p className="mt-1 text-sm text-blue-200 max-w-xl">
            Production tokens, accessible components, and visual identity tailored for premium Indian real estate sales.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="text-white border-white/30 hover:bg-white/10"
            onClick={toggleTheme}
          >
            Toggle Theme ({theme === 'dark' ? 'Dark' : 'Light'})
          </Button>
          <Button
            variant="gold"
            leftIcon={<Search className="h-4 w-4" />}
            onClick={() => setIsCommandOpen(true)}
          >
            Open Palette (Ctrl+K)
          </Button>
        </div>
      </div>

      {/* 1. Color Swatches */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
          1. Brand Palette & Semantic Swatches
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {colorSwatches.map(swatch => (
            <Card
              key={swatch.hex}
              className="p-3 cursor-pointer hover:shadow-md transition group"
              onClick={() => copyToClipboard(swatch.hex)}
            >
              <div
                className="h-16 w-full rounded-lg shadow-inner mb-2.5 transition-transform group-hover:scale-102 flex items-center justify-center text-xs font-mono font-bold"
                style={{
                  backgroundColor: swatch.hex,
                  color: ['#F6F1E7', '#F5B942'].includes(swatch.hex) ? '#0B1B3A' : '#FFFFFF',
                }}
              >
                {copiedToken === swatch.hex ? <Check className="h-4 w-4" /> : swatch.hex}
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {swatch.name}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {swatch.role}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* 2. Button Component Showcase */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
          2. Button Variants & Interaction States
        </h2>
        <Card className="p-6">
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="mint" leftIcon={<ShieldCheck className="h-4 w-4" />}>
              RERA Verified
            </Button>
            <Button variant="gold" leftIcon={<Flame className="h-4 w-4" />}>
              Hot Lead Call
            </Button>
            <Button variant="danger" leftIcon={<AlertTriangle className="h-4 w-4" />}>
              Kill Switch
            </Button>
            <Button variant="ghost">Ghost Link</Button>
            <Button variant="primary" isLoading>
              Loading
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
        </Card>
      </section>

      {/* 3. Badges & Intent Indicators */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
          3. Badges & Intent Indicators
        </h2>
        <Card className="p-6">
          <div className="flex flex-wrap gap-2.5 items-center">
            <Badge variant="blue" icon={<Sparkles className="h-3 w-3" />}>
              AI Active
            </Badge>
            <Badge variant="mint" icon={<CheckCircle2 className="h-3 w-3" />}>
              RERA Approved PRM/KA/RERA/1251
            </Badge>
            <Badge variant="gold" icon={<Flame className="h-3 w-3" />}>
              Hot Lead (Score 92)
            </Badge>
            <Badge variant="rose" icon={<AlertTriangle className="h-3 w-3" />}>
              SLA Warning (&lt; 5m)
            </Badge>
            <Badge variant="slate">Cold Enquiry</Badge>
            <Badge variant="outline">3BHK Luxury Villa</Badge>
          </div>
        </Card>
      </section>

      {/* 4. Stat Tiles & Metric Display */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
          4. Stat Tiles & Performance Meters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Total Captured Leads"
            value="1,428"
            subValue="38 leads today"
            trend={{ value: '+14.2%', isPositive: true, label: 'vs last week' }}
            icon={<Users className="h-5 w-5" />}
            accentColor="blue"
          />
          <StatTile
            label="AI Qualified Leads"
            value="892"
            subValue="62.4% qualification rate"
            trend={{ value: '+8.1%', isPositive: true, label: 'vs baseline' }}
            icon={<Sparkles className="h-5 w-5" />}
            accentColor="mint"
          />
          <StatTile
            label="Hot Leads SLA Queue"
            value="14"
            subValue="Awaiting immediate call"
            trend={{ value: '2 Overdue', isPositive: false, label: 'urgency' }}
            icon={<Flame className="h-5 w-5" />}
            accentColor="gold"
          />
          <StatTile
            label="Confirmed Site Visits"
            value="26"
            subValue="Scheduled this weekend"
            trend={{ value: '+5 new', isPositive: true, label: 'today' }}
            icon={<Calendar className="h-5 w-5" />}
            accentColor="rose"
          />
        </div>
      </section>

      {/* 5. Intent Score Radial Gauges */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
          5. Intent Score Gauges (0–100)
        </h2>
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-around gap-6">
            <Gauge score={94} label="Hot Lead (High Intent)" size="lg" />
            <Gauge score={68} label="Warm Lead (Active Search)" size="md" />
            <Gauge score={28} label="Cold Lead (Casual Visitor)" size="sm" />
          </div>
        </Card>
      </section>

      {/* 6. Skeletons & Empty States */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
          6. Loading Skeletons & Empty States
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Shimmer Skeleton Loaders
            </h3>
            <Skeleton className="h-8 w-3/4 rounded-xl" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-5/6 rounded-md" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-10 w-28 rounded-xl" />
              <Skeleton className="h-10 w-28 rounded-xl" />
            </div>
          </Card>

          <Card className="p-6">
            <EmptyState
              title="No Pending Approvals"
              description="All autonomous AI actions are within safety guidelines. No pricing commitments need review."
              actionLabel="View Audit Log"
              onAction={() => {}}
            />
          </Card>
        </div>
      </section>

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
      />
    </div>
  );
};

export default DesignSystemPage;
