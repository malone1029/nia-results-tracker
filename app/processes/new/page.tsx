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
  const [isKey, setIsKey] = useState(false);
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
        is_key: isKey,
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
        <p className="text-gray-500 mt-1">
          Start with the basics, then use the edit page or AI to build out Charter and ADLI sections.
        </p>
      </div>

      {/* Create with AI option */}
      <Link
        href="/processes/new/ai"
        className="block bg-nia-dark/5 border-2 border-dashed border-nia-dark/20 rounded-xl p-5 hover:bg-nia-dark/10 hover:border-nia-dark/40 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-nia-dark flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a8 8 0 0 0-8 8c0 3.5 2.1 6.4 5 7.7V22l3-3 3 3v-4.3c2.9-1.3 5-4.2 5-7.7a8 8 0 0 0-8-8z" />
              <circle cx="9" cy="10" r="1" fill="white" />
              <circle cx="15" cy="10" r="1" fill="white" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-nia-dark">Create with AI</p>
            <p className="text-sm text-gray-500">
              Answer a few questions and AI builds a complete process with Charter and ADLI sections.
            </p>
          </div>
          <svg className="w-5 h-5 text-gray-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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

        {/* Key Process Toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setIsKey(!isKey)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isKey ? "bg-nia-orange" : "bg-gray-300"
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                isKey ? "translate-x-5" : ""
              }`}
            />
          </div>
          <span className="text-sm font-medium text-nia-dark">
            Key Process
          </span>
          <span className="text-xs text-gray-400">
            Key processes directly fulfill key requirements and need LeTCI scoring
          </span>
        </label>

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
