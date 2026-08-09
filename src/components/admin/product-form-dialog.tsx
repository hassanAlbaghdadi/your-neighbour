"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { createProductAction, updateProductAction } from "@/app/actions/products";
import {
  productFormSchema,
  type ProductFormInput,
} from "@/lib/validations/product";
import { slugify } from "@/lib/utils";
import type { Category, Product } from "@/lib/services/products/get-products";

interface ProductFormDialogProps {
  categories: Category[];
  product?: Product;
  trigger: React.ReactNode;
}

export function ProductFormDialog({
  categories,
  product,
  trigger,
}: ProductFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!product);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProductFormInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      categoryId: product?.category_id ?? null,
      description: product?.description ?? "",
      price: product?.price ?? 0,
      isAvailable: product?.is_available ?? true,
      preparationNotice: product?.preparation_notice ?? "",
      allergens: product?.allergens ?? "",
      displayOrder: product?.display_order ?? 0,
    },
  });

  async function onSubmit(values: ProductFormInput) {
    setSubmitting(true);
    const result = product
      ? await updateProductAction(product.id, values)
      : await createProductAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "Something went wrong.");
      return;
    }
    toast.success(product ? "Product updated." : "Product created.");
    setOpen(false);
    if (!product) {
      reset();
      setSlugTouched(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "New Product"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                {...register("name")}
                onChange={(e) => {
                  setValue("name", e.target.value);
                  if (!slugTouched) {
                    setValue("slug", slugify(e.target.value));
                  }
                }}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="slug">Slug</FieldLabel>
              <Input
                id="slug"
                {...register("slug")}
                onChange={(e) => {
                  setSlugTouched(true);
                  setValue("slug", e.target.value);
                }}
              />
              <FieldError errors={[errors.slug]} />
            </Field>

            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Field>
              <FieldLabel htmlFor="price">Price</FieldLabel>
              <Input id="price" type="number" step="0.01" min={0} {...register("price")} />
              <FieldError errors={[errors.price]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" rows={3} {...register("description")} />
              <FieldError errors={[errors.description]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="allergens">Allergens</FieldLabel>
              <Input id="allergens" placeholder="Contains gluten, dairy" {...register("allergens")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="preparationNotice">Preparation notice</FieldLabel>
              <Input id="preparationNotice" {...register("preparationNotice")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="displayOrder">Display order</FieldLabel>
              <Input id="displayOrder" type="number" min={0} {...register("displayOrder")} />
            </Field>

            <Controller
              control={control}
              name="isAvailable"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="isAvailable">Available for order</FieldLabel>
                  <Switch
                    id="isAvailable"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : product ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
