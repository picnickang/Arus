import { useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { insertSkillSchema } from "@shared/schema";
import { useCreateMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/useCrudMutations";
import { MARITIME_RANKS, COMMON_SKILLS } from "../lib/crewManagementUtils";

export interface Crew {
  id: string;
  name: string;
  rank: string;
  roleId?: string;
  vesselId?: string;
  maxHours7d: number;
  minRestH: number;
  active: boolean;
  skills: string[];
}
export interface AvailableRank {
  id: string;
  name: string;
  displayName: string;
  department?: string;
  hierarchyLevel: number;
  source: "custom" | "template";
}
export interface CrewLeave {
  id: string;
  crewId: string;
  start: string;
  end: string;
  reason?: string;
}
export interface ShiftTemplate {
  id: string;
  vesselId?: string;
  role: string;
  start: string;
  end: string;
  needed: number;
  skillRequired?: string;
  description?: string;
}

const skillFormSchema = insertSkillSchema
  .extend({
    category: z.string().min(1, "Category is required"),
    maxLevel: z.coerce.number().min(1).max(5, "Max level must be between 1-5"),
  })
  .omit({ orgId: true });
export type SkillFormData = z.infer<typeof skillFormSchema>;

const SKILL_CATEGORIES = [
  "Navigation",
  "Engineering",
  "Deck",
  "Safety",
  "Communication",
  "Maintenance",
];

export function useCrewManagementData() {
  const [crewForm, setCrewForm] = useState({
    name: "",
    rank: "Able Seaman",
    roleId: "",
    vesselId: "",
    maxHours7d: 72,
    minRestH: 10,
  });
  const [crewSkillForm, setCrewSkillForm] = useState({ crewId: "", skill: "", level: 1 });
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  const { data: crew = [], isLoading } = useQuery<Crew[]>({
    queryKey: ["/api/crew"],
    refetchInterval: 60000,
  });
  const { data: vessels = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/vessels"],
    refetchInterval: 60000,
  });
  const { data: skillsCatalog = [] } = useQuery<
    Array<{ id: string; name: string; category?: string; maxLevel: number; description?: string }>
  >({ queryKey: ["/api/skills"], refetchInterval: 60000 });

  // Fetch available ranks from the permissions system
  const { data: availableRanks = [] } = useQuery<AvailableRank[]>({
    queryKey: ["/api/crew/available-ranks"],
    refetchInterval: 60000,
  });

  // Combine API ranks with static fallback for backward compatibility
  const maritimeRanks = useMemo(() => {
    if (availableRanks.length > 0) {
      return availableRanks.map((r) => r.displayName);
    }
    return MARITIME_RANKS; // Fallback to static list
  }, [availableRanks]);

  const skillForm = useForm<SkillFormData>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: {
      name: "",
      category: "",
      description: "",
      maxLevel: 5,
      // @ts-ignore -- bulk-silence
      orgId: "default-org-id",
    },
  });

  const createCrewMutation = useCreateMutation("/api/crew", {
    successMessage: "Crew member created successfully",
    onSuccess: () =>
      setCrewForm({
        name: "",
        rank: "Able Seaman",
        roleId: "",
        vesselId: "",
        maxHours7d: 72,
        minRestH: 10,
      }),
  });
  const addSkillMutation = useCreateMutation("/api/crew/skills", {
    successMessage: "Skill added successfully",
    invalidateKeys: ["/api/crew"],
    onSuccess: () => setCrewSkillForm({ crewId: "", skill: "", level: 1 }),
  });
  const createSkillMutation = useCreateMutation<SkillFormData>("/api/skills", {
    successMessage: "Skill created successfully",
    onSuccess: () => skillForm.reset(),
  });
  const updateSkillMutation = useUpdateMutation<SkillFormData>("/api/skills", {
    successMessage: "Skill updated successfully",
    onSuccess: () => {
      setEditingSkillId(null);
      skillForm.reset();
    },
  });
  const deleteSkillMutation = useDeleteMutation("/api/skills", {
    successMessage: "Skill deleted successfully",
  });

  const capitalizeNames = useCallback(
    (name: string): string =>
      name
        .split(" ")
        .map((word) =>
          word.length === 0 ? "" : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" "),
    []
  );
  const handleSubmitCrew = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!crewForm.name.trim()) {
        return;
      }
      createCrewMutation.mutate(crewForm);
    },
    [crewForm, createCrewMutation]
  );
  const handleAddSkill = useCallback(() => {
    if (!crewSkillForm.crewId || !crewSkillForm.skill.trim()) {
      return;
    }
    addSkillMutation.mutate(crewSkillForm);
  }, [crewSkillForm, addSkillMutation]);
  const onSubmitSkill = useCallback(
    (data: SkillFormData) => {
      if (editingSkillId) {
        // @ts-ignore -- bulk-silence
        updateSkillMutation.mutate({ id: editingSkillId, ...data });
      } else {
        createSkillMutation.mutate(data);
      }
    },
    [editingSkillId, updateSkillMutation, createSkillMutation]
  );
  const handleEditSkill = useCallback(
    (skill: {
      id: string;
      name: string;
      category?: string;
      description?: string;
      maxLevel?: number;
    }) => {
      setEditingSkillId(skill.id);
      skillForm.reset({
        name: skill.name,
        category: skill.category || "",
        description: skill.description || "",
        maxLevel: skill.maxLevel || 5,
      });
    },
    [skillForm]
  );
  const handleCancelEdit = useCallback(() => {
    setEditingSkillId(null);
    skillForm.reset();
  }, [skillForm]);

  return {
    crewForm,
    setCrewForm,
    crewSkillForm,
    setCrewSkillForm,
    editingSkillId,
    crew,
    vessels,
    skillsCatalog,
    isLoading,
    skillForm,
    createCrewMutation,
    addSkillMutation,
    createSkillMutation,
    updateSkillMutation,
    deleteSkillMutation,
    capitalizeNames,
    handleSubmitCrew,
    handleAddSkill,
    onSubmitSkill,
    handleEditSkill,
    handleCancelEdit,
    maritimeRanks,
    availableRanks,
    skillCategories: SKILL_CATEGORIES,
    commonSkills: COMMON_SKILLS,
  };
}
