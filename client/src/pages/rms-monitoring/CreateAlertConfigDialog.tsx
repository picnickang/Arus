import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Vessel } from "./_shared";

export function CreateAlertConfigDialog({ vessels }: { vessels: Vessel[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [vesselId, setVesselId] = useState("");
  const [alertType, setAlertType] = useState("fuel_threshold");
  const [thresholdValue, setThresholdValue] = useState("500");
  const [engineKey, setEngineKey] = useState("mainEngine");
  const [direction, setDirection] = useState("above");
  const [centerLat, setCenterLat] = useState("");
  const [centerLon, setCenterLon] = useState("");
  const [radiusNm, setRadiusNm] = useState("5");
  const [triggerOn, setTriggerOn] = useState("both");
  const [cooldownMinutes, setCooldownMinutes] = useState("60");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      let config: Record<string, unknown> = {};
      if (alertType === "fuel_threshold") {
        config = { engineKey, thresholdKgPerH: parseFloat(thresholdValue), direction };
      } else if (alertType === "daily_consumption") {
        config = { maxDailyMt: parseFloat(thresholdValue) };
      } else if (alertType === "geofence") {
        config = {
          centerLat: parseFloat(centerLat),
          centerLon: parseFloat(centerLon),
          radiusNm: parseFloat(radiusNm),
          triggerOn,
        };
      } else if (alertType === "bunkering") {
        config = {
          notifyOnStart: true,
          notifyOnEnd: true,
          minVolumeLitres: parseFloat(thresholdValue) || 0,
        };
      }
      await apiRequest("POST", "/api/rms/alerts/configs", {
        vesselId,
        alertType,
        name,
        config,
        cooldownMinutes: parseInt(cooldownMinutes),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rms/alerts/configs"] });
      toast({ title: "Alert configuration created" });
      setOpen(false);
      setName("");
      setVesselId("");
      setAlertType("fuel_threshold");
    },
    onError: () => {
      toast({ title: "Failed to create alert config", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="btn-create-alert-config">
          <Plus className="h-4 w-4 mr-1" />
          New Alert Rule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Alert Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="High consumption warning"
              data-testid="input-alert-name"
            />
          </div>
          <div>
            <Label>Vessel</Label>
            <Select value={vesselId} onValueChange={setVesselId}>
              <SelectTrigger data-testid="select-alert-vessel">
                <SelectValue placeholder="Select vessel" />
              </SelectTrigger>
              <SelectContent>
                {vessels
                  .filter((v) => v.id)
                  .map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Alert Type</Label>
            <Select value={alertType} onValueChange={setAlertType}>
              <SelectTrigger data-testid="select-alert-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fuel_threshold">Fuel Threshold</SelectItem>
                <SelectItem value="daily_consumption">Daily Consumption</SelectItem>
                <SelectItem value="geofence">Geofence</SelectItem>
                <SelectItem value="bunkering">Bunkering</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {alertType === "fuel_threshold" && (
            <>
              <div>
                <Label>Engine</Label>
                <Select value={engineKey} onValueChange={setEngineKey}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mainEngine">Main Engine</SelectItem>
                    <SelectItem value="portEngine">Port Engine</SelectItem>
                    <SelectItem value="stbdEngine">Starboard Engine</SelectItem>
                    <SelectItem value="generator">Generator</SelectItem>
                    <SelectItem value="boiler">Boiler</SelectItem>
                    <SelectItem value="total">Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Threshold (kg/h)</Label>
                <Input
                  type="number"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  data-testid="input-threshold"
                />
              </div>
              <div>
                <Label>Direction</Label>
                <Select value={direction} onValueChange={setDirection}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Above</SelectItem>
                    <SelectItem value="below">Below</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {alertType === "daily_consumption" && (
            <div>
              <Label>Max Daily Consumption (MT)</Label>
              <Input
                type="number"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
                data-testid="input-max-daily"
              />
            </div>
          )}

          {alertType === "geofence" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Center Lat</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={centerLat}
                    onChange={(e) => setCenterLat(e.target.value)}
                    data-testid="input-center-lat"
                  />
                </div>
                <div>
                  <Label>Center Lon</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={centerLon}
                    onChange={(e) => setCenterLon(e.target.value)}
                    data-testid="input-center-lon"
                  />
                </div>
              </div>
              <div>
                <Label>Radius (NM)</Label>
                <Input
                  type="number"
                  value={radiusNm}
                  onChange={(e) => setRadiusNm(e.target.value)}
                  data-testid="input-radius"
                />
              </div>
              <div>
                <Label>Trigger On</Label>
                <Select value={triggerOn} onValueChange={setTriggerOn}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enter">Enter</SelectItem>
                    <SelectItem value="exit">Exit</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {alertType === "bunkering" && (
            <div>
              <Label>Min Volume (litres)</Label>
              <Input
                type="number"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
                data-testid="input-min-volume"
              />
            </div>
          )}

          <div>
            <Label>Cooldown (minutes)</Label>
            <Input
              type="number"
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(e.target.value)}
              data-testid="input-cooldown"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name || !vesselId || createMutation.isPending}
            data-testid="btn-save-alert-config"
          >
            {createMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
