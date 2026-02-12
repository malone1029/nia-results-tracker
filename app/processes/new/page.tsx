"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, Button, Input, Select } from "@/components/ui";
import { Textarea } from "@/components/ui/input";

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
  const [processType, setProcessType] = useState<"key" | "support" | "unclassified">("unclassified");
  const [description, setDescription] = useState("");

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
        process_type: processType,
        description: description.trim() || null,
        status: "draft",
        template_type: "full",
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
        <h1 className="text-3xl font-bold text-nia-dark">
          Create New Process
        </h1>
        <p className="text-text-tertiary mt-1">
          Start with the basics, then use the edit page or AI to build out Charter and ADLI sections.
        </p>
      </div>

      {/* Create with AI option */}
      <Link
        href="/processes/new/ai"
        className="block bg-nia-dark/5 border-2 border-dashed border-nia-dark/20 rounded-xl p-5 hover:bg-nia-dark/10 hover:border-nia-dark/40 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-nia-dark-solid flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a8 8 0 0 0-8 8c0 3.5 2.1 6.4 5 7.7V22l3-3 3 3v-4.3c2.9-1.3 5-4.2 5-7.7a8 8 0 0 0-8-8z" />
              <circle cx="9" cy="10" r="1" fill="white" />
              <circle cx="15" cy="10" r="1" fill="white" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-nia-dark">Create with AI</p>
            <p className="text-sm text-text-tertiary">
              Answer a few questions and AI builds a complete process with Charter and ADLI sections.
            </p>
          </div>
          <svg className="w-5 h-5 text-text-muted ml-auto flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </Link>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input label="Process Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Voice of Customer Process" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Baldrige Category" required value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Select a category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.display_name}</option>
            ))}
          </Select>
          <Input label="Baldrige Item" hint="optional" value={baldrigeItem} onChange={(e) => setBaldrigeItem(e.target.value)} placeholder="e.g., 3.1a" />
        </div>

        <Input label="Owner" hint="optional" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g., Jon Malone" />

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Process Type</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setProcessType("key")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                processType === "key" ? "bg-nia-orange/15 border-nia-orange text-nia-orange" : "bg-card border-border text-text-tertiary hover:text-text-secondary"
              }`}>★ Key Process</button>
            <button type="button" onClick={() => setProcessType("support")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                processType === "support" ? "bg-nia-grey-blue/15 border-nia-grey-blue text-nia-grey-blue" : "bg-card border-border text-text-tertiary hover:text-text-secondary"
              }`}>Support Process</button>
          </div>
          <p className="mt-1.5 text-xs text-text-muted">Key processes directly create value. Support processes enable key processes.</p>
        </div>

        <Textarea label="What is this process?" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Briefly describe what this process does and why it matters..." />

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving}>{saving ? "Creating..." : "Create Process"}</Button>
          <Button variant="ghost" onClick={() => router.push("/processes")}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
