import { Link } from "wouter";
import { ArrowRight, Bell, Book, CloudSun, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function LogbookStatusTab() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Book className="h-5 w-5 text-blue-600" />
              Deck Logbook
            </CardTitle>
            <CardDescription>Bridge navigation and weather records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Last 7 Days Entries</span>
                <span className="text-muted-foreground">-</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Unsigned Logs</span>
                <span className="text-muted-foreground">-</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Completion Rate</span>
                <span className="text-muted-foreground">-</span>
              </div>
            </div>
            <Separator />
            <Button className="w-full" asChild>
              <Link href="/logs/deck">
                Open Deck Logbook
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-orange-600" />
              Engine Logbook
            </CardTitle>
            <CardDescription>Engine room operations and readings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Last 7 Days Entries</span>
                <span className="text-muted-foreground">-</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Unsigned Logs</span>
                <span className="text-muted-foreground">-</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Completion Rate</span>
                <span className="text-muted-foreground">-</span>
              </div>
            </div>
            <Separator />
            <Button className="w-full" variant="secondary" asChild>
              <Link href="/logs/engine">
                Open Engine Logbook
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudSun className="h-5 w-5 text-cyan-600" />
              StormGeo Weather Integration
            </CardTitle>
            <CardDescription>
              Automatic weather data import for deck logbook auto-fill
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Integration Status</span>
                <Badge variant="secondary">File Import</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Auto-fill</span>
                <span className="text-green-600">Enabled</span>
              </div>
            </div>
            <Separator />
            <Button className="w-full" variant="secondary" asChild>
              <Link href="/stormgeo-settings">
                Configure StormGeo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-600" />
              Notification Settings
            </CardTitle>
            <CardDescription>Email alerts and notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Email Alerts</span>
                <Badge variant="secondary">Configured</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Compliance Alerts</span>
                <span className="text-green-600">Enabled</span>
              </div>
            </div>
            <Separator />
            <Button className="w-full" variant="secondary" asChild>
              <Link href="/notifications">
                Configure Notifications
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
