"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface CategoryOption {
  id: number;
  display_name: string;
}

export default function NewProcessPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [baldrigeItem, setBaldrigeItem] = useState("");
  const [owner, setOwner] = useState("");
  const [isKey, setIsKey] = useState(false);
  const [description, setDescription] = useState("");
  const [basicSteps, setBasicSteps] = useState<string[]>([""]);
  const [participants, setParticipants] = useState<string[]>([""]);
  const [metricsSummary, setMetricsSummary] = useState("");
  const [connections, setConnections] = useState("");

  useEffect(() => {
    document.title = "Create Process | NIA Excellence Hub";

    async function fetchCategories() {
      const { data } = await supabase
        .from("categories")
        .select("id, display_name")
        .order("sort_order");
      if (data) setCategories(data);
    }
    fetchCategories();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || categoryId === "") return;

    setSaving(true);

    const { data, error } = await supabase
      .from("processes")
      .insert({
        name: name.trim(),
        category_id: categoryId,
        baldrige_item: baldrigeItem.trim() || null,
        owner: owner.trim() || null,
        is_key: isKey,
        description: description.trim() || null,
        status: "draft",
        template_type: "quick",
        basic_steps: basicSteps.filter((s) => s.trim()),
        participants: participants.filter((p) => p.trim()),
        metrics_summary: metricsSummary.trim() || null,
        connections: connections.trim() || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating process:", error);
      alert("Failed to create process: " + error.message);
      setSaving(false);
      return;
    }

    router.push(`/processes/${data.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#324a4d]">
          Create New Process
        </h1>
        <p className="text-gray-500 mt-1">
          Start with the Quick template — capture the basics now, add detail
          later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Process Name */}
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
            placeholder="e.g., Voice of Customer Process"
          />
        </div>

        {/* Category + Baldrige Item row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#324a4d] mb-1">
              Baldrige Category <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={categoryId}
              onChange={(e) =>
                setCategoryId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
            >
              <option value="">Select a category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#324a4d] mb-1">
              Baldrige Item{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={baldrigeItem}
              onChange={(e) => setBaldrigeItem(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
              placeholder="e.g., 3.1a"
            />
          </div>
        </div>

        {/* Owner */}
        <div>
          <label className="block text-sm font-medium text-[#324a4d] mb-1">
            Owner{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
            placeholder="e.g., Jon Malone"
          />
        </div>

        {/* Key Process Toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setIsKey(!isKey)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isKey ? "bg-[#f79935]" : "bg-gray-300"
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                isKey ? "translate-x-5" : ""
              }`}
            />
          </div>
          <span className="text-sm font-medium text-[#324a4d]">
            Key Process
          </span>
          <span className="text-xs text-gray-400">
            Key processes directly fulfill key requirements and need LeTCI scoring
          </span>
        </label>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[#324a4d] mb-1">
            What is this process?
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
            placeholder="Briefly describe what this process does and why it matters..."
          />
        </div>

        {/* Basic Steps */}
        <div>
          <label className="block text-sm font-medium text-[#324a4d] mb-1">
            How do we do it?{" "}
            <span className="text-gray-400 font-normal">(basic steps)</span>
          </label>
          <div className="space-y-2">
            {basicSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-gray-400 w-6 text-right">
                  {i + 1}.
                </span>
                <input
                  type="text"
                  value={step}
                  onChange={(e) => {
                    const updated = [...basicSteps];
                    updated[i] = e.target.value;
                    setBasicSteps(updated);
                  }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                  placeholder={`Step ${i + 1}...`}
                />
                {basicSteps.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setBasicSteps(basicSteps.filter((_, idx) => idx !== i))
                    }
                    className="text-red-400 hover:text-red-600 text-sm px-2"
                    title="Remove step"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setBasicSteps([...basicSteps, ""])}
              className="text-sm text-[#55787c] hover:text-[#324a4d] transition-colors font-medium"
            >
              + Add Step
            </button>
          </div>
        </div>

        {/* Participants */}
        <div>
          <label className="block text-sm font-medium text-[#324a4d] mb-1">
            Who&apos;s involved?{" "}
            <span className="text-gray-400 font-normal">
              (roles or names)
            </span>
          </label>
          <div className="space-y-2">
            {participants.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={p}
                  onChange={(e) => {
                    const updated = [...participants];
                    updated[i] = e.target.value;
                    setParticipants(updated);
                  }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                  placeholder={`e.g., CEO, HR Director...`}
                />
                {participants.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setParticipants(
                        participants.filter((_, idx) => idx !== i)
                      )
                    }
                    className="text-red-400 hover:text-red-600 text-sm px-2"
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setParticipants([...participants, ""])}
              className="text-sm text-[#55787c] hover:text-[#324a4d] transition-colors font-medium"
            >
              + Add Participant
            </button>
          </div>
        </div>

        {/* Metrics Summary */}
        <div>
          <label className="block text-sm font-medium text-[#324a4d] mb-1">
            How do we know it&apos;s working?
          </label>
          <textarea
            value={metricsSummary}
            onChange={(e) => setMetricsSummary(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
            placeholder="What metrics or indicators show this process is effective?"
          />
        </div>

        {/* Connections */}
        <div>
          <label className="block text-sm font-medium text-[#324a4d] mb-1">
            What does this connect to?
          </label>
          <textarea
            value={connections}
            onChange={(e) => setConnections(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
            placeholder="Related processes, strategic goals, or other systems..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#324a4d] text-white rounded-lg py-2 px-6 hover:opacity-90 disabled:opacity-50 font-medium"
          >
            {saving ? "Creating..." : "Create Process"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/processes")}
            className="bg-gray-200 text-[#324a4d] rounded-lg py-2 px-6 hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
