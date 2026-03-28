import React from "react";
import { 
  ClipboardCheck, 
  BookOpen, 
  AlertTriangle, 
  Activity, 
  Wrench, 
  Settings, 
  Tool, 
  Calendar, 
  Package, 
  Users, 
  LayoutDashboard, 
  Radio, 
  Bell, 
  Zap, 
  CloudRain, 
  Ship, 
  ShieldCheck, 
  BarChart3, 
  MonitorPlay,
  MoreHorizontal,
  ChevronDown,
  LogOut,
  Menu
} from "lucide-react";

// Helper components to simulate shadcn/ui and keep the file self-contained
const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={`rounded-xl border border-slate-800 bg-slate-900/50 text-slate-100 shadow-sm ${className || ''}`}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'default', className = '' }: { children: React.ReactNode, variant?: 'default'|'destructive'|'warning'|'outline', className?: string }) => {
  const variants = {
    default: "bg-slate-800 text-slate-100 hover:bg-slate-700 border-transparent",
    destructive: "bg-red-900/50 text-red-200 border-red-800 hover:bg-red-900/70",
    warning: "bg-amber-900/50 text-amber-200 border-amber-800 hover:bg-amber-900/70",
    outline: "border-slate-700 text-slate-300"
  };
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
};

const Button = ({ children, variant = 'default', size = 'default', className = '', ...props }: any) => {
  const variants = {
    default: "bg-cyan-600 text-white hover:bg-cyan-700",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-slate-700 bg-transparent hover:bg-slate-800 text-slate-100",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
    ghost: "hover:bg-slate-800 hover:text-slate-100 text-slate-300",
    link: "text-slate-300 underline-offset-4 hover:underline"
  };
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10"
  };
  return (
    <button className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Separator = ({ className = '' }: { className?: string }) => (
  <div className={`h-[1px] w-full bg-slate-800 ${className}`} />
);

export function SidebarSplit() {
  // Mock Data
  const role = "Chief Engineer";
  
  const navGroups = [
    {
      title: "Maintenance",
      items: [
        { label: "Work Orders", icon: Wrench, active: true },
        { label: "Equipment", icon: Settings },
        { label: "PdM Dashboard", icon: Activity },
        { label: "Schedule Planner", icon: Calendar },
        { label: "Spare Parts", icon: Package },
        { label: "Vendors", icon: Users },
      ]
    },
    {
      title: "Operations",
      items: [
        { label: "Dashboard", icon: LayoutDashboard },
        { label: "Active Telemetry", icon: Radio },
        { label: "Alerts", icon: Bell },
        { label: "Actionable Insights", icon: Zap },
        { label: "Weather", icon: CloudRain },
      ]
    },
    {
      title: "Fleet",
      items: [
        { label: "Vessel Management", icon: Ship },
        { label: "CII Compliance", icon: ShieldCheck },
        { label: "Fleet Analytics", icon: BarChart3 },
        { label: "Digital Twin", icon: MonitorPlay },
      ]
    }
  ];

  const quickActions = [
    { label: "New Work Order", icon: ClipboardCheck },
    { label: "Log Engine Entry", icon: BookOpen },
    { label: "Report Defect", icon: AlertTriangle },
    { label: "Check PdM Alerts", icon: Activity },
  ];

  const tasks = [
    { title: "Replace fuel injector #3", equipment: "Main Engine", due: "Jan 15", priority: "high" },
    { title: "Inspect cooling pump seals", equipment: "Aux Engine 1", due: "Jan 18", priority: "medium" },
    { title: "Calibrate exhaust gas temp sensor", equipment: "Boiler System", due: "Jan 20", priority: "low" },
    { title: "Torque cylinder head bolts", equipment: "Main Engine", due: "Jan 22", priority: "high" },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* LEFT SIDEBAR */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        {/* Role & User Section */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-cyan-900/50 flex items-center justify-center border border-cyan-800 text-cyan-400">
            <span className="font-bold text-lg">CE</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-slate-100 truncate">Alex Mercer</h2>
            <p className="text-xs text-cyan-400 truncate">{role}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          <div className="px-3 space-y-6">
            {navGroups.map((group, idx) => (
              <div key={idx}>
                <h3 className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={i}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors ${
                          item.active 
                            ? 'bg-cyan-900/30 text-cyan-400 font-medium' 
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            <div>
              <h3 className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                More
              </h3>
              <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors">
                <MoreHorizontal className="h-4 w-4 shrink-0" />
                <span className="truncate">View all modules</span>
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-800">
          <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-slate-100">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-slate-950 to-slate-950">
        
        {/* Header Bar */}
        <header className="h-16 flex-shrink-0 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-3 md:hidden">
            <Menu className="h-6 w-6 text-slate-400" />
            <h1 className="text-xl font-bold tracking-tight text-slate-100">ARUS</h1>
          </div>
          <div className="hidden md:flex items-center space-x-2">
            <div className="h-6 w-1 bg-cyan-500 rounded-full mr-2"></div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">Overview</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" className="hidden sm:flex border-slate-700">
              Change Role
            </Button>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 cursor-pointer hover:bg-slate-700 transition-colors text-slate-300">
              <Bell className="h-4 w-4" />
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Attention Banner */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-sm font-medium text-slate-400 mb-3 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2 text-slate-500" />
                Requires Attention
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-4 cursor-pointer hover:bg-red-950/40 transition-colors group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-3xl font-light text-red-400 mb-1">3</div>
                      <div className="text-sm font-medium text-red-200 group-hover:text-red-100 transition-colors">Overdue Work Orders</div>
                    </div>
                    <Badge variant="destructive">Critical</Badge>
                  </div>
                </div>
                
                <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-4 cursor-pointer hover:bg-amber-950/40 transition-colors group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-3xl font-light text-amber-400 mb-1">5</div>
                      <div className="text-sm font-medium text-amber-200 group-hover:text-amber-100 transition-colors">Unacknowledged Alerts</div>
                    </div>
                    <Badge variant="warning">Warning</Badge>
                  </div>
                </div>

                <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-4 cursor-pointer hover:bg-amber-950/40 transition-colors group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-3xl font-light text-amber-400 mb-1">2</div>
                      <div className="text-sm font-medium text-amber-200 group-hover:text-amber-100 transition-colors">High-Risk Equipment</div>
                    </div>
                    <Badge variant="warning">Warning</Badge>
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Actions */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
              <h2 className="text-sm font-medium text-slate-400 mb-3 flex items-center">
                <Zap className="h-4 w-4 mr-2 text-slate-500" />
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {quickActions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <button 
                      key={idx} 
                      className="flex flex-col items-center justify-center p-6 bg-slate-900/60 border border-slate-800 rounded-xl hover:bg-slate-800 hover:border-slate-700 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-cyan-900/30 flex items-center justify-center mb-3 transition-colors">
                        <Icon className="h-5 w-5 text-slate-300 group-hover:text-cyan-400 transition-colors" />
                      </div>
                      <span className="text-sm font-medium text-slate-300 group-hover:text-slate-100">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Main Content Grid: Tasks and Secondary Info */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
              
              {/* My Tasks */}
              <section className="xl:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-slate-100 flex items-center">
                    <ClipboardCheck className="h-5 w-5 mr-2 text-cyan-500" />
                    My Tasks
                  </h2>
                  <Button variant="link" size="sm" className="text-cyan-400">View All</Button>
                </div>
                
                <Card className="overflow-hidden border-slate-800/60 bg-slate-900/40">
                  <div className="divide-y divide-slate-800/60">
                    {tasks.map((task, idx) => (
                      <div key={idx} className="p-4 hover:bg-slate-800/40 transition-colors flex items-center justify-between group">
                        <div className="flex items-start space-x-4">
                          <div className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                            task.priority === 'high' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                            task.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-500'
                          }`} />
                          <div>
                            <h4 className="text-sm font-medium text-slate-200 group-hover:text-cyan-400 transition-colors mb-1">{task.title}</h4>
                            <div className="flex items-center text-xs text-slate-500 space-x-3">
                              <span className="flex items-center">
                                <Settings className="h-3 w-3 mr-1" />
                                {task.equipment}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <Badge variant="outline" className="bg-slate-950">Due {task.due}</Badge>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                            Start
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>

              {/* Auxiliary Widget Area */}
              <section className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium text-slate-100 mb-4 flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-cyan-500" />
                    Fleet Status
                  </h2>
                  <Card className="p-5 border-slate-800/60 bg-slate-900/40 flex flex-col justify-center items-center text-center space-y-4">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-800" />
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="282.7" strokeDashoffset="28.27" className="text-cyan-500" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-slate-100">90%</span>
                        <span className="text-xs text-slate-400">Health</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-300">All primary systems operating within normal parameters.</p>
                      <Button variant="outline" size="sm" className="mt-4 w-full">View Telemetry</Button>
                    </div>
                  </Card>
                </div>
              </section>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default SidebarSplit;
