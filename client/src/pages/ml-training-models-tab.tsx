import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Database, Loader2 } from "lucide-react";
import type { MLTrainingData } from "./ml-training-types";

interface TrainedModelsTabProps {
  training: MLTrainingData;
}

export function TrainedModelsTab({ training: t }: TrainedModelsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Trained ML Models
        </CardTitle>
        <CardDescription>View and manage your trained machine learning models</CardDescription>
      </CardHeader>
      <CardContent>
        {t.isLoadingModels ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : t.mlModels.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-models">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No trained models yet</p>
            <p className="text-sm mt-1">Train an LSTM or Random Forest model to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Data Quality</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.mlModels.map((model) => {
                  const tier = model.hyperparameters?.dataQualityTier;
                  const accuracy = model.performance?.accuracy;
                  const lookbackDays = model.hyperparameters?.lookbackDays;
                  return (
                    <TableRow key={model.id} data-testid={`row-model-${model.id}`}>
                      <TableCell className="font-medium">{model.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-type-${model.id}`}>
                          {model.modelType === "failure_prediction"
                            ? "LSTM"
                            : model.modelType === "health_classification"
                              ? "Random Forest"
                              : model.modelType}
                        </Badge>
                      </TableCell>
                      <TableCell>{model.targetEquipmentType || "All"}</TableCell>
                      <TableCell>
                        {accuracy ? (
                          <span className="text-sm" data-testid={`text-accuracy-${model.id}`}>
                            {(accuracy * 100).toFixed(1)}% accuracy
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {tier ? (
                          <div className="space-y-1">
                            <Badge
                              className={t.getTierBadge(tier).className}
                              data-testid={`badge-tier-${model.id}`}
                            >
                              {t.getTierBadge(tier).label}
                            </Badge>
                            {lookbackDays && (
                              <div className="text-xs text-muted-foreground">
                                {lookbackDays} days
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Legacy</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {model.status === "active" ? (
                          <Badge
                            variant="default"
                            className="bg-green-600"
                            data-testid={`badge-status-${model.id}`}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-status-${model.id}`}>
                            {model.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {model.createdAt ? new Date(model.createdAt).toLocaleDateString() : ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
