/**
 * RAG Analytics Dashboard Page
 * Visualizes RAG system performance metrics
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/navigation/PageHeader";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { MessageSquare, Zap, Database, ThumbsUp, FileText, Clock, TrendingUp } from "lucide-react";

interface AnalyticsSummary {
  queries: {
    total: number;
    last24h: number;
    last7d: number;
    averageLatencyMs: number;
  };
  cache: {
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    entriesCount: number;
  };
  feedback: {
    totalResponses: number;
    helpfulCount: number;
    notHelpfulCount: number;
    averageRating: number;
    satisfactionRate: number;
  };
  documents: {
    totalCount: number;
    totalChunks: number;
    avgChunksPerDoc: number;
    recentlyAdded: number;
  };
  conversations: {
    totalCount: number;
    activeCount: number;
    avgMessagesPerConversation: number;
  };
  trends: {
    queriesPerDay: Array<{ date: string; count: number }>;
    feedbackPerDay: Array<{ date: string; helpful: number; notHelpful: number }>;
  };
}

interface AnalyticsResponse {
  success: boolean;
  analytics: AnalyticsSummary;
}

const CHART_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b"];

function StatCard({
  title,
  value,
  subvalue,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  subvalue?: string;
  icon: typeof MessageSquare;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subvalue && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
            {subvalue}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function RagAnalyticsDashboard() {
  const analyticsQuery = useQuery<AnalyticsResponse>({
    queryKey: ["/api/rag/analytics"],
    refetchInterval: 60000,
  });

  const analytics = analyticsQuery.data?.analytics;

  if (analyticsQuery.isLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="RAG Analytics" description="Knowledge Base performance metrics" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <PageHeader title="RAG Analytics" description="Knowledge Base performance metrics" />
        <div className="text-center text-muted-foreground py-12">Unable to load analytics data</div>
      </div>
    );
  }

  const feedbackPieData = [
    { name: "Helpful", value: analytics.feedback.helpfulCount },
    { name: "Not Helpful", value: analytics.feedback.notHelpfulCount },
  ];

  const cacheData = [
    { name: "Cache Hits", value: analytics.cache.totalHits },
    { name: "Cache Misses", value: analytics.cache.totalMisses },
  ];

  return (
    <div className="p-6 space-y-6" data-testid="rag-analytics-dashboard">
      <PageHeader
        title="RAG Analytics"
        description="Knowledge Base performance metrics and insights"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Queries"
          value={analytics.queries.total}
          subvalue={`${analytics.queries.last24h} in last 24h`}
          icon={MessageSquare}
          trend="up"
        />
        <StatCard
          title="Avg Response Time"
          value={`${Math.round(analytics.queries.averageLatencyMs)}ms`}
          icon={Clock}
        />
        <StatCard
          title="Cache Hit Rate"
          value={`${Math.round(analytics.cache.hitRate * 100)}%`}
          subvalue={`${analytics.cache.entriesCount} cached entries`}
          icon={Zap}
        />
        <StatCard
          title="Satisfaction Rate"
          value={`${Math.round(analytics.feedback.satisfactionRate * 100)}%`}
          subvalue={`${analytics.feedback.totalResponses} responses rated`}
          icon={ThumbsUp}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Documents"
          value={analytics.documents.totalCount}
          subvalue={`${analytics.documents.recentlyAdded} added this week`}
          icon={FileText}
        />
        <StatCard
          title="Total Chunks"
          value={analytics.documents.totalChunks}
          subvalue={`~${analytics.documents.avgChunksPerDoc} per doc`}
          icon={Database}
        />
        <StatCard
          title="Conversations"
          value={analytics.conversations.totalCount}
          subvalue={`${analytics.conversations.activeCount} active`}
          icon={MessageSquare}
        />
        <StatCard
          title="Avg Messages"
          value={analytics.conversations.avgMessagesPerConversation}
          subvalue="per conversation"
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Queries Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.trends.queriesPerDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analytics.trends.queriesPerDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No query data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Feedback Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.feedback.totalResponses > 0 ? (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={feedbackPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {feedbackPieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No feedback data yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daily Feedback Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.trends.feedbackPerDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.trends.feedbackPerDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} />
                  <Bar dataKey="helpful" name="Helpful" fill="#22c55e" />
                  <Bar dataKey="notHelpful" name="Not Helpful" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No feedback trend data
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cache Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Hit Rate</span>
                <Badge variant="secondary">{Math.round(analytics.cache.hitRate * 100)}%</Badge>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${analytics.cache.hitRate * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {analytics.cache.totalHits}
                  </div>
                  <div className="text-xs text-muted-foreground">Cache Hits</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {analytics.cache.totalMisses}
                  </div>
                  <div className="text-xs text-muted-foreground">Cache Misses</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default RagAnalyticsDashboard;
