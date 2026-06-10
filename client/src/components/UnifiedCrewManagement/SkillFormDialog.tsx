import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { COMMON_SKILLS, formatRank, useUnifiedCrewData } from "@/features/crew";

type UnifiedCrewData = ReturnType<typeof useUnifiedCrewData>;

export function SkillFormDialog({ d }: { d: UnifiedCrewData }) {
  return (
    <ResponsiveDialog
      open={d.isAddSkillDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          d.closeSkillDialog();
        }
      }}
      title="Add Skill to Crew Member"
      description="Assign a maritime skill or certification"
      footer={
        <div className="flex gap-2 w-full">
          <Button type="button" variant="outline" onClick={d.closeSkillDialog} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={d.skillForm.handleSubmit(d.onSubmitSkill)}
            disabled={d.addSkillMutation.isPending}
            className="flex-1"
            data-testid="button-save-skill"
          >
            Add Skill
          </Button>
        </div>
      }
    >
      <Form {...d.skillForm}>
        <form className="space-y-4">
          {d.skillAssignmentCrewId ? (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">Assigning skill to:</p>
              <p className="text-lg font-semibold">
                {d.crew.find((c) => c.id === d.skillAssignmentCrewId)?.name || "Unknown"}
              </p>
            </div>
          ) : (
            <FormField
              control={d.skillForm.control}
              name="crewId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Crew Member</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-skill-crew">
                        <SelectValue placeholder="Select crew member" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {d.crew.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} ({formatRank(member.rank)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={d.skillForm.control}
            name="skill"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Skill</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-skill-name">
                      <SelectValue placeholder="Select skill" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COMMON_SKILLS.map((skill) => (
                      <SelectItem key={skill} value={skill}>
                        {skill.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={d.skillForm.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Proficiency Level</FormLabel>
                <Select
                  value={field.value?.toString()}
                  onValueChange={(v) => field.onChange(Number.parseInt(v))}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-skill-level">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <SelectItem key={level} value={level.toString()}>
                        Level {level} {level === 1 ? "(Basic)" : level === 5 ? "(Expert)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </ResponsiveDialog>
  );
}
