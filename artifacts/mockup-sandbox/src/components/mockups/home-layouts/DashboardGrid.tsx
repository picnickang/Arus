import React, { useState } from "react";
import {
  ClipboardCheck,
  BookOpen,
  AlertTriangle,
  Activity,
  Ship,
  Wrench,
  Settings,
  CloudLightning,
  BarChart3,
  Tool,
  Boxes,
  Users,
  Anchor,
  Moon,
  Sun,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  ListTodo
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// Mock Data
const MOCK_DATA = {
  role: "Chief Engineer",
  attentionItems: [
    { label: "Overdue WO", count: 3, critical: true },
    { label: "Unack Alerts", count: 5, critical: false },
    { label: "High Risk Eq", count: 2, critical: false },
  ],
  quickActions: [
    { label: "New Work Order", icon: ClipboardCheck },
    { label: "Log Engine Entry", icon: BookOpen },
    { label: "Report Defect", icon: AlertTriangle },
    { label: "Check PdM Alerts", icon: Activity },
  ],
  tasks: [
    { title: "Replace fuel injector #3", equipment: "Main Engine", due: "Jan 15", priority: "high" },
    { title: "Inspect cooling pump seals", equipment: "Aux Engine 1", due: "Jan 18", priority: "medium" },
    { title: "Calibrate exhaust gas temp sensor", equipment: "Boiler System", due: "Jan 20", priority: "low" },
    { title: "Torque cylinder head bolts", equipment: "Main Engine", due: "Jan 22", priority: "medium" },
  ],
  navigation: [
    {
      group: "Maintenance",
      icon: Wrench,
      items: ["Work Orders", "Equipment", "PdM Dashboard", "Schedule Planner", "Spare Parts", "Vendors"],
    },
    {
      group: "Operations",
      icon: Activity,
      items: ["Dashboard", "Active Telemetry", "Alerts", "Actionable Insights", "Weather"],
    },
    {
      group: "Fleet",
      icon: Ship,
      items: ["Vessel Management", "CII Compliance", "Fleet Analytics", "Digital Twin"],
    },
  ],
};

export default function DashboardGrid() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Force dark mode styles on container for the mockup
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
      {/* Top Header - Compact Instrument Panel Style */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Anchor className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold tracking-tight text-white m-0 leading-none">ARUS</h1>
            <Badge variant="outline" className="bg-slate-800 text-cyan-300 border-cyan-900 ml-2 py-0 h-5">
              {MOCK_DATA.role}
            </Badge>
          </div>
          
          <Separator orientation="vertical" className="h-6 bg-slate-700 mx-2" />
          
          {/* Attention Pills inline */}
          <div className="flex items-center gap-2">
            {MOCK_DATA.attentionItems.map((item, idx) => (
              <Button 
                key={idx} 
                variant="ghost" 
                size="sm" 
                className={`h-7 px-2 border flex items-center gap-1.5 ${
                  item.critical 
                    ? "bg-red-950/30 border-red-900/50 text-red-400 hover:bg-red-900/40 hover:text-red-300" 
                    : "bg-amber-950/30 border-amber-900/50 text-amber-400 hover:bg-amber-900/40 hover:text-amber-300"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{item.count} {item.label}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-white">
            Change Role
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="flex-1 p-4 grid grid-cols-12 gap-4 overflow-hidden h-[calc(100vh-3rem)]">
        
        {/* Left Column (60%) */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4 overflow-hidden">
          
          {/* Quick Actions - Tight 2x2 Grid */}
          <section className="shrink-0">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ListTodo className="w-3.5 h-3.5" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {MOCK_DATA.quickActions.map((action, idx) => {
                const Icon = action.icon;
                return (
                  <Button 
                    key={idx}
                    variant="outline" 
                    className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white justify-start h-12 px-4 shadow-sm"
                  >
                    <Icon className="w-4 h-4 mr-3 text-cyan-400" />
                    <span className="font-medium text-sm">{action.label}</span>
                  </Button>
                )
              })}
            </div>
          </section>

          {/* Tasks - Compact Table */}
          <section className="flex-1 flex flex-col min-h-0 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-cyan-400" />
                My Assigned Tasks
              </h2>
              <Badge className="bg-slate-800 text-slate-300 hover:bg-slate-700">4 Active</Badge>
            </div>
            
            <div className="flex-1 overflow-auto p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-950/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Task / Work Order</th>
                    <th className="px-4 py-2 font-medium">Equipment</th>
                    <th className="px-4 py-2 font-medium text-right">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {MOCK_DATA.tasks.map((task, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="px-4 py-2.5 w-12">
                        <div className={`w-2 h-2 rounded-full ${
                          task.priority === 'high' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 
                          task.priority === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                        }`} />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-200">
                        {task.title}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">
                        {task.equipment}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-400 font-mono text-xs">
                        {task.due}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Column (40%) - Navigation Modules */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 overflow-hidden h-full">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0 flex items-center gap-1">
            <Boxes className="w-3.5 h-3.5" />
            Modules
          </h2>
          
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 pb-4 custom-scrollbar">
            {MOCK_DATA.navigation.map((nav, idx) => {
              const GroupIcon = nav.icon;
              return (
                <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-slate-950/30 border-b border-slate-800 flex items-center gap-2">
                    <GroupIcon className="w-4 h-4 text-cyan-500" />
                    <h3 className="font-medium text-sm text-slate-200">{nav.group}</h3>
                  </div>
                  <div className="p-2 grid grid-cols-2 gap-1.5">
                    {nav.items.map((item, itemIdx) => (
                      <button 
                        key={itemIdx}
                        className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-slate-800 text-left text-sm text-slate-400 hover:text-slate-100 transition-colors border border-transparent hover:border-slate-700"
                      >
                        <span className="truncate">{item}</span>
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* More Categories (Collapsible proxy) */}
            <div className="border border-slate-800 border-dashed rounded-lg bg-slate-900/30">
              <button className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors rounded-lg">
                <span>View More Categories</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}} />
    </div>
  );
}
