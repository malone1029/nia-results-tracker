'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { FormSkeleton } from '@/components/skeleton';
import type {
  ProcessStatus,
  Charter,
  AdliApproach,
  AdliDeployment,
  AdliLearning,
  AdliIntegration,
  Workflow,
} from '@/lib/types';
import { Card, Button, Input, Select } from '@/components/ui';
import MarkdownContent from '@/components/markdown-content';

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
  { value: 'draft', label: 'Draft' },
  { value: 'ready_for_review', label: 'Ready for Review' },
  { value: 'approved', label: 'Approved' },
];

export default function EditProcessPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  // Deep-link: hash fragment like #charter or #adli_approach
  const [targetSection, setTargetSection] = useState<string | null>(null);
  const scrolledRef = useRef(false);
  const [allRequirements, setAllRequirements] = useState<ReqOption[]>([]);
  const [linkedReqIds, setLinkedReqIds] = useState<Set<number>>(new Set());
  // Form fields
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [baldrigeItem, setBaldrigeItem] = useState('');
  const [owner, setOwner] = useState('');
  const [processType, setProcessType] = useState<'key' | 'support' | 'unclassified'>(
    'unclassified'
  );
  const [reviewer, setReviewer] = useState('');
  const [status, setStatus] = useState<ProcessStatus>('draft');
  const [description, setDescription] = useState('');

  // Full template fields
  const [charter, setCharter] = useState<Charter>({});
  const [approach, setApproach] = useState<AdliApproach>({});
  const [deployment, setDeployment] = useState<AdliDeployment>({});
  const [learning, setLearning] = useState<AdliLearning>({});
  const [integration, setIntegration] = useState<AdliIntegration>({});
  const [workflow, setWorkflow] = useState<Workflow>({});
  const [baldrigeMappings, setBaldrigeMappings] = useState<
    {
      item_code: string;
      item_name: string;
      category_name: string;
      questions: { question_code: string; question_text: string; coverage: string }[];
    }[]
  >([]);

  useEffect(() => {
    async function fetchData() {
      // Fetch categories, requirements, and process data in parallel
      const [catRes, reqRes, procRes, linkRes, mappingsRes] = await Promise.all([
        supabase.from('categories').select('id, display_name').order('sort_order'),
        supabase
          .from('key_requirements')
          .select('id, requirement, stakeholder_group')
          .order('sort_order'),
        supabase.from('processes').select('*').eq('id', id).single(),
        supabase.from('process_requirements').select('requirement_id').eq('process_id', id),
        supabase
          .from('process_question_mappings')
          .select(
            'coverage, baldrige_questions!inner(question_code, question_text, baldrige_items!inner(item_code, item_name, category_name))'
          )
          .eq('process_id', id),
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (reqRes.data) setAllRequirements(reqRes.data);
      if (linkRes.data) setLinkedReqIds(new Set(linkRes.data.map((l) => l.requirement_id)));

      if (procRes.data) {
        const p = procRes.data;
        setName(p.name || '');
        setCategoryId(p.category_id);
        setBaldrigeItem(p.baldrige_item || '');
        setOwner(p.owner || '');
        setProcessType(p.process_type || 'unclassified');
        setReviewer(p.reviewer || '');
        setStatus(p.status || 'draft');
        setDescription(p.description || '');
        if (p.charter) setCharter(p.charter);
        if (p.adli_approach) setApproach(p.adli_approach);
        if (p.adli_deployment) setDeployment(p.adli_deployment);
        if (p.adli_learning) setLearning(p.adli_learning);
        if (p.adli_integration) setIntegration(p.adli_integration);
        if (p.workflow) setWorkflow(p.workflow);
        document.title = `Edit: ${p.name} | NIA Excellence Hub`;
      }

      // Group Baldrige mappings by item
      if (mappingsRes.data) {
        const grouped = new Map<
          string,
          {
            item_name: string;
            category_name: string;
            questions: { question_code: string; question_text: string; coverage: string }[];
          }
        >();
        for (const r of mappingsRes.data) {
          const q = r.baldrige_questions as unknown as {
            question_code: string;
            question_text: string;
            baldrige_items: { item_code: string; item_name: string; category_name: string };
          };
          const key = q.baldrige_items.item_code;
          const existing = grouped.get(key) || {
            item_name: q.baldrige_items.item_name,
            category_name: q.baldrige_items.category_name,
            questions: [],
          };
          existing.questions.push({
            question_code: q.question_code,
            question_text: q.question_text,
            coverage: r.coverage,
          });
          grouped.set(key, existing);
        }
        setBaldrigeMappings(
          [...grouped.entries()].map(([item_code, data]) => ({ item_code, ...data }))
        );
      }

      setLoading(false);
    }
    fetchData();
  }, [id]);

  // Read hash fragment on mount (e.g., #charter, #adli_approach)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) setTargetSection(hash);
  }, []);

  // After loading, scroll to target section
  useEffect(() => {
    if (!loading && targetSection && !scrolledRef.current) {
      scrolledRef.current = true;
      // Short delay for DOM to render expanded sections
      setTimeout(() => {
        const el = document.getElementById(`section-${targetSection}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    }
  }, [loading, targetSection]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || categoryId === '') return;
    setSaving(true);

    // Strip empty strings from list fields before saving
    const clean = (arr?: string[]) => arr?.filter(Boolean);

    const { error } = await supabase
      .from('processes')
      .update({
        name: name.trim(),
        category_id: categoryId,
        baldrige_item: baldrigeItem.trim() || null,
        owner: owner.trim() || null,
        process_type: processType,
        reviewer: reviewer.trim() || null,
        status,
        description: description.trim() || null,
        charter: { ...charter, stakeholders: clean(charter.stakeholders) },
        adli_approach: {
          ...approach,
          key_steps: clean(approach.key_steps),
          tools_used: clean(approach.tools_used),
        },
        adli_deployment: { ...deployment, teams: clean(deployment.teams) },
        adli_learning: { ...learning, metrics: clean(learning.metrics) },
        adli_integration: {
          ...integration,
          strategic_goals: clean(integration.strategic_goals),
          related_processes: clean(integration.related_processes),
        },
        workflow: {
          ...workflow,
          inputs: clean(workflow.inputs),
          outputs: clean(workflow.outputs),
          quality_controls: clean(workflow.quality_controls),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      alert('Failed to save: ' + error.message);
      setSaving(false);
      return;
    }

    // Sync requirements links
    // Delete removed links
    await supabase.from('process_requirements').delete().eq('process_id', Number(id));
    // Insert current links
    if (linkedReqIds.size > 0) {
      await supabase.from('process_requirements').insert(
        Array.from(linkedReqIds).map((reqId) => ({
          process_id: Number(id),
          requirement_id: reqId,
        }))
      );
    }

    router.push(`/processes/${id}`);
  }

  if (loading) return <FormSkeleton fields={8} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-nia-dark">Edit Process</h1>
        <p className="text-text-tertiary mt-1">Full ADLI Template</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core fields */}
        <Input
          label="Process Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Baldrige Category"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
          >
            <option value="">Select...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </Select>
          <Input
            label="Baldrige Item"
            value={baldrigeItem}
            onChange={(e) => setBaldrigeItem(e.target.value)}
            placeholder="e.g., 1.1a"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
          <Input label="Reviewer" value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProcessStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Process Classification */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Process Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setProcessType('key')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                processType === 'key'
                  ? 'bg-nia-orange/15 border-nia-orange text-nia-orange'
                  : 'bg-card border-border text-text-tertiary hover:text-text-secondary hover:border-border-dark'
              }`}
            >
              ★ Key Process
            </button>
            <button
              type="button"
              onClick={() => setProcessType('support')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                processType === 'support'
                  ? 'bg-nia-grey-blue/15 border-nia-grey-blue text-nia-grey-blue'
                  : 'bg-card border-border text-text-tertiary hover:text-text-secondary hover:border-border-dark'
              }`}
            >
              Support Process
            </button>
          </div>
          <p className="mt-1.5 text-xs text-text-muted">
            Key processes directly create value for stakeholders. Support processes enable key
            processes to function.
          </p>
        </div>

        {/* Description — only show when no charter content */}
        {!charter.content && (
          <CollapsibleSection title="What is this process?" defaultOpen>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
              placeholder="Briefly describe what this process does..."
            />
          </CollapsibleSection>
        )}

        {/* Charter */}
        <CollapsibleSection
          title="Charter"
          sectionId="charter"
          forceOpen={targetSection === 'charter'}
          subtitle={
            charter.content
              ? 'imported'
              : countFilled([
                  charter.purpose,
                  charter.scope_includes,
                  charter.scope_excludes,
                  charter.mission_alignment,
                  charter.stakeholders?.length ? 'yes' : undefined,
                ])
          }
        >
          <div className="space-y-4">
            {charter.content && (
              <TextAreaField
                label="Full Content (from import)"
                value={charter.content}
                onChange={(v) => setCharter({ ...charter, content: v })}
                rows={12}
              />
            )}
            {!charter.content && (
              <>
                <TextAreaField
                  label="Purpose"
                  value={charter.purpose || ''}
                  onChange={(v) => setCharter({ ...charter, purpose: v })}
                  placeholder="Why does this process exist?"
                />
                <div>
                  <label className="block text-sm font-medium text-nia-dark mb-1">
                    Stakeholders
                  </label>
                  <ListEditor
                    items={charter.stakeholders?.length ? charter.stakeholders : ['']}
                    onChange={(items) => setCharter({ ...charter, stakeholders: items })}
                    placeholder="e.g., Board, Workforce"
                  />
                </div>
                <TextAreaField
                  label="Scope (Includes)"
                  value={charter.scope_includes || ''}
                  onChange={(v) => setCharter({ ...charter, scope_includes: v })}
                  placeholder="What this process covers..."
                />
                <TextAreaField
                  label="Scope (Excludes)"
                  value={charter.scope_excludes || ''}
                  onChange={(v) => setCharter({ ...charter, scope_excludes: v })}
                  placeholder="What this process does NOT cover..."
                />
                <TextAreaField
                  label="Mission Alignment"
                  value={charter.mission_alignment || ''}
                  onChange={(v) => setCharter({ ...charter, mission_alignment: v })}
                  placeholder="How does this connect to NIA's mission?"
                />
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* ADLI: Approach */}
        <CollapsibleSection
          title="ADLI: Approach"
          sectionId="adli_approach"
          forceOpen={targetSection === 'adli_approach'}
          subtitle={
            approach.content
              ? 'imported'
              : countFilled([
                  approach.evidence_base,
                  approach.key_requirements,
                  approach.key_steps?.length ? 'yes' : undefined,
                  approach.tools_used?.length ? 'yes' : undefined,
                ])
          }
        >
          <div className="space-y-4">
            {approach.content && (
              <TextAreaField
                label="Full Content (from import)"
                value={approach.content}
                onChange={(v) => setApproach({ ...approach, content: v })}
                rows={16}
              />
            )}
            {!approach.content && (
              <>
                <TextAreaField
                  label="Evidence Base"
                  value={approach.evidence_base || ''}
                  onChange={(v) => setApproach({ ...approach, evidence_base: v })}
                  placeholder="What evidence or research informs this approach?"
                />
                <div>
                  <label className="block text-sm font-medium text-nia-dark mb-1">Key Steps</label>
                  <ListEditor
                    items={approach.key_steps?.length ? approach.key_steps : ['']}
                    onChange={(items) => setApproach({ ...approach, key_steps: items })}
                    placeholder="Key step"
                    numbered
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nia-dark mb-1">Tools Used</label>
                  <ListEditor
                    items={approach.tools_used?.length ? approach.tools_used : ['']}
                    onChange={(items) => setApproach({ ...approach, tools_used: items })}
                    placeholder="e.g., Asana, Excel"
                  />
                </div>
                <TextAreaField
                  label="Key Requirements"
                  value={approach.key_requirements || ''}
                  onChange={(v) => setApproach({ ...approach, key_requirements: v })}
                  placeholder="What requirements must this approach satisfy?"
                />
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* ADLI: Deployment */}
        <CollapsibleSection
          title="ADLI: Deployment"
          sectionId="adli_deployment"
          forceOpen={targetSection === 'adli_deployment'}
          subtitle={
            deployment.content
              ? 'imported'
              : countFilled([
                  deployment.communication_plan,
                  deployment.training_approach,
                  deployment.consistency_mechanisms,
                  deployment.teams?.length ? 'yes' : undefined,
                ])
          }
        >
          <div className="space-y-4">
            {deployment.content && (
              <TextAreaField
                label="Full Content (from import)"
                value={deployment.content}
                onChange={(v) => setDeployment({ ...deployment, content: v })}
                rows={12}
              />
            )}
            {!deployment.content && (
              <>
                <div>
                  <label className="block text-sm font-medium text-nia-dark mb-1">Teams</label>
                  <ListEditor
                    items={deployment.teams?.length ? deployment.teams : ['']}
                    onChange={(items) => setDeployment({ ...deployment, teams: items })}
                    placeholder="e.g., Senior Leadership Team"
                  />
                </div>
                <TextAreaField
                  label="Communication Plan"
                  value={deployment.communication_plan || ''}
                  onChange={(v) => setDeployment({ ...deployment, communication_plan: v })}
                  placeholder="How is this process communicated to stakeholders?"
                />
                <TextAreaField
                  label="Training Approach"
                  value={deployment.training_approach || ''}
                  onChange={(v) => setDeployment({ ...deployment, training_approach: v })}
                  placeholder="How are people trained on this process?"
                />
                <TextAreaField
                  label="Consistency Mechanisms"
                  value={deployment.consistency_mechanisms || ''}
                  onChange={(v) => setDeployment({ ...deployment, consistency_mechanisms: v })}
                  placeholder="How do you ensure consistent deployment?"
                />
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* ADLI: Learning */}
        <CollapsibleSection
          title="ADLI: Learning"
          sectionId="adli_learning"
          forceOpen={targetSection === 'adli_learning'}
          subtitle={
            learning.content
              ? 'imported'
              : countFilled([
                  learning.evaluation_methods,
                  learning.review_frequency,
                  learning.improvement_process,
                  learning.metrics?.length ? 'yes' : undefined,
                ])
          }
        >
          <div className="space-y-4">
            {learning.content && (
              <TextAreaField
                label="Full Content (from import)"
                value={learning.content}
                onChange={(v) => setLearning({ ...learning, content: v })}
                rows={12}
              />
            )}
            {!learning.content && (
              <>
                <div>
                  <label className="block text-sm font-medium text-nia-dark mb-1">Metrics</label>
                  <ListEditor
                    items={learning.metrics?.length ? learning.metrics : ['']}
                    onChange={(items) => setLearning({ ...learning, metrics: items })}
                    placeholder="e.g., Customer satisfaction score"
                  />
                </div>
                <TextAreaField
                  label="Evaluation Methods"
                  value={learning.evaluation_methods || ''}
                  onChange={(v) => setLearning({ ...learning, evaluation_methods: v })}
                  placeholder="How do you evaluate this process?"
                />
                <TextAreaField
                  label="Review Frequency"
                  value={learning.review_frequency || ''}
                  onChange={(v) => setLearning({ ...learning, review_frequency: v })}
                  placeholder="e.g., Quarterly, Annually"
                  rows={1}
                />
                <TextAreaField
                  label="Improvement Process"
                  value={learning.improvement_process || ''}
                  onChange={(v) => setLearning({ ...learning, improvement_process: v })}
                  placeholder="How are improvements identified and implemented?"
                />
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* ADLI: Integration */}
        <CollapsibleSection
          title="ADLI: Integration"
          sectionId="adli_integration"
          forceOpen={targetSection === 'adli_integration'}
          subtitle={
            integration.content
              ? 'imported'
              : countFilled([
                  integration.mission_connection,
                  integration.standards_alignment,
                  integration.strategic_goals?.length ? 'yes' : undefined,
                  integration.related_processes?.length ? 'yes' : undefined,
                ])
          }
        >
          <div className="space-y-4">
            {integration.content && (
              <TextAreaField
                label="Full Content (from import)"
                value={integration.content}
                onChange={(v) => setIntegration({ ...integration, content: v })}
                rows={12}
              />
            )}
            {!integration.content && (
              <>
                <div>
                  <label className="block text-sm font-medium text-nia-dark mb-1">
                    Strategic Goals
                  </label>
                  <ListEditor
                    items={integration.strategic_goals?.length ? integration.strategic_goals : ['']}
                    onChange={(items) => setIntegration({ ...integration, strategic_goals: items })}
                    placeholder="e.g., Workforce excellence"
                  />
                </div>
                <TextAreaField
                  label="Mission Connection"
                  value={integration.mission_connection || ''}
                  onChange={(v) => setIntegration({ ...integration, mission_connection: v })}
                  placeholder="How does this process support NIA's mission?"
                />
                <div>
                  <label className="block text-sm font-medium text-nia-dark mb-1">
                    Related Processes
                  </label>
                  <ListEditor
                    items={
                      integration.related_processes?.length ? integration.related_processes : ['']
                    }
                    onChange={(items) =>
                      setIntegration({ ...integration, related_processes: items })
                    }
                    placeholder="e.g., Strategic Planning Process"
                  />
                </div>
                <TextAreaField
                  label="Standards Alignment"
                  value={integration.standards_alignment || ''}
                  onChange={(v) => setIntegration({ ...integration, standards_alignment: v })}
                  placeholder="What standards or frameworks does this align to?"
                />
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* Process Map */}
        <CollapsibleSection
          title="Process Map"
          sectionId="workflow"
          forceOpen={targetSection === 'workflow'}
          subtitle={
            workflow.content
              ? 'imported'
              : countFilled([
                  workflow.inputs?.length ? 'yes' : undefined,
                  workflow.steps?.length ? 'yes' : undefined,
                  workflow.outputs?.length ? 'yes' : undefined,
                  workflow.quality_controls?.length ? 'yes' : undefined,
                ])
          }
        >
          <div className="space-y-4">
            {workflow.content && (
              <MermaidEditor
                value={workflow.content}
                onChange={(v) => setWorkflow({ ...workflow, content: v })}
              />
            )}
            {!workflow.content && (
              <>
                <div>
                  <label className="block text-sm font-medium text-nia-dark mb-1">Inputs</label>
                  <ListEditor
                    items={workflow.inputs?.length ? workflow.inputs : ['']}
                    onChange={(items) => setWorkflow({ ...workflow, inputs: items })}
                    placeholder="e.g., Survey results, Budget data"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nia-dark mb-1">Steps</label>
                  <WorkflowStepEditor
                    steps={workflow.steps || []}
                    onChange={(steps) => setWorkflow({ ...workflow, steps })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nia-dark mb-1">Outputs</label>
                  <ListEditor
                    items={workflow.outputs?.length ? workflow.outputs : ['']}
                    onChange={(items) => setWorkflow({ ...workflow, outputs: items })}
                    placeholder="e.g., Updated strategic plan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nia-dark mb-1">
                    Quality Controls
                  </label>
                  <ListEditor
                    items={workflow.quality_controls?.length ? workflow.quality_controls : ['']}
                    onChange={(items) => setWorkflow({ ...workflow, quality_controls: items })}
                    placeholder="e.g., SLT review and approval"
                  />
                </div>
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* Baldrige Connections — read-only view */}
        <CollapsibleSection
          title="Baldrige Connections"
          sectionId="baldrige_connections"
          forceOpen={targetSection === 'baldrige_connections'}
          subtitle={
            baldrigeMappings.reduce((sum, g) => sum + g.questions.length, 0) > 0
              ? `${baldrigeMappings.reduce((sum, g) => sum + g.questions.length, 0)} mapped`
              : 'none'
          }
        >
          {baldrigeMappings.length > 0 ? (
            <div className="space-y-3">
              {baldrigeMappings.map((group) => (
                <div key={group.item_code}>
                  <div className="text-sm font-medium text-nia-dark">
                    {group.item_code} {group.item_name}
                    <span className="text-text-muted font-normal ml-2 text-xs">
                      {group.category_name}
                    </span>
                  </div>
                  <div className="ml-3 mt-1 space-y-1">
                    {group.questions.map((q) => (
                      <div key={q.question_code} className="flex items-start gap-2 text-xs">
                        <span className="font-medium text-text-secondary whitespace-nowrap">
                          {q.question_code}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                            q.coverage === 'primary'
                              ? 'bg-nia-green/10 text-nia-green'
                              : q.coverage === 'supporting'
                                ? 'bg-nia-grey-blue/10 text-nia-grey-blue'
                                : 'bg-nia-orange/10 text-nia-orange'
                          }`}
                        >
                          {q.coverage}
                        </span>
                        <span className="text-text-tertiary">{q.question_text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-border-light">
                <a
                  href={`/processes/${id}`}
                  className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium"
                >
                  Use &ldquo;Find Connections&rdquo; on the process page to add more &rarr;
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-text-tertiary">No Baldrige connections yet.</p>
              <p className="text-xs text-text-muted mt-1">
                Use{' '}
                <a
                  href={`/processes/${id}`}
                  className="underline text-nia-grey-blue hover:text-nia-dark"
                >
                  Find Connections
                </a>{' '}
                on the process page, or{' '}
                <a href="/criteria" className="underline text-nia-grey-blue hover:text-nia-dark">
                  AI Scan
                </a>{' '}
                on the Criteria Map.
              </p>
            </div>
          )}
        </CollapsibleSection>

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
                    isLinked ? 'bg-nia-grey-blue/10' : 'hover:bg-surface-hover'
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
                    className="rounded border-border text-nia-grey-blue focus:ring-nia-grey-blue"
                  />
                  <span className="text-sm text-nia-dark">{req.requirement}</span>
                  <span className="text-xs text-text-muted ml-auto">{req.stakeholder_group}</span>
                </label>
              );
            })}
            {allRequirements.length === 0 && (
              <p className="text-sm text-text-muted italic">
                No key requirements in the database yet.
              </p>
            )}
          </div>
        </CollapsibleSection>

        {/* Save / Cancel */}
        <div className="flex items-center gap-3 pt-2 pb-8">
          <Button type="submit" loading={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="ghost" onClick={() => router.push(`/processes/${id}`)}>
            Cancel
          </Button>
          <a
            href="/help"
            className="ml-auto text-xs text-text-muted hover:text-nia-orange transition-colors"
          >
            Need help? View FAQ &rarr;
          </a>
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
  forceOpen = false,
  sectionId,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  sectionId?: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen || forceOpen);

  // If forceOpen becomes true after mount, expand
  useEffect(() => {
    if (forceOpen) setIsOpen(true);
  }, [forceOpen]);

  return (
    <div id={sectionId ? `section-${sectionId}` : undefined}>
      <Card accent={forceOpen ? 'green' : 'orange'} className="overflow-hidden">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-sm">{isOpen ? '\u25BC' : '\u25B6'}</span>
            <span className="font-semibold text-nia-dark">{title}</span>
          </div>
          {subtitle && <span className="text-xs text-text-muted">{subtitle}</span>}
        </button>
        {isOpen && <div className="border-t border-border-light px-4 py-3">{children}</div>}
      </Card>
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
      <label className="block text-sm font-medium text-nia-dark mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue text-sm"
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
          {numbered && <span className="text-sm text-text-muted w-6 text-right">{i + 1}.</span>}
          <input
            type="text"
            value={item}
            onChange={(e) => {
              const updated = [...items];
              updated[i] = e.target.value;
              onChange(updated);
            }}
            className="flex-1 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue text-sm"
            placeholder={placeholder}
          />
          {items.length > 1 && (
            <Button
              variant="ghost"
              size="xs"
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-nia-red/60 hover:text-nia-red"
            >
              ✕
            </Button>
          )}
        </div>
      ))}
      <Button variant="ghost" size="xs" type="button" onClick={() => onChange([...items, ''])}>
        + Add
      </Button>
    </div>
  );
}

function WorkflowStepEditor({
  steps,
  onChange,
}: {
  steps: { responsible: string; action: string; output: string; timing: string }[];
  onChange: (
    steps: { responsible: string; action: string; output: string; timing: string }[]
  ) => void;
}) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="bg-surface-hover rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-nia-dark">Step {i + 1}</span>
            <Button
              variant="ghost"
              size="xs"
              type="button"
              onClick={() => onChange(steps.filter((_, idx) => idx !== i))}
              className="text-nia-red/60 hover:text-nia-red"
            >
              Remove
            </Button>
          </div>
          <textarea
            value={step.action}
            onChange={(e) => {
              const updated = [...steps];
              updated[i] = { ...step, action: e.target.value };
              onChange(updated);
            }}
            rows={2}
            className="w-full border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue text-sm"
            placeholder="What happens in this step?"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={step.responsible}
              onChange={(e) => {
                const updated = [...steps];
                updated[i] = { ...step, responsible: e.target.value };
                onChange(updated);
              }}
              className="border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue text-sm"
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
              className="border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue text-sm"
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
              className="border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue text-sm"
              placeholder="Timing"
            />
          </div>
        </div>
      ))}
      <Button
        variant="ghost"
        size="xs"
        type="button"
        onClick={() =>
          onChange([...steps, { responsible: '', action: '', output: '', timing: '' }])
        }
      >
        + Add Step
      </Button>
    </div>
  );
}

function countFilled(values: (string | undefined)[]): string {
  const filled = values.filter(Boolean).length;
  return `${filled} of ${values.length} filled`;
}

function MermaidEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isMermaid = value.includes('```mermaid');
  const [showCode, setShowCode] = useState(!isMermaid);

  return (
    <div className="space-y-3">
      {isMermaid && (
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-surface-subtle rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setShowCode(false)}
              className={`text-xs font-medium rounded-md px-3 py-1.5 transition-colors ${
                !showCode
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setShowCode(true)}
              className={`text-xs font-medium rounded-md px-3 py-1.5 transition-colors ${
                showCode
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              Edit Code
            </button>
          </div>
          <span className="text-xs text-text-muted">Mermaid diagram</span>
        </div>
      )}
      {isMermaid && !showCode ? (
        <div className="border border-border rounded-lg p-4 bg-surface-hover">
          <MarkdownContent content={value} />
          <p className="text-xs text-text-muted mt-3 pt-3 border-t border-border">
            Use AI on the process page to refine this diagram visually.
          </p>
        </div>
      ) : (
        <TextAreaField label="Full Content" value={value} onChange={onChange} rows={12} />
      )}
    </div>
  );
}
