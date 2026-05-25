/**
 * Feedback / Flags — pilot stub.
 *
 * Surfaced as the second item in the simplified user-portal nav. This
 * is intentionally minimal: it gives users a place to land from the
 * "Feedback / Flags" tab without exposing the full attention-inbox.
 * Replaced by the real submission flow in a follow-up.
 */

import { Flag, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function FeedbackPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl" data-testid="page-feedback">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Flag className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Feedback &amp; Flags</CardTitle>
          <CardDescription>
            Report an issue, suggest an improvement, or flag a concern.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            The dedicated submission form arrives in the next pilot update. In the
            meantime, open the Attention Inbox to flag an item for the team.
          </p>
          <Link href="/attention-inbox">
            <Button className="w-full" data-testid="button-feedback-attention-inbox">
              Open Attention Inbox
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
