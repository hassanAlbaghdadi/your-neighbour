"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createCategoryAction, deleteCategoryAction } from "@/app/actions/categories";
import { slugify } from "@/lib/utils";
import type { Category } from "@/lib/services/products/get-products";

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) return;
    setSubmitting(true);
    const result = await createCategoryAction({
      name: name.trim(),
      slug: slugify(name),
      displayOrder: categories.length,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to create category.");
      return;
    }
    toast.success("Category added.");
    setName("");
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteCategoryAction(id);
    setDeletingId(null);
    if (!result.success) {
      toast.error(result.error ?? "Failed to delete category.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Badge key={category.id} variant="outline" className="gap-1 py-1">
            {category.name}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={deletingId === category.id}
                  aria-label={`Delete ${category.name}`}
                >
                  <X className="size-3" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {category.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This can&apos;t be undone. Products in this category
                    won&apos;t be deleted, but they&apos;ll lose their
                    category.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(category.id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Badge>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-56"
        />
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={submitting}>
          <Plus /> Add
        </Button>
      </div>
    </div>
  );
}
