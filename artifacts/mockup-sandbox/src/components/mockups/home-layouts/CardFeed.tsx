import React, { useState } from "react";
import { 
  ClipboardCheck, BookOpen, AlertTriangle, Activity, Clock, AlertCircle, Sun, Moon, Wrench,
  Gauge, Anchor, ChevronRight, Menu, Bell, Search
} from "lucide-react";

// Mock Data
const role = "Chief Engineer";

const attentionItems = [
  { id: 1, count: 3, label: "Overdue work orders", type: "critical", icon: Clock },
  { id: 2, count: 5, label: "Unacknowledged alerts", type: "warning", icon: AlertCircle },
  { id: 3, count: 2, label: "High-risk equipment", type: "warning", icon: AlertTriangle },
];

const quickActions = [
  { id: 1, label: "New Work Order", icon: ClipboardCheck },
  { id: 2, label: "Log Engine Entry", icon: BookOpen },
  { id: 3, label: "Report Defect", icon: AlertTriangle },
  { id: 4, label: "Check PdM Alerts", icon: Activity },
];

const tasks = [
  { id: 1, action: "Replace fuel injector #3", equipment: "Main Engine", due: "in 2 days", priority: "high" },
  { id: 2, action: "Inspect cooling pump seals", equipment: "Aux Engine 1", due: "in 5 days", priority: "medium" },
  { id: 3, action: "Calibrate exhaust gas temp sensor", equipment: "Boiler System", due: "in 7 days", priority: "medium" },
  { id: 4, action: "Torque cylinder head bolts", equipment: "Main Engine", due: "in 9 days", priority: "low" },
];

const navCategories = [
  {
    id: "maintenance",
    name: "Maintenance",
    icon: Wrench,
    items: ["Work Orders", "Equipment", "PdM Dashboard", "Schedule Planner", "Spare Parts", "Vendors"]
  },
  {
    id: "operations",
    name: "Operations",
    icon: Gauge,
    items: ["Dashboard", "Active Telemetry", "Alerts", "Actionable Insights", "Weather"]
  },
  {
    id: "fleet",
    name: "Fleet",
    icon: Anchor,
    items: ["Vessel Management", "CII Compliance", "Fleet Analytics", "Digital Twin"]
  }
];

export function CardFeed() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-300 ${theme === 'dark' ? 'dark bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
      {/* Sticky top bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-900/30 text-cyan-400 font-bold tracking-wider">
            A
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-wide text-slate-100 leading-tight">ARUS</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-slate-400">{role}</span>
              <button className="text-[10px] text-cyan-500 hover:text-cyan-400 hover:underline">Change</button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors">
            <Search className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-slate-950"></span>
          </button>
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content Feed */}
      <main className="max-w-lg mx-auto w-full px-4 py-6 space-y-6">
        
        {/* Card 1: Attention Banner */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 px-1">Attention Required</h2>
          <div className="flex flex-col gap-3">
            {attentionItems.map((item) => (
              <div 
                key={item.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border ${
                  item.type === 'critical' 
                    ? 'bg-red-950/20 border-red-900/30' 
                    : 'bg-amber-950/20 border-amber-900/30'
                } relative overflow-hidden cursor-pointer hover:brightness-110 transition-all`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  item.type === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  item.type === 'critical' ? 'bg-red-900/50 text-red-400' : 'bg-amber-900/50 text-amber-400'
                }`}>
                  <item.icon className="w-5 h-5" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${
                      item.type === 'critical' ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      {item.count}
                    </span>
                    <span className={`text-sm font-medium ${
                      item.type === 'critical' ? 'text-red-200' : 'text-amber-200'
                    }`}>
                      {item.label}
                    </span>
                  </div>
                </div>
                
                <ChevronRight className={`w-5 h-5 opacity-50 ${
                  item.type === 'critical' ? 'text-red-400' : 'text-amber-400'
                }`} />
              </div>
            ))}
          </div>
        </section>

        {/* Card 2: Quick Actions Settings Menu Style */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 px-1">Quick Actions</h2>
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800/60 overflow-hidden divide-y divide-slate-800/60 shadow-sm">
            {quickActions.map((action) => (
              <button 
                key={action.id}
                className="w-full flex items-center gap-4 p-4 hover:bg-slate-800/40 transition-colors text-left group"
              >
                <div className="p-2 rounded-xl bg-slate-800 text-cyan-400 group-hover:bg-cyan-900/40 group-hover:text-cyan-300 transition-colors">
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="flex-1 font-medium text-slate-200">{action.label}</span>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400" />
              </button>
            ))}
          </div>
        </section>

        {/* Card 3: My Tasks */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">My Tasks</h2>
            <button className="text-xs font-medium text-cyan-500 hover:text-cyan-400">View All</button>
          </div>
          
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800/60 p-2 space-y-2 shadow-sm">
            {tasks.map((task) => (
              <div 
                key={task.id}
                className="flex flex-col p-3 rounded-xl bg-slate-950/50 border border-slate-800/40 hover:border-slate-700/60 transition-colors relative overflow-hidden group cursor-pointer"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  task.priority === 'high' ? 'bg-red-500' :
                  task.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />
                
                <div className="pl-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-medium text-slate-200 text-sm leading-snug group-hover:text-cyan-400 transition-colors">
                      {task.action}
                    </h3>
                    <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                      {task.due}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Wrench className="w-3 h-3" />
                    <span>{task.equipment}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Card 4+: Navigation Categories */}
        {navCategories.map((category) => (
          <section key={category.id}>
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800/60 overflow-hidden shadow-sm">
              <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-800/60 bg-slate-900/80">
                <div className="p-2 rounded-lg bg-cyan-950/30 text-cyan-400">
                  <category.icon className="w-5 h-5" />
                </div>
                <h2 className="font-semibold text-slate-100">{category.name}</h2>
              </div>
              
              <div className="flex flex-col py-2">
                {category.items.map((item, idx) => (
                  <button 
                    key={idx}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-800/40 transition-colors group text-left"
                  >
                    <span className="text-sm font-medium text-slate-300 group-hover:text-slate-100 transition-colors">
                      {item}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* More Categories Collapsible */}
        <section className="pt-2">
          <button className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-slate-800 border-dashed text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-colors font-medium text-sm">
            <Menu className="w-4 h-4" />
            <span>More Categories</span>
          </button>
        </section>
        
        {/* Bottom padding */}
        <div className="h-8"></div>
      </main>
    </div>
  );
}

export default CardFeed;
