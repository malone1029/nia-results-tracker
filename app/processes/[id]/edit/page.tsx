"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type {
  ProcessStatus,
  TemplateType,
  Charter,
  AdliApproach,
  AdliDeployment,
  AdliLearning,
  AdliIntegration,
  Workflow,
  BaldigeConnections,
} from "@/lib/types";

interface CategoryOption {
  id: number;
  display_name: string;
}

interface ReqOption {
  id: number;
  requirement: string;
  stakeholder_group: string;
}

const STATUS_OPTIONS: { value: ProcessStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "ready_for_review", label: "Ready for Review" },
  { value: "in_review", label: "In Review" },
  { value: "revisions_needed", label: "Revisions Needed" },
  { value: "approved", label: "Approved" },
];

export default function EditProcessPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [allRequirements, setAllRequirements] = useState<ReqOption[]>([]);
  const [linkedReqIds, setLinkedReqIds] = useState<Set<number>>(new Set());
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [baldrigeItem, setBaldrigeItem] = useState("");
  const [owner, setOwner] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [status, setStatus] = useState<ProcessStatus>("draft");
  const [templateType, setTemplateType] = useState<TemplateType>("quick");
  const [description, setDescription] = useState("");
  const [basicSteps, setBasicSteps] = useState<string[]>([""]);
  const [participants, setParticipants] = useState<string[]>([""]);
  const [metricsSummary, setMetricsSummary] = useState("");
  const [connections, setConnections] = useState("");

  // Full template fields
  const [charter, setCharter] = useState<Charter>({});
  const [approach, setApproach] = useState<AdliApproach>({});
  const [deployment, setDeployment] = useState<AdliDeployment>({});
  const [learning, setLearning] = useState<AdliLearning>({});
  const [integration, setIntegration] = useState<AdliIntegration>({});
  const [workflow, setWorkflow] = useState<Workflow>({});
  const [baldrigeConn, setBaldrigeConn] = useState<BaldigeConnections>({});

  useEffect(() => {
    async function fetchData() {
      // Fetch categories, requirements, and process data in parallel
      const [catRes, reqRes, procRes, linkRes] = await Promise.all([
        supabase.from("categories").select("id, display_name").order("sort_order"),
        supabase.from("key_requirements").select("id, requirement, stakeholder_group").order("sort_order"),
        supabase.from("processes").select("*").eq("id", id).single(),
        supabase.from("process_requirements").select("requirement_id").eq("process_id", id),
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (reqRes.data) setAllRequirements(reqRes.data);
      if (linkRes.data) setLinkedReqIds(new Set(linkRes.data.map((l) => l.requirement_id)));

      if (procRes.data) {
        const p = procRes.data;
        setName(p.name || "");
        setCategoryId(p.category_id);
        setBaldrigeItem(p.baldrige_item || "");
        setOwner(p.owner || "");
        setReviewer(p.reviewer || "");
        setStatus(p.status || "draft");
        setTemplateType(p.template_type || "quick");
        setDescription(p.description || "");
        setBasicSteps(p.basic_steps?.length ? p.basic_steps : [""]);
        setParticipants(p.participants?.length ? p.participants : [""]);
        setMetricsSummary(p.metrics_summary || "");
        setConnections(p.connections || "");
        if (p.charter) setCharter(p.charter);
        if (p.adli_approach) setApproach(p.adli_approach);
        if (p.adli_deployment) setDeployment(p.adli_deployment);
        if (p.adli_learning) setLearning(p.adli_learning);
        if (p.adli_integration) setIntegration(p.adli_integration);
        if (p.workflow) setWorkflow(p.workflow);
        if (p.baldrige_connections) setBaldrigeConn(p.baldrige_connections);
        document.title = `Edit: ${p.name} | NIA Excellence Hub`;
      }

      setLoading(false);
    }
    fetchData();
  }, [id]);

  function handleUpgrade() {
    setTemplateType("full");
    setShowUpgradeConfirm(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || categoryId === "") return;
    setSaving(true);

    const { error } = await supabase
      .from("processes")
      .update({
        name: name.trim(),
        category_id: categoryId,
        baldrige_item: baldrigeItem.trim() || null,
        owner: owner.trim() || null,
        reviewer: reviewer.trim() || null,
        status,
        template_type: templateType,
        description: description.trim() || null,
        basic_steps: basicSteps.filter((s) => s.trim()),
        participants: participants.filter((p) => p.trim()),
        metrics_summary: metricsSummary.trim() || null,
        connections: connections.trim() || null,
        charter: templateType === "full" ? charter : null,
        adli_approach: templateType === "full" ? approach : null,
        adli_deployment: templateType === "full" ? deployment : null,
        adli_learning: templateType === "full" ? learning : null,
        adli_integration: templateType === "full" ? integration : null,
        workflow: templateType === "full" ? workflow : null,
        baldrige_connections: templateType === "full" ? baldrigeConn : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert("Failed to save: " + error.message);
      setSaving(false);
      return;
    }

    // Sync requirements links
    // Delete removed links
    await supabase.from("process_requirements").delete().eq("process_id", Number(id));
    // Insert current links
    if (linkedReqIds.size > 0) {
      await supabase.from("process_requirements").insert(
        Array.from(linkedReqIds).map((reqId) => ({
          process_id: Number(id),
          requirement_id: reqId,
        }))
      );
    }

    router.push(`/processes/${id}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[#55787c] text-lg">Loading process...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#324a4d]">Edit Process</h1>
        <p className="text-gray-500 mt-1">
          {templateType === "quick" ? "Quick" : "Full ADLI"} Template
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core fields */}
        <div>
          <label className="block text-sm font-medium text-[#324a4d] mb-1">
            Process Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#324a4d] mb-1">
              Baldrige Category <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
            >
              <option value="">Select...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#324a4d] mb-1">
              Baldrige Item
            </label>
            <input
              type="text"
              value={baldrigeItem}
              onChange={(e) => setBaldrigeItem(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
              placeholder="e.g., 1.1a"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#324a4d] mb-1">Owner</label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#324a4d] mb-1">Reviewer</label>
            <input
              type="text"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#324a4d] mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProcessStatus)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Template Fields */}
        <CollapsibleSection title="What is this process?" defaultOpen>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
            placeholder="Briefly describe what this process does..."
          />
        </CollapsibleSection>

        {/* These quick-only fields are redundant for full templates (covered by Charter + ADLI) */}
        {templateType === "quick" && (
          <>
            <CollapsibleSection title="How do we do it? (Basic Steps)" defaultOpen>
              <ListEditor
                items={basicSteps}
                onChange={setBasicSteps}
                placeholder="Step"
                numbered
              />
            </CollapsibleSection>

            <CollapsibleSection title="Who's involved?" defaultOpen>
              <ListEditor
                items={participants}
                onChange={setParticipants}
                placeholder="e.g., CEO, HR Director"
              />
            </CollapsibleSection>

            <CollapsibleSection title="How do we know it's working?" defaultOpen>
              <textarea
                value={metricsSummary}
                onChange={(e) => setMetricsSummary(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                placeholder="What metrics or indicators show this process is effective?"
              />
            </CollapsibleSection>

            <CollapsibleSection title="What does this connect to?" defaultOpen>
              <textarea
                value={connections}
                onChange={(e) => setConnections(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                placeholder="Related processes, strategic goals..."
              />
            </CollapsibleSection>
          </>
        )}

        {/* Upgrade to Full Template */}
        {templateType === "quick" && (
          <div className="bg-[#55787c]/10 rounded-lg p-4">
            <p className="text-sm text-[#324a4d] mb-2">
              Ready to add more detail? Upgrade to the Full ADLI template to document Approach, Deployment, Learning, Integration, and more.
            </p>
            {showUpgradeConfirm ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#324a4d]">This will add ADLI framework sections. Continue?</span>
                <button
                  type="button"
                  onClick={handleUpgrade}
                  className="text-sm bg-[#324a4d] text-white px-3 py-1 rounded-lg hover:opacity-90"
                >
                  Yes, Upgrade
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpgradeConfirm(false)}
                  className="text-sm text-gray-500"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowUpgradeConfirm(true)}
                className="text-sm bg-[#324a4d] text-white px-4 py-2 rounded-lg hover:opacity-90 font-medium"
              >
                Upgrade to Full Template
              </button>
            )}
          </div>
        )}

        {/* Full Template Sections */}
        {templateType === "full" && (
          <>
            {/* Charter */}
            <CollapsibleSection
              title="Charter"
              subtitle={charter.content ? "imported" : countFilled([charter.purpose, charter.scope_includes, charter.scope_excludes, charter.mission_alignment, charter.stakeholders?.length ? "yes" : undefined])}
            >
              <div className="space-y-4">
                {charter.content && (
                  <TextAreaField label="Full Content (from import)" value={charter.content} onChange={(v) => setCharter({ ...charter, content: v })} rows={12} />
                )}
                {!charter.content && (
                  <>
                    <TextAreaField label="Purpose" value={charter.purpose || ""} onChange={(v) => setCharter({ ...charter, purpose: v })} placeholder="Why does this process exist?" />
                    <TextAreaField label="Scope (Includes)" value={charter.scope_includes || ""} onChange={(v) => setCharter({ ...charter, scope_includes: v })} placeholder="What this process covers..." />
                    <TextAreaField label="Scope (Excludes)" value={charter.scope_excludes || ""} onChange={(v) => setCharter({ ...charter, scope_excludes: v })} placeholder="What this process does NOT cover..." />
                    <TextAreaField label="Mission Alignment" value={charter.mission_alignment || ""} onChange={(v) => setCharter({ ...charter, mission_alignment: v })} placeholder="How does this connect to NIA's mission?" />
                    <div>
                      <label className="block text-sm font-medium text-[#324a4d] mb-1">Stakeholders</label>
                      <ListEditor
                        items={charter.stakeholders?.length ? charter.stakeholders : [""]}
                        onChange={(items) => setCharter({ ...charter, stakeholders: items.filter(Boolean) })}
                        placeholder="e.g., Board, Workforce"
                      />
                    </div>
                  </>
                )}
              </div>
            </CollapsibleSection>

            {/* ADLI: Approach */}
            <CollapsibleSection
              title="ADLI: Approach"
              subtitle={approach.content ? "imported" : countFilled([approach.evidence_base, approach.key_requirements, approach.key_steps?.length ? "yes" : undefined, approach.tools_used?.length ? "yes" : undefined])}
            >
              <div className="space-y-4">
                {approach.content && (
                  <TextAreaField label="Full Content (from import)" value={approach.content} onChange={(v) => setApproach({ ...approach, content: v })} rows={16} />
                )}
                {!approach.content && (
                  <>
                    <TextAreaField label="Evidence Base" value={approach.evidence_base || ""} onChange={(v) => setApproach({ ...approach, evidence_base: v })} placeholder="What evidence or research informs this approach?" />
                    <div>
                      <label className="block text-sm font-medium text-[#324a4d] mb-1">Key Steps</label>
                      <ListEditor
                        items={approach.key_steps?.length ? approach.key_steps : [""]}
                        onChange={(items) => setApproach({ ...approach, key_steps: items.filter(Boolean) })}
                        placeholder="Key step"
                        numbered
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#324a4d] mb-1">Tools Used</label>
                      <ListEditor
                        items={approach.tools_used?.length ? approach.tools_used : [""]}
                        onChange={(items) => setApproach({ ...approach, tools_used: items.filter(Boolean) })}
                        placeholder="e.g., Asana, Excel"
                      />
                    </div>
                    <TextAreaField label="Key Requirements" value={approach.key_requirements || ""} onChange={(v) => setApproach({ ...approach, key_requirements: v })} placeholder="What requirements must this approach satisfy?" />
                  </>
                )}
              </div>
            </CollapsibleSection>

            {/* ADLI: Deployment */}
            <CollapsibleSection
              title="ADLI: Deployment"
              subtitle={deployment.content ? "imported" : countFilled([deployment.communication_plan, deployment.training_approach, deployment.consistency_mechanisms, deployment.teams?.length ? "yes" : undefined])}
            >
              <div className="space-y-4">
                {deployment.content && (
                  <TextAreaField label="Full Content (from import)" value={deployment.content} onChange={(v) => setDeployment({ ...deployment, content: v })} rows={12} />
                )}
                {!deployment.content && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#324a4d] mb-1">Teams</label>
                      <ListEditor
                        items={deployment.teams?.length ? deployment.teams : [""]}
                        onChange={(items) => setDeployment({ ...deployment, teams: items.filter(Boolean) })}
                        placeholder="e.g., Senior Leadership Team"
                      />
                    </div>
                    <TextAreaField label="Communication Plan" value={deployment.communication_plan || ""} onChange={(v) => setDeployment({ ...deployment, communication_plan: v })} placeholder="How is this process communicated to stakeholders?" />
                    <TextAreaField label="Training Approach" value={deployment.training_approach || ""} onChange={(v) => setDeployment({ ...deployment, training_approach: v })} placeholder="How are people trained on this process?" />
                    <TextAreaField label="Consistency Mechanisms" value={deployment.consistency_mechanisms || ""} onChange={(v) => setDeployment({ ...deployment, consistency_mechanisms: v })} placeholder="How do you ensure consistent deployment?" />
                  </>
                )}
              </div>
            </CollapsibleSection>

            {/* ADLI: Learning */}
            <CollapsibleSection
              title="ADLI: Learning"
              subtitle={learning.content ? "imported" : countFilled([learning.evaluation_methods, learning.review_frequency, learning.improvement_process, learning.metrics?.length ? "yes" : undefined])}
            >
              <div className="space-y-4">
                {learning.content && (
                  <TextAreaField label="Full Content (from import)" value={learning.content} onChange={(v) => setLearning({ ...learning, content: v })} rows={12} />
                )}
                {!learning.content && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#324a4d] mb-1">Metrics</label>
                      <ListEditor
                        items={learning.metrics?.length ? learning.metrics : [""]}
                        onChange={(items) => setLearning({ ...learning, metrics: items.filter(Boolean) })}
                        placeholder="e.g., Customer satisfaction score"
                      />
                    </div>
                    <TextAreaField label="Evaluation Methods" value={learning.evaluation_methods || ""} onChange={(v) => setLearning({ ...learning, evaluation_methods: v })} placeholder="How do you evaluate this process?" />
                    <TextAreaField label="Review Frequency" value={learning.review_frequency || ""} onChange={(v) => setLearning({ ...learning, review_frequency: v })} placeholder="e.g., Quarterly, Annually" rows={1} />
                    <TextAreaField label="Improvement Process" value={learning.improvement_process || ""} onChange={(v) => setLearning({ ...learning, improvement_process: v })} placeholder="How are improvements identified and implemented?" />
                  </>
                )}
              </div>
            </CollapsibleSection>

            {/* ADLI: Integration */}
            <CollapsibleSection
              title="ADLI: Integration"
              subtitle={integration.content ? "imported" : countFilled([integration.mission_connection, integration.standards_alignment, integration.strategic_goals?.length ? "yes" : undefined, integration.related_processes?.length ? "yes" : undefined])}
            >
              <div className="space-y-4">
                {integration.content && (
                  <TextAreaField label="Full Content (from import)" value={integration.content} onChange={(v) => setIntegration({ ...integration, content: v })} rows={12} />
                )}
                {!integration.content && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#324a4d] mb-1">Strategic Goals</label>
                      <ListEditor
                        items={integration.strategic_goals?.length ? integration.strategic_goals : [""]}
                        onChange={(items) => setIntegration({ ...integration, strategic_goals: items.filter(Boolean) })}
                        placeholder="e.g., Workforce excellence"
                      />
                    </div>
                    <TextAreaField label="Mission Connection" value={integration.mission_connection || ""} onChange={(v) => setIntegration({ ...integration, mission_connection: v })} placeholder="How does this process support NIA's mission?" />
                    <div>
                      <label className="block text-sm font-medium text-[#324a4d] mb-1">Related Processes</label>
                      <ListEditor
                        items={integration.related_processes?.length ? integration.related_processes : [""]}
                        onChange={(items) => setIntegration({ ...integration, related_processes: items.filter(Boolean) })}
                        placeholder="e.g., Strategic Planning Process"
                      />
                    </div>
                    <TextAreaField label="Standards Alignment" value={integration.standards_alignment || ""} onChange={(v) => setIntegration({ ...integration, standards_alignment: v })} placeholder="What standards or frameworks does this align to?" />
                  </>
                )}
              </div>
            </CollapsibleSection>

            {/* Workflow */}
            <CollapsibleSection
              title="Workflow"
              subtitle={workflow.content ? "imported" : countFilled([workflow.inputs?.length ? "yes" : undefined, workflow.steps?.length ? "yes" : undefined, workflow.outputs?.length ? "yes" : undefined, workflow.quality_controls?.length ? "yes" : undefined])}
            >
              <div className="space-y-4">
                {workflow.content && (
                  <TextAreaField label="Full Content (from import)" value={workflow.content} onChange={(v) => setWorkflow({ ...workflow, content: v })} rows={12} />
                )}
                {!workflow.content && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#324a4d] mb-1">Inputs</label>
                      <ListEditor
                        items={workflow.inputs?.length ? workflow.inputs : [""]}
                        onChange={(items) => setWorkflow({ ...workflow, inputs: items.filter(Boolean) })}
                        placeholder="e.g., Survey results, Budget data"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#324a4d] mb-1">Steps</label>
                      <WorkflowStepEditor
                        steps={workflow.steps || []}
                        onChange={(steps) => setWorkflow({ ...workflow, steps })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#324a4d] mb-1">Outputs</label>
                      <ListEditor
                        items={workflow.outputs?.length ? workflow.outputs : [""]}
                        onChange={(items) => setWorkflow({ ...workflow, outputs: items.filter(Boolean) })}
                        placeholder="e.g., Updated strategic plan"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#324a4d] mb-1">Quality Controls</label>
                      <ListEditor
                        items={workflow.quality_controls?.length ? workflow.quality_controls : [""]}
                        onChange={(items) => setWorkflow({ ...workflow, quality_controls: items.filter(Boolean) })}
                        placeholder="e.g., SLT review and approval"
                      />
                    </div>
                  </>
                )}
              </div>
            </CollapsibleSection>

            {/* Baldrige Connections */}
            <CollapsibleSection
              title="Baldrige Connections"
              subtitle={baldrigeConn.content ? "imported" : countFilled([baldrigeConn.questions_addressed?.length ? "yes" : undefined, baldrigeConn.evidence_by_dimension ? "yes" : undefined])}
            >
              <div className="space-y-4">
                {baldrigeConn.content && (
                  <TextAreaField label="Full Content (from import)" value={baldrigeConn.content} onChange={(v) => setBaldrigeConn({ ...baldrigeConn, content: v })} rows={12} />
                )}
                {!baldrigeConn.content && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#324a4d] mb-1">Questions Addressed</label>
                      <ListEditor
                        items={baldrigeConn.questions_addressed?.length ? baldrigeConn.questions_addressed : [""]}
                        onChange={(items) => setBaldrigeConn({ ...baldrigeConn, questions_addressed: items.filter(Boolean) })}
                        placeholder="e.g., 1.1a - How do senior leaders set vision?"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#324a4d] mb-2">Evidence by ADLI Dimension</label>
                      <div className="space-y-3">
                        {(["approach", "deployment", "learning", "integration"] as const).map((dim) => (
                          <TextAreaField
                            key={dim}
                            label={dim.charAt(0).toUpperCase() + dim.slice(1)}
                            value={baldrigeConn.evidence_by_dimension?.[dim] || ""}
                            onChange={(v) => setBaldrigeConn({
                              ...baldrigeConn,
                              evidence_by_dimension: {
                                ...baldrigeConn.evidence_by_dimension,
                                [dim]: v,
                              },
                            })}
                            placeholder={`Evidence for ${dim}...`}
                            rows={2}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CollapsibleSection>
          </>
        )}

        {/* Linked Key Requirements */}
        <CollapsibleSection
          title="Linked Key Requirements"
          subtitle={`${linkedReqIds.size} linked`}
          defaultOpen
        >
          <div className="space-y-2">
            {allRequirements.map((req) => {
              const isLinked = linkedReqIds.has(req.id);
              return (
                <label
                  key={req.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isLinked ? "bg-[#55787c]/10" : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isLinked}
                    onChange={() => {
                      const next = new Set(linkedReqIds);
                      if (isLinked) next.delete(req.id);
                      else next.add(req.id);
                      setLinkedReqIds(next);
                    }}
                    className="rounded border-gray-300 text-[#55787c] focus:ring-[#55787c]"
                  />
                  <span className="text-sm text-[#324a4d]">{req.requirement}</span>
                  <span className="text-xs text-gray-400 ml-auto">{req.stakeholder_group}</span>
                </label>
              );
            })}
            {allRequirements.length === 0 && (
              <p className="text-sm text-gray-400 italic">No key requirements in the database yet.</p>
            )}
          </div>
        </CollapsibleSection>

        {/* Save / Cancel */}
        <div className="flex gap-3 pt-2 pb-8">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#324a4d] text-white rounded-lg py-2 px-6 hover:opacity-90 disabled:opacity-50 font-medium"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/processes/${id}`)}
            className="bg-gray-200 text-[#324a4d] rounded-lg py-2 px-6 hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Reusable Components ───────────────────────────────────────

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden border-l-4 border-[#f79935]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">{isOpen ? "\u25BC" : "\u25B6"}</span>
          <span className="font-semibold text-[#324a4d]">{title}</span>
        </div>
        {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
      </button>
      {isOpen && <div className="border-t border-gray-100 px-4 py-3">{children}</div>}
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#324a4d] mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c] text-sm"
        placeholder={placeholder}
      />
    </div>
  );
}

function ListEditor({
  items,
  onChange,
  placeholder,
  numbered = false,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  numbered?: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          {numbered && <span className="text-sm text-gray-400 w-6 text-right">{i + 1}.</span>}
          <input
            type="text"
            value={item}
            onChange={(e) => {
              const updated = [...items];
              updated[i] = e.target.value;
              onChange(updated);
            }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c] text-sm"
            placeholder={placeholder}
          />
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-red-400 hover:text-red-600 text-sm px-2"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="text-sm text-[#55787c] hover:text-[#324a4d] transition-colors font-medium"
      >
        + Add
      </button>
    </div>
  );
}

function WorkflowStepEditor({
  steps,
  onChange,
}: {
  steps: { responsible: string; action: string; output: string; timing: string }[];
  onChange: (steps: { responsible: string; action: string; output: string; timing: string }[]) => void;
}) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#324a4d]">Step {i + 1}</span>
            <button
              type="button"
              onClick={() => onChange(steps.filter((_, idx) => idx !== i))}
              className="text-red-400 hover:text-red-600 text-xs"
            >
              Remove
            </button>
          </div>
          <textarea
            value={step.action}
            onChange={(e) => {
              const updated = [...steps];
              updated[i] = { ...step, action: e.target.value };
              onChange(updated);
            }}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c] text-sm"
            placeholder="What happens in this step?"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={step.responsible}
              onChange={(e) => {
                const updated = [...steps];
                updated[i] = { ...step, responsible: e.target.value };
                onChange(updated);
              }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#55787c] text-sm"
              placeholder="Responsible"
            />
            <input
              type="text"
              value={step.output}
              onChange={(e) => {
                const updated = [...steps];
                updated[i] = { ...step, output: e.target.value };
                onChange(updated);
              }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#55787c] text-sm"
              placeholder="Output"
            />
            <input
              type="text"
              value={step.timing}
              onChange={(e) => {
                const updated = [...steps];
                updated[i] = { ...step, timing: e.target.value };
                onChange(updated);
              }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#55787c] text-sm"
              placeholder="Timing"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...steps, { responsible: "", action: "", output: "", timing: "" }])}
        className="text-sm text-[#55787c] hover:text-[#324a4d] transition-colors font-medium"
      >
        + Add Step
      </button>
    </div>
  );
}

function countFilled(values: (string | undefined)[]): string {
  const filled = values.filter(Boolean).length;
  return `${filled} of ${values.length} filled`;
}
