import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface EmailTemplates {
  purchaseOrder: EmailTemplate;
  serviceOrder: EmailTemplate;
}

interface EmailTemplatesResponse {
  templates: EmailTemplates;
  placeholders: {
    purchaseOrder: string[];
    serviceOrder: string[];
  };
}

export function useEmailTemplates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const templatesQuery = useQuery<EmailTemplatesResponse>({
    queryKey: ["/api/email-templates"],
    queryFn: async () => {
      const [templatesRes, placeholdersRes] = await Promise.all([
        fetch("/api/email-templates"),
        fetch("/api/email-templates/placeholders"),
      ]);
      if (!templatesRes.ok || !placeholdersRes.ok) {
        throw new Error("Failed to fetch email templates");
      }
      const templates = await templatesRes.json();
      const placeholders = await placeholdersRes.json();
      return { templates, placeholders };
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (params: {
      templateType: "purchaseOrder" | "serviceOrder";
      template: EmailTemplate;
    }) => {
      const response = await apiRequest("/api/email-templates", {
        method: "PATCH",
        body: JSON.stringify({
          [params.templateType]: params.template,
        }),
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({
        title: "Template Saved",
        description: `${variables.templateType === "purchaseOrder" ? "Purchase Order" : "Service Order"} template has been updated.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save email template.",
        variant: "destructive",
      });
    },
  });

  const resetTemplateMutation = useMutation({
    mutationFn: async (templateType: "purchaseOrder" | "serviceOrder") => {
      const response = await apiRequest(
        `/api/email-templates/reset/${templateType}`,
        { method: "POST" }
      );
      return response;
    },
    onSuccess: (_, templateType) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({
        title: "Template Reset",
        description: `${templateType === "purchaseOrder" ? "Purchase Order" : "Service Order"} template has been reset to default.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reset email template.",
        variant: "destructive",
      });
    },
  });

  return {
    templates: templatesQuery.data?.templates,
    placeholders: templatesQuery.data?.placeholders,
    isLoading: templatesQuery.isLoading,
    updateTemplate: updateTemplateMutation.mutate,
    resetTemplate: resetTemplateMutation.mutate,
    isUpdating: updateTemplateMutation.isPending,
    isResetting: resetTemplateMutation.isPending,
  };
}
